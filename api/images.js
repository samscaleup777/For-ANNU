const LICENSE_OK = /^(?:cc0|pdm|pd|public domain|by|by-sa|by-nc-nd|by-nd|by-nc-sa|by-nc|cc by)/i;
const LICENSE_BAD = /(?:\bnc\b|non[- ]commercial|noncommercial|rights[- ]managed|all rights reserved)/i;

function commercialLicense(name, url) {
  const value = String(name || "").toLowerCase();
  const link = String(url || "").toLowerCase();
  return !LICENSE_BAD.test(value) &&
    !LICENSE_BAD.test(link) &&
    (LICENSE_OK.test(value) || /creativecommons\.org\/(?:publicdomain|licenses\/by(?:-sa)?\/)/i.test(link));
}

async function openverse(query) {
  const endpoint = new URL("https://api.openverse.org/v1/images/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("page_size", "30");
  endpoint.searchParams.set("mature", "false");
  endpoint.searchParams.set("license_type", "commercial");
  const response = await fetch(endpoint.toString(), {
    headers: { Accept: "application/json", "User-Agent": "AnnikaProductPhotoSearch/1.0" }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (Array.isArray(data.results) ? data.results : []).map(item => ({
    id: item.id,
    title: item.title || "",
    url: item.url || "",
    thumbnail: item.thumbnail || "",
    foreign_landing_url: item.foreign_landing_url || item.detail_url || "",
    creator: item.creator || "",
    provider: item.provider || "Openverse",
    source: item.source || "Openverse",
    license: item.license || "",
    license_url: item.license_url || "",
    description: item.description || "",
    tags: Array.isArray(item.tags) ? item.tags.map(tag => typeof tag === "string" ? tag : tag && tag.name || "").slice(0, 25) : [],
    width: Number(item.width || 0),
    height: Number(item.height || 0)
  }));
}

async function commons(query) {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  const params = {
    action: "query", generator: "search", gsrsearch: query + " filetype:bitmap",
    gsrnamespace: "6", gsrlimit: "30",
    prop: "imageinfo|info", iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600", format: "json", formatversion: "2"
  };
  for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
  const response = await fetch(endpoint.toString(), {
    headers: { Accept: "application/json", "User-Agent": "AnnikaProductPhotoSearch/1.0 (+https://annika-website-one.vercel.app/)" }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.query && Array.isArray(data.query.pages) ? data.query.pages : []).map(page => {
    const image = page.imageinfo && page.imageinfo[0] || {};
    const metadata = image.extmetadata || {};
    const val = key => metadata[key] && metadata[key].value || "";
    const license = val("LicenseShortName");
    const licenseUrl = val("LicenseUrl");
    return {
      id: "commons:" + String(page.pageid || page.title || ""),
      title: page.title || "",
      url: image.url || "",
      thumbnail: image.thumburl || image.url || "",
      foreign_landing_url: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(String(page.title || "").replace(/ /g, "_")).replace(/%3A/g, ":"),
      creator: val("Artist"),
      provider: "Wikimedia Commons",
      source: "Wikimedia Commons",
      license,
      license_url: licenseUrl,
      description: val("ImageDescription") || val("ObjectName") || "",
      tags: [],
      width: Number(image.width || 0),
      height: Number(image.height || 0)
    };
  }).filter(item => commercialLicense(item.license, item.license_url));
}

function textFor(item) {
  return [item.title, item.creator, item.description, item.provider, item.source,
    (item.tags || []).map(tag => typeof tag === "string" ? tag : tag && tag.name || "").join(" ")]
    .join(" ").toLowerCase();
}

const BAD_PHOTO = /(watermark|shutterstock|getty|alamy|istock|adobe[ -]?stock|dreamstime|depositphotos|123rf|blurred|illustration|vector|clipart|3d[ -]?render|rendered|ai[ -]?generated|generative[ -]?ai|synthetic|screenshot|poster|diagram|chart|logo|collage|drawing|painting)/i;

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed", results: [] });
  }

  const query = String((req.query && req.query.q) || "").trim().slice(0, 180);
  if (!query) return res.status(400).json({ error: "Missing image search query", results: [] });

  try {
    let candidates = await openverse(query);
    if (candidates.length < 8) {
      try { candidates = candidates.concat(await commons(query)); } catch (_) {}
    }
    const seen = new Set();
    const results = candidates.filter(item => {
      const key = item.id || item.url || item.foreign_landing_url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      const license = String(item.license || "");
      const licenseUrl = String(item.license_url || "");
      const url = String(item.url || item.thumbnail || "");
      const text = textFor(item);
      if (!url.startsWith("https://") || !commercialLicense(license, licenseUrl)) return false;
      if (Number(item.width || 0) < 700 || Number(item.height || 0) < 700) return false;
      if (BAD_PHOTO.test(text)) return false;
      return true;
    }).slice(0, 35);

    return res.status(200).json({ query, results, source: "Openverse + Wikimedia Commons" });
  } catch (error) {
    console.error("Annïka product photo search error", error);
    return res.status(200).json({ query, results: [], source: "Openverse + Wikimedia Commons", note: "Image search temporarily unavailable." });
  }
};
