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

  const path=window.location.pathname.toLowerCase();
  const pageClass=path.includes('fashion')?'page-fashion':path.includes('quran-hadith')?'page-quran':path.includes('safety')?'page-safety':path.includes('lifestyle')?'page-lifestyle':path.includes('blog')?'page-blog':path.includes('about')?'page-about':path.includes('contact')?'page-contact':'page-home';
  document.body.classList.add(pageClass);

  const nav=document.querySelector('.nav');
  const updateNav=()=>{if(nav)nav.classList.toggle('nav-scrolled',window.scrollY>22);};
  updateNav();
  window.addEventListener('scroll',updateNav,{passive:true});

  const motionReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealTargets=[
    ...document.querySelectorAll('.section-head,.card,.panel,.feature-photo,.cta-box,.footer,.legal article,.contact-card,.fashion-page .topic-card,.fashion-page .fashion-video-block')
  ];
  const showAll=()=>revealTargets.forEach(el=>el.classList.add('is-visible'));

  if(motionReduced || !('IntersectionObserver' in window)){
    showAll();
  }else{
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },{threshold:.10,rootMargin:'0px 0px -55px 0px'});
    revealTargets.forEach((el,index)=>{
      el.style.setProperty('--reveal-delay',`${(index%4)*120}ms`);
      observer.observe(el);
    });
  }

  // Enable animation styles only after reveal observers/fallback are initialized.
  document.body.classList.add('ani-on');

  // Major content pages get a slow editorial strip.
  if(['page-fashion','page-quran','page-safety','page-lifestyle'].includes(pageClass)){
    const anchor=document.querySelector('main .section:nth-of-type(2)');
    if(anchor&&!document.querySelector('.ani-library-strip')){
      const strip=document.createElement('div');
      strip.className='ani-library-strip wrap';
      const track=document.createElement('div');
      track.className='ani-library-track';
      const labels=pageClass==='page-fashion'?['Hijab','Abaya','Burkha','Wardrobe','Fabric','Layering']:
        pageClass==='page-quran'?['Read','Reflect','Verify','Context','Learn','Practice']:
        pageClass==='page-safety'?['Privacy','Travel','Boundaries','Emergency','Accounts','Awareness']:
        ['Prayer','Wellbeing','Family','Learning','Ramadan','Rest'];
      [...labels,...labels].forEach(label=>{const chip=document.createElement('span');chip.textContent=label;track.appendChild(chip);});
      strip.appendChild(track);
      anchor.parentNode.insertBefore(strip,anchor.nextSibling);
    }
  }
});
