document.addEventListener('DOMContentLoaded',()=>{
  // Keep the heart-dot confined to the Annïka brand word and preserve word spacing.
  const decorateBrandNames = (root = document.body) => {
    if (!root || !window.NodeFilter) return;
    const accepts = /ann(?:ï|i|ı)ka/i;
    const matcher = /ann(?:ï|i|ı)ka/gi;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,noscript,textarea,input,select,option,code,pre,[contenteditable="true"],.brand,.brand-name-inline')) return NodeFilter.FILTER_REJECT;
        return accepts.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const wordChar = /[\\p{L}\\p{N}]$/u;
    nodes.forEach(node => {
      const value = node.nodeValue || '';
      const fragment = document.createDocumentFragment();
      let cursor = 0, match;
      matcher.lastIndex = 0;
      while ((match = matcher.exec(value))) {
        const prefix = value.slice(cursor, match.index);
        if (prefix) fragment.appendChild(document.createTextNode(prefix));
        let addSpaceBefore = prefix ? wordChar.test(prefix) : false;
        if (!prefix && match.index === 0) {
          let previous = node.previousSibling;
          if (!previous && node.parentElement) previous = node.parentElement.previousSibling;
          const priorText = previous?.textContent || '';
          addSpaceBefore = wordChar.test(priorText);
        }
        if (addSpaceBefore) fragment.appendChild(document.createTextNode(' '));

        const found = match[0];
        const word = document.createElement('span');
        word.className = 'brand-name-inline';
        word.setAttribute('aria-label', found);
        word.appendChild(document.createTextNode(found.slice(0, 3)));
        const letter = document.createElement('span');
        letter.className = 'brand-heart-i';
        letter.appendChild(document.createTextNode('ı'));
        const heart = document.createElement('span');
        heart.className = 'brand-heart-dot';
        heart.setAttribute('aria-hidden', 'true');
        heart.textContent = '♥';
        letter.appendChild(heart);
        word.appendChild(letter);
        word.appendChild(document.createTextNode(found.slice(-2)));
        fragment.appendChild(word);

        cursor = matcher.lastIndex;
        if (/[\\p{L}\\p{N}]/u.test(value.charAt(cursor))) fragment.appendChild(document.createTextNode(' '));
      }
      if (cursor === 0) return;
      fragment.appendChild(document.createTextNode(value.slice(cursor)));
      node.parentNode.replaceChild(fragment, node);
    });
  };
  decorateBrandNames();
  // Product cards and other content can be inserted after initial page load.
  const brandNameObserver = new MutationObserver(records => {
    const addedPageContent = records.some(record => [...record.addedNodes].some(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches('.brand-name-inline')) return false;
      if (node.nodeType === Node.TEXT_NODE && node.parentElement?.closest('.brand-name-inline')) return false;
      return true;
    }));
    if (addedPageContent) decorateBrandNames();
  });
  brandNameObserver.observe(document.body, { childList: true, subtree: true });

  const main=document.querySelector('main');
  if(main&&!main.id)main.id='main-content';
  if(main&&!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.className='skip-link';skip.href='#main-content';skip.textContent='Skip to content';document.body.prepend(skip)}
  const menu=document.querySelector('.menu'),links=document.querySelector('.links');
  const setMenuState=open=>{if(!menu||!links)return;links.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation')};
  if(menu&&links){menu.setAttribute('aria-expanded',links.classList.contains('open')?'true':'false');menu.addEventListener('click',()=>setMenuState(!links.classList.contains('open')));links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenuState(false)));document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenuState(false)})}
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  // Keep the lightweight SVG favicon; do not inject image files into site content.

  if(!document.querySelector('link[href^="/brand-fix.css"]')){const logoFix=document.createElement('link');logoFix.rel='stylesheet';logoFix.href='/brand-fix.css?v=1';document.head.appendChild(logoFix)}
  const oldAni=[...document.querySelectorAll('link[href^="/animations-v3.css"]')];
  oldAni.forEach(link=>{link.href='/animations-v3.css?v=12'});
  if(!oldAni.length){const animationStyle=document.createElement('link');animationStyle.rel='stylesheet';animationStyle.href='/animations-v3.css?v=12';document.head.appendChild(animationStyle)}

  const path=window.location.pathname.toLowerCase();
  const pageClass=path.includes('fashion')?'page-fashion':path.includes('quran-hadith')?'page-quran':path.includes('safety')?'page-safety':path.includes('lifestyle')?'page-lifestyle':path.includes('blog')?'page-blog':path.includes('about')?'page-about':path.includes('contact')?'page-contact':'page-home';
  document.body.classList.add(pageClass,'ani-on');
  const nav=document.querySelector('.nav'),updateNav=()=>{if(nav)nav.classList.toggle('nav-scrolled',window.scrollY>22)};updateNav();window.addEventListener('scroll',updateNav,{passive:true});

  const search=document.querySelector('[data-search]'),cards=[...document.querySelectorAll('[data-searchable]')];
  if(search&&cards.length)search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();cards.forEach(c=>c.classList.toggle('hidden',q&&!c.textContent.toLowerCase().includes(q)))});

  const revealTargets=[...document.querySelectorAll('.section-head,.card,.panel,.feature-photo,.cta-box,.footer,.legal article,.contact-card,.fashion-page .topic-card,.fashion-video-block,.howto-card')],revealAll=()=>revealTargets.forEach(el=>el.classList.add('is-visible'));
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced||!('IntersectionObserver' in window))revealAll();
  else{const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add('is-visible');observer.unobserve(entry.target)}),{threshold:.08,rootMargin:'0px 0px -25px 0px'});revealTargets.forEach((el,index)=>{el.style.setProperty('--reveal-delay',`${(index%4)*150}ms`);observer.observe(el)});requestAnimationFrame(()=>{const vh=window.innerHeight||800;revealTargets.forEach(el=>{if(el.getBoundingClientRect().top<vh*.92)el.classList.add('is-visible')})});setTimeout(()=>revealTargets.forEach(el=>{if(el.getBoundingClientRect().top<window.innerHeight*1.2)el.classList.add('is-visible')}),900)}



  if(['page-fashion','page-quran','page-safety','page-lifestyle'].includes(pageClass)){
    const anchor=document.querySelector('main .section:nth-of-type(2)');
    if(anchor&&!document.querySelector('.ani-library-strip')){const strip=document.createElement('div');strip.className='ani-library-strip wrap';const track=document.createElement('div');track.className='ani-library-track';const labels=pageClass==='page-fashion'?['Hijab','Abaya','Burkha','Wardrobe','Fabric','Layering']:pageClass==='page-quran'?['Read','Reflect','Verify','Context','Learn','Practice']:pageClass==='page-safety'?['Privacy','Travel','Boundaries','Emergency','Accounts','Awareness']:['Prayer','Wellbeing','Family','Learning','Ramadan','Rest'];[...labels,...labels].forEach(label=>{const chip=document.createElement('span');chip.textContent=label;track.appendChild(chip)});strip.appendChild(track);anchor.parentNode.insertBefore(strip,anchor.nextSibling)}
  }
});

