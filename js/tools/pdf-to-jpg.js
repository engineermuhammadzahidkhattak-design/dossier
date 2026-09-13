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
  let resultIsZip = false;

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

      // Render every page to a JPEG blob first. If there's only one page,
      // we skip the ZIP step entirely and hand back the JPEG directly —
      // no point zipping a single file.
      const jpegBlobs = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(statusEl, `Rendering page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        jpegBlobs.push(blob);
      }

      if (jpegBlobs.length === 1) {
        resultBlob = jpegBlobs[0];
        resultIsZip = false;
        resultName.textContent = 'page.jpg';
        resultMeta.textContent = formatBytes(resultBlob.size);
      } else {
        setStatus(statusEl, 'Packing ZIP…');
        const zip = new JSZip();
        jpegBlobs.forEach((blob, idx) => {
          zip.file(`page-${String(idx + 1).padStart(3, '0')}.jpg`, blob);
        });
        resultBlob = await zip.generateAsync({ type: 'blob' });
        resultIsZip = true;
        resultName.textContent = 'pages.zip';
        resultMeta.textContent = `${jpegBlobs.length} images · ${formatBytes(resultBlob.size)}`;
      }

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
    if (resultBlob) downloadBlob(resultBlob, resultIsZip ? 'pages.zip' : 'page.jpg');
  });
})();
