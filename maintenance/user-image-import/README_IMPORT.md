# Annïka catalog photo import pack

## What this pack contains
- 335 locally stored, optimized JPGs derived from the ZIP supplied by the site owner.
- `maintenance/user-image-source-map.csv`: reviewed source-to-product mapping.
- `maintenance/mapping-contact-sheets/`: seven visual contact sheets showing the proposed image-to-product IDs.
- `maintenance/user-image-map-preview.html`: a local review gallery; the installer regenerates it with the current catalog's product names.
- `INSTALL_USER_CATALOG_IMAGES.py`: a guarded installer which updates the local repository files and produces a per-product audit report.
- `fashion-image-overrides.css`: makes Fashion's hero and feature imagery use supplied, local photos.

## Review summary
- 335 source photos were visually reviewed using contact sheets.
- 303 photos are assigned to distinct catalog product IDs: 277 direct product matches and 26 close variants judged visually related.
- 32 photos are preserved in the repo assets but intentionally not mapped to a product because a confident unique match was not established.
- The catalog has 350 product IDs. Products without an assigned photo will use the existing local no-person placeholder; this removes old/mismatched product pictures rather than forcing an incorrect match.
- Product photographs are same-origin files; remote Openverse photo substitution is disabled by the installer.
- The supplied JPGs are optimized versions, max 1000px edge, JPEG quality 87. The original filenames are recorded in the CSV.

## Install into the GitHub/Vercel repository
1. Download and extract this ZIP into the **root** of `samscaleup777/For-ANNU` (merge folders; do not put the entire pack in a nested folder).
2. From the repository root, run `python INSTALL_USER_CATALOG_IMAGES.py --repo-root .`.
3. Review `maintenance/catalog-image-audit.csv` and the generated Git diff.
4. Open `maintenance/user-image-map-preview.html` to review the named matches and unassigned photos, then inspect `maintenance/catalog-image-audit.csv`.
5. Run `git diff --check`, inspect `git status --short`, then commit and push the changes to `main`; Vercel can then build the updated production site.

The installer validates all 335 files, checks for a unique product assignment, makes backups outside the repository before writing, disables remote photo substitutions, updates the Fashion CSS reference and writes an audit report.

## Important status
Preparing this pack does **not** itself change the live site. The current environment can prepare and validate the files, but does not have a working binary-write path into the authenticated GitHub repository. Do not claim the new photos are live until the assets and importer output have been committed to `main` and a READY Vercel production deployment is verified.
