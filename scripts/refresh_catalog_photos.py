#!/usr/bin/env python3
from __future__ import annotations
import io,json,os,re,sys,time
from pathlib import Path
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from PIL import Image
import imagehash

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"data"/"shop-catalog.json"
OUT=ROOT/"assets"/"shop"/"catalog"
CREDITS=ROOT/"data"/"image-credits.json"
UA="AnnikaCatalogImageRefresher/1.0 (+https://annika-website-one.vercel.app/)"
S=requests.Session(); S.headers.update({"User-Agent":UA,"Accept":"application/json,text/plain,*/*"})
TIMEOUT=25
BAD=re.compile(r"(watermark|shutterstock|getty images|alamy|istock|adobe stock|dreamstime|depositphotos|123rf)",re.I)
STOP={"real","photo","product","image","set","women","woman","muslim","modest","fashion","item","essentials"}

def words(t):
    return [w for w in re.findall(r"[a-z0-9]+",str(t).lower()) if w not in STOP and len(w)>2]

def queries(p):
    base=p.get("query") or p["name"]; section=p.get("section","")
    q=[base," ".join(words(p["name"]+" "+p.get("subsection","")))]
    if any(k in section for k in ["Hijab","Clothing","Footwear","Jewellery","Fragrance"]):
        q += [base+" Bangladesh",base+" Pakistan",base+" Arab",base+" Gulf"]
    elif "Prayer" in section or "Ramadan" in section:
        q += [base+" Islamic",base+" Muslim",base+" Arab"]
    else:
        q += [base+" product flat lay",base+" product photo"]
    return list(dict.fromkeys(x.strip() for x in q if x.strip()))

def blob(x):
    z=[x.get("title",""),x.get("creator",""),x.get("description",""),x.get("provider",""),x.get("source","")]
    for t in x.get("tags") or []: z.append(t if isinstance(t,str) else t.get("name",""))
    return " ".join(map(str,z)).lower()

def score(x,p):
    h=blob(x); s=0.0
    for w in words(p["name"]):
        if w in h: s+=4
    for w in words(p.get("subsection","")):
        if w in h: s+=1.5
    sec=p.get("section","").lower()
    if "hijab" in sec and any(w in h for w in ["hijab","abaya","khimar","jilbab","modest"]): s+=3
    if "prayer" in sec and any(w in h for w in ["quran","prayer","salah","muslim","mosque","tasbih","mat"]): s+=3
    if "skincare" in sec and any(w in h for w in ["skin","skincare","cream","serum","face"]): s+=2
    if "haircare" in sec and any(w in h for w in ["hair","shampoo","comb","brush"]): s+=2
    if "fitness" in sec and any(w in h for w in ["fitness","yoga","exercise","running","gym"]): s+=2
    if BAD.search(h): s-=20
    if min(x.get("width") or 0,x.get("height") or 0)>=700: s+=2
    if x.get("license_url"): s+=1
    return s

def get(url,params):
    for attempt in range(3):
        try:
            r=S.get(url,params=params,timeout=TIMEOUT)
            if r.status_code==429:
                time.sleep(3+attempt*2); continue
            r.raise_for_status(); return r.json()
        except Exception:
            if attempt==2: return {}
            time.sleep(2)

def openverse(q):
    return get("https://api.openverse.org/v1/images/",{"q":q,"page_size":30,"mature":"false","license_type":"commercial"}).get("results",[])

def commons(q):
    params={"action":"query","generator":"search","gsrsearch":q+" filetype:bitmap","gsrnamespace":"6","gsrlimit":"30","prop":"imageinfo|info","iiprop":"url|size|mime|extmetadata","iiurlwidth":"1400","format":"json","formatversion":"2"}
    pages=get("https://commons.wikimedia.org/w/api.php",params).get("query",{}).get("pages",[])
    out=[]
    for p in pages:
        info=(p.get("imageinfo") or [{}])[0]; ext=info.get("extmetadata") or {}
        lic=(ext.get("LicenseShortName") or {}).get("value","")
        if not lic: continue
        out.append({
            "title":p.get("title",""),
            "url":info.get("url"),"thumbnail":info.get("thumburl") or info.get("url"),
            "width":info.get("width"),"height":info.get("height"),
            "license":lic,"license_url":(ext.get("LicenseUrl") or {}).get("value",""),
            "creator":re.sub("<[^>]+>","",(ext.get("Artist") or {}).get("value","")),
            "creator_url":"","foreign_landing_url":"https://commons.wikimedia.org/wiki/"+quote(p.get("title","").replace(" ","_"),safe="/:_"),
            "provider":"Wikimedia Commons","source":"wikimedia","tags":[]
        })
    return out

