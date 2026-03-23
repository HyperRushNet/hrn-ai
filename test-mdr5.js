/**
 * Dark Angel - Core Markdown Renderer
 * Versie: 7.0 Core (Geen styling, puur structuur)
 * 
 * Input: Markdown string.
 * Output: Semantic HTML met class hooks.
 * Styling: Volledig over te nemen door gebruiker via CSS.
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

  // --- COMPONENT BUILDERS ---

  // 1. Code Block Generator
  function createCodeBlock(lang, code) {
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
    
    const pre = document.createElement('pre');
    const codeTag = document.createElement('code');
    if(lang) codeTag.className = `language-${lang}`;
    codeTag.textContent = code;
    
    pre.appendChild(codeTag);
    container.appendChild(header);
    container.appendChild(pre);
    
    return container;
  }

  // 2. Task List Generator
  function createTaskList(tasks) {
    const ul = document.createElement('ul');
    ul.className = 'da-task-list';
    
    tasks.forEach(t => {
      const li = document.createElement('li');
      if(t.checked) li.className = 'checked';
      
      const check = document.createElement('div');
      check.className = 'da-task-check';
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', !!t.checked);
      check.setAttribute('tabindex', '0');
      check.innerHTML = checkIcon;
      
      const content = document.createElement('div');
      content.className = 'da-task-content';
      // Parse basic inline code for tasks
      content.innerHTML = t.text.replace(/`([^`]+)`/g, '<code>$1</code>');
      
      li.appendChild(check);
      li.appendChild(content);
      ul.appendChild(li);
    });
    
    return ul;
  }

  // --- MAIN RENDER FUNCTION ---

  /**
   * Rendert markdown naar HTML in een target element.
   * @param {HTMLElement} element - De container waar gerenderd wordt.
   * @param {String} markdown - De ruwe markdown tekst.
   */
  function render(element, markdown) {
    if(!element || !markdown) return;

    // Clear
    element.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'da-body';

    // 1. Tasks Extractie
    // We zoeken naar task lists in de markdown voordat marked er aankomt
    // Dit is een simpele regex extractie. 
    // Format: - [ ] task of - [x] task
    const taskRegex = /^- \[([ x])\] (.*)$/gm;
    const tasks = [];
    let mdClean = markdown;
    
    // Als er tasks zijn, halen we ze uit de markdown en stoppen we ze in een custom lijst
    // MARKED.js maakt standaard <li><input type="checkbox">... dit vervangen we door onze custom hooks
    // Voor maximale controle gebruiken we hier custom parsing.
    
    // Eerst voeren we door marked.js voor de rest
    if (typeof marked !== 'undefined') {
      // Config: geen standaard mangle, etc.
      marked.setOptions({ gfm: true, breaks: false });
      container.innerHTML = marked.parse(mdClean);
    } else {
      container.textContent = markdown;
      element.appendChild(container);
      return;
    }

    // 2. Post-Processing: Tasks omvormen
    // Marked zet tasks om naar: <li><input type="checkbox" ...> text</li>
    // Wij vervangen dit door onze custom structuur
    const listItems = container.querySelectorAll('li');
    
    listItems.forEach(li => {
      const input = li.querySelector('input[type="checkbox"]');
      if(input) {
        const isChecked = input.hasAttribute('checked') || input.checked;
        const text = li.textContent.trim(); // Haal tekst na input
        
        // Maak nieuwe structuur
        const newLi = document.createElement('li');
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
        // We halen de HTML inhoud behalve de input
        // Een beetje hacky, maar effectief voor GFM tasks
        let htmlContent = '';
        li.childNodes.forEach(node => {
          if(node.nodeType === 3 || (node.nodeType === 1 && node.tagName !== 'INPUT')) {
            htmlContent += node.nodeType === 3 ? node.textContent : node.outerHTML;
          }
        });
        contentDiv.innerHTML = htmlContent;
        
        newLi.appendChild(checkDiv);
        newLi.appendChild(contentDiv);
        
        // Vervang de parent <li> met onze nieuwe <li>
        // OF we kunnen de parent ul een class geven
        const parentUl = li.parentNode;
        if(parentUl && !parentUl.classList.contains('da-task-list')) {
           parentUl.classList.add('da-task-list');
        }
        
        li.replaceWith(newLi);
      }
    });

    // 3. Code Blocks
    // Marked maakt <pre><code class="language-xxx">
    const codeBlocks = container.querySelectorAll('pre > code');
    codeBlocks.forEach(block => {
      const langMatch = block.className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : 'code';
      const code = block.textContent;
      
      // Alleen vervangen als het geen inline code is (prism check)
      if(block.parentNode.tagName === 'PRE') {
         const newBlock = createCodeBlock(lang, code);
         block.parentNode.replaceWith(newBlock);
      }
    });

    element.appendChild(container);

    // 4. Math (KaTeX)
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }

    // 5. Prism Highlighting
    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(element);
    }

    // 6. Interaction for Tasks
    container.addEventListener('click', e => {
      const check = e.target.closest('.da-task-check');
      if (check) {
        const li = check.closest('.da-task-item') || check.parentElement;
        const isChecked = li.classList.toggle('checked');
        check.setAttribute('aria-checked', isChecked);
      }
    });

    container.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.classList.contains('da-task-check')) {
          e.preventDefault();
          const li = e.target.closest('.da-task-item') || e.target.parentElement;
          const isChecked = li.classList.toggle('checked');
          e.target.setAttribute('aria-checked', isChecked);
        }
      }
    });
  }

  // --- EXPORT ---
  global.DarkAngel = {
    render: render
  };

})(window);
