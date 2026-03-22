class AIClient extends EventTarget {
  static _chatIds = new Set();

  constructor(options = {}) {
    super();
    const immutableConfig = Object.freeze({
      apiKey: options.apiKey || null,
      model: options.model || 'openai',
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      width: options.width || 1024,
      height: options.height || 1024,
      historyLimit: options.historyLimit || 10,
      timeout: options.timeout || 60000,
      seed: options.seed ?? null,
      retry: options.retry !== undefined ? options.retry : true,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000,
      chatId: options.chatId ?? null,
      stream: options.stream ?? false
    });

    if (immutableConfig.chatId) {
      if (AIClient._chatIds.has(immutableConfig.chatId)) {
        throw new Error(`chatId "${immutableConfig.chatId}" already exists`);
      }
      AIClient._chatIds.add(immutableConfig.chatId);
    }

    this.config = { ...immutableConfig, history: [] };
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
      const res = await fetch('https://gen.pollinations.ai/v1/models'); // no API key
      if (!res.ok) throw new Error("Failed to fetch model list");
      const data = await res.json();
      this._modelCache = data.data || [];
      return this._modelCache.find(m => m.id === this.config.model) || null;
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
    const activeSeed = this.config.seed ?? Math.floor(Math.random() * 1e9);

    try {
      if (type === 'image') {
        const payload = {
          prompt: input,
          model: this.config.model,
          size: `${this.config.width}x${this.config.height}`,
          response_format: "b64_json",
          nologo: true,
          seed: activeSeed
        };
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        if (!data?.data?.[0]?.b64_json) throw new Error("Invalid image response.");
        const b64 = data.data[0].b64_json;
        const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
        this.dispatchEvent(new CustomEvent("message", { detail: { data: blob, chatId: this.config.chatId, stream: false } }));
      } else {
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        if (this.config.stream) {
          const payload = {
            model: this.config.model,
            messages: [
              { role: 'system', content: this.config.systemPrompt },
              ...this.config.history,
              { role: 'user', content: input }
            ],
            stream: true,
            seed: activeSeed,
            response_format: { type: "json_object" }
          };
          const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
          if (!res.ok) throw new Error(`API Error: ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const chunkText = decoder.decode(value, { stream: true });
              const lines = chunkText.split(/\r?\n/).filter(Boolean);
              for (const line of lines) {
                if (line.trim() === '[DONE]') {
                  this.dispatchEvent(new CustomEvent("message", { detail: { data: false, chatId: this.config.chatId, stream: true } }));
                } else {
                  try {
                    const parsed = JSON.parse(line);
                    const content = parsed?.choices?.[0]?.delta?.content ?? '';
                    if (content) this.dispatchEvent(new CustomEvent("message", { detail: { data: content, chatId: this.config.chatId, stream: true } }));
                  } catch {}
                }
              }
            }
          }
        } else {
          const payload = {
            model: this.config.model,
            messages: [
              { role: 'system', content: this.config.systemPrompt },
              ...this.config.history,
              { role: 'user', content: input }
            ],
            seed: activeSeed
          };
          const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`API Error: ${res.status}`);
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (!content) throw new Error("Invalid text response.");
          this.dispatchEvent(new CustomEvent("message", { detail: { data: content, chatId: this.config.chatId, stream: false } }));
        }
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error("AI Request Timeout");
      throw err;
    } finally {
      if (this.config.chatId) AIClient._chatIds.delete(this.config.chatId);
    }
  }

  destroy() {
    if (this.config.chatId) AIClient._chatIds.delete(this.config.chatId);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = AIClient;
