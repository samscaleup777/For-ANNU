#!/usr/bin/env python3
from __future__ import annotations
import io,json,re,sys,time,hashlib
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image
import imagehash

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"data/shop-catalog.json"
OUT=ROOT/"assets/shop/catalog"
CREDITS=ROOT/"data/image-credits.json"
UA="AnnikaCatalogRefresh/2.0 (+https://annika-website-one.vercel.app/)"
S=requests.Session()
S.headers.update({"User-Agent":UA,"Accept":"application/json"})
TIMEOUT=25
BAD=re.compile(r"(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|illustration|vector|clipart|3d[ -]?render|rendered|ai[ -]?generated|generative[ -]?ai|synthetic)",re.I)
STOP={"real","photo","product","image","set","women","woman","muslim","modest","fashion","item","essentials"}

def words(t):
    return [w for w in re.findall(r"[a-z0-9]+",str(t).lower()) if w not in STOP and len(w)>2]

def queries(p):
    base=(p.get("query") or p["name"]).strip()
    sec=(p.get("section","")+" "+p.get("subsection","")).lower()
    qs=[base, p["name"]+" "+p.get("subsection","")]
    if any(x in sec for x in ["hijab","clothing","footwear","jewellery","fragrance"]):
        qs += [base+" Bangladesh",base+" Pakistan",base+" Arab",base+" Saudi Arabia",base+" Gulf",base+" South Asia"]
    elif any(x in sec for x in ["prayer","ramadan"]):
        qs += [base+" Islamic",base+" Quran",base+" prayer",base+" Arab"]
    else:
        qs += [base+" Bangladesh",base+" Pakistan",base+" Arab"]
    return list(dict.fromkeys(q.strip() for q in qs if q.strip()))[:6]

def blob(x):
    tags=(x.get("tags") or [])
    tags=" ".join(t if isinstance(t,str) else t.get("name","") for t in tags)
    return " ".join(str(x.get(k,"")) for k in ["title","creator","description","provider","source"])+ " "+tags

def score(x,p,q):
    h=blob(x).lower()
    s=0
    for w in words(p["name"]): s += 4 if w in h else 0
    for w in words(p.get("subsection","")): s += 1.5 if w in h else 0
    sec=p.get("section","").lower()
    if "hijab" in sec and re.search(r"hijab|abaya|khimar|jilbab",h): s+=4
    if "prayer" in sec and re.search(r"quran|prayer|salah|muslim|mosque|tasbih|mat",h): s+=4
    if "skincare" in sec and re.search(r"skin|cream|serum|face|cosmetic",h): s+=3
    if "haircare" in sec and re.search(r"hair|shampoo|comb|brush|bonnet",h): s+=3
    if "fitness" in sec and re.search(r"fitness|gym|exercise|running|yoga",h): s+=3
    if "travel" in sec and re.search(r"travel|suitcase|backpack|passport|luggage",h): s+=3
    if "bangladesh" in q.lower() and "bangladesh" in h:s+=5
    if "pakistan" in q.lower() and "pakistan" in h:s+=5
    if any(x in q.lower() for x in ["arab","saudi","gulf","dubai","qatar","kuwait"]) and re.search(r"arab|saudi|gulf|dubai|qatar|kuwait",h):s+=5
    if BAD.search(h): s-=30
    if x.get("license_url"):s+=2
    if x.get("width",0) and x.get("height",0) and min(x["width"],x["height"])>=700:s+=2
    return s

def get_json(url,params):
    for attempt in range(3):
        try:
            r=S.get(url,params=params,timeout=TIMEOUT)
            if r.status_code==429:
                time.sleep(3*(attempt+1)); continue
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt==2:return {}
            time.sleep(2)
    return {}

def openverse(q):
    j=get_json("https://api.openverse.org/v1/images/",{"q":q,"page_size":30,"mature":"false","license_type":"commercial"})
    return j.get("results",[])

def commons(q):
    j=get_json("https://commons.wikimedia.org/w/api.php",{
      "action":"query","generator":"search","gsrsearch":q+" filetype:bitmap","gsrnamespace":"6","gsrlimit":"30",
      "prop":"imageinfo|info","iiprop":"url|size|mime|extmetadata","iiurlwidth":"1400","format":"json","formatversion":"2"})
    out=[]
    for p in j.get("query",{}).get("pages",[]):
        i=(p.get("imageinfo") or [{}])[0]; e=i.get("extmetadata") or {}
        lic=(e.get("LicenseShortName") or {}).get("value","")
        if not re.match(r"^(CC|Public domain|PD|CC0)",lic,re.I):continue
        out.append({
          "title":p.get("title",""),"url":i.get("url"),"thumbnail":i.get("thumburl") or i.get("url"),
          "width":i.get("width",0),"height":i.get("height",0),"license":lic,
          "license_url":(e.get("LicenseUrl") or {}).get("value",""),
          "creator":re.sub("<[^>]*>","",(e.get("Artist") or {}).get("value","")),
          "provider":"Wikimedia Commons","source":"wikimedia","tags":[],
          "foreign_landing_url":"https://commons.wikimedia.org/wiki/"+quote(p.get("title","").replace(" ","_"),safe="/:_")})
    return out

