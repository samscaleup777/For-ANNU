(()=>{"use strict";
const DATA_URL="/data/shop-catalog.json";
const state={products:[],cart:JSON.parse(localStorage.getItem("annikaCart")||"[]"),section:"all",query:"",payment:"bkash"};
const photoCache=new Map(),usedPhotoUrls=new Set();
let photoObserver=null;
const PHOTO_STORE_KEY="annikaCuratedPhotoMapV6";
const savedPhotos=(()=>{try{["annikaCuratedPhotoMapV5","annikaCuratedPhotoMapV4","annikaCuratedPhotoMapV3","annikaCuratedPhotoMapV2","annikaCuratedPhotoMapV1"].forEach(k=>localStorage.removeItem(k));const data=JSON.parse(localStorage.getItem(PHOTO_STORE_KEY)||"{}");return data&&typeof data==="object"?data:{}}catch(e){return {}}})();
const REGIONAL_TERMS=["Bangladesh","Pakistan","Saudi Arabia","United Arab Emirates","Arab world","Middle East","South Asia","Malaysia","Indonesia","Turkey","Morocco","Egypt"];
function persistPhoto(id,rec){try{savedPhotos[id]=rec;localStorage.setItem(PHOTO_STORE_KEY,JSON.stringify(savedPhotos))}catch(e){}}
const BAD_PHOTO=/(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|illustration|vector|clipart|3d[ -]?render|rendered|ai[ -]?generated|generative[ -]?ai|synthetic)/i;
const NON_PRODUCT_TERMS=new Set([
  "a","an","and","the","for","of","to","with","from","real","photo","photos","image","images",
  "product","products","item","items","catalog","picture","pictures","high","quality","official",
  "bangladesh","bangladeshi","south","asia","pakistan","saudi","arabia","uae","gulf","middle",
  "east","global","modest","fashion","muslim","muslimah","woman","women","womens","men","mens",
  "lady","ladies","person","people","wearing","studio","isolated","white","background"
]);
const PERSON_SCENE=/(\b(?:woman|women|man|men|girl|boy|child|children|person|people|model|portrait|face|human|patient|nurse|doctor)\b|\b(?:wearing|posing|standing|sitting|holding|looking at|looking into)\b)/i;
const ITEM_SYNONYMS={
  "hot-water bag":["hot water bottle","hot-water bag","heating bag"],
  "heating pad":["heating pad","heat pad"],
  "quran":["quran","koran"],
  "tasbih":["tasbih","misbaha","prayer beads"],
  "sanitary pads":["sanitary pads","menstrual pads","period pads"],
  "pantyliners":["pantyliners","panty liners"],
  "menstrual cup":["menstrual cup"],
  "hair mask":["hair mask","hair treatment mask"],
  "face wash":["face wash","facial cleanser","cleanser"],
  "sunscreen":["sunscreen","sun cream","sunblock"],
  "safety pins":["safety pins"],
  "hijab undercap":["hijab undercap","undercap","inner cap"],
  "hijab inner":["hijab inner","inner cap","undercap"],
  "prayer mat / janamaz":["prayer mat","janamaz","prayer rug"],
  "quran stand":["quran stand","rehal"],
  "abaya":["abaya","abāya"],
  "burqa":["burqa","burqa","borkha","burka"],
  "niqab":["niqab","face veil"],
  "khimar":["khimar","khimaar"],
  "jilbab":["jilbab","jilbaab"]
};
function imageText(item){
  return [item.title,item.creator,item.description,item.provider,item.source,(item.tags||[]).map(t=>typeof t==="string"?t:t?.name||"").join(" ")].join(" ").toLowerCase();
}
function normalizedTokens(text){
  return [...new Set(String(text||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(w=>w.length>2&&!NON_PRODUCT_TERMS.has(w)))];
}
function productTerms(p){
  const name=String(p?.name||"").replace(/[—–]/g," ");
  let terms=normalizedTokens(name);
  if(!terms.length)terms=normalizedTokens(p?.query||"");
  return terms;
}
function objectOnlyProduct(p){
  const name=(String(p?.name||"")+" "+String(p?.subsection||"")).toLowerCase();
  const section=String(p?.section||"");
  const garments=/niqab|abaya|burqa|borkha|khimar|jilbab|salwar|kameez|kurti|dress|gown|tunic|shirt|top|skirt|trouser|palazzo|pants|jogger|leggings|outerwear|garment|clothing|sleeve|kaftan|thobe|jubba|shawl|scarf|dupatta|prayer dress|sports hijab|modest workout clothes|eid outfit|\bhijab\b/i.test(name);
  const accessory=/pin|magnet|clip|undercap|inner cap|bonnet|organizer|storage|ring|brush|bag|holder|accessor|case|pouch|belt|belt|socks|glove/i.test(name);
  const garmentSection=["Hijab & Modest Wear","Everyday Clothing","Fitness"].includes(section) ||
    (section==="Ramadan / Eid Essentials" && /outfit|abaya|hijab|prayer dress|clothing/i.test(name));
  // Only wearable apparel may show a model. Accessories, all hygiene/innerwear,
  // skincare, makeup, medical, electronics and all other catalog products are object-only.
  return !(garments && garmentSection && !accessory);
}
const AMBIGUOUS_PRODUCT_CONTEXT={
  palazzo:["pants","trouser","trousers"],
  watch:["wristwatch","wrist watch"],
  flats:["shoes","footwear","flat shoes"],
  flat:["shoes","footwear","flat shoes"],
  brush:["hair brush","hairbrush","brush hair"],
  sari:["sari","saree"]
};
function photoRelevance(item,p){
  const text=imageText(item);
  const terms=productTerms(p);
  const key=(String(p?.name||"")).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  let score=0,matched=0;
  for(const term of terms){
    if(text.includes(term)){matched++;score+=String(item.title||"").toLowerCase().includes(term)?4:2}
  }
  const aliases=Object.entries(ITEM_SYNONYMS).find(([aliasKey])=>p.name.toLowerCase().includes(aliasKey));
  if(aliases){
    const found=aliases[1].some(alias=>text.includes(alias));
    if(!found)return 0;
    const synonymTokens=normalizedTokens(aliases[0]);
    const missing=terms.filter(term=>!text.includes(term));
    // Only words in the alias itself may be replaced by its documented synonym.
    if(missing.some(term=>!synonymTokens.includes(term)))return 0;
    score+=5;
    matched=terms.length;
  }
  const required=terms.length;
  if(matched<required)return 0;
  // Disambiguate generic words using the catalog's intended item type.
  if(terms.length===1){
    const contexts=AMBIGUOUS_PRODUCT_CONTEXT[terms[0]];
    if(contexts&&!contexts.some(term=>text.includes(term)))return 0;
    const queryTerms=normalizedTokens(p.query||"").filter(term=>!NON_PRODUCT_TERMS.has(term)&&!terms.includes(term));
    if(queryTerms.length&&!queryTerms.some(term=>text.includes(term)))return 0;
  }
  if(key && text.includes(key))score+=6;
  return score;
}
function isUsablePhoto(item,p){
  const text=imageText(item);
  if(!(item.url||item.thumbnail)||BAD_PHOTO.test(text))return false;
  if(!(item.license||item.license_url))return false;
  if(PERSON_SCENE.test(text))return false;
  return photoRelevance(item,p)>0;
}
const openverseQuery=(p)=>{
  const name=String(p?.name||"").trim();
  const exact=String(p?.query||name).trim();
  const objectOnly=objectOnlyProduct(p);
  const queries=[
    name+" product photo",
    exact+" product photo",
    name+" flat lay product",
    name+" isolated item on white background",
    name+" folded product no model"
  ];
  if(!objectOnly){
    queries.push(name+" folded garment flat lay");
    queries.push(name+" modest clothing product only");
  }else{
    queries.push(name+" product packshot");
    queries.push(name+" packaging product photo");
  }
  return [...new Set(queries.filter(Boolean))].slice(0,6);
};

const money=n=>"৳"+Number(n||0).toLocaleString("en-BD");
const slug=s=>String(s).toLowerCase().replace(/&/g,"and").replace(/[/]/g," ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const priceFor=(p,i)=>{
  const s=(p.section+" "+p.subsection+" "+p.name).toLowerCase();
  if(/laptop|tablet/.test(s))return 25990+(i%4)*8000;
  if(/smartphone/.test(s))return 12990+(i%4)*5000;
  if(/watch|smartwatch|fitness tracker/.test(s))return 2990+(i%5)*1000;
  if(/hair dryer|straightener|curling|epilator|trimmer|ring light|tripod/.test(s))return 1890+(i%5)*700;
  if(/electronics|charger|power bank|adapter|earbuds|headphones/.test(s))return 790+(i%7)*350;
  if(/abaya|jilbab|dress|kameez|kurti|cardigan|jacket|raincoat|outfit|skirt|trousers|palazzo|salwar|clothing|nightwear|pajamas|loungewear|sweater|top|shirt|sleeves|leggings|bonnet/.test(s))return 990+(i%9)*400;
  if(/bra|underwear|camisole|slip|inner|shapewear|undershirt|socks|thermal/.test(s))return 390+(i%7)*150;
  if(/quran|islamic book|dua|tasbih|prayer|rehal|qibla|calendar/.test(s))return 450+(i%8)*180;
  if(/perfume|attar|fragrance|body mist|scented|deodorant/.test(s))return 590+(i%7)*220;
  if(/lip|foundation|concealer|blush|eyeliner|kajal|mascara|eyeshadow|makeup|cosmetic|cream|serum|toner|sunscreen|skincare|shampoo|conditioner|hair oil|hair mask|hair serum|body wash|lotion|scrub|soap/.test(s))return 390+(i%10)*170;
  if(/bag|wallet|clutch|backpack|pouch|organizer|holder|suitcase/.test(s))return 690+(i%10)*240;
  if(/jewelry|necklace|earring|bracelet|bangles|ring|anklet|brooch|pendant/.test(s))return 490+(i%9)*220;
  if(/shoe|heels|sneaker|sandals|boots|slippers/.test(s))return 790+(i%8)*300;
  if(/bed|pillow|blanket|comforter|towel|bathrobe|mirror|storage|hanger|basket|boxes/.test(s))return 590+(i%9)*250;
  if(/first-aid|medicine|thermometer|medical|bandage|gauze|antiseptic/.test(s))return 250+(i%8)*100;
  if(/stationery|notebook|planner|diary|pens|highlighter/.test(s))return 180+(i%8)*70;
  if(/yoga|resistance|dumbbell|gym|fitness|sports|joggers|workout/.test(s))return 690+(i%9)*300;
  return 490+(i%10)*190;
};

let verifiedPhotoIds=new Set();
function svgText(value){
  return String(value||"Product").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function productOnlyPlaceholder(p){
  const name=String(p&&p.name||"Product");
  const lower=(name+" "+(p&&p.section||"")+" "+(p&&p.subsection||"")).toLowerCase();
  let shape='<path d="M300 320 L500 320 L535 375 L535 565 Q535 585 515 585 L285 585 Q265 585 265 565 L265 375 Z" fill="#d8b596" stroke="#805f47" stroke-width="10"/><rect x="350" y="260" width="100" height="60" rx="12" fill="#c9824f" stroke="#805f47" stroke-width="8"/>';
  if(/hijab|scarf|khimar|abaya|burqa|niqab|jilbab|dress|gown|tunic|shirt|skirt|trouser|palazzo|pants|kurti|kameez|saree|sari|shawl|dupatta|cardigan|sweater|jacket|coat|robe|pajama|leggings|sleeve|underwear|camisole|sock/.test(lower)){
    shape='<path d="M225 330 Q310 280 400 310 Q490 280 575 330 L525 560 Q400 590 275 560 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><path d="M275 375 Q400 435 525 375" fill="none" stroke="#805f47" stroke-width="8"/>';
  }else if(/shoe|sandal|slipper|heel|flat|sneaker|footwear|boot/.test(lower)){
    shape='<path d="M210 455 Q275 440 335 350 L405 395 Q445 450 560 455 Q605 460 610 515 L230 515 Q190 500 210 455 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><path d="M230 493 L600 493" stroke="#805f47" stroke-width="8"/>';
  }else if(/quran|book|dua|calendar|planner|diary|notebook|prayer mat|janamaz|sajadah|bookmark/.test(lower)){
    shape='<path d="M230 325 Q315 292 400 345 Q485 292 570 325 L570 550 Q485 515 400 568 Q315 515 230 550 Z" fill="#d8b596" stroke="#805f47" stroke-width="10"/><path d="M400 345 L400 568" stroke="#805f47" stroke-width="8"/><path d="M265 375 L365 395 M265 425 L365 445 M435 395 L535 375 M435 445 L535 425" stroke="#805f47" stroke-width="7"/>';
  }else if(/phone|laptop|tablet|power bank|charger|cable|earbud|headphone|watch|clock|compass|thermometer|flashlight|tripod|adapter|electronic|device|battery/.test(lower)){
    shape='<rect x="300" y="265" width="200" height="325" rx="24" fill="#d8b596" stroke="#805f47" stroke-width="10"/><rect x="322" y="290" width="156" height="255" rx="8" fill="#fbf7ef" stroke="#805f47" stroke-width="6"/><circle cx="400" cy="565" r="8" fill="#805f47"/>';
  }else if(/ring|earring|necklace|bracelet|bangle|jewell|brooch|magnet|pin|clip|comb|brush|tweezer|razor|scissor|needle|thread|button|tape|scrunchie|headband/.test(lower)){
    shape='<circle cx="400" cy="425" r="118" fill="none" stroke="#d8b596" stroke-width="38"/><circle cx="400" cy="425" r="118" fill="none" stroke="#805f47" stroke-width="9"/><circle cx="400" cy="425" r="62" fill="none" stroke="#805f47" stroke-width="5"/>';
  }else if(/bag|pouch|organizer|holder|case|wallet|backpack|suitcase|box|basket|storage/.test(lower)){
    shape='<path d="M260 350 L540 350 L565 575 L235 575 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><path d="M330 350 L330 310 Q330 260 400 260 Q470 260 470 310 L470 350" fill="none" stroke="#805f47" stroke-width="12"/><path d="M285 425 L515 425" stroke="#805f47" stroke-width="7"/>';
  }
  const label=svgText(name.length>45?name.slice(0,42)+"…":name);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="'+label+' product-only reference"><rect width="800" height="1000" fill="#fbf7ef"/><rect x="34" y="34" width="732" height="932" rx="38" fill="#f2e7d6" stroke="#dfd5c2" stroke-width="3"/><circle cx="400" cy="425" r="205" fill="#ead8bd"/>'+shape+'<text x="400" y="710" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#17231d">'+label+'</text><text x="400" y="765" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#625d54">Product-only reference</text><text x="400" y="808" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#625d54">Exact photo not yet verified</text></svg>';
  return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}
function productCard(p,i){
  const saved=savedPhotos[p.id];
  const imagePath=p.image||("/assets/shop/catalog/"+p.slug+".jpg");
  const image=saved?.url||(imagePath.startsWith("data:")?imagePath:imagePath+"?v=18");
  const price=priceFor(p,i);
  return '<article class="product-card" data-section="'+p.section+'" data-name="'+p.name+'" data-price="'+price+'" data-id="'+p.id+'">'+
    '<div class="product-media"><span class="product-badge">'+p.subsection+'</span><img src="'+image+'" alt="'+p.name+' — product reference image" loading="lazy" data-photo-query="'+(p.query||p.name).replace(/"/g,'&quot;')+'"><a class="photo-credit" target="_blank" rel="noopener" hidden>Photo source</a></div>'+
    '<div class="product-body"><div class="product-category">'+p.section+'</div><h3 class="product-title">'+p.name+'</h3>'+
    '<p class="product-desc">'+p.subsection+' · product listing for the Annïka A–Z store.</p>'+
    '<div class="product-price"><strong>'+money(price)+'</strong><span class="product-sample">indicative</span></div>'+
    '<div class="product-actions"><button class="add" type="button" data-add="'+p.id+'">Add to cart</button><button type="button" data-buy="'+p.id+'">Buy now</button></div></div></article>';
}

function sectionDescription(name){
  const map={
  "Hijab & Modest Wear":"Hijab, abaya, khimar, jilbab, dresses, skirts, trousers, dupatta and coverage essentials.",
  "Everyday Clothing":"Everyday, home, nightwear, winter and occasion clothing for a modest wardrobe.",
  "Innerwear & Undergarments":"Everyday innerwear, bras, basics, socks and comfort-focused layers.",
  "Salah / Prayer Essentials":"Prayer wear, mats, Quran, tasbih, qibla tools and Islamic reading essentials.",
  "Menstrual & Personal Hygiene":"Period care, hygiene, bath & body and personal care essentials.",
  "Skincare":"Face, lip, body and daily sun-care products.",
  "Modest Everyday Makeup":"Daily makeup, brushes, organizers and application tools.",
  "Haircare":"Hair wash, treatments, styling tools, accessories and protective night care.",
  "Hands, Feet & Grooming":"Manicure, pedicure, grooming, shaving and hair-removal essentials.",
  "Fragrance":"Attar, perfume, mist, roll-on and scented body-care choices.",
  "Jewellery & Accessories":"Jewelry, watches, sunglasses, bags, wallets and hijab accessories.",
  "Footwear":"Daily, walking, running, formal, occasion and home footwear.",
  "Home & Personal Room":"Bedroom, bath, storage, mirrors and personal-organization products.",
  "Work / Study":"Work bags, stationery, desk/lifestyle products and personal devices.",
  "Travel":"Luggage, travel organizers, prayer travel gear, toiletries and comfort items.",
  "Fitness":"Modest workout clothing plus training and hydration essentials.",
  "Emergency & Safety":"First-aid, hygiene and practical emergency/safety essentials.",
  "Clothing Care":"Repair, sewing, laundry, stain and garment-care products.",
  "Personal Electronics":"Phones, charging, audio, creator gear and cable-management essentials.",
  "Ramadan / Eid Essentials":"Eid fashion, prayer, Quran, Ramadan planning, iftar and gifting essentials."
  };
  return map[name]||"Explore the complete Annïka personal shopping catalog.";
}

function filtered(){
  const q=state.query.trim().toLowerCase();
  return state.products.map((p,i)=>({...p,_i:i,_price:priceFor(p,i)})).filter(p=>{
    const inSection=state.section==="all"||p.section===state.section;
    const hay=(p.name+" "+p.section+" "+p.subsection+" "+p.query).toLowerCase();
    return inSection&&(!q||hay.includes(q));
  });
}

function render(){
  const grid=document.getElementById("productGrid");
  if(!grid)return;
  const rows=filtered();
  const info=document.getElementById("catalogCurrent");
  const title=state.section==="all"?"Complete A–Z collection":state.section;
  if(info)info.innerHTML='<span class="eyebrow">'+rows.length+' product listings</span><h2>'+title+'</h2><p>'+sectionDescription(state.section==="all"?"":state.section)+'</p>';
  grid.innerHTML=rows.length?rows.map(p=>productCard(p,p._i)).join(""):'<div class="catalog-empty"><h3>No products found.</h3><p>Try another section or search term.</p></div>';
  document.querySelectorAll("#shopFilter button").forEach(b=>b.classList.toggle("active",(b.dataset.section||"all")===state.section));
  document.querySelectorAll(".shop-cat").forEach(b=>b.classList.toggle("active",(b.dataset.jump||"all")===state.section));
  bindProductButtons();
  updateBadges();
  enableRemotePhotoRefinement();
}

function bindProductButtons(){
  document.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>add(btn.dataset.add)));
  document.querySelectorAll("[data-buy]").forEach(btn=>btn.addEventListener("click",()=>{add(btn.dataset.buy);openCheckout()}));
}
function add(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  const i=state.products.indexOf(p),price=priceFor(p,i);
  const existing=state.cart.find(x=>x.id===id);
  if(existing)existing.qty+=1;else {
    const currentImg=document.querySelector('.product-card[data-id="'+CSS.escape(p.id)+'"] img');
    state.cart.push({id:p.id,name:p.name,price,image:currentImg?.src||savedPhotos[p.id]?.url||("/assets/shop/catalog/"+p.slug+".jpg"),qty:1,section:p.section});
  }
  saveCart();renderCart();updateBadges();
}
function saveCart(){localStorage.setItem("annikaCart",JSON.stringify(state.cart))}
function updateBadges(){const n=state.cart.reduce((a,b)=>a+b.qty,0);["cartCount","heroCartCount"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=n})}
function cartTotal(){return state.cart.reduce((a,b)=>a+b.price*b.qty,0)}
function renderCart(){
  const list=document.getElementById("cartList"),totalEl=document.getElementById("checkoutTotal");if(!list||!totalEl)return;
  if(!state.cart.length){list.innerHTML='<div class="note">Your cart is empty. Add products from the A–Z catalog.</div>';totalEl.textContent=money(0);return}
  list.innerHTML=state.cart.map((x,i)=>'<div class="cart-row"><img src="'+x.image+'" alt=""><div><h4>'+x.name+'</h4><p>'+money(x.price)+' each · '+x.section+'</p><div class="cart-controls"><button type="button" onclick="changeQty('+i+',-1)">−</button><span>'+x.qty+'</span><button type="button" onclick="changeQty('+i+',1)">+</button><button class="cart-remove" type="button" onclick="removeItem('+i+')" aria-label="Remove item">×</button></div></div><strong>'+money(x.price*x.qty)+'</strong></div>').join("");
  totalEl.textContent=money(cartTotal());
}
window.changeQty=(i,d)=>{if(!state.cart[i])return;state.cart[i].qty+=d;if(state.cart[i].qty<=0)state.cart.splice(i,1);saveCart();renderCart();updateBadges()};
window.removeItem=i=>{state.cart.splice(i,1);saveCart();renderCart();updateBadges()};
window.openCheckout=()=>{renderCart();const b=document.getElementById("checkoutBackdrop");if(b){b.classList.add("open");b.setAttribute("aria-hidden","false");document.body.style.overflow="hidden"}};
window.closeCheckout=()=>{const b=document.getElementById("checkoutBackdrop");if(b){b.classList.remove("open");b.setAttribute("aria-hidden","true");document.body.style.overflow=""}document.getElementById("orderSuccess")?.classList.remove("open");document.getElementById("checkoutMain").style.display="block"};

window.filterProducts=(section)=>{
  state.section=section==="all"?"all":section;
  render();
enableRemotePhotoRefinement();
  const grid=document.getElementById("shop-products");if(grid&&state.section!=="all")grid.scrollIntoView({behavior:"smooth",block:"start"});
};

async function fetchBetterPhoto(p,img,credit){
  if(!p||!img||img.dataset.photoLoaded==="1"||img.dataset.photoLoading==="1")return;
  img.dataset.photoLoading="1";
  const cacheKey=p.id;
  const rawLocalImage=p.image||("/assets/shop/catalog/"+p.slug+".jpg");
  const localImage=rawLocalImage.startsWith("data:")?rawLocalImage:rawLocalImage+(rawLocalImage.includes("?")?"&":"?")+"v=18";
  const applyRecord=(rec)=>{
    img.src=rec.url;
    if(credit){credit.href=rec.landing||rec.url;credit.textContent="Photo source"+(rec.provider?" · "+rec.provider:"")+(rec.license?" · "+rec.license:"");credit.hidden=false}
    img.dataset.photoLoaded="1";
    delete img.dataset.photoLoading;
  };
  // Old localStorage entries were selected by a loose keyword match. Never
  // reuse them; V3 only stores images that pass product-name and sensitivity checks.
  const existing=savedPhotos[cacheKey];
  if(existing && existing.url && existing.license && existing.landing){
    const rec={...existing,title:existing.title||""};
    const synthetic={title:rec.title||"",description:rec.description||"",url:rec.url,license:rec.license,license_url:rec.license_url,provider:rec.provider,creator:rec.creator};
    if(isUsablePhoto(synthetic,p) && !usedPhotoUrls.has(rec.url)){
      usedPhotoUrls.add(rec.url);photoCache.set(cacheKey,rec);applyRecord(rec);return;
    }
    delete savedPhotos[cacheKey];
    try{localStorage.setItem(PHOTO_STORE_KEY,JSON.stringify(savedPhotos))}catch(e){}
  }
  for(const q of openverseQuery(p)){
    try{
      const r=await fetch("/api/images?q="+encodeURIComponent(q),{});
      if(!r.ok)continue;
      const data=await r.json();
      const candidates=(data.results||[])
        .filter(x=>isUsablePhoto(x,p)&&!usedPhotoUrls.has(x.url||x.thumbnail))
        .map(x=>({...x,_relevance:photoRelevance(x,p)}))
        .sort((a,b)=>b._relevance-a._relevance);
      const pick=candidates[0];
      // No low-confidence image substitutions. Keep this product's own local
      // catalog file rather than showing a different item or a person on a
      // sensitive-product card.
      if(!pick)continue;
      const url=pick.url||pick.thumbnail;
      const rec={
        url,
        landing:pick.foreign_landing_url||pick.detail_url||url,
        creator:pick.creator||"",
        provider:pick.provider||pick.source||"Open source",
        license:pick.license||"",
        license_url:pick.license_url||"",
        title:pick.title||"",
        description:pick.description||""
      };
      usedPhotoUrls.add(url);
      photoCache.set(cacheKey,rec);
      persistPhoto(cacheKey,rec);
      img.onerror=()=>{
        img.onerror=null;
        img.src=localImage;
        if(credit)credit.hidden=true;
        delete img.dataset.photoLoading;
      };
      applyRecord(rec);
      return;
    }catch(e){}
  }
  img.src=localImage;
  if(credit)credit.hidden=true;
  img.dataset.photoLoaded="1";
  delete img.dataset.photoLoading;
}
function enableRemotePhotoRefinement(){
  if(photoObserver){photoObserver.disconnect();photoObserver=null;}
  const images=[...document.querySelectorAll("#productGrid .product-card img")];
  if(!images.length)return;
  const lookup=(img)=>{
    const card=img.closest(".product-card");
    const product=state.products.find(p=>String(p.id)===String(card?.dataset.id));
    if(!product)return;
    const credit=img.closest(".product-media")?.querySelector(".photo-credit");
    fetchBetterPhoto(product,img,credit);
  };
  if("IntersectionObserver" in window){
    photoObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        photoObserver.unobserve(entry.target);
        lookup(entry.target);
      }
    },{rootMargin:"320px 0px"});
    images.forEach(img=>photoObserver.observe(img));
  }else{
    images.slice(0,18).forEach(lookup);
  }
}

