# Dossier — browser-only PDF tools

A static website of PDF tools (merge, split, rotate, compress, convert, watermark,
password-protect) that run entirely in the visitor's browser — no backend, no
uploads. Built to be hosted free on GitHub Pages.

## What's included and working

- `index.html` — homepage / tool catalog
- `merge.html` — combine PDFs, drag to reorder
- `split.html` — extract a page range, or explode every page into a ZIP
- `rotate.html` — click-to-rotate page thumbnails
- `compress.html` — re-renders pages as JPEG at a chosen quality to shrink file size
- `pdf-to-jpg.html` — export every page as a JPG (ZIP download)
- `jpg-to-pdf.html` — combine images into a PDF, drag to reorder
- `watermark.html` — diagonal text watermark, adjustable opacity/color
- `protect.html` — password-protects a PDF with real RC4 40-bit standard PDF
  encryption (hand-implemented in `js/pdf-crypto.js` + `js/md5.js` + `js/rc4.js`,
  verified against `qpdf` — correct/incorrect passwords are handled correctly)
- `edit.html` — "add text to a PDF" tool: click anywhere on a rendered page to
  drop a draggable, editable text box (font size + color), page-by-page, then
  bake every box into the PDF with `pdf-lib` on save (`js/tools/edit.js`)

- Favicon (`assets/favicon.svg`) and Open Graph / Twitter card meta tags on
  every page, pointing at `assets/social-preview.png`

## Not built yet (next session)

- No README badges / screenshots.

## How it works

Everything runs client-side using:
- **pdf-lib** — building/editing/encrypting PDF files
- **pdf.js** — rendering PDF pages to canvas for previews and rasterization
- **JSZip** — packaging multi-file downloads (split pages, PDF→JPG)

All three are loaded from a CDN (jsDelivr) in each tool's HTML file — there is
no build step, no npm install needed to run the site itself.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (public or private, Pages works on both
   if you're on GitHub Pro/Team/Enterprise; public repos always get free Pages).
2. Push everything in this folder to the root of that repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch".
5. Set **Branch** to `main` and folder to `/ (root)`, then **Save**.
6. Wait a minute or two — your site will be live at:
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`

No server, database, or environment variables needed — it's just static files.

## Continuing this project

Pick up next time by asking to:
1. Optionally add more tools (unlock/remove password, page numbering, PDF→text)
2. Polish `edit.html`: undo/redo for text boxes, embed a real font for accented
   characters (currently uses pdf-lib's built-in Helvetica, WinAnsi-only)
