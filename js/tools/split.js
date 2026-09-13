(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, downloadBlob, setStatus, initDropzone } = window.Dossier;

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const modeRow = document.getElementById('modeRow');
  const rangeRow = document.getElementById('rangeRow');
  const rangeInput = document.getElementById('rangeInput');
  const pageCountHint = document.getElementById('pageCountHint');
  const actionsRow = document.getElementById('actionsRow');
  const splitBtn = document.getElementById('splitBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFile = null;
  let pageCount = 0;
  let resultPayload = null; // { bytes, filename, mime } or { blob, filename }

  function parseRange(str, max) {
    const pages = new Set();
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) throw new Error(`"${part}" isn't a valid page or range.`);
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : start;
      if (start < 1 || end > max || start > end) throw new Error(`"${part}" is outside 1–${max}.`);
      for (let p = start; p <= end; p++) pages.add(p - 1);
    }
    if (pages.size === 0) throw new Error('Enter at least one page number.');
    return Array.from(pages).sort((a, b) => a - b);
  }

  async function handleFile(file) {
    currentFile = file;
    resultBox.classList.remove('show');
    setStatus(statusEl, 'Reading file…');
    try {
      const bytes = await readAsArrayBuffer(file);
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pageCount = doc.getPageCount();
      pageCountHint.textContent = `(this file has ${pageCount} page${pageCount === 1 ? '' : 's'})`;
      modeRow.style.display = 'block';
      rangeRow.style.display = 'block';
      actionsRow.style.display = 'flex';
      setStatus(statusEl, '');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Could not read that PDF. Is it a valid file?', 'error');
    }
  }

  initDropzone({
    dropzoneEl, inputEl, listEl, multiple: false, accept: ['.pdf'],
    onChange: (files) => {
      if (files.length) handleFile(files[0]);
      else { modeRow.style.display = 'none'; rangeRow.style.display = 'none'; actionsRow.style.display = 'none'; }
    },
  });

  document.querySelectorAll('input[name=mode]').forEach(r => {
    r.addEventListener('change', () => {
      rangeRow.style.display = document.querySelector('input[name=mode]:checked').value === 'range' ? 'block' : 'none';
    });
  });

  splitBtn.addEventListener('click', async () => {
    const mode = document.querySelector('input[name=mode]:checked').value;
    splitBtn.disabled = true;
    setStatus(statusEl, 'Splitting…');
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const { PDFDocument } = PDFLib;

      if (mode === 'range') {
        const indices = parseRange(rangeInput.value, pageCount);
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, indices);
        pages.forEach(p => out.addPage(p));
        const outBytes = await out.save();
        resultPayload = { bytes: outBytes, filename: 'split.pdf', mime: 'application/pdf' };
        resultName.textContent = 'split.pdf';
        resultMeta.textContent = `${indices.length} page(s) · ${formatBytes(outBytes.length)}`;
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pageCount; i++) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const out = await PDFDocument.create();
          const [page] = await out.copyPages(src, [i]);
          out.addPage(page);
          const outBytes = await out.save();
          zip.file(`page-${String(i + 1).padStart(3, '0')}.pdf`, outBytes);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        resultPayload = { blob, filename: 'pages.zip' };
        resultName.textContent = 'pages.zip';
        resultMeta.textContent = `${pageCount} files · ${formatBytes(blob.size)}`;
      }
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, err.message || 'Something went wrong while splitting.', 'error');
    } finally {
      splitBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!resultPayload) return;
    if (resultPayload.bytes) downloadBytes(resultPayload.bytes, resultPayload.filename, resultPayload.mime);
    else downloadBlob(resultPayload.blob, resultPayload.filename);
  });
})();
