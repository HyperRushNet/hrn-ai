/**
 * Dark Angel Renderer - V6.0
 * - Transparent backgrounds by default.
 * - Full custom styling config per element.
 * - Fixed code highlighting (manual trigger + fallback styles).
 */
(function(global) {
  'use strict';

  // --- DEFAULT CONFIG ---
  const defaultConfig = {
    classes: {
      body: 'da-body',
      heading: 'da-heading',
      paragraph: 'da-paragraph',
      blockquote: 'da-blockquote',
      list: 'da-list',
      listItem: 'da-list-item',
      
      // Tasks
      taskList: 'da-task-list',
      taskItem: 'da-task-item',
      taskCheck: 'da-task-check',
      taskContent: 'da-task-content',

      // Code
      codeBlock: 'da-code-block',
      codeHeader: 'da-code-header',
      codeLang: 'da-code-lang',
      codeCopyBtn: 'da-copy-btn',
      codeContent: 'da-code-content',
      inlineCode: 'da-inline-code',

      // Table
      tableWrapper: 'da-table-wrapper',
      table: 'da-table',
      tableHead: 'da-table-head',
      tableCell: 'da-table-cell'
    },
    styles: {
      // Styles can be applied per element key (matches keys above)
      // e.g., body: { color: '#fff' }
    },
    icons: {
      copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
      check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      taskCheck: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
    },
    text: {
      copyButton: 'Kopieer',
      copiedButton: 'Gekopieerd'
    }
  };

  // --- CSS ENGINE ---
  // Includes transparent backgrounds and default syntax highlighting
  const baseCSS = `
  /* Reset & Base */
  .da-body { 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #d1d5db; /* gray-300 */
    background: transparent;
    -webkit-font-smoothing: antialiased;
  }
  .da-body * { box-sizing: border-box; margin: 0; padding: 0; }
  
  /* Typography */
  .da-heading { color: #f9fafb; font-weight: 600; letter-spacing: -0.02em; margin-top: 2em; margin-bottom: 0.6em; }
  .da-heading h1 { font-size: 1.8em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4em; }
  .da-heading h2 { font-size: 1.4em; }
  .da-heading h3 { font-size: 1.15em; }
  
  .da-paragraph { margin-bottom: 1.2em; }
  .da-body a { color: #38bdf8; text-decoration: none; transition: opacity 0.2s; }
  .da-body a:hover { opacity: 0.8; text-decoration: underline; }

  /* Blockquote */
  .da-blockquote {
    margin: 1em 0;
    padding: 0.5em 0 0.5em 1em;
    border-left: 3px solid #38bdf8;
    background: transparent;
    color: #9ca3af;
  }

  /* Inline Code */
  .da-inline-code, .da-body code:not([class*="language-"]) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85em;
    background: rgba(255,255,255,0.05);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    color: #f472b6; /* pink-400 */
    border: 1px solid rgba(255,255,255,0.05);
  }

  /* Code Blocks */
  .da-code-block {
    margin: 1.5em 0;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: transparent; /* User controls background */
    overflow: hidden;
  }
  .da-code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(0,0,0,0.2);
  }
  .da-code-lang {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 0.5px;
  }
  .da-copy-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.2s;
  }
  .da-copy-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
  .da-copy-btn.da-copied { color: #4ade80; }

  .da-code-content {
    padding: 16px 20px;
    overflow-x: auto;
    font-size: 13.5px;
    line-height: 1.6;
    background: transparent;
  }
  
  /* Prism Overrides for Transparency & Colors */
  .da-code-content code[class*="language-"],
  .da-code-content pre[class*="language-"] {
    text-shadow: none;
    background: transparent !important;
    font-family: 'JetBrains Mono', monospace;
  }
  .token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6b7280; }
  .token.punctuation { color: #9ca3af; }
  .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol { color: #f472b6; }
  .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin { color: #4ade80; }
  .token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string { color: #38bdf8; }
  .token.atrule, .token.attr-value, .token.keyword { color: #c084fc; }
  .token.function, .token.class-name { color: #fbbf24; }
  .token.regex, .token.important, .token.variable { color: #fb923c; }

  /* Tasks */
  .da-task-list { list-style: none; padding: 0; margin: 1.5em 0; }
  .da-task-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .da-task-check {
    flex-shrink: 0;
    width: 18px; height: 18px;
    border: 2px solid #4b5563;
    border-radius: 4px;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s;
    margin-top: 3px;
    background: transparent;
  }
  .da-task-check:hover { border-color: #38bdf8; }
  .da-task-check svg {
    width: 12px; height: 12px;
    stroke: #38bdf8;
    stroke-width: 3;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.15s ease;
  }
  .da-task-item.da-checked .da-task-check { border-color: #38bdf8; background: rgba(56, 189, 248, 0.1); }
  .da-task-item.da-checked .da-task-check svg { opacity: 1; transform: scale(1); }
  .da-task-item.da-checked .da-task-content { color: #6b7280; text-decoration: line-through; }
  .da-task-content { flex: 1; min-width: 0; transition: color 0.2s; }

  /* Tables */
  .da-table-wrapper {
    margin: 1.5em 0;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    overflow: hidden;
    background: transparent;
  }
  .da-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .da-table-head {
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background: rgba(0,0,0,0.2);
    color: #9ca3af;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .da-table-cell {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    color: #d1d5db;
  }
  .da-table tr:last-child .da-table-cell { border-bottom: none; }
  
  /* Scrollbar */
  .da-body ::-webkit-scrollbar { height: 6px; width: 6px; }
  .da-body ::-webkit-scrollbar-track { background: transparent; }
  .da-body ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
  `;

  // --- HELPERS ---
  function injectStyle(id, css) {
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function createElement(tag, configKey, content, cfg) {
    const el = document.createElement(tag);
    
    // Apply Classes
    const cls = cfg.classes[configKey] || defaultConfig.classes[configKey];
    if (cls) el.classList.add(...cls.split(' '));
    
    // Apply Inline Styles
    const stl = cfg.styles?.[configKey] || defaultConfig.styles?.[configKey];
    if (stl) Object.assign(el.style, stl);

    if (content) {
      if (typeof content === 'string') el.innerHTML = content;
      else el.appendChild(content);
    }
    return el;
  }

  // --- RENDER LOGIC ---

  function render(target, data, userConfig = {}) {
    // Merge Config
    const cfg = {
      classes: { ...defaultConfig.classes, ...userConfig.classes },
      styles: { ...defaultConfig.styles, ...userConfig.styles },
      icons: { ...defaultConfig.icons, ...userConfig.icons },
      text: { ...defaultConfig.text, ...userConfig.text }
    };

    injectStyle('dark-angel-render-core', baseCSS);

    target.innerHTML = '';
    const container = createElement('div', 'body', null, cfg);
    
    // 1. Tasks
    if (data.tasks && data.tasks.length) {
      const ul = createElement('ul', 'taskList', null, cfg);
      data.tasks.forEach(t => {
        const li = createElement('li', 'taskItem', null, cfg);
        if (t.checked) li.classList.add('da-checked');
        
        const check = createElement('div', 'taskCheck', cfg.icons.taskCheck, cfg);
        check.setAttribute('role', 'checkbox');
        check.setAttribute('tabindex', '0');
        check.setAttribute('aria-checked', !!t.checked);

        // Interaction
        const toggle = () => {
          const isChecked = li.classList.toggle('da-checked');
          check.setAttribute('aria-checked', isChecked);
        };
        check.onclick = toggle;
        check.onkeydown = (e) => { if(e.key===' '||e.key==='Enter') { e.preventDefault(); toggle(); } };

        const content = createElement('div', 'taskContent', parseInline(t.text), cfg);
        
        li.appendChild(check);
        li.appendChild(content);
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // 2. Markdown
    if (data.markdown && typeof marked !== 'undefined') {
      const parsed = marked.parse(data.markdown);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = parsed;
      
      // Process standard elements to apply our classes
      processElements(wrapper, cfg);
      container.appendChild(wrapper);
    }

    // 3. Code Blocks
    if (data.codeBlocks && data.codeBlocks.length) {
      data.codeBlocks.forEach(b => {
        container.appendChild(createCodeBlock(b.lang, b.code, cfg));
      });
    }

    target.appendChild(container);

    // 4. Math (KaTeX)
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(target, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }

    // 5. Highlighting (Prism)
    // Force highlight all code blocks inside container
    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(container);
    }
  }

  function processElements(root, cfg) {
    // Headings
    root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      // Wrap in custom class logic if needed, or just apply styles
      const styleKey = 'heading'; // simplified
      const stl = cfg.styles?.[styleKey];
      if(stl) Object.assign(el.style, stl);
      el.classList.add('da-heading');
    });

    // Paragraphs
    root.querySelectorAll('p').forEach(el => {
      el.classList.add('da-paragraph');
    });
    
    // Blockquotes
    root.querySelectorAll('blockquote').forEach(el => {
      el.classList.add('da-blockquote');
    });

    // Inline Code
    root.querySelectorAll('code:not([class*="language-"])').forEach(el => {
      el.classList.add('da-inline-code');
    });

    // Tables
    root.querySelectorAll('table').forEach(el => {
      const wrapper = createElement('div', 'tableWrapper', null, cfg);
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      el.classList.add('da-table');
      el.querySelectorAll('th').forEach(th => th.classList.add('da-table-head'));
      el.querySelectorAll('td').forEach(td => td.classList.add('da-table-cell'));
    });
  }

  function createCodeBlock(lang, code, cfg) {
    const block = createElement('div', 'codeBlock', null, cfg);
    
    // Header
    const header = createElement('div', 'codeHeader', null, cfg);
    const langSpan = createElement('span', 'codeLang', lang, cfg);
    
    // Button
    const btn = createElement('button', 'codeCopyBtn', cfg.icons.copy + ' ' + cfg.text.copyButton, cfg);
    btn.onclick = () => {
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = cfg.icons.check + ' ' + cfg.text.copiedButton;
        btn.classList.add('da-copied');
        setTimeout(() => {
          btn.innerHTML = cfg.icons.copy + ' ' + cfg.text.copyButton;
          btn.classList.remove('da-copied');
        }, 2000);
      });
    };

    header.appendChild(langSpan);
    header.appendChild(btn);

    // Pre > Code
    const pre = createElement('pre', 'codeContent', null, cfg);
    const codeEl = document.createElement('code');
    codeEl.className = `language-${lang}`;
    codeEl.textContent = code;
    pre.appendChild(codeEl);

    block.appendChild(header);
    block.appendChild(pre);
    return block;
  }

  function parseInline(text) {
    return text.replace(/`([^`]+)`/g, '<code class="da-inline-code">$1</code>');
  }

  // --- EXPOSE ---
  global.DarkAngel = {
    render: render
  };

})(window);
