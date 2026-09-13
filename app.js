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

  // Cache-busted animation stylesheet: static DOM stays visible until this JS enables the motion layer.
  const animationStyle=document.createElement('link');
  animationStyle.rel='stylesheet';
  animationStyle.href='/animations-v2.css?v=2';
  document.head.appendChild(animationStyle);

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

  // Enable the motion layer only after observers/fallback are ready, so a JS/CSS timing issue cannot hide content.
  document.body.classList.add('ani-on');

  // Fashion media is repo-local: replace every external Pexels asset and remove redirect-only video behavior.
  if(pageClass==='page-fashion'){
    const localImages=['/assets/fashion-01.svg','/assets/fashion-02.svg','/assets/fashion-03.svg','/assets/fashion-04.svg'];
    const heroImage=document.querySelector('.fashion-hero-visual img');
    if(heroImage){heroImage.src=localImages[0];heroImage.removeAttribute('srcset');heroImage.alt='Fully covered modest-fashion editorial illustration with face and body details concealed';}

    document.querySelectorAll('.topic-card img').forEach((img,index)=>{
      img.src=localImages[index]||localImages[0];
      img.removeAttribute('srcset');
      img.alt=`Fully covered modest fashion visual for ${['Hijab','Abaya','Burkha','Wardrobe'][index]||'modest wardrobe'}`;
    });

    const featureImage=document.querySelector('.fashion-feature-image img');
    if(featureImage){featureImage.src=localImages[1];featureImage.removeAttribute('srcset');featureImage.alt='Fully covered modest fashion editorial illustration with face concealed';}

    const videoMedia=document.querySelector('.fashion-video-media');
    if(videoMedia){
      videoMedia.innerHTML='<video class="local-fashion-video" controls muted loop playsinline preload="metadata" aria-label="Local Annïka modest fashion film with fully covered figure"><source src="/assets/fashion-film.mp4" type="video/mp4">Your browser does not support the local fashion video.</video><div class="fashion-video-overlay-local"><span>Local fashion film</span></div>';
    }

    document.querySelectorAll('.fashion-page a[href*="pexels.com"]').forEach(a=>{
      a.removeAttribute('target');
      a.removeAttribute('rel');
      a.removeAttribute('href');
      a.classList.add('local-media-note');
      a.textContent='Video stored in Annïka repository';
    });
  }

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
