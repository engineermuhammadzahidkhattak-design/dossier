(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, initDropzone } = window.Dossier;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const qualityRow = document.getElementById('qualityRow');
  const qualityHint = document.getElementById('qualityHint');
  const actionsRow = document.getElementById('actionsRow');
  const compressBtn = document.getElementById('compressBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFile = null;
  let originalSize = 0;
  let resultBytes = null;

  const hints = {
    '0.4': 'Small file — noticeable quality loss on dense text or fine detail',
    '0.65': 'Medium — good balance of size and clarity',
    '0.85': 'High quality — modest size reduction only',
  };

  document.querySelectorAll('input[name=quality]').forEach(r => {
    r.addEventListener('change', () => { qualityHint.textContent = hints[r.value]; });
  });

  function handleFile(file) {
    currentFile = file;
    originalSize = file.size;
    resultBox.classList.remove('show');
    qualityRow.style.display = 'block';
    actionsRow.style.display = 'flex';
    setStatus(statusEl, '');
  }

  initDropzone({
    dropzoneEl, inputEl, listEl, multiple: false, accept: ['.pdf'],
    onChange: (files) => {
      if (files.length) handleFile(files[0]);
      else { qualityRow.style.display = 'none'; actionsRow.style.display = 'none'; }
    },
  });

  compressBtn.addEventListener('click', async () => {
    compressBtn.disabled = true;
    const quality = parseFloat(document.querySelector('input[name=quality]:checked').value);
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const { PDFDocument } = PDFLib;
      const out = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(statusEl, `Re-encoding page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const scale = 1.5; // ~150 DPI equivalent for a 72dpi page unit
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0));
        const jpegImage = await out.embedJpg(jpegBytes);
        const newPage = out.addPage([viewport.width / scale, viewport.height / scale]);
        newPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width / scale, height: viewport.height / scale });
      }

      setStatus(statusEl, 'Assembling PDF…');
      resultBytes = await out.save();

      const pct = Math.round((1 - resultBytes.length / originalSize) * 100);
      resultName.textContent = 'compressed.pdf';
      resultMeta.textContent = pct > 0
        ? `${formatBytes(resultBytes.length)} — ${pct}% smaller than the original ${formatBytes(originalSize)}`
        : `${formatBytes(resultBytes.length)} (original was already smaller: ${formatBytes(originalSize)})`;
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong compressing that PDF.', 'error');
    } finally {
      compressBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'compressed.pdf', 'application/pdf');
  });
})();
