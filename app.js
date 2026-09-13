document.addEventListener('DOMContentLoaded',()=>{
  const main=document.querySelector('main');
  if(main&&!main.id)main.id='main-content';
  if(main&&!document.querySelector('.skip-link')){
    const skip=document.createElement('a');
    skip.className='skip-link';
    skip.href='#main-content';
    skip.textContent='Skip to content';
    document.body.prepend(skip);
  }

  const menu=document.querySelector('.menu');
  const links=document.querySelector('.links');
  const setMenuState=open=>{
    if(!menu||!links)return;
    links.classList.toggle('open',open);
    menu.setAttribute('aria-expanded',String(open));
  };
  if(menu&&links){
    menu.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-controls','primary-navigation');
    links.id='primary-navigation';
    menu.addEventListener('click',()=>setMenuState(!links.classList.contains('open')));
    links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenuState(false)));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenuState(false)});
  }

  const search=document.querySelector('[data-search]');
  const cards=[...document.querySelectorAll('[data-searchable]')];
  if(search&&cards.length){
    search.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase();
      cards.forEach(c=>c.classList.toggle('hidden',q&&!c.textContent.toLowerCase().includes(q)));
    });
  }
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
});
