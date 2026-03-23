(function(global) {
  'use strict';

  class DarkAngel {
    constructor(config = {}) {
      this.config = {
        target: config.target || '#render-target',
        accent: config.accent || '#3b82f6',
        ...config
      };
      this.initStyles();
    }

    initStyles() {
      if (document.getElementById('da-core-style')) return;
      const css = `
        .da-body { line-height: 1.75; color: var(--da-text); }
        .da-task-list { list-style: none; padding-left: 0; }
        .da-task-item { display: flex; gap: 12px; padding: 6px 0; align-items: flex-start; }
        .da-task-check { 
            width: 18px; height: 18px; border: 2px solid var(--da-border); 
            border-radius: 4px; flex-shrink: 0; margin-top: 4px; cursor: pointer;
            display: grid; place-items: center;
        }
        .da-task-item.checked .da-task-check { background: var(--da-accent); border-color: var(--da-accent); }
        .da-task-item.checked .da-task-content { opacity: 0.5; text-decoration: line-through; }
        .da-code-block { margin: 1.5em 0; border-radius: 8px; overflow: hidden; }
        .da-code-header { padding: 8px 16px; display: flex; justify-content: space-between; font-size: 12px; font-family: monospace; }
        .streaming::after { content: '▊'; animation: da-blink 0.8s step-end infinite; color: var(--da-accent); }
        @keyframes da-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        table { width: 100%; border-collapse: collapse; border: 1px solid var(--da-border); border-radius: 8px; margin: 1.5em 0; }
        th, td { padding: 12px; border: 1px solid var(--da-border); }
        th { background: var(--da-surface); }
      `;
      const style = document.createElement('style');
      style.id = 'da-core-style';
      style.innerText = css;
      document.head.appendChild(style);
    }

    protectMath(md) {
      return md.replace(/\$\$([\s\S]+?)\$\$/g, (m, g) => `<div class="da-math-display">$$${g}$$</div>`)
               .replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (m, g) => `<span class="da-math-inline">$${g}$</span>`);
    }

    render(markdown, isStreaming = false) {
      const el = document.querySelector(this.config.target);
      if (!el) return;

      el.classList.toggle('streaming', isStreaming);
      const html = marked.parse(this.protectMath(markdown));
      
      const container = document.createElement('div');
      container.className = 'da-body';
      container.innerHTML = html;

      // TASK LISTS
      container.querySelectorAll('li').forEach(li => {
        const cb = li.querySelector('input[type="checkbox"]');
        if (cb) {
          li.parentElement.classList.add('da-task-list');
          li.classList.add('da-task-item');
          if (cb.checked) li.classList.add('checked');
          const checkDiv = document.createElement('div');
          checkDiv.className = 'da-task-check';
          checkDiv.innerHTML = cb.checked ? '✓' : '';
          cb.remove();
          li.prepend(checkDiv);
          const content = document.createElement('div');
          content.className = 'da-task-content';
          while (li.childNodes.length > 1) content.appendChild(li.childNodes[1]);
          li.appendChild(content);
        }
      });

      // CODE BLOCKS (De Fix)
      container.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        const lang = (code.className.match(/language-(\w+)/) || [, 'code'])[1];
        const wrapper = document.createElement('div');
        wrapper.className = 'da-code-block';
        wrapper.innerHTML = `<div class="da-code-header"><span>${lang}</span></div>`;
        const newPre = document.createElement('pre');
        newPre.className = code.className;
        newPre.textContent = code.textContent;
        wrapper.appendChild(newPre);
        pre.replaceWith(wrapper);
      });

      el.innerHTML = '';
      el.appendChild(container);

      // Plugins triggeren
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(el, { delimiters: [{left:'$$', right:'$$', display:true}, {left:'$', right:'$', display:false}], throwOnError: false });
      }
      if (typeof Prism !== 'undefined') Prism.highlightAllUnder(el);
    }
  }

  global.DarkAngel = DarkAngel;
})(window);
