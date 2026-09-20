document.addEventListener('DOMContentLoaded',()=>{
  const main=document.querySelector('main');
  if(main&&!main.id)main.id='main-content';
  if(main&&!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.className='skip-link';skip.href='#main-content';skip.textContent='Skip to content';document.body.prepend(skip)}
  const menu=document.querySelector('.menu'),links=document.querySelector('.links');
  const setMenuState=open=>{if(!menu||!links)return;links.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation')};
  if(menu&&links){menu.setAttribute('aria-expanded',links.classList.contains('open')?'true':'false');menu.addEventListener('click',()=>setMenuState(!links.classList.contains('open')));links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenuState(false)));document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenuState(false)})}
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  document.querySelectorAll('link[rel="icon"]').forEach(icon=>{icon.href='/assets/annika-mark-exact-visible.png';icon.type='image/png'});

  const oldAni=[...document.querySelectorAll('link[href^="/animations-v3.css"]')];
  oldAni.forEach(link=>{link.href='/animations-v3.css?v=12'});
  if(!oldAni.length){const animationStyle=document.createElement('link');animationStyle.rel='stylesheet';animationStyle.href='/animations-v3.css?v=12';document.head.appendChild(animationStyle)}

  const path=window.location.pathname.toLowerCase();
  const pageClass=path.includes('fashion')?'page-fashion':path.includes('quran-hadith')?'page-quran':path.includes('safety')?'page-safety':path.includes('lifestyle')?'page-lifestyle':path.includes('blog')?'page-blog':path.includes('about')?'page-about':path.includes('contact')?'page-contact':'page-home';
  document.body.classList.add(pageClass,'ani-on');
  const nav=document.querySelector('.nav'),updateNav=()=>{if(nav)nav.classList.toggle('nav-scrolled',window.scrollY>22)};updateNav();window.addEventListener('scroll',updateNav,{passive:true});

  const visualMap={'page-home':['/assets/real/annika-girl-01.jpg','/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-02.jpg','/assets/real/annika-girl-04.jpg'],'page-quran':['/assets/real/annika-girl-02.jpg','/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-01.jpg','/assets/real/annika-girl-04.jpg'],'page-safety':['/assets/real/annika-girl-03.jpg','/assets/real/annika-girl-01.jpg','/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-02.jpg'],'page-lifestyle':['/assets/real/annika-girl-04.jpg','/assets/real/annika-girl-02.jpg','/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-01.jpg'],'page-blog':['/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-01.jpg','/assets/real/annika-girl-03.jpg','/assets/real/annika-girl-02.jpg'],'page-about':['/assets/real/annika-girl-03.jpg','/assets/real/annika-girl-01.jpg','/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-04.jpg'],'page-contact':['/assets/real/annika-girl-02.jpg','/assets/real/annika-girl-04.jpg','/assets/real/annika-girl-05.jpg','/assets/real/annika-girl-01.jpg']};
  const visuals=visualMap[pageClass]||visualMap['page-home'];

  document.querySelectorAll('.grid4 .card').forEach((card,index)=>{if(card.querySelector('img,.context-media'))return;const media=document.createElement('div');media.className='context-media';const img=document.createElement('img');img.src=visuals[index%visuals.length];img.onerror=()=>{img.onerror=null;img.src='/assets/real/annika-girl-01.jpg'};img.alt='Annïka visual for '+((card.querySelector('h3')?.textContent||'this topic').trim());img.loading='lazy';media.appendChild(img);card.prepend(media);card.classList.add('has-context-media')});
  const feature=document.querySelector('.feature-photo');
  if(feature&&!feature.querySelector('img')){const featureImages={'page-home':'/assets/real/annika-girl-01.jpg','page-quran':'/assets/real/annika-girl-02.jpg','page-safety':'/assets/real/annika-girl-03.jpg','page-lifestyle':'/assets/real/annika-girl-04.jpg','page-blog':'/assets/real/annika-girl-05.jpg','page-about':'/assets/real/annika-girl-03.jpg','page-contact':'/assets/real/annika-girl-02.jpg'};feature.style.backgroundImage=`linear-gradient(135deg,rgba(18,49,38,.08),rgba(18,49,38,.32)),url('${featureImages[pageClass]||'/assets/real/annika-girl-01.jpg'}')`;feature.setAttribute('aria-label','Annïka section visual')}
  const search=document.querySelector('[data-search]'),cards=[...document.querySelectorAll('[data-searchable]')];
  if(search&&cards.length)search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();cards.forEach(c=>c.classList.toggle('hidden',q&&!c.textContent.toLowerCase().includes(q)))});

  const revealTargets=[...document.querySelectorAll('.section-head,.card,.panel,.feature-photo,.cta-box,.footer,.legal article,.contact-card,.fashion-page .topic-card,.fashion-video-block,.howto-card')],revealAll=()=>revealTargets.forEach(el=>el.classList.add('is-visible'));
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced||!('IntersectionObserver' in window))revealAll();
  else{const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add('is-visible');observer.unobserve(entry.target)}),{threshold:.08,rootMargin:'0px 0px -25px 0px'});revealTargets.forEach((el,index)=>{el.style.setProperty('--reveal-delay',`${(index%4)*150}ms`);observer.observe(el)});requestAnimationFrame(()=>{const vh=window.innerHeight||800;revealTargets.forEach(el=>{if(el.getBoundingClientRect().top<vh*.92)el.classList.add('is-visible')})});setTimeout(()=>revealTargets.forEach(el=>{if(el.getBoundingClientRect().top<window.innerHeight*1.2)el.classList.add('is-visible')}),900)}

  document.querySelectorAll('.brand .mark').forEach(mark=>{
    if(mark.dataset.annikaLogoReady)return;
    const img=document.createElement('img');
    img.className='brand-logo-exact';
    img.src='/assets/annika-mark-exact-visible.png';
    img.alt='Annïka';
    mark.replaceWith(img);
  });

  if(['page-fashion','page-quran','page-safety','page-lifestyle'].includes(pageClass)){
    const anchor=document.querySelector('main .section:nth-of-type(2)');
    if(anchor&&!document.querySelector('.ani-library-strip')){const strip=document.createElement('div');strip.className='ani-library-strip wrap';const track=document.createElement('div');track.className='ani-library-track';const labels=pageClass==='page-fashion'?['Hijab','Abaya','Burkha','Wardrobe','Fabric','Layering']:pageClass==='page-quran'?['Read','Reflect','Verify','Context','Learn','Practice']:pageClass==='page-safety'?['Privacy','Travel','Boundaries','Emergency','Accounts','Awareness']:['Prayer','Wellbeing','Family','Learning','Ramadan','Rest'];[...labels,...labels].forEach(label=>{const chip=document.createElement('span');chip.textContent=label;track.appendChild(chip)});strip.appendChild(track);anchor.parentNode.insertBefore(strip,anchor.nextSibling)}
  }
});

