/**
 * AIChat Library
 * Lichtgewicht streaming AI chat met automatische Markdown + code highlighting + MathJax
 *
 * @example
 * const ai = new AIChat({
 *   apiKey: 'jouw-api-key',
 *   model: 'gemini-search',
 *   enableMarkdown: true,      // default: true
 *   enableMathJax: true,       // default: true
 *   enableHighlightJS: true,   // default: true
 *   autoContinue: true
 * });
 *
 * ai.addEventListener('chunk', e => {
 *   // e.detail → raw tekst chunk
 *   document.getElementById('chat').innerHTML += ai.parse(e.detail);
 * });
 */
class AIChat extends EventTarget {
  constructor(options = {}) {
    super();

    // Config
    this.apiBase      = options.apiBase      || "https://gen.pollinations.ai";
    this.apiKey       = options.apiKey       || localStorage.getItem("pk") || "";
    this.model        = options.model        || "gemini-search";
    this.systemPrompt = options.systemPrompt || "You are a helpful assistant.";

    this.enableMarkdown    = options.enableMarkdown    !== false;
    this.enableMathJax     = options.enableMathJax     !== false;
    this.enableHighlightJS = options.enableHighlightJS !== false;
    this.autoContinue      = options.autoContinue      !== false;

    // State
    this.abortController = null;
    this._librariesLoaded = false;

    // Lazy init parsers & libs
    this._parser = null;
  }

  /**
   * Laadt Highlight.js en MathJax (indien ingeschakeld) één keer
   * @private
   */
  async _ensureLibraries() {
    if (this._librariesLoaded) return;
    this._librariesLoaded = true;

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

    const promises = [];

    if (this.enableHighlightJS) {
      promises.push(
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js")
      );
      // Optioneel: extra talen laden
      // promises.push(loadScript("https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js"));
    }

    if (this.enableMathJax) {
      promises.push(
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js")
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises).catch(err => {
        console.warn("Kon niet alle externe libraries laden", err);
      });
    }

    // Highlight.js configuratie na laden
    if (this.enableHighlightJS && window.hljs) {
      window.hljs.configure({ ignoreUnescapedHTML: true });
      // window.hljs.registerLanguage('...') indien nodig
    }
  }

  /**
   * Geeft geparste HTML terug (markdown → html + highlighting + mathjax placeholders)
   * @param {string} text
   * @returns {string} HTML
   */
  parse(text) {
    if (!this.enableMarkdown || !text) return text || "";

    if (!this._parser) {
      this._parser = new TextParser({
        enableHighlightJS: this.enableHighlightJS,
        enableMathJax: this.enableMathJax
      });
    }

    return this._parser.parse(text);
  }

  async ask(input) {
    await this._ensureLibraries();

    let messages = typeof input === "string"
      ? [{ role: "user", content: input }]
      : Array.isArray(input)
        ? input
        : (() => { throw new Error("ask() verwacht string of messages array"); })();

    this.abortController = new AbortController();
    let fullText = "";

    const streamRequest = async (ctxMessages) => {
      const res = await fetch(`${this.apiBase}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "system", content: this.systemPrompt }, ...ctxMessages],
          stream: true,
          seed: Math.floor(Math.random() * 1000000)
        }),
        signal: this.abortController.signal
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim().startsWith("data: ")) continue;
          const data = line.trim().slice(6);
          if (data === "[DONE]") return;

          try {
            const json = JSON.parse(data);
            const chunk = json.choices?.[0]?.delta?.content || "";
            if (chunk) {
              fullText += chunk;
              this.dispatchEvent(new CustomEvent("chunk", { detail: chunk }));
            }
          } catch {}
        }
      }

      // Auto-continue check
      if (this.autoContinue && this._looksTruncated(fullText)) {
        this.dispatchEvent(new CustomEvent("system", { detail: "→ continuing..." }));

        const continuation = [
          ...ctxMessages,
          { role: "assistant", content: fullText },
          { role: "user", content: "Continue exactly from where you left off. Do not repeat previous text. Pick up precisely." }
        ];

        await streamRequest(continuation);
      }
    };

    try {
      await streamRequest(messages);
      this.dispatchEvent(new CustomEvent("complete", { detail: fullText }));
      return fullText;
    } catch (err) {
      if (err.name === "AbortError") {
        this.dispatchEvent(new CustomEvent("abort", { detail: fullText }));
      } else {
        this.dispatchEvent(new CustomEvent("error", { detail: err.message }));
      }
      throw err;
    }
  }

  stop() {
    this.abortController?.abort();
  }

  _looksTruncated(text) {
    if (!text) return false;
    // Simpele heuristiek: oneven aantal code fences → waarschijnlijk afgebroken
    const fences = (text.match(/```/g) || []).length;
    return fences % 2 === 1;
  }
}

