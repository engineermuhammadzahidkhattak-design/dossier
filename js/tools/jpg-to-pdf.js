(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, escapeHtml } = window.Dossier;

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const fitRow = document.getElementById('fitRow');
  const actionsRow = document.getElementById('actionsRow');
  const convertBtn = document.getElementById('convertBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFiles = [];
  let resultBytes = null;
  let dragFromIdx = null;

  function render() {
    listEl.innerHTML = '';
    currentFiles.forEach((file, idx) => {
      const li = document.createElement('li');
      li.className = 'draggable';
      li.draggable = true;
      li.innerHTML = `
        <span class="fname">${idx + 1}. ${escapeHtml(file.name)}</span>
        <span class="fmeta">${formatBytes(file.size)}</span>
        <button type="button" class="fremove" aria-label="Remove">✕</button>
      `;
      li.querySelector('.fremove').addEventListener('click', () => { currentFiles.splice(idx, 1); render(); });
      li.addEventListener('dragstart', () => { dragFromIdx = idx; li.style.opacity = '0.4'; });
      li.addEventListener('dragend', () => { li.style.opacity = '1'; });
      li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over-item'); });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over-item'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over-item');
        if (dragFromIdx === null || dragFromIdx === idx) return;
        const [moved] = currentFiles.splice(dragFromIdx, 1);
        currentFiles.splice(idx, 0, moved);
        render();
      });
      listEl.appendChild(li);
    });
    const has = currentFiles.length > 0;
    fitRow.style.display = has ? 'block' : 'none';
    actionsRow.style.display = has ? 'flex' : 'none';
    resultBox.classList.remove('show');
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter(f => /\.(jpe?g|png)$/i.test(f.name));
    currentFiles = currentFiles.concat(incoming);
    render();
  }

  dropzoneEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', (e) => { addFiles(e.target.files); inputEl.value = ''; });
  ['dragenter', 'dragover'].forEach(evt => dropzoneEl.addEventListener(evt, (e) => { e.preventDefault(); dropzoneEl.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropzoneEl.addEventListener(evt, (e) => { e.preventDefault(); dropzoneEl.classList.remove('dragover'); }));
  dropzoneEl.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  const A4 = [595.28, 841.89];

  convertBtn.addEventListener('click', async () => {
    convertBtn.disabled = true;
    setStatus(statusEl, 'Building PDF…');
    const pageMode = document.querySelector('input[name=pagesize]:checked').value;
    try {
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.create();

      for (const file of currentFiles) {
        const bytes = await readAsArrayBuffer(file);
        const isPng = /\.png$/i.test(file.name);
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const { width, height } = image.scale(1);

        if (pageMode === 'fit') {
          const page = doc.addPage([width, height]);
          page.drawImage(image, { x: 0, y: 0, width, height });
        } else {
          const page = doc.addPage(A4);
          const maxW = A4[0] - 80, maxH = A4[1] - 80;
          const ratio = Math.min(maxW / width, maxH / height, 1);
          const w = width * ratio, h = height * ratio;
          page.drawImage(image, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
        }
      }

      resultBytes = await doc.save();
      resultName.textContent = 'images.pdf';
      resultMeta.textContent = `${currentFiles.length} page(s) · ${formatBytes(resultBytes.length)}`;
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong — check that all files are valid JPG/PNG images.', 'error');
    } finally {
      convertBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'images.pdf', 'application/pdf');
  });
})();
