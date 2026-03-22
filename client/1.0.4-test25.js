(function(global) {
  'use strict';

  class AIClient {
    // Statische cache voor modellen (gedeeld over alle instanties, slechts 1x ophalen)
    static _cache = { models: null, fetched: false };

    constructor(options = {}) {
      // 1. Gestroomlijnde, centrale configuratie
      this.cfg = {
        key: options.apiKey || null,
        model: options.model || 'openai',
        prompt: options.systemPrompt || 'You are a helpful assistant.',
        width: options.width || 1024,
        height: options.height || 1024,
        limit: options.historyLimit || 10,
        timeout: options.timeout || 60000,
        seed: options.seed ?? null,
        retry: options.retry ?? 2,
        delay: options.retryDelay || 1000,
        stream: options.stream ?? false,
        history: []
      };

      // 2. Start model cache update op de achtergrond (non-blocking)
      this._syncModels();
    }

    // Lazy loading van models
    async _syncModels() {
      if (AIClient._cache.fetched) return;
      try {
        if (!AIClient._cache.models) {
           const res = await fetch('https://gen.pollinations.ai/v1/models');
           const data = await res.json();
           AIClient._cache.models = data.data || [];
           AIClient._cache.fetched = true;
        }
      } catch(e) {
        // console.warn("Model sync failed, using heuristics.");
        AIClient._cache.fetched = true; 
      }
    }

    async _getType(modelId) {
      if (!AIClient._cache.fetched) await this._syncModels();
      
      const info = (AIClient._cache.models || []).find(m => m.id === modelId);
      if (info?.output_modalities?.includes('image')) return 'image';
      
      // Smart Fallback
      if (['flux', 'zimage', 'kontext', 'gptimage', 'seedream5'].includes(modelId)) return 'image';
      
      return 'text';
    }

    // --- Method Chaining Helpers (Corrected Syntax) ---
    key(k) { this.cfg.key = k; return this; }
    model(m) { this.cfg.model = m; return this; }
    prompt(p) { this.cfg.prompt = p; return this; }
    timeout(t) { this.cfg.timeout = t; return this; }
    seed(s) { this.cfg.seed = s; return this; }
    dimensions(w, h) { this.cfg.width = w; this.cfg.height = h; return this; }

    // --- History Management ---
    clearHistory() { 
      this.cfg.history = []; 
      return this; 
    }

    // Core Generator
    async generate(input, opts = {}) {
      if (!this.cfg.key) throw new Error("Key required");
      
      const model = opts.model || this.cfg.model;
      const type = await this._getType(model);
      const isImg = type === 'image';
      const isStream = !isImg && (opts.stream ?? this.cfg.stream);
      
      if (isStream) return this._stream(input, model, opts.onStream);
      if (isImg) return this._image(input, model, opts);
      return this._text(input, model, opts);
    }

    // Internal Request Handler
    async _exec(url, payload, timeout) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${this.cfg.key}` 
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      
      clearTimeout(timer);
      return res;
    }

    // Image Logic
    async _image(input, model, opts) {
      const url = 'https://gen.pollinations.ai/v1/images/generations';
      const payload = {
        prompt: input,
        model: model,
        width: opts.width || this.cfg.width,
        height: opts.height || this.cfg.height,
        response_format: "b64_json",
        seed: opts.seed ?? this.cfg.seed ?? Math.floor(Math.random() * 1e9)
      };

      let res = await this._exec(url, payload, this.cfg.timeout);
      let attempts = 0;

      while (!res.ok && attempts < this.cfg.retry) {
        await new Promise(r => setTimeout(r, this.cfg.delay));
        res = await this._exec(url, payload, this.cfg.timeout);
        attempts++;
      }

      if (!res.ok) throw new Error(`Image Error: ${res.status}`);
      
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image data");
      
      return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
    }

    // Text Logic (Non-stream)
    async _text(input, model, opts) {
      const url = 'https://gen.pollinations.ai/v1/chat/completions';
      const payload = {
        model: model,
        messages: [
          { role: 'system', content: this.cfg.prompt },
          ...this.cfg.history,
          { role: 'user', content: input }
        ],
        seed: opts.seed ?? this.cfg.seed ?? Math.floor(Math.random() * 1e9)
      };

      const res = await this._exec(url, payload, this.cfg.timeout);
      if (!res.ok) throw new Error(`Text Error: ${res.status}`);
      
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      
      this._updateHistory(input, content);
      return content;
    }

    // Stream Logic
    async _stream(input, model, onStream) {
      const url = 'https://gen.pollinations.ai/v1/chat/completions';
      const payload = {
        model: model,
        messages: [
          { role: 'system', content: this.cfg.prompt },
          ...this.cfg.history,
          { role: 'user', content: input }
        ],
        stream: true,
        seed: this.cfg.seed ?? Math.floor(Math.random() * 1e9)
      };

      const res = await this._exec(url, payload, this.cfg.timeout);
      if (!res.ok) throw new Error(`Stream Error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (let line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const p = JSON.parse(json);
            const chunk = p.choices?.[0]?.delta?.content;
            if (chunk) {
              fullText += chunk;
              if (onStream) onStream(chunk);
            }
          } catch (e) {}
        }
      }
      
      this._updateHistory(input, fullText);
      return null;
    }

    // Central History Updater
    _updateHistory(userInput, assistantOutput) {
      if (this.cfg.limit === 0) return; // No history mode
      
      this.cfg.history.push({ role: 'user', content: userInput });
      this.cfg.history.push({ role: 'assistant', content: assistantOutput });
      
      if (this.cfg.history.length > this.cfg.limit * 2) {
        this.cfg.history.splice(0, 2);
      }
    }
  }

  global.AIClient = AIClient;

})(window);
