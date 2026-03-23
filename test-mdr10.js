/**
 * Dark Angel - Core Renderer v8.5 (Nested Tasks & Math Fixed)
 * * - Ondersteunt nu diep geneste checklists.
 * - Beschermt wiskunde ($$...$$) tegen parsing door 'marked'.
 * - Behoudt inline HTML en iconen in taken.
 */

(function(global) {
  'use strict';

  // --- ICONS ---
  const checkIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="20 6 9 17 4 12"/></svg>`;

  // --- MATH PROTECTION LOGICA ---
  function protectMath(markdown) {
    let processed = markdown;
    
    // Display Math ($$ ... $$)
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
      return `<div class="da-math-display">$$${math}$$</div>`;
    });

    // Inline Math ($ ... $)
    processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, math) => {
        return `<span class="da-math-inline">$${math}$</span>`;
    });

    return processed;
  }

  // --- COMPONENT FACTORIES ---

  function createCodeBlock(lang, codeText) {
    const container = document.createElement('div');
    container.className = 'da-code-block';
    
    const header = document.createElement('div');
    header.className = 'da-code-header';
    
    const langSpan = document.createElement('span');
    langSpan.className = 'da-code-lang';
    langSpan.textContent = lang || 'code';
    
    header.appendChild(langSpan);
    
    const pre = document.createElement('pre');
    const codeTag = document.createElement('code');
    if(lang) codeTag.className = `language-${lang}`;
    codeTag.textContent = codeText;
    
    pre.appendChild(codeTag);
    container.appendChild(header);
    container.appendChild(pre);
    
    return container;
  }

  /**
   * Converteert een standaard LI met checkbox naar een Dark Angel Task Item.
   * Werkt nu ook voor geneste elementen door de content recursief te behouden.
   */
  function transformToTaskItem(li) {
    const checkbox = li.querySelector(':scope > input[type="checkbox"]');
    if (!checkbox) return;

    const isChecked = checkbox.hasAttribute('checked') || checkbox.checked;
    
    // Maak de nieuwe structuur
    li.classList.add('da-task-item');
    if(isChecked) li.classList.add('checked');

    const checkDiv = document.createElement('div');
    checkDiv.className = 'da-task-check';
    checkDiv.setAttribute('role', 'checkbox');
    checkDiv.setAttribute('aria-checked', isChecked);
    checkDiv.setAttribute('tabindex', '0');
    checkDiv.innerHTML = checkIcon;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'da-task-content';

    // Verplaats alle child nodes (behalve de checkbox) naar de content div
    // Dit zorgt ervoor dat geneste <ul> of <ol> behouden blijven.
    const nodes = Array.from(li.childNodes);
    nodes.forEach(node => {
      if (node !== checkbox) {
        contentDiv.appendChild(node);
      } else {
        node.remove(); // Verwijder de originele browser checkbox
      }
    });

    li.prepend(checkDiv);
    li.appendChild(contentDiv);
  }

  // --- MAIN RENDER FUNCTION ---

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
    
    // 1. Bescherm wiskunde
    const safeMarkdown = protectMath(markdown);

    // 2. Parse Markdown naar HTML
    marked.setOptions({ gfm: true, breaks: false });
    container.innerHTML = marked.parse(safeMarkdown);

    // 3. Post-Processing: Recursieve Checklist Transformatie
    // We zoeken alle LI's die direct een checkbox bevatten
    const allListItems = Array.from(container.querySelectorAll('li'));
    allListItems.forEach(li => {
      const checkbox = li.querySelector(':scope > input[type="checkbox"]');
      if (checkbox) {
        // Markeer de parent UL/OL als een task-list voor styling
        const parentList = li.parentElement;
        if (parentList) parentList.classList.add('da-task-list');
        
        transformToTaskItem(li);
      }
    });

    // 4. Process Code Blocks
    const codeBlocks = Array.from(container.querySelectorAll('pre > code'));
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        const langMatch = block.className.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';
        const codeText = block.textContent;
        
        const newBlock = createCodeBlock(lang, codeText);
        pre.replaceWith(newBlock);
    });

    // 5. Inject in DOM
    element.appendChild(container);

    // 6. Render Extensions (KaTeX & Prism)
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }

    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(element);
    }

    // 7. Interaction Bindings (Event Delegation)
    container.addEventListener('click', e => {
        const check = e.target.closest('.da-task-check');
        if (check) {
            const li = check.closest('.da-task-item');
            if(li) {
                const isChecked = li.classList.toggle('checked');
                check.setAttribute('aria-checked', isChecked);
            }
        }
    });

    container.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            const check = e.target.closest('.da-task-check');
            if (check) {
                e.preventDefault();
                const li = check.closest('.da-task-item');
                if(li) {
                    const isChecked = li.classList.toggle('checked');
                    check.setAttribute('aria-checked', isChecked);
                }
            }
        }
    });
  }

  // --- EXPORT ---
  global.DarkAngel = {
    render: render
  };

})(window);
