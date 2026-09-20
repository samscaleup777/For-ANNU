# Annïka catalog photography pipeline

The catalog image set is refreshed from openly licensed/public-domain sources via scripts/refresh_catalog_photos.py.

The pipeline combines Openverse and Wikimedia Commons, searches each product by its own query, scores title/tag relevance, rejects common stock/watermark terms, prevents URL/perceptual duplicates, and writes provenance to data/image-credits.json.

Commercial Facebook/shop images are intentionally not scraped without permission.

Open-license libraries do not contain an exact supplier-SKU photograph for every retail item, so this pipeline targets strong product/semantic relevance rather than claiming an exact supplier SKU match.
