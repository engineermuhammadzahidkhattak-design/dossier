/* Shared helpers used by every tool page. No build step, no bundler —
   just plain functions attached to window.Dossier. */

window.Dossier = (function () {

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadBytes(bytes, filename, mime) {
    downloadBlob(new Blob([bytes], { type: mime || 'application/octet-stream' }), filename);
  }

  function setStatus(el, message, kind) {
    el.textContent = message || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  /**
   * Wires a dropzone element + hidden file input into a simple multi-file
   * picker with a rendered file list. Calls onChange(fileArray) whenever
   * the set of selected files changes.
   */
  function initDropzone({ dropzoneEl, inputEl, listEl, multiple, accept, onChange }) {
    let files = [];

    function render() {
      listEl.innerHTML = '';
      files.forEach((file, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="fname">${escapeHtml(file.name)}</span>
          <span class="fmeta">${formatBytes(file.size)}</span>
          <button type="button" class="fremove" aria-label="Remove">✕</button>
        `;
        li.querySelector('.fremove').addEventListener('click', () => {
          files.splice(idx, 1);
          render();
          onChange(files.slice());
        });
        listEl.appendChild(li);
      });
    }

    function addFiles(fileList) {
      const incoming = Array.from(fileList).filter(f => {
        if (!accept) return true;
        return accept.some(ext => f.name.toLowerCase().endsWith(ext));
      });
      if (!multiple) {
        files = incoming.slice(0, 1);
      } else {
        files = files.concat(incoming);
      }
      render();
      onChange(files.slice());
    }

    dropzoneEl.addEventListener('click', () => inputEl.click());
    dropzoneEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') inputEl.click();
    });
    inputEl.addEventListener('change', (e) => addFiles(e.target.files));

    ['dragenter', 'dragover'].forEach(evt => {
      dropzoneEl.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzoneEl.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzoneEl.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove('dragover');
      });
    });
    dropzoneEl.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    return {
      getFiles: () => files.slice(),
      clear: () => { files = []; render(); onChange([]); },
      reorder: (fromIdx, toIdx) => {
        const [moved] = files.splice(fromIdx, 1);
        files.splice(toIdx, 0, moved);
        render();
        onChange(files.slice());
      },
    };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    formatBytes, readAsArrayBuffer, readAsDataURL,
    downloadBlob, downloadBytes, setStatus, initDropzone, escapeHtml, bytesToHex,
  };
})();