// ────────────────────────────────────────────────

class TextParser {
  constructor({ enableHighlightJS = true, enableMathJax = true } = {}) {
    this.enableHighlightJS = enableHighlightJS;
    this.enableMathJax = enableMathJax;
  }

  escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
  }

  parse(input) {
    let text = input ?? "";

    const mathBlocks = [];
    if (this.enableMathJax) {
      text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, c) => {
        const i = mathBlocks.push(c) - 1;
        return `[[MATH_DISPLAY_${i}]]`;
      });
      text = text.replace(/\$([^\$\n]+?)\$/g, (_, c) => {
        const i = mathBlocks.push(c) - 1;
        return `[[MATH_INLINE_${i}]]`;
      });
    }

    const codeBlocks = [];
    text = text.replace(/```(\w+)?\n?([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
      const i = codeBlocks.length;
      codeBlocks.push(this._renderCode(code.trim(), lang?.toLowerCase()));
      return `[[CODE_${i}]]`;
    });

    // Inline code
    text = text.replace(/`([^`]+)`/g, (_, code) =>
      `<code class="inline">${this.escapeHtml(code)}</code>`
    );

    // Basic markdown
    text = text
      .replace(/^ {0,3}### (.*$)/gm,       "<h3>$1</h3>")
      .replace(/^ {0,3}## (.*$)/gm,        "<h2>$1</h2>")
      .replace(/^ {0,3}# (.*$)/gm,         "<h1>$1</h1>")
      .replace(/\*\*([^*]+)\*\*/g,         "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g,             "<em>$1</em>")
      .replace(/~~(.+?)~~/g,               "<del>$1</del>")
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,"<img alt=\"$1\" src=\"$2\">")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\">$1</a>");

    // Na parsing → code & math terugzetten + highlighting triggeren
    text = text.replace(/\[\[CODE_(\d+)\]\]/g, (_, i) => codeBlocks[i] || "");
    text = text.replace(/\[\[MATH_DISPLAY_(\d+)\]\]/g, (_, i) => this.enableMathJax ? `\\[${mathBlocks[i]}\\]` : mathBlocks[i]);
    text = text.replace(/\[\[MATH_INLINE_(\d+)\]\]/g,  (_, i) => this.enableMathJax ? `\\(${mathBlocks[i]}\\)` : mathBlocks[i]);

    // Trigger MathJax & Highlight.js na render (indien aanwezig)
    if (this.enableMathJax && window.MathJax) {
      setTimeout(() => window.MathJax.typesetPromise(), 50);
    }
    if (this.enableHighlightJS && window.hljs) {
      setTimeout(() => {
        document.querySelectorAll("pre code:not(.hljs)").forEach(el => {
          window.hljs.highlightElement(el);
        });
      }, 80);
    }

    return text;
  }

  _renderCode(code, lang = "") {
    const safe = this.escapeHtml(code);
    const cls = lang ? `language-${lang}` : "";
    return `<pre><code class="${cls}">${safe}</code></pre>`;
  }
}
