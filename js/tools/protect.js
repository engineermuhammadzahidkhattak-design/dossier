(function () {
  const { formatBytes, readAsArrayBuffer, downloadBytes, setStatus, initDropzone } = window.Dossier;

  const dropzoneEl = document.getElementById('dropzone');
  const inputEl = document.getElementById('fileInput');
  const listEl = document.getElementById('fileList');
  const optionsBlock = document.getElementById('optionsBlock');
  const userPwInput = document.getElementById('userPw');
  const ownerPwInput = document.getElementById('ownerPw');
  const applyBtn = document.getElementById('applyBtn');
  const statusEl = document.getElementById('status');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const resultMeta = document.getElementById('resultMeta');
  const downloadBtn = document.getElementById('downloadBtn');

  let currentFile = null;
  let resultBytes = null;

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
    const userPassword = userPwInput.value;
    const ownerPassword = ownerPwInput.value;

    if (!userPassword) {
      setStatus(statusEl, 'Enter a password to open the file.', 'error');
      return;
    }

    applyBtn.disabled = true;
    setStatus(statusEl, 'Encrypting…');
    try {
      const bytes = await readAsArrayBuffer(currentFile);
      const { PDFDocument } = PDFLib;
      // Load (not create) so every content stream is already a resolved
      // raw stream — required for the object-by-object RC4 pass to work.
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

      resultBytes = await window.PdfCrypto.encryptDocument(PDFLib, doc, {
        userPassword,
        ownerPassword: ownerPassword || userPassword,
        permissions: -4,
      });

      resultName.textContent = 'protected.pdf';
      resultMeta.textContent = formatBytes(resultBytes.length);
      resultBox.classList.add('show');
      setStatus(statusEl, 'Done — keep the password somewhere safe, it can\u2019t be recovered if lost.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(statusEl, 'Something went wrong encrypting that PDF.', 'error');
    } finally {
      applyBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBytes) downloadBytes(resultBytes, 'protected.pdf', 'application/pdf');
  });
})();
