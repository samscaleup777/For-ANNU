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

  // Load the isolated visual layer after the original site styles.
  const animationStyle=document.createElement('link');
  animationStyle.rel='stylesheet';
  animationStyle.href='/animations.css';
  document.head.appendChild(animationStyle);

  // Identify the page without changing existing HTML markup/content.
  const path=window.location.pathname.toLowerCase();
  const pageClass=path.includes('fashion')?'page-fashion':path.includes('quran-hadith')?'page-quran':path.includes('safety')?'page-safety':path.includes('lifestyle')?'page-lifestyle':path.includes('blog')?'page-blog':path.includes('about')?'page-about':path.includes('contact')?'page-contact':'page-home';
  document.body.classList.add(pageClass,'ani-on');

  const nav=document.querySelector('.nav');
  const updateNav=()=>{if(nav)nav.classList.toggle('nav-scrolled',window.scrollY>22);};
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
    },{threshold:.10,rootMargin:'0px 0px -55px 0px'});

    document.querySelectorAll('.section-head').forEach(el=>observer.observe(el));
    document.querySelectorAll('.panel,.feature-photo,.cta-box,.footer,.legal article,.contact-card').forEach(el=>observer.observe(el));
    document.querySelectorAll('.card').forEach((el,index)=>{
      el.style.setProperty('--reveal-delay',`${(index%4)*120}ms`);
      observer.observe(el);
    });
  }else{
    revealTargets.forEach(el=>el.classList.add('is-visible'));
  }

  // Fashion: insert real topic photography without touching the original copy.
  if(pageClass==='page-fashion'){
    const fashionCards=[...document.querySelectorAll('#guides .card')];
    const topicImages=[
      {
        src:'https://images.pexels.com/photos/7249739/pexels-photo-7249739.jpeg?auto=compress&cs=tinysrgb&w=1000',
        alt:'Two women wearing vibrant hijabs and modest fashion'
      },
      {
        src:'https://images.pexels.com/photos/35324621/pexels-photo-35324621.jpeg?auto=compress&cs=tinysrgb&w=1000',
        alt:'Two women in elegant abayas outdoors'
      },
      {
        src:'https://images.pexels.com/photos/9881829/pexels-photo-9881829.jpeg?auto=compress&cs=tinysrgb&w=1000',
        alt:'Women wearing traditional burka and modest clothing'
      },
      {
        src:'https://images.pexels.com/photos/9219303/pexels-photo-9219303.jpeg?auto=compress&cs=tinysrgb&w=1000',
        alt:'Woman in hijab selecting clothes from a wardrobe'
      }
    ];
    fashionCards.forEach((card,index)=>{
      if(!topicImages[index]||card.querySelector('.topic-media'))return;
      const media=document.createElement('div');
      media.className='topic-media';
      const img=document.createElement('img');
      img.src=topicImages[index].src;
      img.alt=topicImages[index].alt;
      img.loading=index===0?'eager':'lazy';
      img.decoding='async';
      media.appendChild(img);
      card.insertBefore(media,card.firstElementChild);
    });

    // Add a real stock fashion video block after the topic grid.
    const guideSection=document.querySelector('#guides');
    if(guideSection&&!guideSection.nextElementSibling?.classList.contains('fashion-video-block')){
      const block=document.createElement('div');
      block.className='fashion-video-block';
      const video=document.createElement('video');
      video.src='https://www.pexels.com/download/video/9218091/';
      video.poster='https://images.pexels.com/videos/9218091/abdomen-adult-affection-anticipation-9218091.jpeg?auto=compress&dpr=1&h=750&w=1260';
      video.setAttribute('controls','');
      video.setAttribute('muted','');
      video.setAttribute('loop','');
      video.setAttribute('playsinline','');
      video.setAttribute('preload','metadata');
      video.setAttribute('aria-label','Fashion styling video showing a woman in hijab preparing an outfit');
      block.appendChild(video);
      const copy=document.createElement('div');
      copy.className='fashion-video-copy';
      copy.innerHTML='<h3>See the movement of the style.</h3><p>A real fashion clip brings the wardrobe guidance to life—showing preparation, fabric movement and styling in context.</p>';
      block.appendChild(copy);
      guideSection.appendChild(block);
    }
  }

  // Add a calm, slow editorial strip on the major content pages.
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
