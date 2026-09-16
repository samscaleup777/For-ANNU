(()=>{
  if(window.__annikaChatLoaded)return;window.__annikaChatLoaded=true;
  const boot=()=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/chatbot.css?v=1';document.head.appendChild(css);
    const root=document.createElement('div');root.className='annika-chat-root';root.innerHTML=`
      <button class="annika-chat-launcher" type="button" aria-label="Open Annïka Companion" aria-expanded="false" data-open="false">
        <img src="/assets/annika-mark-exact-visible.png" alt="Annïka">
      </button>
      <section class="annika-chat-shell" aria-label="Annïka AI Companion" data-open="false" aria-hidden="true">
        <header class="annika-chat-top">
          <div class="annika-chat-top-inner">
            <div class="annika-chat-avatar"><img src="/assets/annika-mark-exact-visible.png" alt=""></div>
            <div><div class="annika-chat-title">Annïka Companion</div><div class="annika-chat-status">A calm guide to the Annïka library</div></div>
            <button class="annika-chat-close" type="button" aria-label="Close chat">×</button>
          </div>
        </header>
        <div class="annika-chat-body">
          <div class="annika-chat-messages" aria-live="polite"></div>
          <div class="annika-chat-suggestions" aria-label="Suggested questions">
            <button class="annika-chat-suggestion" type="button" data-q="What is Annïka?">What is Annïka?</button>
            <button class="annika-chat-suggestion" type="button" data-q="Show me the modest fashion resources.">Modest fashion</button>
            <button class="annika-chat-suggestion" type="button" data-q="Where can I find the safety resources?">Safety resources</button>
            <button class="annika-chat-suggestion" type="button" data-q="Help me explore Quran & Hadith resources.">Quran &amp; Hadith</button>
          </div>
          <div class="annika-chat-composer">
            <form class="annika-chat-form">
              <textarea class="annika-chat-input" rows="1" maxlength="1200" placeholder="Ask Annïka something…" aria-label="Message Annïka"></textarea>
              <button class="annika-chat-send" type="submit" aria-label="Send message"><span aria-hidden="true">↗</span></button>
            </form>
            <div class="annika-chat-footnote">AI can make mistakes. For sensitive religious or safety matters, verify important details.</div>
          </div>
        </div>
      </section>`;
    document.body.appendChild(root);
    const launcher=root.querySelector('.annika-chat-launcher'),shell=root.querySelector('.annika-chat-shell'),close=root.querySelector('.annika-chat-close'),messages=root.querySelector('.annika-chat-messages'),form=root.querySelector('.annika-chat-form'),input=root.querySelector('.annika-chat-input'),send=root.querySelector('.annika-chat-send'),suggestions=[...root.querySelectorAll('.annika-chat-suggestion')];
    const state={open:false,busy:false,history:[]};
    const addBubble=(text,who='bot')=>{const row=document.createElement('div');row.className=`annika-chat-row ${who}`;const bubble=document.createElement('div');bubble.className='annika-chat-bubble';bubble.textContent=text;row.appendChild(bubble);messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return bubble};
    const addWelcome=()=>{const row=document.createElement('div');row.className='annika-chat-row bot';const bubble=document.createElement('div');bubble.className='annika-chat-bubble';bubble.innerHTML='<div class="annika-chat-welcome"><div class="annika-chat-kicker">For faith. For confidence. For life.</div><h4>How can I help?</h4><p>I can guide you around Annïka’s fashion, faith, safety and lifestyle resources, or help you find the right place to start.</p></div>';row.appendChild(bubble);messages.appendChild(row)};
    const setOpen=open=>{state.open=open;launcher.dataset.open=String(open);shell.dataset.open=String(open);launcher.setAttribute('aria-expanded',String(open));shell.setAttribute('aria-hidden',String(!open));if(open){setTimeout(()=>input.focus(),120)}};
    const setBusy=busy=>{state.busy=busy;send.disabled=busy;input.disabled=busy};
    const showTyping=()=>addBubble('typing','bot');
    const replaceTyping=(bubble,text)=>{bubble.textContent=text;};
    const ask=async text=>{
      const message=(text||'').trim();if(!message||state.busy)return;
      addBubble(message,'user');state.history.push({role:'user',content:message});setBusy(true);input.value='';input.style.height='auto';
      const typing=showTyping();typing.innerHTML='<span class="annika-chat-typing"><span></span><span></span><span></span></span>';
      try{
        const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:state.history.slice(-10),page:window.location.pathname})});
        const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Chat service unavailable');
        const answer=(data.answer||'I’m sorry, I could not answer that just now. Please try again.').trim();replaceTyping(typing,answer);state.history.push({role:'assistant',content:answer});
      }catch(error){replaceTyping(typing,'I’m having trouble connecting right now. Please try again in a moment.');}
      finally{setBusy(false);input.focus();}
    };
    launcher.addEventListener('click',()=>setOpen(!state.open));close.addEventListener('click',()=>setOpen(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)setOpen(false)});
    form.addEventListener('submit',e=>{e.preventDefault();ask(input.value)});
    input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,100)+'px'});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
    suggestions.forEach(button=>button.addEventListener('click',()=>{setOpen(true);ask(button.dataset.q)}));
    addWelcome();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();