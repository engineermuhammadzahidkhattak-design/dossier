(function () {
  const { formatBytes, readAsArrayBuffer, downloadBlob, setStatus, initDropzone } = window.Dossier;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const resRow = document.getElementById('resRow');
  const actionsRow = document.getElementById('actionsRow');
  const convertBtn = document.getElementById('convertBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFile = null;
  let resultBlob = null;

  function handleFile(file) {
    currentFile = file;
    resultBox.classList.remove('show');
    resRow.style.display = 'block';
    actionsRow.style.display = 'flex';
    setStatus(statusEl, '');
  }

  initDropzone({
    dropzoneEl, inputEl, listEl, multiple: false, accept: ['.pdf'],
    onChange: (files) => {
      if (files.length) handleFile(files[0]);
      else { resRow.style.display = 'none'; actionsRow.style.display = 'none'; }
    },
  });

  convertBtn.addEventListener('click', async () => {
    convertBtn.disabled = true;
    const scale = parseFloat(document.querySelector('input[name=scale]:checked').value);
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const zip = new JSZip();

      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(statusEl, `Rendering page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const b64 = dataUrl.split(',')[1];
        zip.file(`page-${String(i).padStart(3, '0')}.jpg`, b64, { base64: true });
      }

      setStatus(statusEl, 'Packing ZIP…');
      resultBlob = await zip.generateAsync({ type: 'blob' });
      resultName.textContent = 'pages.zip';
      resultMeta.textContent = `${pdf.numPages} images · ${formatBytes(resultBlob.size)}`;
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong converting that PDF.', 'error');
    } finally {
      convertBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob) downloadBlob(resultBlob, 'pages.zip');
  });
})();
