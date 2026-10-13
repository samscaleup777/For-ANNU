const LICENSE_OK = /^(?:cc0|pd|public domain|by|by-sa|by-nc-nd|by-nd|by-nc-sa|by-nc|cc by|cc0)/i;
const LICENSE_BAD = /(?:\bnc\b|non[- ]commercial|noncommercial|rights[- ]managed|all rights reserved)/i;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = String((req.query && req.query.q) || "").trim().slice(0, 180);
  if (!query) return res.status(400).json({ error: "Missing image search query", results: [] });

  try {
    const endpoint = new URL("https://api.openverse.org/v1/images/");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("page_size", "30");
    endpoint.searchParams.set("mature", "false");
    endpoint.searchParams.set("license_type", "commercial");

    const response = await fetch(endpoint.toString(), {
      headers: { "Accept": "application/json", "User-Agent": "AnnikaProductPhotoSearch/1.0" }
    });
    if (!response.ok) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ results: [], source: "Openverse", note: "No approved matches returned." });
    }

    const data = await response.json();
    const results = (Array.isArray(data.results) ? data.results : [])
      .filter((item) => {
        const license = String(item.license || "").toLowerCase();
        const licenseUrl = String(item.license_url || "").toLowerCase();
        const url = String(item.url || item.thumbnail || "");
        if (!url.startsWith("https://")) return false;
        if (LICENSE_BAD.test(license) || LICENSE_BAD.test(licenseUrl)) return false;
        return LICENSE_OK.test(license) || /creativecommons\.org\/(?:publicdomain|licenses\/by(?:-sa)?\/)/i.test(licenseUrl);
      })
      .map((item) => ({
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
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => typeof tag === "string" ? tag : tag && tag.name || "").slice(0, 25) : [],
        width: Number(item.width || 0),
        height: Number(item.height || 0)
      }));

    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).json({ results, source: "Openverse" });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ results: [], source: "Openverse", note: "Image search temporarily unavailable." });
  }
};
