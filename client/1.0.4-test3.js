class AIClient {
  // Constructor gebruikt privado-achtige notatie (_) om aan te geven dat het intern is
  constructor(options = {}) {
    // We vriezen het object niet direct in, maar slaan het intern op
    this._config = {
      apiKey: options.apiKey || null,
      model: options.model || 'flux',
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      type: options.type === 'image' ? 'image' : 'text',
      width: options.width || 1024,
      height: options.height || 1024,
      history: options.history || [],
      historyLimit: options.historyLimit || 10,
      timeout: options.timeout || 30000,
      seed: options.seed || null,
      retry: options.retry !== undefined ? options.retry : true,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000
    };
  }

  // --- GETTERS (Read-only access) ---
  get apiKey() { return this._config.apiKey; }
  get model() { return this._config.model; }
  get systemPrompt() { return this._config.systemPrompt; }
  get type() { return this._config.type; }
  get width() { return this._config.width; }
  get height() { return this._config.height; }
  get history() { return this._config.history; }
  get historyLimit() { return this._config.historyLimit; }
  get timeout() { return this._config.timeout; }
  get seed() { return this._config.seed; }
  get retry() { return this._config.retry; }
  get retryAttempts() { return this._config.retryAttempts; }
  get retryDelay() { return this._config.retryDelay; }

  // --- SETTERS (Return NEW instance -> Immutable) ---
  
  setApiKey(k) {
    // Maak een kopie van de config en geef een nieuwe instantie terug
    return new AIClient({ ...this._config, apiKey: String(k) });
  }

  setModel(m) {
    return new AIClient({ ...this._config, model: String(m) });
  }

  setType(t) {
    return new AIClient({ ...this._config, type: t === 'image' ? 'image' : 'text' });
  }

  setSystemPrompt(p) {
    return new AIClient({ ...this._config, systemPrompt: String(p) });
  }

  setTimeout(ms) {
    return new AIClient({ ...this._config, timeout: Number(ms) || 30000 });
  }

  setSeed(s) {
    return new AIClient({ ...this._config, seed: s ? Number(s) : null });
  }

  setDimensions(w, h) {
    return new AIClient({
      ...this._config,
      width: Number(w) || 1024,
      height: Number(h) || 1024
    });
  }

  setRetry(bool, attempts = 2, delay = 1000) {
    return new AIClient({
      ...this._config,
      retry: !!bool,
      retryAttempts: Number(attempts),
      retryDelay: Number(delay)
    });
  }

  clearHistory() {
    // Geschiedenis leegmaken door een nieuwe array door te geven
    return new AIClient({ ...this._config, history: [] });
  }

  // --- GENERATE (Unchanged logic, operates on this._config) ---
  async generate(input, attempt = 0) {
    if (!this._config.apiKey) throw new Error("AIClient: API Key is required.");
    if (!input?.trim()) throw new Error("AIClient: Input prompt cannot be empty.");

    const isImg = this._config.type === 'image';
    const url = isImg ? 'https://gen.pollinations.ai/v1/images/generations' : 'https://gen.pollinations.ai/v1/chat/completions';
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._config.timeout);

    try {
      const activeSeed = this._config.seed || Math.floor(Math.random() * 1e9);
      const payload = isImg ? {
        prompt: input,
        model: this._config.model,
        width: this._config.width,
        height: this._config.height,
        nologo: true,
        response_format: "b64_json",
        seed: activeSeed
      } : {
        model: this._config.model,
        messages: [
          { role: 'system', content: this._config.systemPrompt },
          ...this._config.history,
          { role: 'user', content: input }
        ],
        seed: activeSeed
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${this._config.apiKey}` 
        },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      clearTimeout(timer);

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        if (this._config.retry && attempt < this._config.retryAttempts && retryable) {
          await new Promise(r => setTimeout(r, this._config.retryDelay));
          return this.generate(input, attempt + 1);
        }
        throw new Error(`AI API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (isImg) {
        const b64 = data.data[0].b64_json;
        return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
      } else {
        const content = data.choices[0].message.content;
        // Let op: Dit muteert WEL de interne history array.
        // Omdat 'setters' immutable zijn, behoud je wel de 'oude' versie van de client
        // als je de instantie vóór generate() opslaat.
        this._config.history.push({ role: 'user', content: input }, { role: 'assistant', content });
        if (this._config.history.length > this._config.historyLimit * 2) {
          this._config.history.splice(0, 2);
        }
        return content;
      }

    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        if (this._config.retry && attempt < this._config.retryAttempts) {
          return this.generate(input, attempt + 1);
        }
        throw new Error("AI Request Timeout");
      }
      throw err;
    }
  }
}
