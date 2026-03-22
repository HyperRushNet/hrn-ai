class AIClient {
  constructor(options = {}) {
    this.config = Object.freeze({
      apiKey: options.apiKey || null,
      model: options.model || 'openai',
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      width: options.width || 1024,
      height: options.height || 1024,
      history: [],
      historyLimit: options.historyLimit || 10,
      timeout: options.timeout || 60000,
      seed: options.seed ?? null,
      retry: options.retry !== undefined ? options.retry : true,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000
    });
    this._modelCache = null;
  }

  setHistory(h) {
    this.config.history = Array.isArray(h) ? h.slice(-this.config.historyLimit) : [];
    return this;
  }

  clearHistory() {
    this.config.history = [];
    return this;
  }

  async _getModelInfo() {
    if (this._modelCache) return this._modelCache.find(m => m.id === this.config.model);
    try {
      const res = await fetch('https://gen.pollinations.ai/v1/models', {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
      });
      if (!res.ok) throw new Error("Failed to fetch model list");
      const data = await res.json();
      this._modelCache = data.data || [];
      const modelInfo = this._modelCache.find(m => m.id === this.config.model);
      if (!modelInfo) return null;
      return modelInfo;
    } catch {
      return null;
    }
  }

  async generate(input, attempt = 0) {
    if (!input || typeof input !== 'string' || !input.trim()) throw new Error("Input prompt cannot be empty.");
    const modelInfo = await this._getModelInfo();
    let type = 'text';
    let endpoint = 'https://gen.pollinations.ai/v1/chat/completions';
    if (modelInfo) {
      const hasImage = modelInfo.output_modalities?.includes('image');
      const hasText = modelInfo.output_modalities?.includes('text');
      const supported = modelInfo.supported_endpoints || [];
      type = hasImage && !hasText ? 'image' : 'text';
      if (supported.length > 0) {
        const path = supported[0];
        endpoint = path.startsWith('http') ? path : `https://gen.pollinations.ai${path}`;
      }
    }
    if (type === 'image') endpoint = 'https://gen.pollinations.ai/v1/images/generations';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const activeSeed = this.config.seed ?? Math.floor(Math.random() * 1e9);
      const payload = type === 'image' ? {
        prompt: input,
        model: this.config.model,
        size: `${this.config.width}x${this.config.height}`,
        response_format: "b64_json",
        nologo: true,
        seed: activeSeed
      } : {
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.config.history,
          { role: 'user', content: input }
        ],
        seed: activeSeed
      };
      const headers = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      clearTimeout(timer);
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        if (this.config.retry && attempt < this.config.retryAttempts && retryable) {
          await new Promise(r => setTimeout(r, this.config.retryDelay));
          return this.generate(input, attempt + 1);
        }
        let errMsg = `API Error: ${response.status}`;
        try { const errJson = await response.json(); if (errJson.error?.message) errMsg = errJson.error.message } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (type === 'image') {
        if (!data?.data?.[0]?.b64_json) throw new Error("Invalid image response.");
        const b64 = data.data[0].b64_json;
        return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
      } else {
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("Invalid text response.");
        return content;
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        if (this.config.retry && attempt < this.config.retryAttempts) return this.generate(input, attempt + 1);
        throw new Error("AI Request Timeout");
      }
      throw err;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = AIClient;
