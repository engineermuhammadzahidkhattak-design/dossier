(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, initDropzone } = window.Dossier;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const allRow = document.getElementById('allRow');
  const pageGrid = document.getElementById('pageGrid');
  const actionsRow = document.getElementById('actionsRow');
  const applyBtn = document.getElementById('applyBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFile = null;
  let rotations = []; // additional rotation per page, degrees
  let resultBytes = null;

  function renderThumb(container, dataUrl, rotationDeg, pageNum) {
    container.innerHTML = `
      <img src="${dataUrl}" style="transform: rotate(${rotationDeg}deg); transition: transform 0.15s;">
      <span class="pnum">Page ${pageNum}</span>
    `;
  }

  async function loadPreview(bytes) {
    pageGrid.innerHTML = '';
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    rotations = new Array(pdf.numPages).fill(0);
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const tile = document.createElement('div');
      tile.className = 'page-thumb';
      tile.style.cursor = 'pointer';
      tile.title = 'Click to rotate this page 90°';
      renderThumb(tile, canvas.toDataURL(), 0, i);
      tile.addEventListener('click', () => {
        rotations[i - 1] = (rotations[i - 1] + 90) % 360;
        tile.querySelector('img').style.transform = `rotate(${rotations[i - 1]}deg)`;
      });
      pageGrid.appendChild(tile);
    }
    allRow.style.display = 'block';
    actionsRow.style.display = 'flex';
  }

  async function handleFile(file) {
    currentFile = file;
    resultBox.classList.remove('show');
    setStatus(statusEl, 'Rendering preview…');
    try {
      const bytes = await readAsArrayBuffer(file);
      await loadPreview(new Uint8Array(bytes));
      setStatus(statusEl, 'Click any page to rotate it 90° at a time.');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Could not read that PDF.', 'error');
    }
  }

  initDropzone({
    dropzoneEl, inputEl, listEl, multiple: false, accept: ['.pdf'],
    onChange: (files) => {
      if (files.length) handleFile(files[0]);
      else { pageGrid.innerHTML = ''; allRow.style.display = 'none'; actionsRow.style.display = 'none'; }
    },
  });

  document.querySelectorAll('[data-rotate-all]').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.rotateAll, 10);
      rotations = rotations.map(r => ((r + delta) % 360 + 360) % 360);
      document.querySelectorAll('.page-thumb img').forEach((img, idx) => {
        img.style.transform = `rotate(${rotations[idx]}deg)`;
      });
    });
  });

  applyBtn.addEventListener('click', async () => {
    applyBtn.disabled = true;
    setStatus(statusEl, 'Applying rotation…');
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const { PDFDocument, degrees } = PDFLib;
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      doc.getPages().forEach((page, idx) => {
        if (rotations[idx]) {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + rotations[idx]) % 360));
        }
      });
      resultBytes = await doc.save();
      resultName.textContent = 'rotated.pdf';
      resultMeta.textContent = formatBytes(resultBytes.length);
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong applying the rotation.', 'error');
    } finally {
      applyBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'rotated.pdf', 'application/pdf');
  });
})();
