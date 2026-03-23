/**
 * Dark Angel - Core Renderer v8.6 (Unified Nested Tasks)
 * - Gebruikt identieke classes voor alle task levels.
 * - Behoudt volledige HTML-inhoud in de task body.
 */

(function(global) {
  'use strict';

  const checkIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="20 6 9 17 4 12"/></svg>`;

  function protectMath(markdown) {
    let processed = markdown;
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => `<div class="da-math-display">$$${math}$$</div>`);
    processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, math) => `<span class="da-math-inline">$${math}$</span>`);
    return processed;
  }

  function createCodeBlock(lang, codeText) {
    const container = document.createElement('div');
    container.className = 'da-code-block';
    container.innerHTML = `<div class="da-code-header"><span class="da-code-lang">${lang || 'code'}</span></div>`;
    const pre = document.createElement('pre');
    const codeTag = document.createElement('code');
    if(lang) codeTag.className = `language-${lang}`;
    codeTag.textContent = codeText;
    pre.appendChild(codeTag);
    container.appendChild(pre);
    return container;
  }

  // --- UNIFIED TASK TRANSFORMATION ---
  function transformToTaskItem(li) {
    // Zoek alleen de checkbox die een direct kind is van dit lijstitem
    const checkbox = li.querySelector(':scope > input[type="checkbox"]');
    if (!checkbox) return;

    const isChecked = checkbox.hasAttribute('checked') || checkbox.checked;
    
    // Reset/Setup LI class (identiek voor elk level)
    li.classList.add('da-task-item');
    if(isChecked) li.classList.add('checked');

    // Maak de checkbox div
    const checkDiv = document.createElement('div');
    checkDiv.className = 'da-task-check';
    checkDiv.setAttribute('role', 'checkbox');
    checkDiv.setAttribute('aria-checked', isChecked);
    checkDiv.setAttribute('tabindex', '0');
    checkDiv.innerHTML = checkIcon;

    // Maak de content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'da-task-content';

    // Verplaats alle bestaande content (tekst, iconen, geneste lijstjes) naar de contentDiv
    const nodes = Array.from(li.childNodes);
    nodes.forEach(node => {
      if (node !== checkbox) {
        contentDiv.appendChild(node);
      } else {
        node.remove(); // Verwijder de originele input
      }
    });

    li.prepend(checkDiv);
    li.appendChild(contentDiv);
  }

  function render(element, markdown) {
    if(!element || !markdown) return;

    element.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'da-body';

    if (typeof marked === 'undefined') {
        container.textContent = "Error: marked.js is required.";
        element.appendChild(container);
        return;
    }
    
    const safeMarkdown = protectMath(markdown);
    marked.setOptions({ gfm: true, breaks: false });
    container.innerHTML = marked.parse(safeMarkdown);

    // Verwerk alle lijst-items recursief
    const allListItems = Array.from(container.querySelectorAll('li'));
    allListItems.forEach(li => {
      if (li.querySelector(':scope > input[type="checkbox"]')) {
        const parentList = li.parentElement;
        if (parentList) parentList.classList.add('da-task-list');
        transformToTaskItem(li);
      }
    });

    // Verwerk Code Blocks
    const codeBlocks = Array.from(container.querySelectorAll('pre > code'));
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        const langMatch = block.className.match(/language-(\w+)/);
        const newBlock = createCodeBlock(langMatch ? langMatch[1] : 'code', block.textContent);
        pre.replaceWith(newBlock);
    });

    element.appendChild(container);

    // Extensions & Events
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(element, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    }
    if (typeof Prism !== 'undefined') Prism.highlightAllUnder(element);

    // Click & Keyboard handlers
    const toggleCheck = (e) => {
      const check = e.target.closest('.da-task-check');
      if (check) {
        const li = check.closest('.da-task-item');
        if(li) {
          const state = li.classList.toggle('checked');
          check.setAttribute('aria-checked', state);
        }
      }
    };

    container.addEventListener('click', toggleCheck);
    container.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCheck(e);
      }
    });
  }

  global.DarkAngel = { render: render };

})(window);
