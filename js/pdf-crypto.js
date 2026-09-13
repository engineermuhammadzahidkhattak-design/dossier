/* Implements the PDF Standard Security Handler, Revision 2 (RC4, 40-bit),
   as specified in ISO 32000-1 section 7.6. This is the same algorithm
   family used by most PDF tools for password protection. Verified against
   qpdf during development: correct/incorrect passwords are recognised
   correctly and content streams decrypt cleanly. */

window.PdfCrypto = (function () {
  const PAD = new Uint8Array([
    0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,
    0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A,
  ]);

  function textToLatin1Bytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }

  function padPassword(pw) {
    const bytes = new Uint8Array(32);
    const src = textToLatin1Bytes(pw || '').slice(0, 32);
    bytes.set(src, 0);
    if (src.length < 32) bytes.set(PAD.slice(0, 32 - src.length), src.length);
    return bytes;
  }

  function concat(...arrs) {
    const len = arrs.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }

  function int32LE(n) {
    const b = new Uint8Array(4);
    b[0] = n & 0xff; b[1] = (n >>> 8) & 0xff; b[2] = (n >>> 16) & 0xff; b[3] = (n >>> 24) & 0xff;
    return b;
  }

  function computeO(ownerPw, userPw) {
    const opw = padPassword(ownerPw || userPw);
    const rc4Key = window.PdfMd5.md5(opw).slice(0, 5);
    const upw = padPassword(userPw);
    return window.PdfRc4.rc4(rc4Key, upw);
  }

  function computeEncryptionKey(userPw, oValue, pValue, idBytes) {
    const upw = padPassword(userPw);
    const hashInput = concat(upw, oValue, int32LE(pValue), idBytes);
    const hash = window.PdfMd5.md5(hashInput);
    return hash.slice(0, 5);
  }

  function computeU(encKey) {
    return window.PdfRc4.rc4(encKey, PAD);
  }

  function encryptBytesForObject(fileKey, objNum, genNum, data) {
    const objBytes = new Uint8Array([objNum & 0xff, (objNum >> 8) & 0xff, (objNum >> 16) & 0xff]);
    const genBytes = new Uint8Array([genNum & 0xff, (genNum >> 8) & 0xff]);
    const input = concat(fileKey, objBytes, genBytes);
    const objKey = window.PdfMd5.md5(input).slice(0, Math.min(fileKey.length + 5, 16));
    return window.PdfRc4.rc4(objKey, data);
  }

  function buildStandardSecurityHandler({ userPassword = '', ownerPassword = '', permissions = -4, idBytes }) {
    const oValue = computeO(ownerPassword, userPassword);
    const fileKey = computeEncryptionKey(userPassword, oValue, permissions, idBytes);
    const uValue = computeU(fileKey);
    return { oValue, uValue, fileKey, permissions };
  }

  /**
   * Encrypts an already-loaded PDFLib.PDFDocument in place (mutating its
   * context) and returns the bytes to save. `doc` must come from
   * PDFDocument.load() so every content stream is already a resolved
   * PDFRawStream (not a lazily-built content stream).
   */
  async function encryptDocument(PDFLib, doc, { userPassword, ownerPassword, permissions }) {
    const { PDFHexString, PDFName, PDFNumber } = PDFLib;
    const context = doc.context;

    const idBytes = new Uint8Array(16);
    crypto.getRandomValues(idBytes);
    const idHex = PDFHexString.of(window.Dossier.bytesToHex(idBytes));
    context.trailerInfo.ID = context.obj([idHex, idHex]);

    const { oValue, uValue, fileKey } = buildStandardSecurityHandler({
      userPassword, ownerPassword, permissions, idBytes,
    });

    function walk(obj, objNum, genNum) {
      if (!obj) return;
      const name = obj.constructor && obj.constructor.name;
      if (name === 'PDFHexString') {
        const enc = encryptBytesForObject(fileKey, objNum, genNum, obj.asBytes());
        obj.value = window.Dossier.bytesToHex(enc);
      } else if (name === 'PDFString') {
        const enc = encryptBytesForObject(fileKey, objNum, genNum, obj.asBytes());
        obj.value = Array.from(enc).map(b => String.fromCharCode(b)).join('');
      } else if (name === 'PDFRawStream') {
        walk(obj.dict, objNum, genNum);
        obj.contents = encryptBytesForObject(fileKey, objNum, genNum, obj.contents);
      } else if (name === 'PDFDict') {
        for (const [, val] of obj.dict.entries()) walk(val, objNum, genNum);
      } else if (name === 'PDFArray') {
        for (let i = 0; i < obj.array.length; i++) walk(obj.array[i], objNum, genNum);
      }
    }

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      walk(obj, ref.objectNumber, ref.generationNumber);
    }

    const encryptDict = context.obj({
      Filter: PDFName.of('Standard'),
      V: PDFNumber.of(1),
      R: PDFNumber.of(2),
      O: PDFHexString.of(window.Dossier.bytesToHex(oValue)),
      U: PDFHexString.of(window.Dossier.bytesToHex(uValue)),
      P: PDFNumber.of(permissions),
    });
    const encryptRef = context.register(encryptDict);
    context.trailerInfo.Encrypt = encryptRef;

    return doc.save({ useObjectStreams: false });
  }

  return { buildStandardSecurityHandler, encryptDocument };
})();
