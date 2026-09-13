(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, initDropzone } = window.Dossier;

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const optionsBlock = document.getElementById('optionsBlock');
  const textInput = document.getElementById('textInput');
  const opacityInput = document.getElementById('opacityInput');
  const opacityHint = document.getElementById('opacityHint');
  const applyBtn = document.getElementById('applyBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFile = null;
  let resultBytes = null;

  const colors = {
    gray: [0.55, 0.55, 0.55],
    red: [0.70, 0.22, 0.18],
    black: [0.1, 0.1, 0.1],
  };

  opacityInput.addEventListener('input', () => { opacityHint.textContent = `${opacityInput.value}%`; });

  initDropzone({
    dropzoneEl, inputEl, listEl, multiple: false, accept: ['.pdf'],
    onChange: (files) => {
      currentFile = files[0] || null;
      resultBox.classList.remove('show');
      optionsBlock.style.display = currentFile ? 'block' : 'none';
      setStatus(statusEl, '');
    },
  });

  applyBtn.addEventListener('click', async () => {
    const text = textInput.value.trim() || 'CONFIDENTIAL';
    const opacity = parseInt(opacityInput.value, 10) / 100;
    const [r, g, b] = colors[document.querySelector('input[name=color]:checked').value];

    applyBtn.disabled = true;
    setStatus(statusEl, 'Applying watermark…');
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      doc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        const fontSize = Math.min(width, height) / 9;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - fontSize / 3,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(35),
        });
      });

      resultBytes = await doc.save();
      resultName.textContent = 'watermarked.pdf';
      resultMeta.textContent = formatBytes(resultBytes.length);
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong watermarking that PDF.', 'error');
    } finally {
      applyBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'watermarked.pdf', 'application/pdf');
  });
})();
