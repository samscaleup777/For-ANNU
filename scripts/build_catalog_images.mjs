const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const catalogFile = path.join(root, "data", "shop-catalog.json");
const outDir = path.join(root, "assets", "shop", "catalog");
const creditsFile = path.join(root, "data", "image-credits.json");

const UA = "AnnikaCatalogBuilder/1.0 (+https://annika-website-one.vercel.app/)";
const BAD = /(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|blurred-face)/i;
const STOP = new Set(["real","photo","product","image","set","women","woman","muslim","modest","fashion","item","essentials"]);

function words(s){
  return String(s||"").toLowerCase().match(/[a-z0-9]+/g)?.filter(w=>!STOP.has(w)&&w.length>2) || [];
}
function queries(p){
  const base = p.query || p.name;
  const section = p.section || "";
  const qs = [base, words(p.name+" "+(p.subsection||"")).join(" ")];
  if(/Hijab|Clothing|Footwear|Jewellery|Fragrance/.test(section)){
    qs.push(base+" Bangladesh", base+" Pakistan", base+" Arab", base+" Gulf");
  } else if(/Prayer|Ramadan/.test(section)){
    qs.push(base+" Islamic", base+" Muslim", base+" Arab");
  } else {
    qs.push(base+" product flat lay", base+" product photo");
  }
  return [...new Set(qs.map(x=>x.trim()).filter(Boolean))].slice(0,4);
}
function text(c){
  const tags = (c.tags||[]).map(t=>typeof t==="string"?t:t?.name||"").join(" ");
  return [c.title,c.creator,c.description,c.provider,c.source,tags].filter(Boolean).join(" ").toLowerCase();
}
function score(c,p){
  const h=text(c), name=words(p.name), sub=words(p.subsection);
  let s=0;
  name.forEach(w=>{if(h.includes(w))s+=4});
  sub.forEach(w=>{if(h.includes(w))s+=1.5});
  const sec=(p.section||"").toLowerCase();
  if(sec.includes("hijab")&&/(hijab|abaya|khimar|jilbab|modest)/.test(h))s+=3;
  if(sec.includes("prayer")&&/(quran|prayer|salah|muslim|mosque|tasbih|mat)/.test(h))s+=3;
  if(sec.includes("skincare")&&/(skin|skincare|cream|serum|face)/.test(h))s+=2;
  if(sec.includes("haircare")&&/(hair|shampoo|comb|brush)/.test(h))s+=2;
  if(sec.includes("fitness")&&/(fitness|yoga|exercise|running|gym)/.test(h))s+=2;
  if(BAD.test(h))s-=25;
  if(c.license_url)s+=1;
  return s;
}
async function getJSON(url, params){
  const u = new URL(url);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  for(let i=0;i<3;i++){
    try{
      const r=await fetch(u,{headers:{"User-Agent":UA,"Accept":"application/json"}});
      if(r.status===429){await new Promise(x=>setTimeout(x,2500*(i+1)));continue;}
      if(!r.ok) return null;
      return await r.json();
    }catch(e){if(i===2)return null;await new Promise(x=>setTimeout(x,1000));}
  }
  return null;
}
async function openverse(q){
  const j=await getJSON("https://api.openverse.org/v1/images/",{
    q,page_size:24,mature:"false",license_type:"commercial"
  });
  return j?.results||[];
}
async function commons(q){
  const j=await getJSON("https://commons.wikimedia.org/w/api.php",{
    action:"query",generator:"search",gsrsearch:q+" filetype:bitmap",
    gsrnamespace:"6",gsrlimit:"24",prop:"imageinfo|info",
    iiprop:"url|size|mime|extmetadata",iiurlwidth:"1400",format:"json",formatversion:"2"
  });
  return (j?.query?.pages||[]).map(p=>{
    const info=p.imageinfo?.[0]||{}, ext=info.extmetadata||{};
    return {
      title:p.title||"",url:info.url,thumbnail:info.thumburl||info.url,
      width:info.width,height:info.height,
      license:ext.LicenseShortName?.value||"",
      license_url:ext.LicenseUrl?.value||"",
      creator:String(ext.Artist?.value||"").replace(/<[^>]*>/g,""),
      provider:"Wikimedia Commons",source:"wikimedia",tags:[],
      foreign_landing_url:"https://commons.wikimedia.org/wiki/"+encodeURIComponent((p.title||"").replace(/ /g,"_"))
    };
  }).filter(x=>/^(CC|Public domain|PD|CC0)/i.test(x.license||""));
}
async function searchProduct(p){
  let all=[],seen=new Set();
  for(const q of queries(p)){
    const ov=await openverse(q);
    for(const c of ov){
      const k=c.id||c.url||c.foreign_landing_url;
      if(k&&!seen.has(k)){seen.add(k);c._q=q;all.push(c);}
    }
    if(all.length>=60)break;
  }
  if(all.length<12){
    for(const q of queries(p).slice(0,2)){
      const cm=await commons(q);
      for(const c of cm){
        const k=c.url||c.foreign_landing_url;
        if(k&&!seen.has(k)){seen.add(k);c._q=q;all.push(c);}
      }
    }
  }
  return all.sort((a,b)=>score(b,p)-score(a,p));
}
async function download(url){
  try{
    const r=await fetch(url,{headers:{"User-Agent":UA},redirect:"follow"});
    if(!r.ok)return null;
    const type=(r.headers.get("content-type")||"").split(";")[0].toLowerCase();
    if(!type.startsWith("image/"))return null;
    const b=Buffer.from(await r.arrayBuffer());
    if(b.length<15000||b.length>9000000)return null;
    let ext=type==="image/jpeg"||type==="image/jpg"?".jpg":type==="image/png"?".png":type==="image/webp"?".webp":type==="image/gif"?".gif":null;
    if(!ext)return null;
    return {b,ext,type};
  }catch(e){return null;}
}
async function main(){
  const data=JSON.parse(fs.readFileSync(catalogFile,"utf8"));
  const products=data.products||[];
  fs.mkdirSync(outDir,{recursive:true});
  for(const f of fs.readdirSync(outDir)){
    if(/\.(jpg|jpeg|png|webp|gif)$/i.test(f))fs.unlinkSync(path.join(outDir,f));
  }

  const candidateMap=new Map();
  const batch=8;
  for(let i=0;i<products.length;i+=batch){
    const slice=products.slice(i,i+batch);
    const results=await Promise.all(slice.map(async p=>[p.id,await searchProduct(p)]));
    results.forEach(([id,c])=>candidateMap.set(id,c));
    console.log("Searched "+Math.min(i+batch,products.length)+"/"+products.length);
  }

  const usedHashes=new Set();
  const usedLandings=new Set();
  const credits=[];
  const providerCounts={};

  for(let i=0;i<products.length;i++){
    const p=products[i];
    const ranked=candidateMap.get(p.id)||[];
    let chosen=null;
    for(const c of ranked.slice(0,100)){
      if(BAD.test(text(c)))continue;
      const landing=c.foreign_landing_url||c.detail_url||"";
      if(landing&&usedLandings.has(landing))continue;
      const candidates=[c.url,c.thumbnail].filter(Boolean);
      for(const u of candidates){
        const dl=await download(u);
        if(!dl)continue;
        const hash=crypto.createHash("sha256").update(dl.b).digest("hex");
        if(usedHashes.has(hash))continue;
        if(score(c,p)<3)continue;
        chosen={c,dl,hash,landing};break;
      }
      if(chosen)break;
    }
    if(!chosen){
      console.warn("[WARN] no unique licensed photo:",p.id,p.name);
      continue;
    }
    const fileName=p.slug+chosen.dl.ext;
    fs.writeFileSync(path.join(outDir,fileName),chosen.dl.b);
    p.image="/assets/shop/catalog/"+fileName;
    p.imageSource=chosen.c.provider||chosen.c.source||"Open source";
    usedHashes.add(chosen.hash);
    if(chosen.landing)usedLandings.add(chosen.landing);
    const provider=chosen.c.provider||chosen.c.source||"Open source";
    providerCounts[provider]=(providerCounts[provider]||0)+1;
    credits.push({
      id:p.id,name:p.name,slug:p.slug,query:chosen.c._q||p.query,
      provider,source:chosen.c.source||"",license:chosen.c.license||"",
      license_version:chosen.c.license_version||"",license_url:chosen.c.license_url||"",
      creator:chosen.c.creator||"",creator_url:chosen.c.creator_url||"",
      landing_url:chosen.landing||"",original_url:chosen.c.url||""
    });
    console.log("["+String(i+1).padStart(3,"0")+"/"+products.length+"] "+p.name+" <- "+provider+" / "+(chosen.c.license||"license metadata"));
  }

  fs.writeFileSync(catalogFile,JSON.stringify({...data,version:(data.version||1)+1,source:"Openverse + Wikimedia Commons",note:"Product photos are selected per product query from openly licensed/public-domain results; image provenance is recorded in data/image-credits.json."},null,2));
  const missing=products.filter(p=>!p.image);
  fs.writeFileSync(creditsFile,JSON.stringify({
    generatedAt:new Date().toISOString(),
    policy:"Open-license/public-domain media only. Source/license/creator metadata is retained. Commercial Facebook/e-commerce images are not copied without permission.",
    providers:providerCounts,images:credits,missing:missing.map(p=>({id:p.id,name:p.name}))
  },null,2));
  if(missing.length)throw new Error("Missing "+missing.length+" catalog images");
}
main().catch(e=>{console.error(e);process.exit(1)});