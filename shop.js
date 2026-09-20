(()=>{"use strict";
const DATA_URL="/data/shop-catalog.json";
const state={products:[],cart:JSON.parse(localStorage.getItem("annikaCart")||"[]"),section:"all",query:"",payment:"bkash"};
const photoCache=new Map(),usedPhotoUrls=new Set();
const BAD_PHOTO=/(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred)/i;
const openverseQuery=(p)=>{
  const base=p.query||p.name, sec=(p.section||"")+" "+(p.subsection||"");
  const regionTerms=/Hijab|Clothing|Footwear|Jewellery|Fragrance|Ramadan|Prayer/i.test(sec)
    ? ["Bangladesh","Pakistan","Arab","Saudi Arabia","Dubai","Qatar","Kuwait","South Asia","Gulf"]
    : ["Bangladesh","Pakistan","Arab"];
  return [base,p.name+" "+(p.subsection||""),...regionTerms.map(x=>base+" "+x)].filter(Boolean);
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

function productCard(p,i){
  const image=p.image||("/assets/shop/catalog/"+p.slug+".jpg");
  const price=priceFor(p,i);
  return '<article class="product-card" data-section="'+p.section+'" data-name="'+p.name+'" data-price="'+price+'" data-id="'+p.id+'">'+
    '<div class="product-media"><span class="product-badge">'+p.subsection+'</span><img src="'+image+'" alt="'+p.name+' — catalog product photo" loading="lazy" data-photo-query="'+(p.query||p.name).replace(/"/g,'&quot;')+'"><a class="photo-credit" target="_blank" rel="noopener" hidden>Photo source</a></div>'+
    '<div class="product-body"><div class="product-category">'+p.section+'</div><h3 class="product-title">'+p.name+'</h3>'+
    '<p class="product-desc">'+p.subsection+' · real-photo product listing for the Annïka A–Z store.</p>'+
    '<div class="product-price"><strong>'+money(price)+'</strong><span class="product-sample">sample</span></div>'+
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
}

function bindProductButtons(){
  document.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>add(btn.dataset.add)));
  document.querySelectorAll("[data-buy]").forEach(btn=>btn.addEventListener("click",()=>{add(btn.dataset.buy);openCheckout()}));
}
function add(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  const i=state.products.indexOf(p),price=priceFor(p,i);
  const existing=state.cart.find(x=>x.id===id);
  if(existing)existing.qty+=1;else state.cart.push({id:p.id,name:p.name,price,image:"/assets/shop/catalog/"+p.slug+".jpg",qty:1,section:p.section});
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
  if(!p||!img||img.dataset.photoLoaded==="1")return;
  const cacheKey=p.id;
  if(photoCache.has(cacheKey)){
    const c=photoCache.get(cacheKey);
    img.src=c.url;
    if(credit){credit.href=c.landing||c.url;credit.hidden=false}
    img.dataset.photoLoaded="1";
    return;
  }
  for(const q of openverseQuery(p)){
    try{
      const r=await fetch("/api/images?q="+encodeURIComponent(q),{});
      if(!r.ok)continue;
      const data=await r.json();
      const candidates=(data.results||[]).filter(x=>{
        const txt=[x.title,x.creator,x.description,x.provider,x.source,(x.tags||[]).map(t=>typeof t==="string"?t:t?.name||"").join(" ")].join(" ");
        return (x.url||x.thumbnail)&&!BAD_PHOTO.test(txt)&&!usedPhotoUrls.has(x.url||x.thumbnail);
      });
      const words=(p.name+" "+p.subsection).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
      const score=x=>words.reduce((n,w)=>n+((String(x.title||"")+" "+String(x.tags||"")).toLowerCase().includes(w)?1:0),0);
      candidates.sort((a,b)=>score(b)-score(a));
      const pick=candidates[0];
      if(!pick)continue;
      const url=pick.url||pick.thumbnail;
      usedPhotoUrls.add(url);
      const rec={url,landing:pick.foreign_landing_url||pick.detail_url||url};
      photoCache.set(cacheKey,rec);
      img.onerror=()=>{
        img.onerror=null;
        img.src="/assets/shop/catalog/"+p.slug+".jpg";
        if(credit)credit.hidden=true;
      };
      img.src=url;
      if(credit){credit.href=rec.landing;credit.hidden=false}
      img.dataset.photoLoaded="1";
      return;
    }catch(e){}
  }
}
function enableRemotePhotoRefinement(){
  const imgs=[...document.querySelectorAll(".product-card img[data-photo-query]")];
  if(!("IntersectionObserver" in window)){
    imgs.slice(0,24).forEach(img=>{
      const card=img.closest(".product-card"),p=state.products.find(x=>x.id===card?.dataset.id),c=img.parentElement.querySelector(".photo-credit");
      fetchBetterPhoto(p,img,c);
    });
    return;
  }
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      const img=entry.target,card=img.closest(".product-card");
      const p=state.products.find(x=>x.id===card?.dataset.id),c=img.parentElement.querySelector(".photo-credit");
      fetchBetterPhoto(p,img,c);
      io.unobserve(img);
    });
  },{rootMargin:"500px"});
  imgs.forEach(img=>io.observe(img));
}

async function init(){
  try{
    const res=await fetch(DATA_URL,{cache:"no-store"});if(!res.ok)throw new Error("Catalog data failed");
    const data=await res.json();state.products=data.products||[];
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