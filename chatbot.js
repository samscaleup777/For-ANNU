(()=>{
  if(window.__annikaChatLoaded)return;window.__annikaChatLoaded=true;
  const boot=()=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/chatbot.css?v=4';document.head.appendChild(css);
    const root=document.createElement('div');root.className='annika-chat-root';root.innerHTML=''+
      '<button class="annika-chat-launcher" type="button" aria-label="Open Annïka Companion" aria-expanded="false" data-open="false" title="Drag to move • Click to chat">'+
      '<span class="annika-chat-orbit"></span><span class="annika-chat-drag-badge" aria-hidden="true">↗</span><img src="/assets/annika-mark-exact-visible.png" alt="Annïka"></button>'+
      '<section class="annika-chat-shell" aria-label="Annïka AI Companion" data-open="false" aria-hidden="true">'+
      '<header class="annika-chat-top" data-chat-drag><div class="annika-chat-top-inner">'+
      '<div class="annika-chat-avatar"><img src="/assets/annika-mark-exact-visible.png" alt=""></div>'+
      '<div><div class="annika-chat-title">Annïka Companion</div><div class="annika-chat-status">A calm guide to the Annïka library</div></div>'+
      '<button class="annika-chat-close" type="button" aria-label="Close chat">×</button></div></header>'+
      '<div class="annika-chat-body"><div class="annika-chat-messages" aria-live="polite"></div>'+
      '<div class="annika-chat-suggestions" aria-label="Suggested questions">'+
      '<button class="annika-chat-suggestion" type="button" data-q="What is Annïka?">What is Annïka?</button>'+
      '<button class="annika-chat-suggestion" type="button" data-q="Show me the modest fashion shop.">Shop modest fashion</button>'+
      '<button class="annika-chat-suggestion" type="button" data-q="Where can I find the safety resources?">Safety resources</button>'+
      '<button class="annika-chat-suggestion" type="button" data-q="Help me explore Quran & Hadith resources.">Quran &amp; Hadith</button></div>'+
      '<div class="annika-chat-composer"><form class="annika-chat-form">'+
      '<textarea class="annika-chat-input" rows="1" maxlength="1200" placeholder="Ask Annïka something…" aria-label="Message Annïka"></textarea>'+
      '<button class="annika-chat-send" type="submit" aria-label="Send message"><span aria-hidden="true">↗</span></button></form>'+
      '<div class="annika-chat-footnote">Drag the Annïka mark to move the companion anywhere on the page.</div></div></div></section>';
    document.body.appendChild(root);
    const launcher=root.querySelector('.annika-chat-launcher'),shell=root.querySelector('.annika-chat-shell'),close=root.querySelector('.annika-chat-close'),messages=root.querySelector('.annika-chat-messages'),form=root.querySelector('.annika-chat-form'),input=root.querySelector('.annika-chat-input'),send=root.querySelector('.annika-chat-send'),dragHeader=root.querySelector('[data-chat-drag]'),suggestions=[...root.querySelectorAll('.annika-chat-suggestion')];
    const state={open:false,busy:false,history:[],dragMoved:false};
    const addBubble=(text,who='bot')=>{const row=document.createElement('div');row.className='annika-chat-row '+who;const bubble=document.createElement('div');bubble.className='annika-chat-bubble';bubble.textContent=text;row.appendChild(bubble);messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return bubble};
    const addWelcome=()=>{const row=document.createElement('div');row.className='annika-chat-row bot';const bubble=document.createElement('div');bubble.className='annika-chat-bubble';bubble.innerHTML='<div class="annika-chat-welcome"><div class="annika-chat-kicker">For faith. For confidence. For life.</div><h4>How can I help?</h4><p>I can guide you around Annïka’s fashion shop, faith, safety and lifestyle resources, or help you find the right place to start.</p></div>';row.appendChild(bubble);messages.appendChild(row)};
    const clamp=(v,min,max)=>Math.min(Math.max(v,min),Math.max(min,max));
    const applyShellSide=()=>{const rect=root.getBoundingClientRect();const w=Math.min(390,window.innerWidth-28);const h=Math.min(680,window.innerHeight-120);const enoughRight=rect.left+w<=window.innerWidth-8;shell.style.left=enoughRight?'0px':'auto';shell.style.right=enoughRight?'auto':'0px';const enoughBelow=rect.top+h+92<=window.innerHeight-8;shell.style.top=enoughBelow?'86px':'auto';shell.style.bottom=enoughBelow?'auto':'86px'};
    const setOpen=open=>{state.open=open;launcher.dataset.open=String(open);shell.dataset.open=String(open);launcher.setAttribute('aria-expanded',String(open));shell.setAttribute('aria-hidden',String(!open));if(open){applyShellSide();setTimeout(()=>input.focus(),120)}};
    const setBusy=busy=>{state.busy=busy;send.disabled=busy;input.disabled=busy};
    const showTyping=()=>addBubble('typing','bot');const replaceTyping=(bubble,text)=>{bubble.textContent=text};
    const ask=async text=>{const message=(text||'').trim();if(!message||state.busy)return;addBubble(message,'user');state.history.push({role:'user',content:message});setBusy(true);input.value='';input.style.height='auto';const typing=showTyping();typing.innerHTML='<span class="annika-chat-typing"><span></span><span></span><span></span></span>';try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:state.history.slice(-10),page:window.location.pathname})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Chat service unavailable');const answer=(data.answer||'I’m sorry, I could not answer that just now. Please try again.').trim();replaceTyping(typing,answer);state.history.push({role:'assistant',content:answer})}catch(error){replaceTyping(typing,'I’m having trouble connecting right now. Please try again in a moment.')}finally{setBusy(false);input.focus()}};
    const restorePosition=()=>{try{const p=JSON.parse(localStorage.getItem('annikaChatPosition')||'null');if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top)){root.style.left=clamp(p.left,8,window.innerWidth-76)+'px';root.style.top=clamp(p.top,8,window.innerHeight-76)+'px';root.style.right='auto';root.style.bottom='auto';return}}catch(e){}root.style.left=Math.max(12,window.innerWidth-92)+'px';root.style.top=Math.max(12,window.innerHeight-92)+'px';root.style.right='auto';root.style.bottom='auto'};
    const savePosition=()=>{try{const r=root.getBoundingClientRect();localStorage.setItem('annikaChatPosition',JSON.stringify({left:r.left,top:r.top}))}catch(e){}};
    const bindDrag=el=>{let active=false,startX=0,startY=0,baseLeft=0,baseTop=0;
      const onMove=e=>{if(!active)return;const dx=e.clientX-startX,dy=e.clientY-startY;const nextLeft=clamp(baseLeft+dx,8,window.innerWidth-76),nextTop=clamp(baseTop+dy,8,window.innerHeight-76);root.style.left=nextLeft+'px';root.style.top=nextTop+'px';root.style.right='auto';root.style.bottom='auto';state.dragMoved=Math.abs(dx)+Math.abs(dy)>6;if(state.open)applyShellSide()};
      const onUp=()=>{if(!active)return;active=false;window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);if(state.dragMoved){savePosition();setTimeout(()=>state.dragMoved=false,120)}};
      el.addEventListener('pointerdown',ev=>{if(ev.button!==undefined&&ev.button!==0)return;active=true;const rect=root.getBoundingClientRect();startX=ev.clientX;startY=ev.clientY;baseLeft=rect.left;baseTop=rect.top;el.setPointerCapture?.(ev.pointerId);window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);ev.preventDefault()});
    };
    launcher.addEventListener('click',()=>{if(state.dragMoved)return;setOpen(!state.open)});close.addEventListener('click',()=>setOpen(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)setOpen(false)});bindDrag(launcher);bindDrag(dragHeader);
    form.addEventListener('submit',e=>{e.preventDefault();ask(input.value)});input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,100)+'px'});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
    suggestions.forEach(button=>button.addEventListener('click',()=>{setOpen(true);ask(button.dataset.q)}));
    window.addEventListener('resize',()=>{const r=root.getBoundingClientRect();root.style.left=clamp(r.left,8,window.innerWidth-76)+'px';root.style.top=clamp(r.top,8,window.innerHeight-76)+'px';if(state.open)applyShellSide()},{passive:true});
    restorePosition();addWelcome();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();