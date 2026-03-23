/**
 * Dark Angel - Omega Markdown Renderer Library
 * Versie: 6.0 Stable
 * Inclusief embedded syntax highlighting theme.
 */

(function(global) {
  'use strict';

  // --- 1. EMBEDDED CSS (VOLLEDIG) ---
  const DARK_ANGEL_CSS = `
:root {
  --bg: #09090b;
  --bg-elevated: #0e0e11;
  --surface: #111114;
  --surface-hover: #18181b;
  --border: rgba(255,255,255,0.07);
  --border-focus: rgba(255,255,255,0.12);
  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --muted: #71717a;
  --accent: #38bdf8;
  --accent-soft: rgba(56, 189, 248, 0.1);
  --success: #4ade80;
  --radius: 12px;
  --radius-sm: 6px;
  --fs-base: 15px;
  --fs-code: 13.5px;
  --fs-h1: 26px;
  --fs-h2: 20px;
  --fs-h3: 17px;
  --header-h: 40px;
  --lh: 1.7;
}

/* --- Prism Tomorrow Night Theme (Aangepast voor Dark Angel) --- */
.token.comment, .token.prolog, .token.doctype, .token.cdata {
  color: #6a737d; /* Comment grey */
}
.token.punctuation { color: #ccc; }
.token.namespace { opacity: .7; }

.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted {
  color: #f97583; /* Red/Pink */
}
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted {
  color: #9ecbff; /* Blue */
}
.token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string {
  color: #d19a66; /* Orange */
}
.token.atrule, .token.attr-value, .token.keyword {
  color: #c678dd; /* Purple */
}
.token.function, .token.class-name {
  color: #e5c07b; /* Yellow/Gold */
}
.token.regex, .token.important, .token.variable {
  color: #e06c75;
}

/* --- Layout & Components --- */
* { box-sizing: border-box; margin: 0; padding: 0; }

.da-render-body { 
  background: transparent;
  color: var(--text-secondary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: var(--fs-base);
  line-height: var(--lh);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  position: relative;
}

.da-render-body > *:first-child { margin-top: 0 !important; }
.da-render-body > *:last-child { margin-bottom: 0 !important; }
.da-render-body > * { margin-bottom: 1.5em; }

h1, h2, h3, h4, h5, h6 { 
  margin-top: 2em; 
  margin-bottom: 0.8em; 
  color: var(--text); 
  font-weight: 600; 
  letter-spacing: -0.02em; 
}
h1 { font-size: var(--fs-h1); border-bottom: 1px solid var(--border); padding-bottom: 0.4em; }
h2 { font-size: var(--fs-h2); }
h3 { font-size: var(--fs-h3); }
p { margin-bottom: 1.2em; }

a { color: var(--accent); text-decoration: none; transition: opacity 0.2s; }
a:hover { opacity: 0.8; text-decoration: underline; }

ul, ol { padding-left: 1.5em; margin: 1em 0; }
li { margin-bottom: 0.5em; }
li > ul, li > ol { margin: 0.25em 0; }

/* Task List */
.da-task-list {
  list-style: none;
  padding-left: 0;
  margin: 1.5em 0;
}

.da-task-list li {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 6px 0;
  margin-bottom: 0;
  background: transparent;
}

.da-task-check { 
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: calc((1.7em - 20px) / 2); 
  border: 2px solid var(--muted);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s ease;
  display: grid;
  place-items: center;
}

.da-task-check:hover { border-color: var(--accent); }

.da-task-check svg {
  width: 12px;
  height: 12px;
  stroke: var(--accent);
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.15s ease;
}

.da-is-checked .da-task-check { border-color: var(--accent); }
.da-is-checked .da-task-check svg { opacity: 1; transform: scale(1); }

.da-li-content { 
  flex: 1; 
  line-height: 1.7;
  min-width: 0;
  color: var(--text-secondary);
}

/* Inline code styling */
:not(pre) > code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.88em;
  background: var(--surface);
  padding: 0.15em 0.45em;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  color: var(--accent);
}

.da-li-content code, p code { display: inline; }

/* Blockquote */
.da-render-body blockquote {
  margin: 1em 0;
  padding: 0.25em 0 0.25em 1em;
  border-left: 2px solid var(--accent);
  background: transparent;
  color: var(--text-secondary);
}

.da-render-body blockquote p { margin: 0; line-height: 1.6; }
.da-render-body blockquote ul, .da-render-body blockquote ol { margin: 0.25em 0 0 0; padding-left: 1.5em; }
.da-render-body blockquote > *:last-child { margin-bottom: 0 !important; }

code { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; }

/* Code Block */
.da-code-block {
  margin: 1.5em 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
}

.da-code-header { 
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--header-h);
  padding: 0 14px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.da-code-lang {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.da-copy-btn { 
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  transition: all 0.2s;
}

.da-copy-btn:hover { 
  background: var(--surface); 
  border-color: var(--border);
  color: var(--text); 
}

.da-copy-btn svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
.da-copy-btn.da-copied { color: var(--success); border-color: rgba(74, 222, 128, 0.3); background: rgba(74, 222, 128, 0.05); }

pre {
  padding: 16px 20px !important;
  margin: 0 !important;
  background: transparent !important;
  overflow-x: auto;
  font-size: var(--fs-code);
  line-height: 1.6;
}

pre::-webkit-scrollbar { height: 6px; }
pre::-webkit-scrollbar-track { background: transparent; }
pre::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* KaTeX */
.katex-display { 
  margin: 1.5em 0;
  padding: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.katex { font-size: 1.1em !important; color: var(--text); }

/* Table */
.da-table-wrapper {
  margin: 1.5em 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}

table { 
  width: 100%; 
  border-collapse: collapse; 
  font-size: 14px;
}

th { 
  background: var(--bg-elevated);
  color: var(--text);
  padding: 12px 16px; 
  text-align: left; 
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

td { 
  padding: 12px 16px; 
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
}

tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.01); }

*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;

  // --- 2. ICONS & HELPERS ---
  const iconCopy = `<svg viewBox="0 0 24 24"><path d="M19 21H8V7h11m0-2H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2m-3-4H4a2 2 0 00-2 2v14h2V3h12V1z"/></svg>`;
  const iconCheck = `<svg viewBox="0 0 24 24"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>`;
  const checkIcon = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;

  function injectStyle() {
    if (!document.getElementById('dark-angel-render-style')) {
      const style = document.createElement('style');
      style.id = 'dark-angel-render-style';
      style.textContent = DARK_ANGEL_CSS;
      document.head.appendChild(style);
    }
  }

  function copyToClipboard(button, text) {
    navigator.clipboard.writeText(text).then(() => {
      button.innerHTML = iconCheck + ' Gekopieerd';
      button.classList.add('da-copied');
      setTimeout(() => {
        button.innerHTML = iconCopy + ' Kopieer';
        button.classList.remove('da-copied');
      }, 2000);
    }).catch(() => {
      button.innerText = 'Fout';
    });
  }

  function parseInlineContent(text) {
    return text.replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  // --- 3. COMPONENT BUILDERS ---

  function createCodeBlock(lang, code) {
    const container = document.createElement('div');
    container.className = 'da-code-block';
    
    const header = document.createElement('div');
    header.className = 'da-code-header';
    header.innerHTML = `<span class="da-code-lang">${lang}</span>`;
    
    const btn = document.createElement('button');
    btn.className = 'da-copy-btn';
    btn.innerHTML = iconCopy + ' Kopieer';
    btn.setAttribute('aria-label', 'Kopieer code naar klembord');
    btn.onclick = () => copyToClipboard(btn, code);
    
    header.appendChild(btn);
    
    const pre = document.createElement('pre');
    const codeTag = document.createElement('code');
    // Voeg classes toe voor Prism
    codeTag.className = `language-${lang}`;
    codeTag.textContent = code;
    
    pre.appendChild(codeTag);
    container.appendChild(header);
    container.appendChild(pre);
    
    return container;
  }

  function createTaskList(tasks) {
    const taskUl = document.createElement('ul');
    taskUl.className = 'da-task-list';
    
    tasks.forEach(t => {
      const li = document.createElement('li');
      if (t.checked) li.className = 'da-is-checked';
      
      const checkbox = document.createElement('div');
      checkbox.className = 'da-task-check';
      checkbox.setAttribute('role', 'checkbox');
      checkbox.setAttribute('aria-checked', t.checked);
      checkbox.setAttribute('tabindex', '0');
      checkbox.innerHTML = checkIcon;
      
      const content = document.createElement('div');
      content.className = 'da-li-content';
      content.innerHTML = parseInlineContent(t.text);
      
      li.appendChild(checkbox);
      li.appendChild(content);
      taskUl.appendChild(li);
    });
    
    return taskUl;
  }

  // --- 4. MAIN RENDER FUNCTION ---

  function render(element, content) {
    // Inject CSS once
    injectStyle();
    
    // Clear target
    element.innerHTML = '';
    
    const mdDiv = document.createElement('div');
    mdDiv.className = 'da-render-body';

    // 1. Tasks
    if (content.tasks && content.tasks.length > 0) {
      mdDiv.appendChild(createTaskList(content.tasks));
    }

    // 2. Markdown Content
    if (content.markdown) {
      if (typeof marked !== 'undefined') {
        // Parse markdown
        mdDiv.innerHTML += marked.parse(content.markdown);
      } else {
        console.error('DarkAngel Error: marked.js is required.');
        mdDiv.innerHTML += `<pre>${content.markdown}</pre>`;
      }
    }

    // 3. Manual Code Blocks
    if (content.codeBlocks && content.codeBlocks.length > 0) {
      content.codeBlocks.forEach(block => {
        mdDiv.appendChild(createCodeBlock(block.lang, block.code));
      });
    }

    element.appendChild(mdDiv);

    // 4. Post-Processing (Math & Highlighting)

    // KaTeX Render
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }

    // Prism Highlight
    // We gebruiken highlightAllUnder om alleen de nieuwe elementen te highlighten
    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(element);
    }

    // 5. Interactivity (Tasks)
    mdDiv.addEventListener('click', e => {
      const check = e.target.closest('.da-task-check');
      if (check) {
        const li = check.parentElement;
        const isChecked = li.classList.toggle('da-is-checked');
        check.setAttribute('aria-checked', isChecked);
      }
    });

    mdDiv.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const check = e.target.closest('.da-task-check');
        if (check) {
          e.preventDefault();
          const li = check.parentElement;
          const isChecked = li.classList.toggle('da-is-checked');
          check.setAttribute('aria-checked', isChecked);
        }
      }
    });
  }

  // --- 5. EXPORT ---
  global.DarkAngel = {
    render: render
  };

})(window);
