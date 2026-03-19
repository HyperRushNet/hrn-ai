/**
 * AIChat Library
 * Een generieke, lichtgewicht JavaScript klasse voor AI chat interacties met streaming support.
 * 
 * Features:
 * - Streaming responses via EventTarget (addEventListener).
 * - Ingebouwde optionele Markdown & MathJax rendering.
 * - Auto-continue functionaliteit voor afgebroken antwoorden.
 * 
 * Voorbeeld:
 * const ai = new AIChat({ apiKey: 'jouw_key', enableMarkdown: true });
 * ai.addEventListener('chunk', (e) => console.log(e.detail));
 * await ai.ask("Hallo wereld!");
 */

class AIChat extends EventTarget {
    constructor(options = {}) {
        super();
        
        // Configuraties
        this.apiBase = options.apiBase || "https://gen.pollinations.ai";
        this.apiKey = options.apiKey || localStorage.getItem("pk");
        this.model = options.model || "gemini-search";
        this.systemPrompt = options.systemPrompt || "You are a helpful assistant.";
        
        // Feature flags
        this.enableMarkdown = options.enableMarkdown || false;
        this.enableMathJax = options.enableMathJax || false;
        this.autoContinue = options.autoContinue !== false; // Standaard aan

        // State
        this.abortController = null;

        // Initialiseer parser indien nodig
        if (this.enableMarkdown) {
            this.parser = new TextParser();
        }
    }

    /**
     * Parse tekst naar HTML als markdown/mathjax aanstaat, anders return raw text.
     * Nuttig voor de UI om de 'chunk' data direct te renderen.
     */
    parse(text) {
        if (!this.enableMarkdown || !this.parser) return text;
        return this.parser.parse(text, this.enableMathJax);
    }

