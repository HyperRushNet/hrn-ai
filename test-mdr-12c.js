/**
 * Dark Angel - Ultimate Unified Renderer v10.0
 * Samengevoegd: Core Renderer + Adaptive Styling + Configurable Init
 */

(function(global) {
  'use strict';

  class DarkAngel {
    constructor(config = {}) {
      // 1. Standaard configuratie (Layout & Systeem Kleuren)
      this.config = {
        target: config.target || '#render-target',
        accent: config.accent || '#3b82f6',
        borderRadius: config.borderRadius || '8px',
        fontSize: config.fontSize || '16px',
        fontSans: config.fontSans || 'system-ui, -apple-system, sans-serif',
        fontMono: config.fontMono || 'ui-monospace, monospace',
        darkMode: config.darkMode !== undefined ? config.darkMode : 'auto',
        ...config
      };

      this.initStyles();
      this.checkMarked();
    }

    // 2. Dynamische CSS Injectie (Geen vaste presets in externe CSS)
    initStyles() {
      const id = 'dark-angel-styles';
      if (document.getElementById(id)) return;

      const css = `
        :root {
          --da-accent: ${this.config.accent};
          --da-radius: ${this.config.borderRadius};
          --da-font-sans: ${this.config.fontSans};
          --da-font-mono: ${this.config.fontMono};
          /* Adaptive kleuren op basis van browser/parent */
          --da-text: CanvasText;
          --da-border: color-mix(in srgb, CanvasText, transparent 85%);
          --da-surface: color-mix(in srgb, CanvasText, transparent 96%);
        }

        .da-body {
          font-family: var(--da-font-sans);
          font-size: ${this.config.fontSize};
          line-height: 1.75;
          color: var(--da-text);
          background: transparent;
        }

        /* Tables - ChatGPT Style maar Transparant */
        .da-body table {
          width: 100%; border-collapse: collapse; margin: 1.5em 0;
          border: 1px solid var(--da-border); border-radius: var(--da-radius);
          overflow: hidden; display: table;
        }
        .da-body th { 
          background: var(--da-surface); padding: 12px 16px; 
          font-weight: 600; border-bottom: 2px solid var(--da-border);
        }
        .da-body td { padding: 12px 16px; border-bottom: 1px solid var(--da-border); }

        /* Task Lists */
        .da-task-list { list-style: none; padding-left: 0; }
        .da-task-item { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; }
        .da-task-check {
          width: 18px; height: 18px; border: 2px solid var(--da-border);
          border-radius: 4px; cursor: pointer; flex-shrink: 0; margin-top: 4px;
          display: grid; place-items: center; transition: all 0.2s;
        }
        .da-task-item.checked .da-task-check { background: var(--da-accent); border-color: var(--da-accent); }
        .da-task-item.checked .da-task-content { opacity: 0.5; text-decoration: line-through; }

        /* Code Blocks */
        .da-code-block {
          margin: 1.5em 0; border: 1px solid var(--da-border);
          border-radius: var(--da-radius); background: var(--da-surface); overflow: hidden;
        }
        .da-code-header { 
          padding: 8px 16px; border-bottom: 1px solid var(--da-border);
          display: flex; justify-content: space-between; font-size: 11px;
          font-family: var(--da-font-mono); font-weight: 600; opacity: 0.7;
        }
        .da-code-block pre { margin: 0; padding: 16px; overflow-x: auto; background: transparent !important; }

        /* Math display fix */
        .da-math-display { overflow-x: auto; padding: 10px 0; }
        
        .streaming::after { content: '▊'; animation: da-blink 0.8s step-end infinite; color: var(--da-accent); }
        @keyframes da-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `;

      const styleSheet = document.createElement("style");
      styleSheet.id = id;
      styleSheet.innerText = css;
      document.head.appendChild(styleSheet);
    }

    checkMarked() {
      if (typeof marked === 'undefined') {
        console.error("DarkAngel: marked.js is required in the global scope.");
      }
    }

    // --- RENDER LOGIC ---

    protectMath(markdown) {
      let processed = markdown;
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (m, math) => `<div class="da-math-display">$$${math}$$</div>`);
      processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (m, math) => `<span class="da-math-inline">$${math}$</span>`);
      return processed;
    }

    transformTaskItem(li) {
      const checkbox = li.querySelector(':scope > input[type="checkbox"]');
      if (!checkbox) return;

      const isChecked = checkbox.hasAttribute('checked') || checkbox.checked;
      li.classList.add('da-task-item');
      if(isChecked) li.classList.add('checked');

      const checkDiv = document.createElement('div');
      checkDiv.className = 'da-task-check';
      checkDiv.innerHTML = isChecked ? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="white" stroke-width="4" fill="none"><polyline points="20 6 9 17 4 12"/></svg>` : '';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'da-task-content';

      Array.from(li.childNodes).forEach(node => {
        if (node !== checkbox) contentDiv.appendChild(node);
        else node.remove();
      });

      li.prepend(checkDiv);
      li.appendChild(contentDiv);
    }

    render(markdown, isStreaming = false) {
      const targetEl = document.querySelector(this.config.target);
      if (!targetEl || !markdown) return;

      if (isStreaming) targetEl.classList.add('streaming');
      else targetEl.classList.remove('streaming');

      const safeMarkdown = this.protectMath(markdown);
      marked.setOptions({ gfm: true, breaks: true });
      
      // Render naar tijdelijke div voor verwerking
      const container = document.createElement('div');
      container.className = 'da-body';
      container.innerHTML = marked.parse(safeMarkdown);

      // 1. Task Lists verwerken
      container.querySelectorAll('li').forEach(li => {
        if (li.querySelector(':scope > input[type="checkbox"]')) {
          li.parentElement.classList.add('da-task-list');
          this.transformTaskItem(li);
        }
      });

      // 2. Code Blocks transformeren
      container.querySelectorAll('pre > code').forEach(code => {
        const pre = code.parentElement;
        const lang = code.className.replace('language-', '') || 'code';
        const wrapper = document.createElement('div');
        wrapper.className = 'da-code-block';
        wrapper.innerHTML = `<div class="da-code-header"><span>${lang}</span></div>`;
        const newPre = document.createElement('pre');
        newPre.appendChild(code.cloneNode(true));
        wrapper.appendChild(newPre);
        pre.replaceWith(wrapper);
      });

      // 3. Injecteer in DOM
      targetEl.innerHTML = '';
      targetEl.appendChild(container);

      // 4. Plugins triggeren
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(targetEl, {
          delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
          throwOnError: false
        });
      }
      if (typeof Prism !== 'undefined') Prism.highlightAllUnder(targetEl);
      
      this.attachEvents(targetEl);
    }

    attachEvents(el) {
      el.onclick = (e) => {
        const check = e.target.closest('.da-task-check');
        if (check) {
          const li = check.closest('.da-task-item');
          const isNowChecked = li.classList.toggle('checked');
          check.innerHTML = isNowChecked ? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="white" stroke-width="4" fill="none"><polyline points="20 6 9 17 4 12"/></svg>` : '';
        }
      };
    }
  }

  global.DarkAngel = DarkAngel;

})(window);
