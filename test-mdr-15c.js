(function(global) {
  'use strict';

  class DarkAngel {
    constructor(config = {}) {
      this.config = {
        target: config.target || '#render-target',
        accent: config.accent || '#3b82f6',
        ...config
      };
    }

    protectMath(md) {
      return md.replace(/\$\$(.+?)\$\$/gs, (m, g) => `<div class="da-math-display">$$${g}$$</div>`)
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

      // Transformeer Code Blocks voor Prism
      container.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        
        const lang = (code.className.match(/language-(\w+)/) || [, 'code'])[1];
        const wrapper = document.createElement('div');
        wrapper.className = 'da-code-block';
        wrapper.innerHTML = `<div class="da-code-header"><span>${lang}</span></div>`;
        
        const newPre = document.createElement('pre');
        newPre.className = `language-${lang}`;
        const newCode = document.createElement('code');
        newCode.className = `language-${lang}`;
        newCode.textContent = code.textContent;
        
        newPre.appendChild(newCode);
        wrapper.appendChild(newPre);
        pre.replaceWith(wrapper);
      });

      // Takenlijst transformatie (zoals gevraagd)
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
          const contentDiv = document.createElement('div');
          contentDiv.className = 'da-task-content';
          while (li.childNodes.length > 1) contentDiv.appendChild(li.childNodes[1]);
          li.appendChild(contentDiv);
        }
      });

      el.innerHTML = '';
      el.appendChild(container);

      // CRUCIAAL: Trigger KaTeX en Prism
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(el, { delimiters: [{left:'$$', right:'$$', display:true}, {left:'$', right:'$', display:false}], throwOnError: false });
      }
      if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(el);
      }
    }
  }

  global.DarkAngel = DarkAngel;
})(window);
