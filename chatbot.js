(function () {
  if (window.__annikaChatLoaded) return;
  window.__annikaChatLoaded = true;

  function boot() {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/chatbot.css?v=7';
    document.head.appendChild(css);

    const root = document.createElement('div');
    root.className = 'annika-chat-root';
    root.innerHTML =
      '<button class="annika-chat-launcher" type="button" aria-label="Open Annïka Companion" aria-expanded="false" data-open="false" title="Drag to move • Click to chat">' +
        '<span class="annika-chat-orbit" aria-hidden="true"></span><span class="annika-chat-drag-badge" aria-hidden="true">↗</span><img class="annika-chat-mark" src="/assets/annika-mark-exact-visible.png?logo=3" alt="Annïka logo">' +
      '</button>' +
      '<section class="annika-chat-shell" aria-label="Annïka Companion" data-open="false" aria-hidden="true" inert>' +
        '<header class="annika-chat-top" data-chat-drag>' +
          '<div class="annika-chat-top-inner">' +
            '<div class="annika-chat-avatar"><img class="annika-chat-mark" src="/assets/annika-mark-exact-visible.png?logo=3" alt="Annïka logo"></div>' +
            '<div class="annika-chat-heading"><div class="annika-chat-title">Annïka Companion</div><div class="annika-chat-status">Product-aware site guide</div></div>' +
            '<div class="annika-chat-toolbar">' +
              '<button class="annika-chat-clear" type="button" aria-label="Start a new conversation" title="New conversation">↻</button>' +
              '<button class="annika-chat-close" type="button" aria-label="Close chat" title="Close">×</button>' +
            '</div>' +
          '</div>' +
        '</header>' +
        '<div class="annika-chat-body">' +
          '<div class="annika-chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
          '<div class="annika-chat-suggestions" aria-label="Suggested questions"></div>' +
          '<div class="annika-chat-composer">' +
            '<form class="annika-chat-form">' +
              '<textarea class="annika-chat-input" rows="1" maxlength="3000" placeholder="Ask Annïka anything…" aria-label="Message Annïka"></textarea>' +
              '<button class="annika-chat-send" type="submit" aria-label="Send message" title="Send message"><span aria-hidden="true">↗</span></button>' +
            '</form>' +
            '<div class="annika-chat-composer-meta"><span class="annika-chat-footnote">Enter to send · Shift+Enter for a new line</span><span class="annika-chat-counter" aria-live="polite">0 / 3000</span></div>' +
          '</div>' +
        '</div>' +
      '</section>';
    document.body.appendChild(root);

    const launcher = root.querySelector('.annika-chat-launcher');
    const shell = root.querySelector('.annika-chat-shell');
    const close = root.querySelector('.annika-chat-close');
    const clear = root.querySelector('.annika-chat-clear');
    const messages = root.querySelector('.annika-chat-messages');
    const form = root.querySelector('.annika-chat-form');
    const input = root.querySelector('.annika-chat-input');
    const send = root.querySelector('.annika-chat-send');
    const status = root.querySelector('.annika-chat-status');
    const counter = root.querySelector('.annika-chat-counter');
    const dragHeader = root.querySelector('[data-chat-drag]');
    const suggestions = root.querySelector('.annika-chat-suggestions');
    const STORE_KEY = 'annikaChatSession-v2';
    const state = { open:false, busy:false, history:[], messages:[], dragMoved:false };

    const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
    const saveSession = () => {
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify({
          history: state.history.slice(-18),
          messages: state.messages.slice(-20).map(m => ({
            role:m.role, content:m.content,
            sources:Array.isArray(m.sources) ? m.sources.slice(0,6) : [],
            products:Array.isArray(m.products) ? m.products.slice(0,8) : [],
            mode:m.mode || ''
          }))
        }));
      } catch (e) {}
    };
    const safeHref = (value, fallback) => {
      try {
        const u = new URL(String(value || ''), window.location.origin);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback;
        if (u.origin !== window.location.origin && u.protocol !== 'https:') return fallback;
        return u.href;
      } catch (e) { return fallback; }
    };
    const scrollToBottom = () => { messages.scrollTop = messages.scrollHeight; };

    const addSources = (row, sources) => {
      if (!Array.isArray(sources) || !sources.length) return;
      const box = document.createElement('div');
      box.className = 'annika-chat-sources';
      const label = document.createElement('div');
      label.className = 'annika-chat-sources-label';
      label.textContent = 'Helpful sources';
      box.appendChild(label);
      sources.slice(0, 5).forEach(source => {
        if (!source || !source.url) return;
        const href = safeHref(source.url, '');
        if (!href) return;
        const a = document.createElement('a');
        a.className = 'annika-chat-source';
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = String(source.title || source.url).slice(0, 150);
        box.appendChild(a);
      });
      if (box.children.length > 1) row.appendChild(box);
    };

    const addProducts = (row, found) => {
      if (!Array.isArray(found) || !found.length) return;
      const box = document.createElement('div');
      box.className = 'annika-chat-products';
      const heading = document.createElement('div');
      heading.className = 'annika-chat-products-heading';
      heading.textContent = 'Catalog matches';
      box.appendChild(heading);
      found.slice(0, 6).forEach(product => {
        if (!product || !product.name) return;
        const a = document.createElement('a');
        a.className = 'annika-chat-product-card';
        a.href = safeHref(product.url, '/fashion.html#shop-products');
        a.setAttribute('aria-label', 'Find ' + product.name + ' in the shop');
        const name = document.createElement('strong');
        name.textContent = String(product.name).slice(0, 120);
        const section = document.createElement('span');
        section.textContent = String(product.section || 'Annïka catalog').slice(0, 90);
        const cta = document.createElement('em');
        cta.textContent = 'Find in shop ↗';
        a.append(name, section, cta);
        box.appendChild(a);
      });
      if (box.children.length > 1) row.appendChild(box);
    };

    const drawMessage = entry => {
      const role = entry.role === 'user' ? 'user' : 'assistant';
      const row = document.createElement('div');
      row.className = 'annika-chat-row ' + (role === 'user' ? 'user' : 'bot');
      const bubble = document.createElement('div');
      bubble.className = 'annika-chat-bubble';
      bubble.textContent = String(entry.content || '');
      row.appendChild(bubble);
      if (role !== 'user') {
        addSources(row, entry.sources);
        addProducts(row, entry.products);
        const actions = document.createElement('div');
        actions.className = 'annika-chat-bubble-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'annika-chat-copy';
        copy.textContent = 'Copy answer';
        copy.setAttribute('aria-label', 'Copy assistant answer');
        copy.addEventListener('click', async () => {
          const text = String(entry.content || '');
          try {
            await navigator.clipboard.writeText(text);
            copy.textContent = 'Copied ✓';
            setTimeout(() => { copy.textContent = 'Copy answer'; }, 1400);
          } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); copy.textContent = 'Copied ✓'; }
            catch (err) { copy.textContent = 'Select text to copy'; }
            ta.remove();
          }
        });
        actions.appendChild(copy);
        row.appendChild(actions);
      }
      messages.appendChild(row);
      scrollToBottom();
      return row;
    };

    const addMessage = entry => {
      const clean = {
        role:entry.role === 'user' ? 'user' : 'assistant',
        content:String(entry.content || '').slice(0,12000),
        sources:Array.isArray(entry.sources) ? entry.sources.slice(0,6) : [],
        products:Array.isArray(entry.products) ? entry.products.slice(0,8) : [],
        mode:entry.mode || ''
      };
      state.messages.push(clean);
      drawMessage(clean);
      saveSession();
      return clean;
    };

    const addWelcome = () => {
      const row = document.createElement('div');
      row.className = 'annika-chat-row bot';
      const bubble = document.createElement('div');
      bubble.className = 'annika-chat-bubble';
      bubble.innerHTML = '<div class="annika-chat-welcome"><div class="annika-chat-kicker">For faith. For confidence. For life.</div><h4>Meet your Annïka companion.</h4><p>Explore the site, find products from the catalog, ask follow-up questions, and open source links when available. I will be clear when an answer needs live AI or current verification.</p></div>';
      row.appendChild(bubble);
      messages.appendChild(row);
    };

    const getPrompts = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('fashion')) return [
        ['Find a hijab', 'Find hijab products for me.'],
        ['Browse the full catalog', 'How can I browse the complete product catalog?'],
        ['Travel essentials', 'Suggest practical travel essentials from the catalog.'],
        ['All product names', 'Where can I find the full product name list?']
      ];
      if (path.includes('quran')) return [
        ['Quran resources', 'Help me explore Quran resources.'],
        ['Dua & reminders', 'Where can I find duas and reminders?'],
        ['Learning guide', 'How should I use the Quran & Hadith section?'],
        ['Explore lifestyle', 'Show me the Lifestyle section.']
      ];
      if (path.includes('safety')) return [
        ['Safety resources', 'Show me practical safety resources.'],
        ['Digital privacy', 'What should I check to protect my online privacy?'],
        ['Emergency planning', 'Help me make a general personal safety checklist.'],
        ['Explore Annïka', 'What else can I explore on Annïka?']
      ];
      return [
        ['Find products', 'Help me find products in the Annïka catalog.'],
        ['What is Annïka?', 'What can I do on Annïka?'],
        ['Quran & Hadith', 'Help me explore Quran & Hadith resources.'],
        ['All product names', 'Where can I find the full product name list?']
      ];
    };

    const renderSuggestions = () => {
      suggestions.innerHTML = '';
      getPrompts().forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'annika-chat-suggestion';
        button.textContent = item[0];
        button.addEventListener('click', () => { setOpen(true); ask(item[1]); });
        suggestions.appendChild(button);
      });
    };

    const showTyping = () => {
      const row = document.createElement('div');
      row.className = 'annika-chat-row bot annika-chat-typing-row';
      const bubble = document.createElement('div');
      bubble.className = 'annika-chat-bubble';
      bubble.setAttribute('aria-label', 'Annïka is preparing a response');
      bubble.innerHTML = '<span class="annika-chat-typing"><span></span><span></span><span></span></span>';
      row.appendChild(bubble);
      messages.appendChild(row);
      scrollToBottom();
      return row;
    };

    const setBusy = busy => {
      state.busy = busy;
      send.disabled = busy;
      input.disabled = busy;
      root.classList.toggle('is-busy', busy);
      if (!busy && state.open) input.focus();
    };

    const applyShellSide = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.min(390, window.innerWidth - 28);
      const h = Math.min(680, window.innerHeight - 120);
      const enoughRight = rect.left + w <= window.innerWidth - 8;
      shell.style.left = enoughRight ? '0px' : 'auto';
      shell.style.right = enoughRight ? 'auto' : '0px';
      const enoughBelow = rect.top + h + 92 <= window.innerHeight - 8;
      shell.style.top = enoughBelow ? '86px' : 'auto';
      shell.style.bottom = enoughBelow ? 'auto' : '86px';
    };

    const setOpen = open => {
      state.open = open;
      launcher.dataset.open = String(open);
      shell.dataset.open = String(open);
      launcher.setAttribute('aria-expanded', String(open));
      shell.setAttribute('aria-hidden', String(!open));
      try { shell.inert = !open; } catch (e) {}
      if (open) {
        applyShellSide();
        setTimeout(() => input.focus(), 100);
      }
    };

    async function ask(text) {
      const message = String(text || '').trim().slice(0, 3000);
      if (!message || state.busy) return;
      addMessage({role:'user', content:message});
      state.history.push({role:'user', content:message});
      state.history = state.history.slice(-18);
      saveSession();
      input.value = '';
      input.style.height = 'auto';
      counter.textContent = '0 / 3000';
      setBusy(true);
      const typing = showTyping();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = setTimeout(() => { if (controller) controller.abort(); }, 45000);
      try {
        const response = await fetch('/api/chat', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({message, history:state.history.slice(-18), page:window.location.pathname}),
          signal:controller ? controller.signal : undefined
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Chat service unavailable');
        const answer = String(data.answer || 'I could not prepare an answer just now. Please try again.').trim();
        typing.remove();
        state.history.push({role:'assistant', content:answer});
        state.history = state.history.slice(-18);
        addMessage({role:'assistant', content:answer, sources:data.sources, products:data.products, mode:data.mode});
        status.textContent = data.mode === 'ai' ? 'AI connected · sources when available' : 'Catalog & site guide mode';
      } catch (error) {
        typing.remove();
        const timedOut = error && error.name === 'AbortError';
        const failed = timedOut
          ? 'That took too long to respond. Please try the question again.'
          : 'I could not connect to the chat service just now. You can still browse the site and catalog, or try again in a moment.';
        addMessage({role:'assistant', content:failed, mode:'error'});
      } finally {
        clearTimeout(timeout);
        setBusy(false);
      }
    }

    const restorePosition = () => {
      try {
        const p = JSON.parse(localStorage.getItem('annikaChatPosition') || 'null');
        if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) {
          root.style.left = clamp(p.left, 8, window.innerWidth - 76) + 'px';
          root.style.top = clamp(p.top, 8, window.innerHeight - 76) + 'px';
          root.style.right = 'auto'; root.style.bottom = 'auto';
          return;
        }
      } catch (e) {}
      root.style.left = Math.max(12, window.innerWidth - 92) + 'px';
      root.style.top = Math.max(12, window.innerHeight - 92) + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
    };

    const savePosition = () => {
      try {
        const r = root.getBoundingClientRect();
        localStorage.setItem('annikaChatPosition', JSON.stringify({left:r.left, top:r.top}));
      } catch (e) {}
    };

    const bindDrag = element => {
      let active = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;
      const onMove = event => {
        if (!active) return;
        const dx = event.clientX - startX, dy = event.clientY - startY;
        const nextLeft = clamp(baseLeft + dx, 8, window.innerWidth - 76);
        const nextTop = clamp(baseTop + dy, 8, window.innerHeight - 76);
        root.style.left = nextLeft + 'px'; root.style.top = nextTop + 'px';
        root.style.right = 'auto'; root.style.bottom = 'auto';
        state.dragMoved = Math.abs(dx) + Math.abs(dy) > 6;
        if (state.open) applyShellSide();
      };
      const onUp = () => {
        if (!active) return;
        active = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (state.dragMoved) {
          savePosition();
          setTimeout(() => { state.dragMoved = false; }, 180);
        }
      };
      element.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        if (element === dragHeader && event.target && event.target.closest && event.target.closest('button')) return;
        active = true;
        const rect = root.getBoundingClientRect();
        startX = event.clientX; startY = event.clientY; baseLeft = rect.left; baseTop = rect.top;
        if (element.setPointerCapture) {
          try { element.setPointerCapture(event.pointerId); } catch (e) {}
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
    };

    launcher.addEventListener('click', () => { if (!state.dragMoved) setOpen(!state.open); });
    close.addEventListener('click', () => setOpen(false));
    clear.addEventListener('click', () => {
      state.history = []; state.messages = [];
      try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
      messages.innerHTML = '';
      addWelcome();
      status.textContent = 'New conversation · ready to help';
      input.value = ''; input.style.height = 'auto'; counter.textContent = '0 / 3000';
    });
    form.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      counter.textContent = input.value.length + ' / 3000';
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.open) setOpen(false); });
    bindDrag(launcher);
    bindDrag(dragHeader);
    window.addEventListener('resize', () => {
      const r = root.getBoundingClientRect();
      root.style.left = clamp(r.left, 8, window.innerWidth - 76) + 'px';
      root.style.top = clamp(r.top, 8, window.innerHeight - 76) + 'px';
      if (state.open) applyShellSide();
    }, {passive:true});

    suggestions.innerHTML = '';
    const path = window.location.pathname.toLowerCase();
    const prompts = path.includes('fashion')
      ? [['Find a hijab','Find hijab products for me.'],['Browse the full catalog','How can I browse the complete product catalog?'],['Travel essentials','Suggest practical travel essentials from the catalog.'],['All product names','Where can I find the full product name list?']]
      : path.includes('quran')
        ? [['Quran resources','Help me explore Quran resources.'],['Dua & reminders','Where can I find duas and reminders?'],['Learning guide','How should I use the Quran & Hadith section?'],['Explore lifestyle','Show me the Lifestyle section.']]
        : path.includes('safety')
          ? [['Safety resources','Show me practical safety resources.'],['Digital privacy','What should I check to protect my online privacy?'],['Emergency planning','Help me make a general personal safety checklist.'],['Explore Annïka','What else can I explore on Annïka?']]
          : [['Find products','Help me find products in the Annïka catalog.'],['What is Annïka?','What can I do on Annïka?'],['Quran & Hadith','Help me explore Quran & Hadith resources.'],['All product names','Where can I find the full product name list?']];
    prompts.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'annika-chat-suggestion';
      button.textContent = item[0];
      button.addEventListener('click', () => { setOpen(true); ask(item[1]); });
      suggestions.appendChild(button);
    });

    restorePosition();
    let restored = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (saved && Array.isArray(saved.history) && Array.isArray(saved.messages)) {
        state.history = saved.history.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-18);
        state.messages = saved.messages.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-20);
        state.messages.forEach(drawMessage);
        restored = state.messages.length > 0;
      }
    } catch (e) {}
    if (!restored) addWelcome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();