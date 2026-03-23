/**
 * Dark Angel - Core Renderer v8.1 (Stable & Fixed)
 * 
 * - Geen CSS injectie (volledige gebruikerscontrole).
 * - Behoudt inline HTML in taken.
 * - Geen DOM conflicts (replaceWith bug fixed).
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

  // Code Block: Altijd nieuwe structuur aanmaken (geen hergebruik van DOM nodes)
  function createCodeBlock(lang, codeText) {
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
    btn.onclick = () => copyToClipboard(btn, codeText);
    
    header.appendChild(langSpan);
    header.appendChild(btn);
    
    const pre = document.createElement('pre');
    const codeTag = document.createElement('code');
    if(lang) codeTag.className = `language-${lang}`;
    codeTag.textContent = codeText;
    pre.appendChild(codeTag);
    
    container.appendChild(header);
    container.appendChild(pre);
    
    return container;
  }

  // Task Item: Zet <li><input> om naar custom structuur
  function createTaskItem(li) {
    const input = li.querySelector('input[type="checkbox"]');
    if (!input) return null; 

    const isChecked = input.hasAttribute('checked') || input.checked;
    
    // Clone de LI node om innerlijke HTML te behouden
    const newLi = li.cloneNode(true);
    
    // Verwijder de originele checkbox input uit de clone
    const inputInClone = newLi.querySelector('input[type="checkbox"]');
    if(inputInClone) inputInClone.remove();
    
    // Reset classes en zet status
    newLi.className = 'da-task-item'; 
    if(isChecked) newLi.classList.add('checked');
    
    // Maak custom checkbox
    const checkDiv = document.createElement('div');
    checkDiv.className = 'da-task-check';
    checkDiv.setAttribute('role', 'checkbox');
    checkDiv.setAttribute('aria-checked', isChecked);
    checkDiv.setAttribute('tabindex', '0');
    checkDiv.innerHTML = checkIcon;
    
    // Wrap content in div
    const contentDiv = document.createElement('div');
    contentDiv.className = 'da-task-content';
    
    // Verplaats alle kinderen (text, code, strong, etc.) naar contentDiv
    while (newLi.firstChild) {
        contentDiv.appendChild(newLi.firstChild);
    }
    
    // Nieuwe structuur opbouwen
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

    // 2. Parse Markdown
    if (typeof marked === 'undefined') {
        container.textContent = "Error: marked.js is required.";
        element.appendChild(container);
        return;
    }
    
    marked.setOptions({ gfm: true, breaks: false });
    container.innerHTML = marked.parse(markdown);

    // 3. Post-Processing
    
    // Process Tasks
    // We selecteren alle LIs en filteren degene met een checkbox
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
    // We selecteren alle CODE blocks die een PRE als parent hebben
    const codeBlocks = Array.from(container.querySelectorAll('pre > code'));
    codeBlocks.forEach(block => {
        const pre = block.parentElement; // De <pre> tag
        
        // Extract info
        const langMatch = block.className.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';
        const codeText = block.textContent; // Veilige tekst extractie
        
        // Maak nieuw blok
        const newBlock = createCodeBlock(lang, codeText);
        
        // Vervang de oude <pre> met de nieuwe wrapper
        // Dit is veilig omdat newBlock een vers element is
        pre.replaceWith(newBlock);
    });

    // 4. Inject in DOM
    element.appendChild(container);

    // 5. Render Extensions
    
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
