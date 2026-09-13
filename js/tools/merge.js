(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, escapeHtml } = window.Dossier;

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const reorderHint = document.getElementById('reorderHint');
  const mergeBtn = document.getElementById('mergeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFiles = [];
  let resultBytes = null;
  let dragFromIdx = null;

  function renderList() {
    listEl.innerHTML = '';
    currentFiles.forEach((file, idx) => {
      const li = document.createElement('li');
      li.className = 'draggable';
      li.draggable = true;
      li.dataset.idx = idx;
      li.innerHTML = `
        <span class="fname">${idx + 1}. ${escapeHtml(file.name)}</span>
        <span class="fmeta">${formatBytes(file.size)}</span>
        <button type="button" class="fremove" aria-label="Remove">✕</button>
      `;
      li.querySelector('.fremove').addEventListener('click', () => {
        currentFiles.splice(idx, 1);
        renderList();
      });
      li.addEventListener('dragstart', () => { dragFromIdx = idx; li.style.opacity = '0.4'; });
      li.addEventListener('dragend', () => { li.style.opacity = '1'; });
      li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over-item'); });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over-item'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over-item');
        const toIdx = idx;
        if (dragFromIdx === null || dragFromIdx === toIdx) return;
        const [moved] = currentFiles.splice(dragFromIdx, 1);
        currentFiles.splice(toIdx, 0, moved);
        renderList();
      });
      listEl.appendChild(li);
    });
    reorderHint.style.display = currentFiles.length > 1 ? 'block' : 'none';
    mergeBtn.disabled = currentFiles.length < 2;
    resultBox.classList.remove('show');
    setStatus(statusEl, '');
  }

  // Merge needs custom drag-to-reorder rows, so file intake is wired directly
  // here rather than through the shared Dossier.initDropzone helper.
  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    currentFiles = currentFiles.concat(incoming);
    renderList();
  }
  dropzoneEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', (e) => { addFiles(e.target.files); inputEl.value = ''; });
  ['dragenter', 'dragover'].forEach(evt => dropzoneEl.addEventListener(evt, (e) => { e.preventDefault(); dropzoneEl.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropzoneEl.addEventListener(evt, (e) => { e.preventDefault(); dropzoneEl.classList.remove('dragover'); }));
  dropzoneEl.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  clearBtn.addEventListener('click', () => { currentFiles = []; renderList(); });

  mergeBtn.addEventListener('click', async () => {
    mergeBtn.disabled = true;
    setStatus(statusEl, 'Merging…');
    try {
      const { PDFDocument } = PDFLib;
      const merged = await PDFDocument.create();
      for (const file of currentFiles) {
        const bytes = await readAsArrayBuffer(file);
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      resultBytes = await merged.save();
      setStatus(statusEl, `Done — ${currentFiles.length} files combined into one PDF.`, 'success');
      resultName.textContent = 'merged.pdf';
      resultMeta.textContent = formatBytes(resultBytes.length);
      resultBox.classList.add('show');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong reading one of those PDFs. Is it a valid, non-corrupted file?', 'error');
    } finally {
      mergeBtn.disabled = currentFiles.length < 2;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'merged.pdf', 'application/pdf');
  });
})();
