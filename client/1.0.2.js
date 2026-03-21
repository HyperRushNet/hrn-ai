class AIClient {
  constructor() {
    this.config = {
      apiKey: null, model: 'flux', systemPrompt: 'You are a helpful assistant.',
      type: 'text', width: 1024, height: 1024,
      history: [], historyLimit: 10, timeout: 30000,
      seed: null, retry: false, retryAttempts: 2, retryDelay: 1000,
      onBeforeRequest: null, onAfterResponse: null
    };
  }

  setApiKey(k) { this.config.apiKey = String(k); return this; }
  setModel(m) { this.config.model = String(m); return this; }
  setType(t) { this.config.type = t === 'image' ? 'image' : 'text'; return this; }
  setSystemPrompt(p) { this.config.systemPrompt = String(p); return this; }
  setTimeout(ms) { this.config.timeout = Number(ms) || 30000; return this; }
  setSeed(s) { this.config.seed = s ? Number(s) : null; return this; }
  setRetry(bool, attempts = 2, delay = 1000) {
    this.config.retry = !!bool;
    this.config.retryAttempts = Number(attempts);
    this.config.retryDelay = Number(delay);
    return this;
  }
  setHooks(before, after) {
    this.config.onBeforeRequest = before;
    this.config.onAfterResponse = after;
    return this;
  }
  setDimensions(w, h) {
    this.config.width = Math.max(128, Math.min(2048, Number(w) || 1024));
    this.config.height = Math.max(128, Math.min(2048, Number(h) || 1024));
    return this;
  }
  clearHistory() { this.config.history = []; return this; }

  _wait(ms) { return new Promise(res => setTimeout(res, ms)); }

  _err(msg, status = 0, url = "N/A") {
    return { error: true, message: msg, status, url, timestamp: Date.now() };
  }

  async generate(input, attempt = 0) {
    const isImg = this.config.type === 'image';
    const url = isImg ? 'https://gen.pollinations.ai/v1/images/generations' : 'https://gen.pollinations.ai/v1/chat/completions';

    if (!this.config.apiKey) return this._err("API Key missing", 401, url);
    if (!input?.trim()) return this._err("Input prompt is empty", 400, url);

    if (this.config.onBeforeRequest) this.config.onBeforeRequest({ input, attempt, config: { ...this.config } });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const activeSeed = this.config.seed || Math.floor(Math.random() * 1e9);
      const payload = isImg ? {
        prompt: input, model: this.config.model, width: this.config.width, height: this.config.height,
        nologo: true, response_format: "b64_json", seed: activeSeed
      } : {
        model: this.config.model, seed: activeSeed,
        messages: [{ role: 'system', content: this.config.systemPrompt }, ...this.config.history, { role: 'user', content: input }]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      clearTimeout(timer);

      if (!response.ok) {
        const fatal = [400, 401, 403, 404];
        if (this.config.retry && attempt < this.config.retryAttempts && !fatal.includes(response.status)) {
          await this._wait(this.config.retryDelay);
          return this.generate(input, attempt + 1);
        }
        return this._err(`Request failed: ${response.statusText}`, response.status, url);
      }

      const data = await response.json();
      let result;

      if (isImg) {
        const b64 = data.data[0].b64_json;
        const mime = b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
        result = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: mime });
      } else {
        result = data.choices[0].message.content;
        this.config.history.push({ role: 'user', content: input }, { role: 'assistant', content: result });
        while (this.config.history.length > this.config.historyLimit * 2) this.config.history.shift();
      }

      if (this.config.onAfterResponse) this.config.onAfterResponse({ result, seed: activeSeed });
      return { error: false, data: result, seed: activeSeed };

    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError' && this.config.retry && attempt < this.config.retryAttempts) {
        await this._wait(this.config.retryDelay);
        return this.generate(input, attempt + 1);
      }
      return this._err(e.name === 'AbortError' ? "Timeout" : e.message, 0, url);
    }
  }
}
