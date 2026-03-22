class AIClient extends EventTarget {
  static _chatIds = new Set();

  constructor(options = {}) {
    super();

    // Verplicht: apiKey en model
    if (!options.apiKey) throw new Error("AIClient fout: 'apiKey' is verplicht!");
    if (!options.model) throw new Error("AIClient fout: 'model' is verplicht!");

    this.config = {
      apiKey: options.apiKey,
      model: options.model,
      systemPrompt: options.systemPrompt || "Je bent een behulpzame assistent.",
      width: options.width || 1024,
      height: options.height || 1024,
      historyLimit: options.historyLimit || 10,
      timeout: options.timeout || 60000,
      retry: options.retry !== undefined ? options.retry : true,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000,
      chatId: options.chatId ?? null,
      stream: options.stream ?? false,
      isImage: options.isImage ?? false,
      history: []
    };

    if (this.config.chatId) {
      if (AIClient._chatIds.has(this.config.chatId)) {
        throw new Error(`AIClient fout: chatId "${this.config.chatId}" bestaat al.`);
      }
      AIClient._chatIds.add(this.config.chatId);
    }
  }

  clearHistory() {
    this.config.history = [];
    return this;
  }

  async generate(input) {
    if (!input?.trim()) throw new Error("AIClient fout: prompt kan niet leeg zijn.");

    const type = this.config.isImage ? "image" : "text";
    const endpoint = type === "image"
      ? "https://gen.pollinations.ai/v1/images/generations"
      : "https://gen.pollinations.ai/v1/chat/completions";

    let attempts = 0;
    const maxAttempts = this.config.retry ? this.config.retryAttempts : 1;

    while (attempts < maxAttempts) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const headers = { "Content-Type": "application/json" };
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;

        if (type === "image") {
          const payload = {
            prompt: input,
            model: this.config.model,
            size: `${this.config.width}x${this.config.height}`,
            response_format: "b64_json",
            nologo: true
          };

          const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`API fout: ${res.status} ${res.statusText}`);

          const data = await res.json();
          const b64 = data?.data?.[0]?.b64_json;
          if (!b64) throw new Error("AIClient fout: Geen geldige afbeelding ontvangen.");

          const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: "image/png" });
          this._dispatch(blob, false);

        } else {
          const payload = {
            model: this.config.model,
            messages: [
              { role: "system", content: this.config.systemPrompt },
              ...this.config.history,
              { role: "user", content: input }
            ],
            stream: this.config.stream
          };

          const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
          if (!res.ok) throw new Error(`API fout: ${res.status} ${res.statusText}`);

          if (this.config.stream) {
            await this._handleStream(res.body);
          } else {
            clearTimeout(timer);
            const data = await res.json();
            const content = data?.choices?.[0]?.message?.content;
            if (!content) throw new Error("AIClient fout: Geen tekstrespons ontvangen.");
            this._dispatch(content, false);
          }
        }

        return; // Succesvol, stoppen met retry

      } catch (err) {
        clearTimeout(timer);
        attempts++;

        if (err.name === "AbortError") {
          if (attempts >= maxAttempts) throw new Error("AIClient fout: request timeout.");
        } else if (attempts >= maxAttempts) {
          throw new Error(`AIClient fout: ${err.message}`);
        } else {
          console.warn(`Retry ${attempts}/${maxAttempts} na fout:`, err.message);
          await new Promise(r => setTimeout(r, this.config.retryDelay));
        }
      }
    }
  }

  // Stream afhandeling
  async _handleStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const message = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
        if (message === "[DONE]") {
          this._dispatch(false, true);
          return;
        }

        try {
          const parsed = JSON.parse(message);
          const content = parsed?.choices?.[0]?.delta?.content;
          if (content) this._dispatch(content, true);
        } catch (e) {
          console.warn("AIClient stream parse fout:", e);
        }
      }
    }
    this._dispatch(false, true);
  }

  // Event dispatch helper
  _dispatch(data, stream) {
    this.dispatchEvent(new CustomEvent("message", { detail: { data, chatId: this.config.chatId, stream } }));
  }

  destroy() {
    if (this.config.chatId) AIClient._chatIds.delete(this.config.chatId);
  }
}