async function init(){
  try{
    const res=await fetch(DATA_URL,{cache:"no-store"});if(!res.ok)throw new Error("Catalog data failed");
    const data=await res.json();
    const creditsRes=await fetch("/data/image-credits.json?photo-v=17",{cache:"no-store"}).catch(()=>null);
    let credits={images:[]};try{if(creditsRes&&creditsRes.ok)credits=await creditsRes.json()}catch(e){}
    verifiedPhotoIds=new Set((credits.images||[]).map(x=>String(x.id)));
    state.products=(data.products||[]).map(p=>verifiedPhotoIds.has(String(p.id))?p:{...p,image:productOnlyPlaceholder(p)});
    state.cart=state.cart.map(item=>{
      const product=state.products.find(p=>p.id===item.id);
      if(!product)return item;
      const image=product.image||("/assets/shop/catalog/"+product.slug+".jpg");
      return {...item,image:image.startsWith("data:")?image:image+"?v=18"};
    });
    saveCart();
    render();
  }catch(e){
    const grid=document.getElementById("productGrid");if(grid)grid.innerHTML='<div class="catalog-empty"><h3>Catalog loading failed.</h3><p>Please refresh the page.</p></div>';
  }

  const search=document.getElementById("shopSearch");if(search)search.addEventListener("input",()=>{state.query=search.value;render()});
  document.querySelectorAll("#shopFilter button").forEach(b=>b.addEventListener("click",()=>window.filterProducts(b.dataset.section||"all")));
  document.querySelectorAll(".shop-cat").forEach(b=>b.addEventListener("click",()=>window.filterProducts(b.dataset.jump||"all")));

  document.querySelectorAll(".payment-method").forEach(label=>label.addEventListener("click",()=>{const r=label.querySelector("input");if(!r)return;state.payment=r.value;document.querySelectorAll(".payment-method").forEach(x=>x.classList.remove("active"));label.classList.add("active");updatePaymentInstructions(r.value)}));

  document.getElementById("checkoutForm")?.addEventListener("submit",e=>{
    e.preventDefault();if(!state.cart.length){alert("Please add at least one product.");return}
    const fd=new FormData(e.target);
    const order={id:"ANN-"+Date.now().toString(36).toUpperCase(),created:new Date().toISOString(),items:state.cart,total:cartTotal(),payment:state.payment,customer:Object.fromEntries(fd.entries())};
    localStorage.setItem("annikaLastOrder",JSON.stringify(order));
    document.getElementById("checkoutMain").style.display="none";document.getElementById("orderSuccess").classList.add("open");
    state.cart=[];saveCart();updateBadges();
  });
  document.getElementById("checkoutBackdrop")?.addEventListener("click",e=>{if(e.target.id==="checkoutBackdrop")closeCheckout()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCheckout()});
  updatePaymentInstructions("bkash");updateBadges();
  document.querySelectorAll("[data-year]").forEach(el=>el.textContent=new Date().getFullYear());
}

function updatePaymentInstructions(method){
  const el=document.getElementById("paymentInstructions"),bank=document.getElementById("bankSelect"),tid=document.getElementById("transactionId");if(!el)return;
  if(bank)bank.style.display=method==="bank"?"block":"none";if(tid)tid.style.display=method==="cod"?"none":"block";
  if(method==="bank")el.textContent="Choose your receiving bank and enter your actual account/reference details before launch. The prototype does not invent account numbers.";
  else if(method==="cod")el.textContent="Cash on Delivery is available as a checkout option; connect your courier/order workflow before accepting live orders.";
  else {const n={bkash:"bKash",nagad:"Nagad",rocket:"Rocket"}[method]||"wallet";el.textContent="Configure your "+n+" merchant number before launch. The prototype intentionally does not hard-code a payment account you have not provided."}
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();