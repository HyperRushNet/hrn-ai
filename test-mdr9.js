/**
 * Dark Angel - Core Renderer v8.4 (Math Fixed)
 * 
 * - Beschermt wiskunde ($$...$$) tegen parsing door 'marked'.
 * - Lost het probleem op waarbij formules verdwijnen of breken.
 * - Behoudt inline HTML in taken.
 */

(function(global) {
  'use strict';

  // --- ICONS ---
  const checkIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="20 6 9 17 4 12"/></svg>`;

  // --- MATH PROTECTION LOGICA ---
  // Deze regex zoekt naar $$...$$ (display) en $...$ (inline) en vervangt ze
  // door een placeholder die 'marked' niet aanpast.
  function protectMath(markdown) {
    // 1. Bescherm display math ($$...$$) - ook over meerdere regels
    // We gebruiken een unieke placeholder syntax die geldige HTML is, zodat marked het niet sloopt.
    // We zetten het in een DIV voor display en SPAN voor inline.
    
    let processed = markdown;
    
    // Display Math ($$ ... $$)
    // Matcht alles tussen $$, niet-greedy, met de 's' flag voor multiline
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
      // We coderen de inhoud zodat special chars niet door marked worden geplet
      return `<div class="da-math-display">$$${math}$$</div>`;
    });

    // Inline Math ($ ... $)
    // We moeten oppassen dat we geen geldige valuta tekens pakken (bijv. $5).
    // Een simpele heuristic is dat math geen spatie na de openings-$ heeft, of meerdere chars heeft.
    // Regex: $(niet-$ + willekeurig)$ maar niet direct gevolgd door digit (valuta).
    // Betere regex van KaTeX docs gebruikt meestal: (?<!\$)\$(?!\$)([^\$]+?)\$(?!\$)
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

  function createTaskItem(li) {
    const input = li.querySelector('input[type="checkbox"]');
    if (!input) return null; 

    const isChecked = input.hasAttribute('checked') || input.checked;
    
    const newLi = li.cloneNode(true);
    const inputInClone = newLi.querySelector('input[type="checkbox"]');
    if(inputInClone) inputInClone.remove();
    
    newLi.className = 'da-task-item'; 
    if(isChecked) newLi.classList.add('checked');
    
    const checkDiv = document.createElement('div');
    checkDiv.className = 'da-task-check';
    checkDiv.setAttribute('role', 'checkbox');
    checkDiv.setAttribute('aria-checked', isChecked);
    checkDiv.setAttribute('tabindex', '0');
    checkDiv.innerHTML = checkIcon;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'da-task-content';
    
    while (newLi.firstChild) {
        contentDiv.appendChild(newLi.firstChild);
    }
    
    newLi.appendChild(checkDiv);
    newLi.appendChild(contentDiv);
    
    return newLi;
  }

  // --- MAIN RENDER FUNCTION ---

  function render(element, markdown) {
    if(!element || !markdown) return;

    // 1. Reset Container
    element.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'da-body';

    // 2. Process Markdown
    if (typeof marked === 'undefined') {
        container.textContent = "Error: marked.js is required.";
        element.appendChild(container);
        return;
    }
    
    // STAP 1: Bescherm wiskunde
    const safeMarkdown = protectMath(markdown);

    // STAP 2: Parse Markdown
    marked.setOptions({ gfm: true, breaks: false });
    container.innerHTML = marked.parse(safeMarkdown);

    // 3. Post-Processing (Tasks & Code)
    
    // Process Tasks
    const listItems = Array.from(container.querySelectorAll('li'));
    listItems.forEach(li => {
        if (li.querySelector('input[type="checkbox"]')) {
            const parentUl = li.parentElement;
            if(parentUl) parentUl.classList.add('da-task-list');
            
            const newTaskItem = createTaskItem(li);
            if(newTaskItem) {
                li.replaceWith(newTaskItem);
            }
        }
    });

    // Process Code Blocks
    const codeBlocks = Array.from(container.querySelectorAll('pre > code'));
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        const langMatch = block.className.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';
        const codeText = block.textContent;
        
        const newBlock = createCodeBlock(lang, codeText);
        pre.replaceWith(newBlock);
    });

    // 4. Inject in DOM
    element.appendChild(container);

    // 5. Render Extensions (KaTeX & Prism)
    
    // KaTeX
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }

    // Prism
    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(element);
    }

    // 6. Interaction Bindings
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