def search_product(p):
    allc=[];seen=set()
    for q in queries(p):
        for c in openverse(q):
            k=c.get("id") or c.get("url") or c.get("foreign_landing_url")
            if not k or k in seen:continue
            c["_q"]=q;seen.add(k);allc.append(c)
        if len(allc)>=90:break
    if len(allc)<15:
        for q in queries(p)[:3]:
            for c in commons(q):
                k=c.get("url") or c.get("foreign_landing_url")
                if not k or k in seen:continue
                c["_q"]=q;seen.add(k);allc.append(c)
    return sorted(allc,key=lambda x:score(x,p,x.get("_q","")),reverse=True)

def download(url):
    if not url:return None
    try:
        r=S.get(url,timeout=TIMEOUT,allow_redirects=True)
        r.raise_for_status()
        if not (r.headers.get("content-type","").lower().startswith("image/")):return None
        b=r.content
        if len(b)<15000 or len(b)>10000000:return None
        im=Image.open(io.BytesIO(b)).convert("RGB");im.load()
        if min(im.width,im.height)<500:return None
        return b,im
    except Exception:return None

def main():
    products=json.loads(CATALOG.read_text(encoding="utf-8"))["products"]
    OUT.mkdir(parents=True,exist_ok=True)
    old={p.name:p for p in OUT.glob("*") if p.suffix.lower() in {".jpg",".jpeg",".png",".webp"}}
    for p in OUT.glob("*"):
        if p.suffix.lower() in {".jpg",".jpeg",".png",".webp"}:p.unlink()

    candidates={}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures={pool.submit(search_product,p):p for p in products}
        for n,f in enumerate(as_completed(futures),1):
            p=futures[f]
            try:candidates[p["id"]]=f.result()
            except Exception:candidates[p["id"]]=[]
            print(f"search {n}/{len(products)}: {p['id']} candidates={len(candidates[p['id']])}",flush=True)

    used_hashes=[];used_urls=set();credits=[];provider_counts={}
    for idx,p in enumerate(products,1):
        chosen=None
        for c in candidates.get(p["id"],[])[:140]:
            if BAD.search(blob(c)):continue
            if score(c,p,c.get("_q",""))<5:continue
            for u in [c.get("url"),c.get("thumbnail")]:
                if not u or u in used_urls:continue
                got=download(u)
                if not got:continue
                b,im=got
                ph=imagehash.phash(im)
                if any(ph-old<8 for old in used_hashes):continue
                chosen=(c,u,b,im,ph);break
            if chosen:break
        if not chosen:
            print(f"FAIL {p['id']} {p['name']}",flush=True);continue
        c,u,b,im,ph=chosen
        out=OUT/(p["slug"]+".jpg")
        # Normalize oversized images to keep the repo/deployment compact.
        im.thumbnail((1600,1600),Image.Resampling.LANCZOS)
        buf=io.BytesIO();im.save(buf,"JPEG",quality=87,optimize=True,progressive=True)
        out.write_bytes(buf.getvalue())
        used_hashes.append(ph);used_urls.add(u)
        provider=c.get("provider") or c.get("source") or "Open source"
        provider_counts[provider]=provider_counts.get(provider,0)+1
        credits.append({
          "id":p["id"],"name":p["name"],"slug":p["slug"],"query":c.get("_q",p.get("query","")),
          "provider":provider,"license":c.get("license",""),"license_url":c.get("license_url",""),
          "creator":c.get("creator",""),"landing_url":c.get("foreign_landing_url") or c.get("detail_url") or u,
          "original_url":u})
        print(f"ok {idx}/{len(products)} {p['name']} <- {provider}",flush=True)
    missing=[p["id"] for p in products if not (OUT/(p["slug"]+".jpg")).exists()]
    CREDITS.write_text(json.dumps({
      "generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
      "providers":provider_counts,"images":credits,"missing":missing,
      "policy":"Open-license/public-domain media only; per-file source and license metadata retained. Commercial Facebook/e-commerce photos are not copied without permission."
    },ensure_ascii=False,indent=2),encoding="utf-8")
    if missing:
        raise SystemExit(f"Missing {len(missing)} products: {','.join(missing)}")
if __name__=="__main__":main()
