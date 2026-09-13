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
    menu.setAttribute('aria-expanded',links.classList.contains('open')?'true':'false');
    const id=links.id||'primary-navigation';
    links.id=id;
    menu.setAttribute('aria-controls',id);
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

  /* Annïka animation layer — visual-only; preserves existing interactions. */
  document.body.classList.add('animation-ready');

  const nav=document.querySelector('.nav');
  const updateNav=()=>{
    if(nav)nav.classList.toggle('nav-scrolled',window.scrollY>18);
  };
  updateNav();
  window.addEventListener('scroll',updateNav,{passive:true});

  const motionReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealTargets=[
    ...document.querySelectorAll('.section-head'),
    ...document.querySelectorAll('.card'),
    ...document.querySelectorAll('.panel'),
    ...document.querySelectorAll('.feature-photo'),
    ...document.querySelectorAll('.cta-box'),
    ...document.querySelectorAll('.footer'),
    ...document.querySelectorAll('.legal article'),
    ...document.querySelectorAll('.contact-card')
  ];

  if(motionReduced){
    revealTargets.forEach(el=>el.classList.add('is-visible'));
  }else if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },{threshold:.12,rootMargin:'0px 0px -40px 0px'});

    document.querySelectorAll('.section-head').forEach(el=>observer.observe(el));
    document.querySelectorAll('.panel,.feature-photo,.cta-box,.footer,.legal article,.contact-card').forEach(el=>observer.observe(el));
    document.querySelectorAll('.card').forEach((el,index)=>{
      el.style.setProperty('--reveal-delay',`${(index%4)*90}ms`);
      observer.observe(el);
    });
  }else{
    revealTargets.forEach(el=>el.classList.add('is-visible'));
  }
});
