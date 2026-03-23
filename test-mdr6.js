/**
 * Dark Angel - Core Renderer v8.0 (Stable)
 * 
 * - Geen CSS injectie (volledige gebruikerscontrole).
 * - Behoudt inline HTML (code, links, math) in taken.
 * - Geen redundante code.
 */

(function(global) {
  'use strict';

  // --- ICONS ---
  const iconCopy = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 21H8V7h11m0-2H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2m-3-4H4a2 2 0 00-2 2v14h2V3h12V1z"/></svg>`;
  const iconCheck = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>`;
  const checkIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="20 6 9 17 4 12"/></svg>`;

  // --- HELPERS ---
  function copyToClipboard(button, text) {
    navigator.clipboard.writeText(text).then(() => {
      button.innerHTML = iconCheck + ' Gekopieerd';
      button.classList.add('copied');
      setTimeout(() => {
        button.innerHTML = iconCopy + ' Kopieer';
        button.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      button.innerText = 'Fout';
    });
  }

  // --- COMPONENT FACTORIES ---

  // Code Block: Vervangt standaard <pre><code> door wrapper met button
  function createCodeBlock(lang, code, originalPre) {
    const container = document.createElement('div');
    container.className = 'da-code-block';
    
    const header = document.createElement('div');
    header.className = 'da-code-header';
    
    const langSpan = document.createElement('span');
    langSpan.className = 'da-code-lang';
    langSpan.textContent = lang || 'code';
    
    const btn = document.createElement('button');
    btn.className = 'da-copy-btn';
    btn.innerHTML = iconCopy + ' Kopieer';
    btn.onclick = () => copyToClipboard(btn, code);
    
    header.appendChild(langSpan);
    header.appendChild(btn);
    
    container.appendChild(header);
    
    // Hergebruik de originele <pre> om eventuele Prism classes die er al op staan te behouden
    // Of maak een nieuwe aan als dat niet kan
    const pre = originalPre || document.createElement('pre');
    if(!pre.parentElement) { // Als het niet in DOM zit (nieuwe creatie)
        const codeTag = document.createElement('code');
        if(lang) codeTag.className = `language-${lang}`;
        codeTag.textContent = code;
        pre.appendChild(codeTag);
    }
    
    container.appendChild(pre);
    
    return container;
  }

  // Task Item: Vervangt <li><input> door custom structuur
  function createTaskItem(li) {
    const input = li.querySelector('input[type="checkbox"]');
    if (!input) return null; // Geen task

    const isChecked = input.hasAttribute('checked') || input.checked;
    
    // Clone de LI node om alle innerlijke HTML (code, links, etc.) te behouden
    const newLi = li.cloneNode(true);
    
    // Verwijder de input checkbox uit de clone
    const inputInClone = newLi.querySelector('input[type="checkbox"]');
    if(inputInClone) inputInClone.remove();
    
    // Zet classes
    newLi.className = 'da-task-item'; // Reset classes
    if(isChecked) newLi.classList.add('checked');
    
    // Maak de custom checkbox
    const checkDiv = document.createElement('div');
    checkDiv.className = 'da-task-check';
    checkDiv.setAttribute('role', 'checkbox');
    checkDiv.setAttribute('aria-checked', isChecked);
    checkDiv.setAttribute('tabindex', '0');
    checkDiv.innerHTML = checkIcon;
    
    // Wrap de resterende content in een div
    const contentDiv = document.createElement('div');
    contentDiv.className = 'da-task-content';
    
    // Verplaats alle child nodes van newLi naar contentDiv
    while (newLi.firstChild) {
        contentDiv.appendChild(newLi.firstChild);
    }
    
    // Bouw de nieuwe structuur op: [Check] + [Content]
    newLi.appendChild(checkDiv);
    newLi.appendChild(contentDiv);
    
    return newLi;
  }

  // --- MAIN RENDER FUNCTION ---

  /**
   * Rendert markdown naar HTML in een target element.
   * @param {HTMLElement} element - De container waar gerenderd wordt.
   * @param {String} markdown - De ruwe markdown tekst.
   */
  function render(element, markdown) {
    if(!element || !markdown) return;

    // 1. Reset Container
    element.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'da-body';

    // 2. Parse Markdown (GFM)
    if (typeof marked === 'undefined') {
        container.textContent = "Error: marked.js is required.";
        element.appendChild(container);
        return;
    }
    
    marked.setOptions({ gfm: true, breaks: false });
    container.innerHTML = marked.parse(markdown);

    // 3. Post-Processing: Loop door alle elementen
    
    // Verzamel eerst alle nodes om live DOM updates te vermijden
    const listItems = Array.from(container.querySelectorAll('li'));
    const codeBlocks = Array.from(container.querySelectorAll('pre > code'));

    // Process Tasks
    listItems.forEach(li => {
        // Check of het een task is (bevat input checkbox)
        if (li.querySelector('input[type="checkbox"]')) {
            const parentUl = li.parentElement;
            if(parentUl) parentUl.classList.add('da-task-list'); // Class op de UL zetten
            
            const newTaskItem = createTaskItem(li);
            if(newTaskItem) {
                li.replaceWith(newTaskItem);
            }
        }
    });

    // Process Code Blocks
    codeBlocks.forEach(block => {
        // Check of de parent een PRE is (dus block, niet inline)
        // marked wrapped code blocks in <pre>
        const pre = block.parentElement;
        if(pre && pre.tagName === 'PRE') {
            const langMatch = block.className.match(/language-(\w+)/);
            const lang = langMatch ? langMatch[1] : 'code';
            const code = block.textContent; // Tekst is veilig
            
            // Als de pre al vervangen is door een vorig loop, skip
            if(pre.parentElement.classList.contains('da-code-block')) return;

            const newBlock = createCodeBlock(lang, code, pre);
            pre.replaceWith(newBlock);
        }
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
      // Highlight alleen onder onze container
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
