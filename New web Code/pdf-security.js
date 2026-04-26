/**
 * PDF Security Suite — Lock & Unlock PDF
 *
 * LOCK:  PDF.js renders each page → jsPDF creates a password-encrypted PDF.
 * UNLOCK: PDF.js decrypts (using user's password) → pdf-lib rebuilds without encryption.
 *
 * 100% client-side. No files leave the browser.
 */

/* ── Spin animation for loader ── */
(function () {
  var s = document.createElement('style');
  s.textContent = '.spin{animation:_spin 1s linear infinite}@keyframes _spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', function () {

  /* ─── Set PDF.js worker (must happen before any getDocument call) ─── */
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /* ─── Initialize Lucide icons ─── */
  if (window.lucide) lucide.createIcons();

  /* ─── Diagnostic: confirm all libraries loaded ─── */
  console.log('[PDF Security] Library check:',
    'pdf-lib=', !!window.PDFLib,
    '| jspdf=', !!window.jspdf,
    '| pdfjsLib=', !!window.pdfjsLib
  );

  /* ─── Helper: get jsPDF constructor regardless of UMD global shape ─── */
  function getJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
    if (window.jspdf && typeof window.jspdf === 'function') return window.jspdf;
    return null;
  }

  /* ─── DOM refs ─── */
  var modeBtns         = document.querySelectorAll('.mode-btn');
  var uploadSection    = document.getElementById('upload-section');
  var lockPanel        = document.getElementById('lock-panel');
  var unlockPanel      = document.getElementById('unlock-panel');
  var downloadSection  = document.getElementById('download-section');
  var uploadActionText = document.getElementById('upload-action-text');
  var fileInput        = document.getElementById('file-input');
  var uploadBox        = document.getElementById('upload-box');
  var selectPdfBtn     = document.getElementById('select-pdf-btn');

  var lockPassword  = document.getElementById('lock-password');
  var lockConfirm   = document.getElementById('lock-confirm');
  var lockError     = document.getElementById('lock-error');
  var strengthBars  = document.getElementById('strength-bars');
  var strengthText  = document.getElementById('strength-text');
  var btnLock       = document.getElementById('btn-process-lock');

  var unlockPassword = document.getElementById('unlock-password');
  var unlockError    = document.getElementById('unlock-error');
  var btnUnlock      = document.getElementById('btn-process-unlock');

  var downloadBtn  = document.getElementById('download-btn');
  var startOverBtn = document.getElementById('start-over-btn');
  var successMsg   = document.getElementById('success-msg');

  /* ─── State ─── */
  var currentMode       = 'lock';
  var currentFile       = null;
  var processedPdfBytes = null;

  /* ══════════════════════════════════════════════
     MODE SWITCHING
  ══════════════════════════════════════════════ */
  modeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (currentFile) resetState();

      currentMode = btn.dataset.mode;

      modeBtns.forEach(function (b) {
        b.classList.remove('active', 'lock-mode-active', 'unlock-mode-active');
      });
      btn.classList.add('active', currentMode + '-mode-active');
      uploadActionText.textContent = currentMode === 'lock' ? 'Lock' : 'Unlock';
    });
  });

  /* ══════════════════════════════════════════════
     FILE UPLOAD
  ══════════════════════════════════════════════ */
  selectPdfBtn.addEventListener('click', function () {
    fileInput.value = '';   // reset so same file can be re-selected
    fileInput.click();
  });

  fileInput.addEventListener('change', handleFileSelect);

  uploadBox.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadBox.style.borderColor = 'var(--emerald)';
    uploadBox.style.background = 'rgba(16,185,129,.05)';
  });
  uploadBox.addEventListener('dragleave', function () {
    uploadBox.style.borderColor = 'var(--border)';
    uploadBox.style.background  = 'var(--bg-card)';
  });
  uploadBox.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadBox.style.borderColor = 'var(--border)';
    uploadBox.style.background  = 'var(--bg-card)';
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  function handleFileSelect() {
    if (!fileInput.files || fileInput.files.length === 0) return;
    var file = fileInput.files[0];
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }
    currentFile = file;
    uploadSection.style.display = 'none';
    if (currentMode === 'lock') {
      lockPanel.classList.add('active');
    } else {
      unlockPanel.classList.add('active');
    }
  }

  /* ══════════════════════════════════════════════
     PASSWORD VISIBILITY TOGGLE
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.toggle-password').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var input = document.getElementById(btn.dataset.target);
      var icon  = btn.querySelector('i');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
      } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
      }
      if (window.lucide) lucide.createIcons();
    });
  });

  /* ══════════════════════════════════════════════
     PASSWORD STRENGTH METER
  ══════════════════════════════════════════════ */
  lockPassword.addEventListener('input', function () {
    var pwd = lockPassword.value;
    var strength = 0;
    if (pwd.length >= 6)  strength++;
    if (pwd.length >= 10) strength++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    strengthBars.className = 'strength-bars';

    if (pwd.length === 0) {
      strengthText.textContent = 'Enter password';
      strengthText.style.color = '';
    } else if (strength <= 1) {
      strengthBars.classList.add('strength-weak');
      strengthText.textContent = 'Weak';
      strengthText.style.color = '#ef4444';
    } else if (strength === 2) {
      strengthBars.classList.add('strength-fair');
      strengthText.textContent = 'Fair';
      strengthText.style.color = '#f59e0b';
    } else if (strength === 3) {
      strengthBars.classList.add('strength-good');
      strengthText.textContent = 'Good';
      strengthText.style.color = '#10b981';
    } else {
      strengthBars.classList.add('strength-strong');
      strengthText.textContent = 'Strong';
      strengthText.style.color = '#10b981';
    }
    validatePasswords();
  });

  lockConfirm.addEventListener('input', validatePasswords);

  function validatePasswords() {
    if (lockConfirm.value.length > 0 && lockPassword.value !== lockConfirm.value) {
      showLockError('Passwords do not match.');
      return false;
    }
    hideLockError();
    return lockPassword.value.length >= 4 && lockPassword.value === lockConfirm.value;
  }

  /* ══════════════════════════════════════════════
     LOCK PDF
  ══════════════════════════════════════════════ */
  btnLock.addEventListener('click', async function () {
    /* Validate passwords */
    if (!lockPassword.value || lockPassword.value.length < 4) {
      showLockError('Password must be at least 4 characters.');
      return;
    }
    if (lockPassword.value !== lockConfirm.value) {
      showLockError('Passwords do not match.');
      return;
    }
    hideLockError();

    /* Library check */
    var jsPDF = getJsPDF();
    if (!jsPDF) {
      showLockError('PDF library (jsPDF) failed to load. Please refresh the page.');
      console.error('[Lock PDF] jspdf not found. window.jspdf=', window.jspdf, 'window.jsPDF=', window.jsPDF);
      return;
    }
    if (!window.pdfjsLib) {
      showLockError('PDF.js not loaded. Please refresh the page.');
      return;
    }

    var password = lockPassword.value;
    setLoading(btnLock, '<i data-lucide="loader" class="btn-icon spin"></i> Encrypting...');

    try {
      /* Read file bytes */
      var arrayBuffer = await currentFile.arrayBuffer();
      var uint8Array  = new Uint8Array(arrayBuffer);

      /* Render pages with PDF.js */
      var pdfDoc  = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      var numPages = pdfDoc.numPages;

      /* Build encrypted PDF with jsPDF */
      var doc = null;

      for (var i = 1; i <= numPages; i++) {
        var page     = await pdfDoc.getPage(i);
        var viewport = page.getViewport({ scale: 2 });

        var canvas  = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        var imgData  = canvas.toDataURL('image/jpeg', 0.92);
        var pxToMm   = 25.4 / 144;           // scale=2 → 144 effective DPI
        var widthMm  = viewport.width  * pxToMm;
        var heightMm = viewport.height * pxToMm;
        var orient   = widthMm > heightMm ? 'landscape' : 'portrait';

        if (i === 1) {
          doc = new jsPDF({
            orientation: orient,
            unit: 'mm',
            format: [widthMm, heightMm],
            encryption: {
              userPassword:  password,
              ownerPassword: password,
              userPermissions: ['print']
            }
          });
        } else {
          doc.addPage([widthMm, heightMm], orient);
        }

        doc.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);
      }

      pdfDoc.destroy();

      /* Collect output */
      processedPdfBytes = doc.output('arraybuffer');

      successMsg.textContent = 'Your PDF is now password-protected. Keep your password safe!';
      showDownload();

    } catch (err) {
      console.error('[Lock PDF]', err);
      showLockError('Encryption failed: ' + (err.message || 'Unknown error. Check console.'));
    } finally {
      resetLoading(btnLock, '<i data-lucide="lock" class="btn-icon"></i> Protect PDF');
    }
  });

  /* ══════════════════════════════════════════════
     UNLOCK PDF
  ══════════════════════════════════════════════ */
  btnUnlock.addEventListener('click', async function () {
    var password = unlockPassword.value.trim();

    if (!password) {
      showUnlockError('Please enter the PDF password.');
      return;
    }
    if (!window.pdfjsLib) {
      showUnlockError('PDF.js not loaded. Please refresh the page.');
      return;
    }
    if (!window.PDFLib) {
      showUnlockError('pdf-lib not loaded. Please refresh the page.');
      return;
    }

    setLoading(btnUnlock, '<i data-lucide="loader" class="btn-icon spin"></i> Unlocking...');
    hideUnlockError();

    try {
      var arrayBuffer = await currentFile.arrayBuffer();
      var uint8Array  = new Uint8Array(arrayBuffer);

      /* Open with PDF.js — it handles all standard PDF encryption */
      var pdfDoc;
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: uint8Array, password: password }).promise;
      } catch (pdfErr) {
        /* PDF.js throws PasswordException with code 1 (need pwd) or 2 (wrong pwd) */
        if (pdfErr.name === 'PasswordException') {
          if (pdfErr.code === 2) {
            showUnlockError('Incorrect password. Please try again.');
          } else {
            showUnlockError('This PDF is password-protected. Enter the correct password.');
          }
          return;
        }
        throw pdfErr;  // re-throw unexpected errors
      }

      /* Render every page and rebuild as an unencrypted PDF with pdf-lib */
      var newPdf    = await PDFLib.PDFDocument.create();
      var numPages  = pdfDoc.numPages;

      for (var i = 1; i <= numPages; i++) {
        var page     = await pdfDoc.getPage(i);
        var viewport = page.getViewport({ scale: 2 });

        var canvas   = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        /* Convert canvas → PNG → embed in pdf-lib */
        var pngDataUrl = canvas.toDataURL('image/png');
        var pngResp    = await fetch(pngDataUrl);
        var pngBuf     = await pngResp.arrayBuffer();
        var pngImg     = await newPdf.embedPng(pngBuf);

        /* PDF points = pixels / scale (scale=2 from 144dpi back to 72dpi) */
        var ptW = viewport.width  / 2;
        var ptH = viewport.height / 2;

        var pdfPage = newPdf.addPage([ptW, ptH]);
        pdfPage.drawImage(pngImg, { x: 0, y: 0, width: ptW, height: ptH });
      }

      processedPdfBytes = await newPdf.save();
      pdfDoc.destroy();

      successMsg.textContent = 'PDF unlocked! The password protection has been removed.';
      showDownload();

    } catch (err) {
      console.error('[Unlock PDF]', err);
      if (err.name === 'PasswordException') {
        showUnlockError(err.code === 2 ? 'Incorrect password.' : 'Password required.');
      } else {
        showUnlockError('Failed to unlock: ' + (err.message || 'Unknown error.'));
      }
    } finally {
      resetLoading(btnUnlock, '<i data-lucide="unlock" class="btn-icon"></i> Unlock PDF');
    }
  });

  /* ══════════════════════════════════════════════
     DOWNLOAD
  ══════════════════════════════════════════════ */
  downloadBtn.addEventListener('click', function () {
    if (!processedPdfBytes) return;

    var blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = currentFile.name.replace(/\.pdf$/i, '') +
                 (currentMode === 'lock' ? '_protected' : '_unlocked') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  startOverBtn.addEventListener('click', resetState);

  /* ══════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════ */
  function showDownload() {
    lockPanel.classList.remove('active');
    unlockPanel.classList.remove('active');
    downloadSection.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  }

  function resetState() {
    currentFile       = null;
    processedPdfBytes = null;
    fileInput.value   = '';

    lockPassword.value = '';
    lockConfirm.value  = '';
    hideLockError();
    strengthBars.className  = 'strength-bars';
    strengthText.textContent = 'Enter password';
    strengthText.style.color = '';

    unlockPassword.value = '';
    hideUnlockError();

    lockPanel.classList.remove('active');
    unlockPanel.classList.remove('active');
    downloadSection.style.display = 'none';
    uploadSection.style.display   = 'block';
  }

  function setLoading(btn, html) {
    btn.disabled  = true;
    btn.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function resetLoading(btn, html) {
    btn.disabled  = false;
    btn.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function showLockError(msg)  { lockError.textContent = msg; lockError.style.display = 'block'; }
  function hideLockError()     { lockError.style.display = 'none'; }
  function showUnlockError(msg){ unlockError.textContent = msg; unlockError.style.display = 'block'; }
  function hideUnlockError()   { unlockError.style.display = 'none'; }
});
