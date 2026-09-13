(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, initDropzone } = window.Dossier;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const editorBlock = document.getElementById('editorBlock');
  const pageStage = document.getElementById('pageStage');
  const pageCanvas = document.getElementById('pageCanvas');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const sizeInput = document.getElementById('sizeInput');
  const applyBtn = document.getElementById('applyBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  const colors = {
    black: [0.07, 0.07, 0.07],
    red: [0.72, 0.11, 0.11],
    blue: [0.09, 0.24, 0.63],
  };

  let currentFile = null;
  let pdfDoc = null;          // pdf.js document, for rendering
  let numPages = 0;
  let currentPage = 0;        // 0-indexed
  let renderScale = 1;
  let resultBytes = null;

  // boxesByPage[pageIndex] = [{ id, xCanvas, yCanvas, text, size, colorKey }]
  let boxesByPage = [];
  let boxIdSeq = 0;

  function currentColorKey() {
    return document.querySelector('input[name=edit-color]:checked').value;
  }

  function clearBoxDivs() {
    pageStage.querySelectorAll('.text-box').forEach(el => el.remove());
  }

  function makeBoxEl(box) {
    const el = document.createElement('div');
    el.className = 'text-box';
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.style.left = box.xCanvas + 'px';
    el.style.top = box.yCanvas + 'px';
    el.style.fontSize = box.size + 'px';
    el.style.color = ({ black: '#121212', red: '#b81c1c', blue: '#173da1' })[box.colorKey];
    el.textContent = box.text;

    el.addEventListener('input', () => { box.text = el.textContent; });

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      boxesByPage[currentPage] = boxesByPage[currentPage].filter(b => b.id !== box.id);
      el.remove();
    });

    // Drag to reposition (mousedown outside of active text editing caret placement
    // is hard to fully separate from typing, so we only start a drag if the
    // pointer moves more than a few pixels before mouseup).
    let dragging = false, moved = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
    el.addEventListener('mousedown', (e) => {
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      origLeft = box.xCanvas; origTop = box.yCanvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        box.xCanvas = origLeft + dx;
        box.yCanvas = origTop + dy;
        el.style.left = box.xCanvas + 'px';
        el.style.top = box.yCanvas + 'px';
      }
    });
    window.addEventListener('mouseup', () => {
      if (dragging && moved) {
        // swallow the click-to-focus that would otherwise follow a drag
        el.dataset.justDragged = '1';
        setTimeout(() => { delete el.dataset.justDragged; }, 0);
      }
      dragging = false;
    });

    pageStage.appendChild(el);
    return el;
  }

  function renderBoxesForCurrentPage() {
    clearBoxDivs();
    (boxesByPage[currentPage] || []).forEach(box => makeBoxEl(box));
  }

  async function renderPage(pageIndex) {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    // Fit within a comfortable editing width, but don't upscale tiny pages too far.
    const targetWidth = Math.min(720, Math.max(420, baseViewport.width));
    renderScale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: renderScale });

    pageCanvas.width = viewport.width;
    pageCanvas.height = viewport.height;
    pageStage.style.width = viewport.width + 'px';
    pageStage.style.height = viewport.height + 'px';

    await page.render({ canvasContext: pageCanvas.getContext('2d'), viewport }).promise;
    renderBoxesForCurrentPage();
    pageIndicator.textContent = `Page ${pageIndex + 1} of ${numPages}`;
  }

  pageStage.addEventListener('click', (e) => {
    if (e.target !== pageCanvas) return; // clicked an existing box, not the page itself
    const rect = pageStage.getBoundingClientRect();
    const box = {
      id: ++boxIdSeq,
      xCanvas: e.clientX - rect.left,
      yCanvas: e.clientY - rect.top,
      text: '',
      size: parseInt(sizeInput.value, 10) || 16,
      colorKey: currentColorKey(),
    };
    if (!boxesByPage[currentPage]) boxesByPage[currentPage] = [];
    boxesByPage[currentPage].push(box);
    const el = makeBoxEl(box);
    el.focus();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderPage(currentPage); }
  });
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < numPages - 1) { currentPage++; renderPage(currentPage); }
  });

  async function loadPdfForEditing(bytes) {
    pdfDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    numPages = pdfDoc.numPages;
    boxesByPage = new Array(numPages).fill(null).map(() => []);
    currentPage = 0;
    await renderPage(currentPage);
    editorBlock.style.display = 'block';
  }

  async function handleFile(file) {
    currentFile = file;
    resultBox.classList.remove('show');
    editorBlock.style.display = 'none';
    setStatus(statusEl, 'Rendering preview…');
    try {
      const bytes = await readAsArrayBuffer(file);
      await loadPdfForEditing(new Uint8Array(bytes));
      setStatus(statusEl, 'Click the page to add a text box.');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Could not read that PDF.', 'error');
    }
  }

  initDropzone({
    dropzoneEl, inputEl, listEl, multiple: false, accept: ['.pdf'],
    onChange: (files) => {
      if (files.length) handleFile(files[0]);
      else {
        editorBlock.style.display = 'none';
        pdfDoc = null;
        boxesByPage = [];
        setStatus(statusEl, '');
      }
    },
  });

  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    applyBtn.disabled = true;
    setStatus(statusEl, 'Baking text into the PDF…');
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();

      boxesByPage.forEach((boxes, pageIndex) => {
        const page = pages[pageIndex];
        if (!page || !boxes || !boxes.length) return;
        const { height: pageHeightPts } = page.getSize();

        boxes.forEach(box => {
          const text = (box.text || '').trim();
          if (!text) return;
          const [r, g, b] = colors[box.colorKey] || colors.black;
          const pdfSize = box.size / renderScale;
          const pdfX = box.xCanvas / renderScale;
          // Canvas y grows downward from the top; PDF y grows upward from the
          // bottom. Nudge down by ~0.8 * font size so the baseline lines up
          // with where the box's top edge was drawn on screen.
          const pdfY = pageHeightPts - (box.yCanvas / renderScale) - pdfSize * 0.8;

          text.split('\n').forEach((line, i) => {
            if (!line) return;
            page.drawText(line, {
              x: pdfX,
              y: pdfY - i * pdfSize * 1.2,
              size: pdfSize,
              font,
              color: rgb(r, g, b),
            });
          });
        });
      });

      resultBytes = await doc.save();
      resultName.textContent = 'edited.pdf';
      resultMeta.textContent = formatBytes(resultBytes.length);
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong saving that PDF.', 'error');
    } finally {
      applyBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'edited.pdf', 'application/pdf');
  });
})();
