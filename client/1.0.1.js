class AIClient {
  constructor() {
    this.config = {
      apiKey: null,
      model: null,
      systemPrompt: 'You are a helpful assistant.',
      type: 'text',
      width: 1024,
      height: 1024,
      history: []
    };
  }

  setApiKey(key) {
    if (!key) throw new Error("API Key required");
    this.config.apiKey = key;
    return this;
  }

  setModel(modelId) {
    if (!modelId) throw new Error("Model ID required");
    this.config.model = modelId;
    return this;
  }

  setSystemPrompt(prompt) {
    if (prompt && typeof prompt === 'string') {
      this.config.systemPrompt = prompt;
    }
    return this;
  }

  setType(type) {
    if (type === 'text' || type === 'image') {
      this.config.type = type;
    }
    return this;
  }

  setWidth(width) {
    this.config.width = parseInt(width);
    return this;
  }

  setHeight(height) {
    this.config.height = parseInt(height);
    return this;
  }

  async generate(input) {
    if (!this.config.apiKey || !this.config.model || !input) {
      throw new Error("Missing credentials or input");
    }
    return this.config.type === 'image' ? await this._genImg(input) : await this._genTxt(input);
  }

  async _genTxt(prompt) {
    const messages = [
      { role: 'system', content: this.config.systemPrompt },
      ...this.config.history,
      { role: 'user', content: prompt }
    ];

    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Error: ${response.status}`);
    }

    const content = data.choices[0].message.content;

    this.config.history.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: content }
    );

    return content;
  }

  async _genImg(prompt) {
    const params = new URLSearchParams({
      key: this.config.apiKey,
      model: this.config.model,
      width: this.config.width,
      height: this.config.height,
      nologo: 'true'
    });

    const response = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params}`);

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.blob();
  }

  clearHistory() {
    this.config.history = [];
    return this;
  }
}
