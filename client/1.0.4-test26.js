/**
 * AIClient v1.0
 * Robust, zero-dependency JavaScript class for Pollinations AI API.
 * Supports Text, Image, Streaming, History, and Auto-Detection.
 */
(function(global) {

  const FALLBACK_IMAGE_MODELS = new Set([
    'flux', 'zimage', 'kontext', 'nanobanana', 'nanobanana-2', 'nanobanana-pro',
    'seedream5', 'gptimage', 'gptimage-large', 'klein', 'p-image', 'p-image-edit',
    'veo', 'seedance', 'seedance-pro', 'wan', 'p-video'
  ]);

  class AIClient extends EventTarget {
    
    constructor(options = {}) {
      super();
      
      this._config = {
        apiKey: options.apiKey || null,
        model: options.model || 'openai',
        systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
        historyLimit: options.historyLimit !== undefined ? options.historyLimit : 10,
        stream: options.stream || false,
        timeout: options.timeout || 60000,
        seed: options.seed !== undefined ? options.seed : null,
        width: options.width || 1024,
        height: options.height || 1024,
        retry: options.retry !== undefined ? options.retry : true,
        retryAttempts: options.retryAttempts || 2,
        retryDelay: options.retryDelay || 1000
      };

      this.history = [];
      this._modelCache = null;
    }

    key(k) { this._config.apiKey = k; return this; }
    model(m) { this._config.model = m; return this; }
    prompt(p) { this._config.systemPrompt = p; return this; }
    timeout(t) { this._config.timeout = t; return this; }
    seed(s) { this._config.seed = s; return this; }
    dimensions(w, h) { this._config.width = w; this._config.height = h; return this; }

    clearHistory() {
      this.history = [];
    }

    async _fetchModelList() {
      if (this._modelCache) return this._modelCache;
      try {
        const res = await fetch('https://gen.pollinations.ai/v1/models');
        if (!res.ok) throw new Error();
        const data = await res.json();
        this._modelCache = data.data || [];
        return this._modelCache;
      } catch {
        return [];
      }
    }

    async _isImageModel(modelId) {
      const models = await this._fetchModelList();
      const currentModel = models.find(m => m.id === modelId);
      
      if (currentModel && currentModel.output_modalities) {
        return currentModel.output_modalities.includes('image');
      }
      
      return FALLBACK_IMAGE_MODELS.has(modelId.toLowerCase());
    }

    async generate(prompt, options = {}) {
      if (!prompt) throw new Error("Prompt required");

      const cfg = { ...this._config, ...options };

      if (!cfg.apiKey) throw new Error("Key required");

      const targetModel = cfg.model;
      const isImage = await this._isImageModel(targetModel);

      if (isImage) {
        return this._generateImage(prompt, cfg);
      } else {
        return this._generateText(prompt, cfg);
      }
    }

    async _generateText(prompt, cfg) {
      const messages = [
        { role: 'system', content: cfg.systemPrompt },
        ...this.history,
        { role: 'user', content: prompt }
      ];

      const payload = {
        model: cfg.model,
        messages: messages,
        stream: cfg.stream,
        seed: cfg.seed ?? Math.floor(Math.random() * 1e9)
      };

      const endpoint = 'https://gen.pollinations.ai/v1/chat/completions';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      };

      return this._retry(cfg, async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), cfg.timeout);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });

        clearTimeout(t);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        if (cfg.stream) {
          return this._handleStream(res, prompt, cfg);
        } else {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (!text) throw new Error("Invalid response");
          this._addToHistory(prompt, text, cfg.historyLimit);
          return text;
        }
      });
    }

    async _handleStream(res, prompt, cfg) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); 

        for (const line of lines) {
          const str = line.trim();
          if (!str.startsWith('data: ')) continue;
          
          const json = str.slice(6);
          if (json === '[DONE]') continue;

          try {
            const d = JSON.parse(json);
            const chunk = d.choices?.[0]?.delta?.content;
            if (chunk) {
              fullText += chunk;
              if (cfg.onStream) cfg.onStream(chunk);
              this.dispatchEvent(new CustomEvent('chunk', { detail: { data: chunk } }));
            }
          } catch {}
        }
      }

      this._addToHistory(prompt, fullText, cfg.historyLimit);
      return fullText;
    }

    async _generateImage(prompt, cfg) {
      const payload = {
        model: cfg.model,
        prompt: prompt,
        size: `${cfg.width}x${cfg.height}`,
        response_format: 'b64_json',
        seed: cfg.seed ?? Math.floor(Math.random() * 1e9)
      };

      const endpoint = 'https://gen.pollinations.ai/v1/images/generations';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      };

      return this._retry(cfg, async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), cfg.timeout);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });

        clearTimeout(t);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `Image Error ${res.status}`);
        }

        const data = await res.json();
        const imgData = data.data?.[0];

        if (imgData?.b64_json) {
          return this._b64ToBlob(imgData.b64_json);
        } else if (imgData?.url) {
          const imgRes = await fetch(imgData.url);
          return imgRes.blob();
        }

        throw new Error("Invalid image response");
      });
    }

    _addToHistory(user, ai, limit) {
      if (limit === 0) return;
      this.history.push({ role: 'user', content: user });
      this.history.push({ role: 'assistant', content: ai });
      while (this.history.length > limit * 2) {
        this.history.shift();
        this.history.shift();
      }
    }

    _b64ToBlob(b64) {
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return new Blob([arr], { type: 'image/png' });
    }

    async _retry(cfg, fn) {
      let lastErr;
      const attempts = cfg.retry ? cfg.retryAttempts : 1;
      
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (e.name === 'AbortError') throw new Error("AI Request Timeout");
          if (i < attempts - 1) await new Promise(r => setTimeout(r, cfg.retryDelay));
        }
      }
      throw lastErr;
    }
  }

  global.AIClient = AIClient;

})(window);
