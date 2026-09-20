const BAD=/(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|illustration|vector|clipart|3d[ -]?render|rendered|ai[ -]?generated|generative[ -]?ai|synthetic)/i;
const UA='AnnikaImageSearch/1.0 (+https://annika-website-one.vercel.app/)';

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  res.end(JSON.stringify(body));
}
function score(item,q){
  const text=[item.title,item.creator,item.description,item.provider,item.source,(item.tags||[]).map(t=>typeof t==='string'?t:t?.name||'').join(' ')].join(' ').toLowerCase();
  const words=String(q).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
  let s=0;
  for(const w of words) if(text.includes(w)) s+=1;
  if(BAD.test(text)) s-=20;
  if(item.license_url) s+=1;
  return s;
}
async function fetchJson(url,params){
  const u=new URL(url);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:{'User-Agent':UA,'Accept':'application/json'}});
  if(!r.ok) return null;
  return r.json();
}
async function openverse(q){
  const j=await fetchJson('https://api.openverse.org/v1/images/',{q,page_size:30,mature:'false',license_type:'commercial'});
  return j?.results||[];
}
async function commons(q){
  const j=await fetchJson('https://commons.wikimedia.org/w/api.php',{
    action:'query',generator:'search',gsrsearch:q+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'24',
    prop:'imageinfo|info',iiprop:'url|size|mime|extmetadata',iiurlwidth:'1400',format:'json',formatversion:'2'
  });
  return (j?.query?.pages||[]).map(p=>{
    const i=p.imageinfo?.[0]||{},x=i.extmetadata||{};
    return {
      title:p.title||'',url:i.url,thumbnail:i.thumburl||i.url,width:i.width,height:i.height,
      license:x.LicenseShortName?.value||'',license_url:x.LicenseUrl?.value||'',
      creator:String(x.Artist?.value||'').replace(/<[^>]*>/g,''),
      provider:'Wikimedia Commons',source:'wikimedia',tags:[],
      foreign_landing_url:'https://commons.wikimedia.org/wiki/'+encodeURIComponent((p.title||'').replace(/ /g,'_'))
    };
  }).filter(x=>/^(CC|Public domain|PD|CC0)/i.test(x.license||''));
}
module.exports=async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const q=typeof req.query?.q==='string'?req.query.q.trim().slice(0,180):'';
  if(!q)return json(res,400,{error:'q is required'});
  try{
    let results=await openverse(q);
    if(results.length<8) results=results.concat(await commons(q));
    const seen=new Set();
    results=results.filter(x=>{
      const key=x.id||x.url||x.foreign_landing_url;
      if(!key||seen.has(key))return false;
      seen.add(key);
      const txt=[x.title,x.creator,x.description,x.provider,x.source].join(' ');
      return (x.url||x.thumbnail)&&!BAD.test(txt)&&(x.license||x.license_url);
    }).sort((a,b)=>score(b,q)-score(a,q)).slice(0,10);
    return json(res,200,{query:q,results:results.map(x=>({
      url:x.url||x.thumbnail,
      thumbnail:x.thumbnail||x.url,
      title:x.title||'',
      creator:x.creator||'',
      provider:x.provider||x.source||'Open source',
      license:x.license||'',
      license_url:x.license_url||'',
      landing_url:x.foreign_landing_url||x.detail_url||x.url||x.thumbnail
    }))});
  }catch(e){
    console.error('Annika image search error',e);
    return json(res,502,{error:'Image search temporarily unavailable.'});
  }
};