    /**
     * Start een chat request.
     * @param {string|Array} input - Een enkele prompt string of een array van message objecten.
     */
    async ask(input) {
        // Zet string input om naar message array
        let messages = [];
        if (typeof input === 'string') {
            messages = [{ role: 'user', content: input }];
        } else if (Array.isArray(input)) {
            messages = input;
        } else {
            throw new Error("Input must be a string or an array of messages.");
        }

        this.abortController = new AbortController();
        let fullText = "";

        // Interne recursive functie voor streaming
        const streamRequest = async (currentMessages) => {
            const response = await fetch(`${this.apiBase}/v1/chat/completions`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    Authorization: `Bearer ${this.apiKey}` 
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: "system", content: this.systemPrompt }, ...currentMessages],
                    stream: true,
                    seed: Math.floor(Math.random() * 1000000)
                }),
                signal: this.abortController.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop(); // Houd incomplete regel over

                for (const line of lines) {
                    if (!line.trim().startsWith("data: ")) continue;
                    const jsonStr = line.trim().slice(6);
                    if ("[DONE]" === jsonStr) break;

                    try {
                        const json = JSON.parse(jsonStr);
                        const chunk = json.choices?.[0]?.delta?.content;
                        if (chunk) {
                            fullText += chunk;
                            this.dispatchEvent(new CustomEvent('chunk', { detail: chunk }));
                        }
                    } catch (e) { /* Ignore JSON parse errors */ }
                }
            }

            // Auto-continue logic (indien ingeschakeld)
            if (this.autoContinue && this._isTruncated(fullText)) {
                const continueMsg = { role: "user", content: "Continue exactly where you left off. Do not repeat text." };
                this.dispatchEvent(new CustomEvent('system', { detail: 'Continuing truncated response...' }));
                
                // Update context voor de volgende request
                const newContext = [...currentMessages, { role: "assistant", content: fullText }, continueMsg];
                await streamRequest(newContext);
            }
        };

        try {
            await streamRequest(messages);
            this.dispatchEvent(new CustomEvent('complete', { detail: fullText }));
            return fullText;
        } catch (err) {
            if (err.name === 'AbortError') {
                this.dispatchEvent(new CustomEvent('abort', { detail: fullText }));
            } else {
                this.dispatchEvent(new CustomEvent('error', { detail: err.message }));
            }
            throw err;
        }
    }

    /**
     * Stop de huidige generatie.
     */
    stop() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Helper om te checken op afgebroken code blocks.
     */
    _isTruncated(text) {
        if (!text) return false;
        return (text.match(/```/g) || []).length % 2 !== 0;
    }
}

/**
 * Interne helper klasse voor Markdown en MathJax parsing.
 * Slechts lichtgewicht, geen externe dependencies benodigd in de lib zelf
 * (Maar MathJax CSS/JS moet wel geladen zijn in de UI voor perfecte rendering).
 */
class TextParser {
    escapeHtml(t) {
        if (!t) return "";
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return t.replace(/[&<>"']/g, m => map[m]);
    }

    parse(text, enableMathJax = false) {
        if (!text) return "";
        let t = text;
        const mathBlocks = [];

        // 1. MathJax Support (Escapen naar placeholders)
        if (enableMathJax) {
            t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
                const i = mathBlocks.length;
                mathBlocks.push(`\\[${content}\\]`);
                return `[[MATHBLOCK${i}]]`;
            });
            t = t.replace(/\$([^\$\n]+?)\$/g, (_, content) => {
                const i = mathBlocks.length;
                mathBlocks.push(`\\(${content}\\)`);
                return `[[MATHBLOCK${i}]]`;
            });
        }

        const codeBlocks = [];
        // 2. Code Blocks (voor highlighting later in UI)
        t = t.replace(/```(\w*)\n([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
            const i = codeBlocks.length;
            codeBlocks.push(this._renderCodeBlock(code || "", lang));
            return `[[CODEBLOCK${i}]]`;
        });

        const inlineCodes = [];
        t = t.replace(/`([^`\n]+)`/g, (_, code) => {
            const i = inlineCodes.length;
            inlineCodes.push(`<code class="inline-code">${this.escapeHtml(code)}</code>`);
            return `[[INLINECODE${i}]]`;
        });

        // 3. Standard Markdown Elements
        t = this._parseTables(t);
        t = t.replace(/^###### (.+)$/gm, "<h6>$1</h6>").replace(/^##### (.+)$/gm, "<h5>$1</h5>")
             .replace(/^#### (.+)$/gm, "<h4>$1</h4>").replace(/^### (.+)$/gm, "<h3>$1</h3>")
             .replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>");
        
        t = this._parseBlockquotes(t);
        t = t.replace(/^(---|\*\*\*|___)$/gm, '<hr>');
        t = this._parseLists(t);
        
        // Formatting
        t = t.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
             .replace(/__([^_\n]+)__/g, "<strong>$1</strong>").replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
             .replace(/_([^_\n]+)_/g, "<em>$1</em>");
        t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
        
        // Links & Images
        t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
             .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        t = this._parseParagraphs(t);

        // 4. Restore Placeholders
        inlineCodes.forEach((c, i) => t = t.replace(`[[INLINECODE${i}]]`, c));
        codeBlocks.forEach((c, i) => t = t.replace(`[[CODEBLOCK${i}]]`, c));
        mathBlocks.forEach((c, i) => t = t.replace(`[[MATHBLOCK${i}]]`, c));

        return t;
    }

    _renderCodeBlock(code, lang) {
        // We geven een standaard wrapper terug. 
        // Highlighting door hljs moet in de UI gebeuren (via hljs.highlightElement of classes)
        const safeCode = this.escapeHtml(code.trim());
        return `<div class="code-block"><div class="code-header"><span class="code-lang">${lang || 'code'}</span></div><pre><code class="language-${lang}">${safeCode}</code></pre></div>`;
    }

    _parseTables(t) {
        return t.replace(/^\|(.+)\|\s*\n\|([-:\s|]+)\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (_, headerRow, separator, bodyRows) => {
            const headers = headerRow.split("|").map(h => h.trim()).filter(Boolean);
            const aligns = separator.split("|").map(s => { s = s.trim(); return s.startsWith(":") && s.endsWith(":") ? "center" : s.endsWith(":") ? "right" : "left"; });
            const rows = bodyRows.trim().split("\n").map(r => r.split("|").map(c => c.trim()).filter(Boolean));
            return `<table><thead><tr>${headers.map((h, i) => `<th style="text-align:${aligns[i]}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="text-align:${aligns[i]}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        });
    }

    _parseBlockquotes(t) {
        const lines = t.split("\n");
        let result = [], buffer = [], inQuote = false;
        for (let line of lines) {
            if (line.startsWith("> ")) {
                if (!inQuote) { inQuote = true; buffer = []; }
                buffer.push(line.substring(2));
            } else {
                if (inQuote) { result.push('<blockquote>' + buffer.join("<br>") + "</blockquote>"); inQuote = false; }
                result.push(line);
            }
        }
        if (inQuote) result.push('<blockquote>' + buffer.join("<br>") + "</blockquote>");
        return result.join("\n");
    }

    _parseLists(t) {
        const lines = t.split("\n");
        let result = [], inUl = false, inOl = false, ulBuf = [], olBuf = [];
        for (let line of lines) {
            const taskMatch = line.match(/^[\s]*[-*+][\s]+\[( |x)\][\s]+(.+)$/);
            const ulMatch = line.match(/^[\s]*[-*+][\s]+(.+)$/);
            const olMatch = line.match(/^[\s]*(\d+)\.[\s]+(.+)$/);

            if (taskMatch) {
                if (inOl) { result.push("<ol>" + olBuf.join("") + "</ol>"); inOl = false; olBuf = []; }
                if (!inUl) { inUl = true; ulBuf = []; }
                ulBuf.push(`<li class="task-list-item"><input type="checkbox" ${taskMatch[1] === "x" ? "checked" : ""} disabled> ${taskMatch[2]}</li>`);
            } else if (ulMatch) {
                if (inOl) { result.push("<ol>" + olBuf.join("") + "</ol>"); inOl = false; olBuf = []; }
                if (!inUl) { inUl = true; ulBuf = []; }
                ulBuf.push(`<li>${ulMatch[1]}</li>`);
            } else if (olMatch) {
                if (inUl) { result.push("<ul>" + ulBuf.join("") + "</ul>"); inUl = false; ulBuf = []; }
                if (!inOl) { inOl = true; olBuf = []; }
                olBuf.push(`<li>${olMatch[2]}</li>`);
            } else {
                if (inUl) { result.push("<ul>" + ulBuf.join("") + "</ul>"); inUl = false; ulBuf = []; }
                if (inOl) { result.push("<ol>" + olBuf.join("") + "</ol>"); inOl = false; olBuf = []; }
                result.push(line);
            }
        }
        if (inUl) result.push("<ul>" + ulBuf.join("") + "</ul>");
        if (inOl) result.push("<ol>" + olBuf.join("") + "</ol>");
        return result.join("\n");
    }

    _parseParagraphs(t) {
        return t.split(/\n\n+/).map(p => {
            p = p.trim();
            if (!p) return "";
            // Skip als het al een HTML block is
            if (p.match(/^<(h[1-6]|ul|ol|li|blockquote|hr|div|p|pre|code|table)/) || p.match(/^\[\[CODEBLOCK\d+\]\]$/)) return p;
            return `<p>${p.replace(/\n/g, "<br>")}</p>`;
        }).join("\n");
    }
}