def dl(url):
    try:
        r=S.get(url,timeout=TIMEOUT,allow_redirects=True); r.raise_for_status()
        if len(r.content)<15000 or len(r.content)>12000000: return None
        im=Image.open(io.BytesIO(r.content)).convert("RGB"); im.load()
        if im.width<500 or im.height<500: return None
        return r.content,im
    except Exception: return None

def jpeg(im):
    im.thumbnail((1800,1800),Image.Resampling.LANCZOS); b=io.BytesIO()
    im.save(b,"JPEG",quality=88,optimize=True,progressive=True); return b.getvalue()

def fetch_candidates(p):
    out=[]; seen=set()
    qs=queries(p)[:3]
    for q in qs:
        for raw in openverse(q):
            key=raw.get("id") or raw.get("url") or raw.get("foreign_landing_url")
            if key and key not in seen:
                raw["_q"]=q; seen.add(key); out.append(raw)
        if len(out)>=60: break
    if len(out)<12:
        for q in qs[:2]:
            for raw in commons(q):
                key=raw.get("url") or raw.get("foreign_landing_url")
                if key and key not in seen:
                    raw["_q"]=q; seen.add(key); out.append(raw)
    return out

def main():
    products=json.loads(CATALOG.read_text(encoding="utf-8"))["products"]
    OUT.mkdir(parents=True,exist_ok=True)
    for p in OUT.glob("*.jpg"): p.unlink()
    credits=[]; used_hash=[]; used_urls=set(); providers={}
    all_candidates={}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs={pool.submit(fetch_candidates,p):p for p in products}
        for n,f in enumerate(as_completed(futs),1):
            p=futs[f]
            try: all_candidates[p["id"]]=f.result()
            except Exception: all_candidates[p["id"]]=[]
            print(f"[search {n}/{len(products)}] {p['id']} {p['name']} candidates={len(all_candidates[p['id']])}",flush=True)
    for i,p in enumerate(products,1):
        ranked=sorted(all_candidates.get(p["id"],[]),key=lambda x:score(x,p),reverse=True)
        chosen=None
        for x in ranked[:150]:
            if BAD.search(blob(x)): continue
            u=x.get("url") or x.get("thumbnail")
            if not u or u in used_urls or score(x,p)<3: continue
            got=dl(u)
            if not got: continue
            data,im=got; ph=imagehash.phash(im)
            if any(ph-old<7 for old in used_hash): continue
            chosen=(x,im,ph); break
        if not chosen:
            print("[WARN] no strong unique image for",p["id"],p["name"],flush=True); continue
        x,im,ph=chosen; (OUT/(p["slug"]+".jpg")).write_bytes(jpeg(im))
        used_hash.append(ph); used_urls.add(x.get("url") or x.get("thumbnail"))
        provider=x.get("provider") or x.get("source") or "Open source"; providers[provider]=providers.get(provider,0)+1
        credits.append({"id":p["id"],"name":p["name"],"slug":p["slug"],"query":x.get("_q"),"provider":provider,"source":x.get("source"),"license":x.get("license"),"license_version":x.get("license_version"),"license_url":x.get("license_url"),"creator":x.get("creator"),"creator_url":x.get("creator_url"),"landing_url":x.get("foreign_landing_url") or x.get("detail_url"),"original_url":x.get("url")})
        print(f"[{i}/{len(products)}] {p['id']} {p['name']} <- {provider} / {x.get('license')}",flush=True)
        time.sleep(.04)
    CREDITS.write_text(json.dumps({"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"purpose":"Annïka catalog image credits and provenance","policy":"Only openly licensed/public-domain results selected; license metadata is recorded. Commercial Facebook/e-commerce pages are not scraped.","providers":providers,"images":credits},ensure_ascii=False,indent=2),encoding="utf-8")
    missing=[p["id"] for p in products if not (OUT/(p["slug"]+".jpg")).exists()]
    print(f"Selected {len(credits)}/{len(products)} unique catalog photos; missing={len(missing)}",flush=True)
    if missing:
        print("Missing IDs:",",".join(missing),flush=True); return 2
    return 0

if __name__=="__main__": sys.exit(main())
