#!/usr/bin/env python3
"""Strict, non-destructive catalog photo refresh for Annïka.

Only replaces an existing product image when search metadata strongly matches the
product's meaningful name tokens, the image is open-licensed/commercial-use eligible,
the file is a real high-resolution photograph, and the candidate passes sensitive-
product people-image exclusion. Failed matches preserve the current local asset and
are recorded in data/image-credits.json for review.
"""
from __future__ import annotations
import io, json, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
import requests
from PIL import Image
import imagehash

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"data/shop-catalog.json"
OUT=ROOT/"assets/shop/catalog"
CREDITS=ROOT/"data/image-credits.json"
UA="AnnikaCatalogRefresh/3.0 (+https://annika-website-one.vercel.app/)"
TIMEOUT=20
BAD=re.compile(r"(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|illustration|vector|clipart|3d[ -]?render|rendered|ai[ -]?generated|generative[ -]?ai|synthetic|screenshot|poster|diagram|chart|logo|collage|drawing|painting)",re.I)
PERSON=re.compile(r"\b(woman|women|man|men|girl|boy|child|children|person|people|model|portrait|face|human|patient|nurse|doctor|wearing|posing|standing|sitting|holding|selfie|personnel)\b",re.I)
STOP={"a","an","and","the","for","of","to","with","from","real","photo","photos","product","image","images","set","item","items","essentials","women","woman","womens","men","mens","muslim","modest","fashion","catalog","daily","everyday","comfortable","premium","classic","simple","new"}
QUERY_STOP={"real","photo","product","image","images","item","items","catalog","high","quality","commercial","license","licensed","bangladesh","bangladeshi","pakistan","pakistani","saudi","arabia","uae","gulf","south","asia","global","middle","east","arab","world","muslim","modest","fashion","women","woman","mens","womens","man","men","full","length","studio","isolated","white","background","open","new","classic","premium","simple"}
AMBIGUOUS_REQUIREMENTS={"palazzo":{"pants","trouser","trousers"},"watch":{"wrist","wristwatch"},"flats":{"shoe","shoes","footwear"},"flat":{"shoe","shoes","footwear"},"sari":{"saree","sari"},"sweater":{"clothing","garment","wear","fashion"}}
ALIASES={
 "hot-water bag":["hot water bottle","hot-water bag","heating bag"],
 "hot water bag":["hot water bottle","hot-water bag","heating bag"],
 "quran":["quran","koran","al quran"],
 "tasbih":["tasbih","misbaha","prayer beads"],
 "sanitary pads":["sanitary pads","menstrual pads","period pads"],
 "pantyliners":["pantyliners","panty liners"],
 "menstrual cup":["menstrual cup"],
 "hijab undercap":["hijab undercap","undercap","inner cap"],
 "hijab inner":["hijab inner","inner cap","undercap"],
 "prayer mat / janamaz":["prayer mat","janamaz","prayer rug","sajadah"],
 "quran stand":["quran stand","rehal","book stand"],
 "abaya":["abaya","abāya"],
 "burqa / niqab":["burqa","burka","borkha","niqab","face veil"],
 "burqa":["burqa","burka","borkha"],
 "niqab":["niqab","face veil"],
 "khimar":["khimar","khimaar"],
 "jilbab":["jilbab","jilbaab"],
 "kameez":["kameez","qameez"],
 "salwar kameez":["salwar kameez","shalwar kameez"],
 "face wash":["face wash","facial cleanser","cleanser"],
 "sunscreen":["sunscreen","sun cream","sunblock"],
 "power bank":["power bank","portable charger"],
 "charging cable":["charging cable","usb cable"],
 "period underwear":["period underwear","menstrual underwear"],
 "wireless earbuds":["wireless earbuds","bluetooth earbuds","ear buds"],
}
OBJ_ONLY_SECTION={"Innerwear & Undergarments","Menstrual & Personal Hygiene","Skincare","Modest Everyday Makeup","Haircare","Hands, Feet & Grooming","Fragrance","Jewellery & Accessories","Footwear","Home & Personal Room","Work / Study","Travel","Emergency & Safety","Clothing Care","Personal Electronics"}
WEARABLE_WORDS=re.compile(r"(\b(hijab|khimar|jilbab|abaya|burqa|burka|borkha|niqab|salwar|shalwar|kameez|qameez|kurti|dress|gown|tunic|shirt|top|skirt|trouser|palazzo|pants|jogger|leggings|outerwear|garment|clothing|sleeve|kaftan|thobe|jubba|shawl|scarf|dupatta|sweater|cardigan|coat|jacket|nightwear|pajama|pajamas|robe|blouse|maxi|saree|sari|eid outfit)\b)",re.I)
ACCESSORY_WORDS=re.compile(r"(pin|magnet|clip|undercap|inner cap|bonnet|organizer|storage|hanger|ring|brush|bag|holder|accessor|case|pouch|belt|socks|glove|brooch|scarf ring)",re.I)
SESSION=requests.Session()
SESSION.headers.update({"User-Agent":UA,"Accept":"application/json"})

