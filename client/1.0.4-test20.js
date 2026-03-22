class AIClient extends EventTarget {
  static usedChatIds = new Set();
  static cachedModels = null;

  static async fetchModels() {
    if (AIClient.cachedModels) return AIClient.cachedModels;

    const response = await fetch("https://gen.pollinations.ai/v1/models");
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    AIClient.cachedModels = data?.data || [];
    return AIClient.cachedModels;
  }

  constructor(options = {}) {
    super();

    this.config = {
      chatId: null,
      history: [],
      systemPrompt: "You are a helpful assistant.",
      model: "openai",
      apiKey: null,
      width: 1024,
      height: 1024,
      timeout: 60000,
      retry: true,
      retryAttempts: 2,
      retryDelay: 1000,
      stream: false,
      ...options
    };

    if (this.config.chatId) {
      if (AIClient.usedChatIds.has(this.config.chatId)) {
        throw new Error(`chatId "${this.config.chatId}" already in use`);
      }
      AIClient.usedChatIds.add(this.config.chatId);
    }
  }

  async resolveModelType() {
    const models = await AIClient.fetchModels();

    const model = models.find(m => m.id === this.config.model);
    if (!model) {
      throw new Error(`Model "${this.config.model}" not found`);
    }

    return model.input_modalities.includes("image") ? "image" : "text";
  }

  clearHistory() {
    this.config.history = [];
    return this;
  }

  async generate(prompt) {
    if (!prompt || !prompt.trim()) {
      throw new Error("Prompt cannot be empty");
    }

    const modelType = await this.resolveModelType();

    const endpoint = modelType === "image"
      ? "https://gen.pollinations.ai/v1/images/generations"
      : "https://gen.pollinations.ai/v1/chat/completions";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      return await this._attemptRequest(prompt, endpoint, modelType, controller);
    } finally {
      clearTimeout(timeoutId);
      if (this.config.chatId) {
        AIClient.usedChatIds.delete(this.config.chatId);
      }
    }
  }

  async _attemptRequest(prompt, endpoint, modelType, controller, attempt = 0) {
    try {
      return await this._makeRequest(prompt, endpoint, modelType, controller);
    } catch (error) {
      if (
        this.config.retry &&
        attempt < this.config.retryAttempts
      ) {
        await new Promise(res => setTimeout(res, this.config.retryDelay));
        return this._attemptRequest(prompt, endpoint, modelType, controller, attempt + 1);
      }

      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }

      throw error;
    }
  }

  async _makeRequest(prompt, endpoint, modelType, controller) {
    const headers = {
      "Content-Type": "application/json"
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    if (modelType === "image") {
      return this._handleImage(prompt, endpoint, headers, controller);
    } else {
      return this._handleText(prompt, endpoint, headers, controller);
    }
  }

  async _handleImage(prompt, endpoint, headers, controller) {
    const body = {
      prompt,
      model: this.config.model,
      size: `${this.config.width}x${this.config.height}`,
      response_format: "b64_json",
      nologo: true
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Image API error: ${response.status}`);
    }

    const data = await response.json();
    const base64 = data?.data?.[0]?.b64_json;

    if (!base64) {
      throw new Error("Invalid image response");
    }

    const blob = this._base64ToBlob(base64);

    this._emit(blob, false);
    return blob;
  }

  async _handleText(prompt, endpoint, headers, controller) {
    const body = {
      model: this.config.model,
      messages: [
        { role: "system", content: this.config.systemPrompt },
        ...this.config.history,
        { role: "user", content: prompt }
      ],
      stream: this.config.stream
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Text API error: ${response.status}`);
    }

    if (this.config.stream) {
      return this._handleStreaming(response);
    } else {
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("Invalid text response");
      }

      this._updateHistory(prompt, text);
      this._emit(text, false);

      return text;
    }
  }

  async _handleStreaming(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const clean = line.trim();
        if (!clean) continue;

        const jsonStr = clean.startsWith("data: ")
          ? clean.slice(6)
          : clean;

        if (jsonStr === "[DONE]") {
          this._emit(false, true);
          return fullText;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const chunk = parsed?.choices?.[0]?.delta?.content;

          if (chunk) {
            fullText += chunk;
            this._emit(chunk, true);
          }
        } catch {}
      }
    }

    this._emit(false, true);
    return fullText;
  }

  _updateHistory(userPrompt, aiResponse) {
    this.config.history.push(
      { role: "user", content: userPrompt },
      { role: "assistant", content: aiResponse }
    );
  }

  _emit(data, isStreaming) {
    this.dispatchEvent(new CustomEvent("message", {
      detail: {
        data,
        chatId: this.config.chatId,
        stream: isStreaming
      }
    }));
  }

  _base64ToBlob(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: "image/png" });
  }

  destroy() {
    if (this.config.chatId) {
      AIClient.usedChatIds.delete(this.config.chatId);
    }
  }
}
