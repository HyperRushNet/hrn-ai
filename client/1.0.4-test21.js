(function(global) {
  'use strict';

  class AIClient {
    static _chatIds = new Set();

    constructor(options = {}) {
      const cfg = {
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
        stream: options.stream ?? false,
        baseUrl: options.baseUrl || 'https://gen.pollinations.ai' 
      };

      if (cfg.chatId) {
        if (AIClient._chatIds.has(cfg.chatId)) {
          throw new Error(`chatId "${cfg.chatId}" already exists`);
        }
        AIClient._chatIds.add(cfg.chatId);
      }

      this.config = { ...cfg, history: [] };
    }

    _getHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      return headers;
    }

    async generate(prompt, options = {}) {
      if (!prompt || typeof prompt !== 'string') throw new Error('Prompt required');

      const streamOpt = options.stream !== undefined ? options.stream : this.config.stream;
      const onStream = typeof options.onStream === 'function' ? options.onStream : null;

      const payload = {
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.config.history,
          { role: 'user', content: prompt }
        ],
        stream: streamOpt,
        seed: this.config.seed,
        temperature: options.temperature ?? 0.7
      };

      const executeRequest = async (attempt = 1) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timer);

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error ${res.status}: ${errText}`);
          }

          if (streamOpt && res.body) {
            return await this._handleStreamResponse(res.body, onStream, prompt);
          } else {
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content;
            if (!text) throw new Error('Invalid response');
            this._updateHistory(prompt, text);
            return text;
          }
        } catch (e) {
          clearTimeout(timer);
          if (e.name === 'AbortError') throw new Error('Request timed out');
          if (this.config.retry && attempt < this.config.retryAttempts) {
            await new Promise(r => setTimeout(r, this.config.retryDelay));
            return executeRequest(attempt + 1);
          }
          throw e;
        }
      };

      return executeRequest();
    }

    async _handleStreamResponse(body, onStream, prompt) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (let line of lines) {
          line = line.trim();
          if (!line || !line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed?.choices?.[0]?.delta?.content;
            if (chunk) {
              fullText += chunk;
              if (onStream) onStream(chunk);
            }
          } catch (e) {
            // Ignore incomplete chunks
          }
        }
      }
      
      this._updateHistory(prompt, fullText);
      return null;
    }

    async generateImage(prompt, options = {}) {
      if (!prompt) throw new Error('Prompt required');
      
      const payload = {
        prompt: prompt,
        model: options.model || 'flux',
        size: options.size || `${this.config.width}x${this.config.height}`,
        // FIX: Forceer URL output, dit is veel stabieler voor <img> tags
        response_format: "url", 
        seed: options.seed ?? this.config.seed
      };

      try {
        const res = await fetch(`${this.config.baseUrl}/v1/images/generations`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Image API Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const imgData = data.data?.[0];

        // FIX: Handle zowel URL als Base64 output correct
        if (imgData.url) {
          return imgData.url;
        } else if (imgData.b64_json) {
          // Als het toch base64 is, maak er een data URI van
          return `data:image/jpeg;base64,${imgData.b64_json}`;
        } else {
          throw new Error("No image data returned");
        }
      } catch (e) {
        throw e;
      }
    }

    _updateHistory(userMsg, assistantMsg) {
      if (!userMsg || !assistantMsg) return;
      this.config.history.push({ role: 'user', content: userMsg });
      this.config.history.push({ role: 'assistant', content: assistantMsg });
      while (this.config.history.length > this.config.historyLimit * 2) {
        this.config.history.shift();
        this.config.history.shift();
      }
    }

    clearHistory() {
      this.config.history = [];
    }

    destroy() {
      if (this.config.chatId) AIClient._chatIds.delete(this.config.chatId);
    }
  }

  global.AIClient = AIClient;

})(window);