def clean_text(x):
    if isinstance(x,dict):
        return " ".join(str(x.get(k,"")) for k in ("name","title","description","value","label"))
    return str(x or "")

def metadata(item):
    tags=item.get("tags") or []
    tag_text=" ".join(clean_text(t) for t in tags)
    return " ".join(str(item.get(k,"")) for k in ("title","description","tags","alt","caption"))+" "+tag_text

def normalized_tokens(text):
    return [w for w in re.findall(r"[a-z0-9]+",str(text).lower()) if len(w)>1 and w not in STOP]

def product_tokens(p):
    raw=p.get("name","")
    terms=normalized_tokens(raw)
    # Keep model/brand-independent, non-stopword product identity tokens.
    return list(dict.fromkeys(terms))

def object_only(p):
    name=(p.get("name","")+" "+p.get("subsection","")).lower()
    section=p.get("section","")
    # A model is acceptable only for clearly wearable outer modest clothing.
    if section in OBJ_ONLY_SECTION:return True
    if ACCESSORY_WORDS.search(name):return True
    if section=="Hijab & Modest Wear" or section=="Everyday Clothing" or section=="Fitness" or section=="Ramadan / Eid Essentials":
        return not bool(WEARABLE_WORDS.search(name))
    return True

def exact_name_match(item,p):
    text=metadata(item).lower()
    tokens=product_tokens(p)
    if not tokens:return False
    # A documented synonym phrase may replace name tokens, but unrelated keywords
    # never count as a match.
    name=(p.get("name","")+" "+p.get("query","")).lower()
    alias_match=False
    for alias_key,phrases in ALIASES.items():
        if alias_key in name:
            if not any(phrase in text for phrase in phrases):return False
            remaining=[t for t in tokens if t not in normalized_tokens(alias_key)]
            if not all(t in text for t in remaining):return False
            alias_match=True
            break
    if not alias_match and not all(t in text for t in tokens):return False

    # Single-word product names can be ambiguous in ordinary text (e.g. "Palazzo"
    # may mean a building). Require its item-type context from the catalog query.
    if len(tokens)==1:
        key=tokens[0]
        allowed=AMBIGUOUS_REQUIREMENTS.get(key)
        if allowed and not any(term in text for term in allowed):return False
        query_tokens=[t for t in normalized_tokens(p.get("query","")) if t not in QUERY_STOP and t not in tokens]
        if query_tokens and not any(term in text for term in query_tokens):return False
    return True

def score(item,p):
    text=metadata(item).lower()
    title=str(item.get("title","")).lower()
    tokens=product_tokens(p)
    if not exact_name_match(item,p):return -100
    s=20*len(tokens)
    s+=sum(3 for t in tokens if t in title)
    if item.get("license_url"):s+=2
    if item.get("width",0) and item.get("height",0) and min(item["width"],item["height"])>=1000:s+=4
    elif item.get("width",0) and item.get("height",0) and min(item["width"],item["height"])>=700:s+=2
    if object_only(p) and PERSON.search(text):return -100
    if BAD.search(text):return -100
    q=str(item.get("_q","")).lower()
    if "bangladesh" in q and "bangladesh" in text:s+=1
    return s

def get_json(url,params):
    for attempt in range(3):
        try:
            r=SESSION.get(url,params=params,timeout=TIMEOUT)
            if r.status_code==429:
                time.sleep(2*(attempt+1))
                continue
            if not r.ok:
                return {}
            return r.json()
        except Exception:
            if attempt<2:time.sleep(1)
    return {}

def openverse(q):
    return get_json("https://api.openverse.org/v1/images/",{"q":q,"page_size":30,"mature":"false","license_type":"commercial"}).get("results",[])

def commons(q):
    j=get_json("https://commons.wikimedia.org/w/api.php",{
       "action":"query","generator":"search","gsrsearch":q+" filetype:bitmap","gsrnamespace":"6","gsrlimit":"30",
       "prop":"imageinfo|info","iiprop":"url|size|mime|extmetadata","iiurlwidth":"1600","format":"json","formatversion":"2"})
    out=[]
    for page in j.get("query",{}).get("pages",[]):
        img=(page.get("imageinfo") or [{}])[0]; ext=img.get("extmetadata") or {}
        license_name=clean_text((ext.get("LicenseShortName") or {}).get("value",""))
        license_url=clean_text((ext.get("LicenseUrl") or {}).get("value",""))
        # Commercial reuse only: exclude every NonCommercial/NC license.
        if re.search(r"\\bNC\\b|non[- ]commercial|noncommercial",license_name,re.I):continue
        if not re.match(r"^(CC0|Public domain|PD|CC BY)",license_name,re.I):continue
        out.append({"title":page.get("title",""),"url":img.get("url"),"thumbnail":img.get("thumburl") or img.get("url"),
          "width":img.get("width",0),"height":img.get("height",0),"license":license_name,"license_url":license_url,
          "creator":clean_text((ext.get("Artist") or {}).get("value","")),
          "provider":"Wikimedia Commons","source":"wikimedia","tags":[],
          "foreign_landing_url":"https://commons.wikimedia.org/wiki/"+quote(page.get("title","").replace(" ","_"),safe="/:_")})
    return out

