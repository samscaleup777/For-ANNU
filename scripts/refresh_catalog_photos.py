#!/usr/bin/env python3
"""Strict catalog photo reset for Annïka.

Replace legacy catalog photos only with exact-name, openly licensed, high-resolution
product-only photos that pass face/person detection and duplicate checks. If no safe
exact match is found, delete the old photo and make a labeled product-only SVG graphic.
The maintenance audit lists products still needing an exact licensed photo.
"""
from __future__ import annotations
import io, json, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape
from urllib.parse import quote
import requests
from PIL import Image
import imagehash
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"data/shop-catalog.json"
OUT=ROOT/"assets/shop/catalog"
CREDITS=ROOT/"data/image-credits.json"
AUDIT=ROOT/"maintenance/catalog-photo-audit.json"
PLACEHOLDERS=OUT/"placeholders"
UA="AnnikaCatalogRefresh/3.0 (+https://annika-website-one.vercel.app/)"
TIMEOUT=12
BAD=re.compile(r"(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|illustration|vector|clipart|3d[ -]?render|rendered|ai[ -]?generated|generative[ -]?ai|synthetic|screenshot|poster|diagram|chart|logo|collage|drawing|painting)",re.I)
PERSON=re.compile(r"\b(woman|women|man|men|girl|boy|child|children|person|people|model|portrait|face|human|patient|nurse|doctor|wearing|posing|standing|sitting|holding|selfie|personnel)\b",re.I)
STOP={"a","an","and","the","for","of","to","with","from","real","photo","photos","product","image","images","set","item","items","essentials","women","woman","womens","men","mens","muslim","modest","fashion","catalog","daily","everyday","comfortable","premium","classic","simple","new"}
QUERY_STOP={"real","photo","product","image","images","item","items","catalog","high","quality","commercial","license","licensed","bangladesh","bangladeshi","pakistan","pakistani","saudi","arabia","uae","gulf","south","asia","global","middle","east","arab","world","muslim","modest","fashion","women","woman","mens","womens","man","men","full","length","studio","isolated","white","background","open","new","classic","premium","simple"}
AMBIGUOUS_REQUIREMENTS={"palazzo":{"pants","trouser","trousers"},"watch":{"wrist","wristwatch"},"flats":{"shoe","shoes","footwear"},"flat":{"shoe","shoes","footwear"},"sari":{"saree","sari"},"sweater":{"clothing","garment","wear","fashion"},"abaya":{"dress","garment","clothing","apparel","fashion","wear","robe","thobe","jilbab"}}
ALIASES={
 "hijab — chiffon":["chiffon hijab","hijab chiffon","chiffon scarf","chiffon headscarf","chiffon head scarf"],
 "hijab — cotton":["cotton hijab","hijab cotton","cotton scarf","cotton headscarf","cotton head scarf"],
 "hijab — jersey":["jersey hijab","hijab jersey","jersey scarf","jersey headscarf"],
 "hijab — georgette":["georgette hijab","hijab georgette","georgette scarf","georgette headscarf"],
 "instant hijab":["instant hijab","ready hijab","ready-to-wear hijab","one loop hijab"],
 "hijab undercap":["hijab undercap","undercap","inner cap","underscarf"],
 "hijab inner":["hijab inner","inner cap","undercap","underscarf"],
 "hijab magnets":["hijab magnets","hijab magnet","magnetic hijab pins","hijab pin magnets"],
 "hijab pins":["hijab pins","hijab pin","scarf pins"],
 "hijab clips":["hijab clips","hijab clip","scarf clips"],
 "hijab storage organizer":["hijab storage organizer","hijab organizer","scarf organizer"],
 "hijab hanger":["hijab hanger","scarf hanger","scarf ring hanger"],
 "hijab scarf ring":["hijab scarf ring","scarf ring","hijab ring"],
 "long modest dresses":["long modest dress","modest maxi dress","long dress"],
 "maxi dresses":["maxi dress","maxi dresses","long maxi gown"],
 "prayer khimar":["prayer khimar","salat khimar","full length khimar"],
 "prayer dress":["prayer dress","salah dress","salat dress","prayer garment"],
 "long cardigan":["long cardigan","longline cardigan"],
 "modest tunics":["modest tunic","long tunic","longline tunic"],
 "wide-leg trousers":["wide-leg trousers","wide leg pants","palazzo trousers"],
 "palazzo pants":["palazzo pants","palazzo trousers","palazzo pant"],
 "palazzo":["palazzo pants","palazzo trousers","palazzo pant"],
 "modest salwar kameez":["salwar kameez","shalwar kameez","salwar suit"],
 "salwar kameez":["salwar kameez","shalwar kameez","salwar suit"],
 "long kurti":["long kurti","kurti","long kurta"],
 "dupatta":["dupatta","dupatta scarf","shalwar scarf"],
 "shawl":["shawl","wrap shawl","women's shawl"],
 "burqa / niqab":["burqa","burka","borkha","niqab","face veil","burqa niqab"],
 "arm sleeves":["arm sleeves","sleeve covers","modest arm covers"],
 "leg coverings / leggings":["leggings","leg coverings","modest leggings"],
 "hot-water bag":["hot water bottle","hot-water bag","heating bag"],
 "hot water bag":["hot water bottle","hot-water bag","heating bag"],
 "quran":["quran","koran","al quran"],
 "tasbih":["tasbih","misbaha","prayer beads"],
 "sanitary pads":["sanitary pads","menstrual pads","period pads"],
 "pantyliners":["pantyliners","panty liners"],
 "menstrual cup":["menstrual cup"],
 "prayer mat / janamaz":["prayer mat","janamaz","prayer rug","sajadah"],
 "quran stand":["quran stand","rehal","book stand"],
 "abaya":["abaya","abāya"],
 "burqa":["burqa","burka","borkha"],
 "niqab":["niqab","face veil"],
 "khimar":["khimar","khimaar"],
 "jilbab":["jilbab","jilbaab"],
 "kameez":["kameez","qameez"],
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
    name=(p.get("name","")+" "+p.get("query","")).lower()
    # Prefer the most specific alias first: "hijab — chiffon" must match chiffon
    # hijab/scarf, not just any generic hijab image.
    aliases=sorted(ALIASES.items(),key=lambda pair:len(pair[0]),reverse=True)
    alias_match=False
    for alias_key,phrases in aliases:
        if alias_key in name:
            if not any(phrase in text for phrase in phrases):continue
            remaining=[t for t in tokens if t not in normalized_tokens(alias_key)]
            if not all(t in text for t in remaining):continue
            alias_match=True
            break
    if not alias_match and not all(t in text for t in tokens):return False

    # Single-word product names may have unrelated meanings ("Palazzo" can be a building).
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
    if PERSON.search(text):return -100
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
        if re.search(r"\bNC\b|non[- ]commercial|noncommercial",license_name,re.I):continue
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
    # Never search for a model, wearer, portrait, or human. Keep candidate metadata
    # tied to the exact item, but try multiple product-photography query styles.
    options=[name,cleaned,name+" isolated product photo",name+" flat lay product photo"]
    if p.get("section") in {"Hijab & Modest Wear","Everyday Clothing","Fitness","Ramadan / Eid Essentials"}:
        options.extend([name+" folded garment flat lay",name+" product only no model"])
    else:
        options.extend([name+" object-only product photo",name+" product packaging photo"])
    return list(dict.fromkeys(q.strip() for q in options if q and q.strip()))[:6]

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
        for q in queries(p)[:4]:
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
        if len(data)<5000 or len(data)>10000000:return None
        im=Image.open(io.BytesIO(data)).convert("RGB");im.load()
        if min(im.size)<700:return None
        return data,im
    except Exception:return None

_FACE_CASCADES=[cv2.CascadeClassifier(cv2.data.haarcascades+name) for name in ("haarcascade_frontalface_default.xml","haarcascade_frontalface_alt.xml","haarcascade_profileface.xml")]
_HOG=cv2.HOGDescriptor()
_HOG.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
def person_detected(im):
    """Reject visible faces and full-body people for every product photo."""
    try:
        arr=np.asarray(im)
        h,w=arr.shape[:2]
        scale=min(800.0/max(w,h),1.0)
        if scale<1.0:
            arr=cv2.resize(arr,(max(1,int(w*scale)),max(1,int(h*scale))),interpolation=cv2.INTER_AREA)
        gray=cv2.cvtColor(arr,cv2.COLOR_RGB2GRAY)
        for cascade in _FACE_CASCADES:
            if cascade.empty():
                continue
            for view in (gray,cv2.flip(gray,1)):
                faces=cascade.detectMultiScale(view,scaleFactor=1.08,minNeighbors=4,minSize=(18,18))
                if len(faces):
                    return True
        rectangles,weights=_HOG.detectMultiScale(arr,winStride=(8,8),padding=(8,8),scale=1.04)
        return any(float(weight)>=0.45 for weight in weights)
    except Exception:
        # If screening fails, do not publish a possibly people-containing photo.
        return True

def product_placeholder_svg(p):
    """Draw a named object-only placeholder if an exact, safe licensed photo is unavailable."""
    name=str(p.get("name","Product"))
    lower=name.lower()
    apparel=bool(re.search(r"hijab|abaya|burqa|borkha|niqab|khimar|jilbab|dress|gown|tunic|shirt|top|skirt|trouser|palazzo|pants|kurti|kameez|saree|sari|shawl|dupatta|cardigan|sweater|jacket|coat|robe|pajama|leggings|sleeve|wear|outfit|clothing|underwear|bra|camisole|sock",lower))
    footwear=bool(re.search(r"shoe|sandal|slipper|heels|flats|sneaker|footwear|boot",lower))
    book=bool(re.search(r"quran|book|dua|calendar|planner|diary|notebook|prayer mat|janamaz|sajadah|bookmark",lower))
    electronics=bool(re.search(r"phone|laptop|tablet|power bank|charger|cable|earbud|headphone|watch|clock|compass|thermometer|flashlight|tripod|adapter|electronic|device|screen|battery",lower))
    accessory=bool(re.search(r"ring|earring|necklace|bracelet|bangle|jewellery|jewelry|brooch|magnet|pin|clip|comb|brush|tweezer|razor|scissors|needle|thread|button|tape|scrunchie|headband|pen|highlighter|makeup sponge",lower))
    bag=bool(re.search(r"bag|pouch|organizer|holder|case|wallet|backpack|suitcase|box|basket|storage|packaging|pillow|bedsheet|blanket|towel|linen|mask|pad|tissue|wipe|bottle|serum|cream|oil|wash|shampoo|conditioner|perfume|attar|spray|sanitizer|medicine|cosmetic|foundation|lipstick|sunscreen|hygiene|disposal",lower))
    if apparel:
        shape='<path d="M340 255 L285 295 L235 385 L300 415 L335 365 L335 560 L465 560 L465 365 L500 415 L565 385 L515 295 L460 255 L430 300 L370 300 Z" fill="#d8b596" stroke="#805f47" stroke-width="9" stroke-linejoin="round"/><path d="M335 365 L365 398 L435 398 L465 365" fill="none" stroke="#805f47" stroke-width="8"/>'
    elif footwear:
        shape='<path d="M230 445 Q280 430 325 350 L390 390 Q430 445 525 450 Q580 455 585 505 L245 505 Q205 490 230 445 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><path d="M245 485 L575 485" stroke="#805f47" stroke-width="9"/>'
    elif book:
        shape='<path d="M235 320 Q320 290 400 340 Q480 290 565 320 L565 540 Q480 510 400 558 Q320 510 235 540 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><path d="M400 340 L400 558" stroke="#805f47" stroke-width="8"/><path d="M270 365 Q330 350 365 375 M270 415 Q330 400 365 425 M435 375 Q485 350 535 365 M435 425 Q485 400 535 415" stroke="#805f47" stroke-width="7" fill="none"/>'
    elif electronics:
        shape='<rect x="300" y="280" width="200" height="280" rx="22" fill="#d8b596" stroke="#805f47" stroke-width="10"/><rect x="322" y="310" width="156" height="210" rx="8" fill="#fbf7ef" stroke="#805f47" stroke-width="6"/><circle cx="400" cy="540" r="8" fill="#805f47"/>'
    elif accessory:
        shape='<circle cx="400" cy="415" r="112" fill="none" stroke="#d8b596" stroke-width="38"/><circle cx="400" cy="415" r="112" fill="none" stroke="#805f47" stroke-width="9"/><circle cx="400" cy="415" r="62" fill="none" stroke="#805f47" stroke-width="5"/>'
    elif bag:
        shape='<path d="M270 360 L530 360 L555 565 L245 565 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><path d="M330 360 L330 320 Q330 265 400 265 Q470 265 470 320 L470 360" fill="none" stroke="#805f47" stroke-width="12"/><path d="M300 415 L500 415" stroke="#805f47" stroke-width="7"/>'
    else:
        shape='<path d="M315 300 L485 300 L520 355 L520 545 Q520 565 500 565 L300 565 Q280 565 280 545 L280 355 Z" fill="#d8b596" stroke="#805f47" stroke-width="10" stroke-linejoin="round"/><rect x="345" y="250" width="110" height="50" rx="10" fill="#c9824f" stroke="#805f47" stroke-width="8"/>'
    label=xml_escape(name[:52])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="960" viewBox="0 0 800 960" role="img" aria-label="{label} product reference">
<rect width="800" height="960" fill="#fbf7ef"/><rect x="34" y="34" width="732" height="892" rx="38" fill="#f2e7d6" stroke="#dfd5c2" stroke-width="3"/>
<circle cx="400" cy="410" r="205" fill="#ead8bd"/>{shape}
<text x="400" y="690" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#17231d">{label}</text>
<text x="400" y="750" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#625d54">Product-only reference graphic</text>
<text x="400" y="790" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#625d54">Exact licensed photo not verified</text>
</svg>'''

def main():
    catalog=json.loads(CATALOG.read_text(encoding="utf-8"))
    products=catalog["products"]
    OUT.mkdir(parents=True,exist_ok=True)
    PLACEHOLDERS.mkdir(parents=True,exist_ok=True)

    # Preserve already-verified, source-credited photos. Search/download only for
    # product IDs that still have no approved photo, so the refresh runs faster and
    # cannot replace correct photos just to churn the catalog.
    existing_doc={}
    if CREDITS.exists():
        try: existing_doc=json.loads(CREDITS.read_text(encoding="utf-8"))
        except Exception: existing_doc={}
    existing_credits=list(existing_doc.get("images") or [])
    products_by_id={str(p["id"]):p for p in products}
    verified_ids=set()
    credits=[]
    providers={}
    used_hashes=[]
    used_urls=set()
    for item in existing_credits:
        p=products_by_id.get(str(item.get("id")))
        if not p:continue
        photo_path=str(p.get("image","")).lstrip("/")
        photo=ROOT/photo_path
        if not photo_path.startswith("assets/shop/catalog/") or not photo.exists() or photo.suffix.lower() not in {".jpg",".jpeg"}:
            continue
        verified_ids.add(str(p["id"]))
        credits.append(item)
        url=item.get("original_url")
        if url:used_urls.add(url)
        provider=item.get("provider") or "Open source"
        providers[provider]=providers.get(provider,0)+1
        try:
            with Image.open(photo) as img:
                used_hashes.append(imagehash.phash(img.convert("RGB")))
        except Exception:
            pass

    pending=[p for p in products if str(p["id"]) not in verified_ids]
    candidates={}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures={pool.submit(search_product,p):p for p in pending}
        for i,f in enumerate(as_completed(futures),1):
            p=futures[f]
            try:candidates[str(p["id"])]=f.result()
            except Exception:candidates[str(p["id"])]=[]
            print(f"searched missing {i}/{len(pending)} {p['id']} candidates={len(candidates[str(p['id'])])}",flush=True)

    missing=[]
    for i,p in enumerate(products,1):
        if str(p["id"]) in verified_ids:
            print(f"KEEP VERIFIED {i}/{len(products)} {p['id']} {p['name']}",flush=True)
            continue
        chosen=None
        for candidate in candidates.get(str(p["id"]),[]):
            if score(candidate,p)<0:continue
            for url in (candidate.get("url"),candidate.get("thumbnail")):
                if not url or url in used_urls:continue
                got=download(url)
                if not got:continue
                data,im=got
                if person_detected(im):continue
                ph=imagehash.phash(im)
                if any(ph-old<8 for old in used_hashes):continue
                chosen=(candidate,url,data,im,ph);break
            if chosen:break

        out=OUT/(p["slug"]+".jpg")
        placeholder=PLACEHOLDERS/(p["slug"]+".svg")
        if not chosen:
            # Do not restore the old unverified photo. Keep a named object-only graphic.
            out.unlink(missing_ok=True)
            placeholder.write_text(product_placeholder_svg(p),encoding="utf-8")
            p["image"]="/assets/shop/catalog/placeholders/"+p["slug"]+".svg"
            missing.append({"id":p["id"],"name":p["name"],"section":p.get("section",""),
              "placeholder":p["image"],
              "reason":"No exact open-licensed photo passed product-name, resolution, people/face and duplicate checks; named object-only placeholder used."})
            print(f"PLACEHOLDER {i}/{len(products)} {p['id']} {p['name']}",flush=True)
            continue

        c,url,data,im,ph=chosen
        im.thumbnail((1600,1600),Image.Resampling.LANCZOS)
        buf=io.BytesIO();im.save(buf,"JPEG",quality=90,optimize=True,progressive=True)
        out.write_bytes(buf.getvalue())
        placeholder.unlink(missing_ok=True)
        p["image"]="/assets/shop/catalog/"+p["slug"]+".jpg"
        used_hashes.append(ph);used_urls.add(url)
        provider=c.get("provider") or c.get("source") or "Open source"
        providers[provider]=providers.get(provider,0)+1
        credits.append({"id":p["id"],"name":p["name"],"slug":p["slug"],"query":c.get("_q",p.get("query","")),
          "provider":provider,"license":c.get("license",""),"license_url":c.get("license_url",""),
          "creator":c.get("creator",""),"landing_url":c.get("foreign_landing_url") or c.get("detail_url") or url,
          "original_url":url,"quality_check":"exact product-name metadata + resolution >= 700px + face/people-screening + duplicate check",
          "local_file":"/assets/shop/catalog/"+p["slug"]+".jpg"})
        print(f"DOWNLOADED {i}/{len(products)} {p['id']} {p['name']} <- {provider}",flush=True)

    # Remove every unreferenced/legacy image from the product-photo storage folder.
    active_jpgs={p["slug"]+".jpg" for p in products if str(p.get("image","")).endswith(".jpg")}
    for legacy in OUT.iterdir():
        if legacy.is_file() and legacy.suffix.lower() in {".jpg",".jpeg",".png",".webp",".gif"} and legacy.name not in active_jpgs:
            legacy.unlink(missing_ok=True)
    active_placeholders={p["slug"]+".svg" for p in products if "/placeholders/" in str(p.get("image",""))}
    for legacy in PLACEHOLDERS.glob("*.svg"):
        if legacy.name not in active_placeholders:
            legacy.unlink(missing_ok=True)

    # Keep a stable source manifest of all downloaded local catalog images.
    credits.sort(key=lambda item:int(item.get("id",0)) if str(item.get("id","")).isdigit() else 99999)
    policy="Only locally downloaded, source-credited photos with exact product-name metadata, a commercial-use license, >=700px resolution, no detected faces/people and no near-duplicate check are treated as verified. Other products use a labeled product-only SVG."
    catalog["image_strategy"]={"mode":"verified-product-only","primary":["Openverse","Wikimedia Commons"],"verifiedPhotoCount":len(credits),"namedObjectOnlyPlaceholderCount":len(missing),"policy":policy}
    CATALOG.write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding="utf-8")
    credit_doc={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"providers":providers,"images":credits,"policy":policy}
    CREDITS.write_text(json.dumps(credit_doc,ensure_ascii=False,indent=2),encoding="utf-8")
    audit={"generatedAt":credit_doc["generatedAt"],"totalProducts":len(products),"verifiedInternetPhotos":len(credits),
      "namedObjectOnlyPlaceholders":len(missing),"missing":missing,"policy":policy}
    AUDIT.parent.mkdir(parents=True,exist_ok=True)
    AUDIT.write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"REFRESH SUMMARY: verified_photos={len(credits)} placeholders={len(missing)} total={len(products)} new_downloads={len(credits)-len(verified_ids)}",flush=True)

if __name__=="__main__":main()