def queries(p):
    name=p.get("name","").strip()
    query_terms=[t for t in normalized_tokens(p.get("query","")) if t not in QUERY_STOP]
    cleaned=" ".join(query_terms)
    # Avoid generic suffixes that drown out the product identity.
    options=[name,cleaned,name+" "+p.get("subsection","")]
    if object_only(p):
        options += [name+" packaging",name+" isolated product"]
    elif p.get("section") in {"Hijab & Modest Wear","Everyday Clothing","Ramadan / Eid Essentials","Fitness"}:
        options += [name+" Bangladesh",name+" hijab abaya"]
    return list(dict.fromkeys(q.strip() for q in options if q and q.strip()))[:5]

def search_product(p):
    items=[];seen=set()
    for q in queries(p):
        for c in openverse(q):
            key=c.get("id") or c.get("url") or c.get("foreign_landing_url")
            if not key or key in seen:continue
            c["_q"]=q;seen.add(key)
            if score(c,p)>=0:items.append(c)
        # Exact-match results are enough; do not broaden to unrelated general terms.
        if len(items)>=12:break
    if len(items)<2:
        for q in queries(p)[:2]:
            for c in commons(q):
                key=c.get("url") or c.get("foreign_landing_url")
                if not key or key in seen:continue
                c["_q"]=q;seen.add(key)
                if score(c,p)>=0:items.append(c)
            if len(items)>=12:break
    return sorted(items,key=lambda x:score(x,p),reverse=True)

def download(url):
    if not url:return None
    try:
        r=SESSION.get(url,timeout=TIMEOUT,allow_redirects=True)
        r.raise_for_status()
        if not r.headers.get("content-type","").lower().startswith("image/"):return None
        data=r.content
        if len(data)<12000 or len(data)>10000000:return None
        im=Image.open(io.BytesIO(data)).convert("RGB");im.load()
        if min(im.size)<700:return None
        return data,im
    except Exception:return None

def main():
    catalog=json.loads(CATALOG.read_text(encoding="utf-8"))
    products=catalog["products"]
    OUT.mkdir(parents=True,exist_ok=True)
    # Keep every existing asset while searching. No delete-first behavior.
    candidates={}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures={pool.submit(search_product,p):p for p in products}
        for i,f in enumerate(as_completed(futures),1):
            p=futures[f]
            try:candidates[p["id"]]=f.result()
            except Exception:candidates[p["id"]]=[]
            print(f"searched {i}/{len(products)} {p['id']} candidates={len(candidates[p['id']])}",flush=True)

    used_hashes=[];used_urls=set();credits=[];providers={}
    missing=[]
    for i,p in enumerate(products,1):
        chosen=None
        for candidate in candidates.get(p["id"],[]):
            if score(candidate,p)<0:continue
            for url in (candidate.get("url"),candidate.get("thumbnail")):
                if not url or url in used_urls:continue
                got=download(url)
                if not got:continue
                data,im=got
                ph=imagehash.phash(im)
                if any(ph-old<8 for old in used_hashes):continue
                chosen=(candidate,url,data,im,ph);break
            if chosen:break
        if not chosen:
            missing.append({"id":p["id"],"name":p["name"],"section":p.get("section",""),"reason":"No high-confidence, licensed, name-matched photo passed filters; existing local image preserved."})
            print(f"UNMATCHED {i}/{len(products)} {p['id']} {p['name']}",flush=True)
            continue
        c,url,data,im,ph=chosen
        out=OUT/(p["slug"]+".jpg")
        im.thumbnail((1600,1600),Image.Resampling.LANCZOS)
        buf=io.BytesIO();im.save(buf,"JPEG",quality=90,optimize=True,progressive=True)
        out.write_bytes(buf.getvalue())
        used_hashes.append(ph);used_urls.add(url)
        provider=c.get("provider") or c.get("source") or "Open source"
        providers[provider]=providers.get(provider,0)+1
        credits.append({"id":p["id"],"name":p["name"],"slug":p["slug"],"query":c.get("_q",p.get("query","")),
          "provider":provider,"license":c.get("license",""),"license_url":c.get("license_url",""),
          "creator":c.get("creator",""),"landing_url":c.get("foreign_landing_url") or c.get("detail_url") or url,
          "original_url":url,"quality_check":"metadata-name match + resolution >= 700px + sensitive people-photo exclusion"})
        print(f"UPDATED {i}/{len(products)} {p['id']} {p['name']} <- {provider}",flush=True)
    credit_doc={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
      "providers":providers,"images":credits,"missing":missing,
      "policy":"Commercial-use open-license/public-domain results only. Every changed photo must contain the product's meaningful name terms in searchable metadata; sensitive/non-apparel listings reject person/model metadata. Existing photos remain unchanged when no high-confidence match exists."}
    CREDITS.write_text(json.dumps(credit_doc,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"REFRESH SUMMARY: updated={len(credits)} unmatched={len(missing)} total={len(products)}",flush=True)

if __name__=="__main__":main()
