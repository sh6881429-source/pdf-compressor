/* ═══════════════════ COMPRESS PDF JS ═══════════════════ */
/*
  Strategy: Render each PDF page to a canvas using pdf.js,
  re-encode as JPEG at a quality calculated to hit the user's
  target file size, then rebuild the PDF with pdf-lib.
  Uses binary-search on JPEG quality to converge on target.
*/
document.addEventListener('DOMContentLoaded', () => {
  // ─── Set PDF.js worker FIRST (avoids race condition from inline head script) ───
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ─── Init Lucide icons ───
  if (window.lucide) lucide.createIcons();

  // ─── Diagnostic: confirm all libraries loaded ───
  console.log('[Compress PDF] Library check:',
    'pdfjsLib=', !!window.pdfjsLib,
    '| PDFLib=', !!window.PDFLib,
    '| lucide=', !!window.lucide
  );

  // Nav toggle
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle.addEventListener('click', () => { toggle.classList.toggle('active'); navLinks.classList.toggle('open'); });
  navLinks.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => { toggle.classList.remove('active'); navLinks.classList.remove('open'); }));

  // Scroll to top
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', () => scrollBtn.classList.toggle('visible', window.scrollY > 400), { passive: true });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // FAQ Accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  // ═══════════════════ STATE & ELEMENTS ═══════════════════
  let originalFile = null;
  let compressedBlob = null;

  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  const settingsPanel = document.getElementById('settings-panel');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileSize = document.getElementById('selected-file-size');
  const cancelBtn = document.getElementById('cancel-btn');
  const startCompressBtn = document.getElementById('start-compress-btn');
  const targetSizeInput = document.getElementById('target-size-input');
  const recSize = document.getElementById('rec-size');

  const processingPanel = document.getElementById('processing-panel');
  const processingDesc = document.querySelector('.processing-desc');
  const toolPanel = document.getElementById('tool-panel');

  // Stats elements
  const fileNameEl = document.getElementById('file-name');
  const origSizeEl = document.getElementById('orig-size');
  const newSizeEl = document.getElementById('new-size');
  const savedPercentEl = document.getElementById('saved-percent');

  // ═══════════════════ UPLOAD PREVIEW ELEMENTS ═══════════════════
  const previewName   = document.getElementById('upload-preview-name');
  const previewSize   = document.getElementById('upload-preview-size');
  const removeBtn     = document.getElementById('upload-remove-btn');
  const MAX_SIZE_MB   = 200;
  const MAX_SIZE_BYTES= MAX_SIZE_MB * 1024 * 1024;

  // ═══════════════════ UPLOAD ═══════════════════
  ['dragenter', 'dragover'].forEach(e => uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(e => uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.remove('dragover'); }));

  uploadZone.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') handleFile(f);
  });
  uploadZone.addEventListener('click', e => {
    if (!e.target.closest('.upload-remove-btn') && e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); resetTool(); });

  function handleFile(file) {
    // 200MB guard
    if (file.size > MAX_SIZE_BYTES) {
      alert(`File too large! Maximum allowed size is ${MAX_SIZE_MB} MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      fileInput.value = '';
      return;
    }
    // Show preview in upload zone briefly, then transition to settings
    uploadZone.classList.add('has-file');
    if (previewName) previewName.textContent = file.name;
    if (previewSize) previewSize.textContent = formatBytes(file.size);
    if (window.lucide) lucide.createIcons();
    // Small delay so user sees the preview before the panel switches
    setTimeout(() => showSettings(file), 600);
  }

  function showSettings(file) {
    originalFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);

    // Set recommended target size (50% of original)
    const currentKB = Math.round(file.size / 1024);
    const recommended = Math.max(1, Math.round(currentKB * 0.5));
    recSize.textContent = recommended;
    targetSizeInput.value = recommended;

    uploadZone.style.display = 'none';
    settingsPanel.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  }

  cancelBtn.addEventListener('click', resetTool);

  startCompressBtn.addEventListener('click', () => {
    let targetKB = parseInt(targetSizeInput.value);
    const currentKB = Math.round(originalFile.size / 1024);

    if (!targetKB || targetKB < 1) {
      alert('Please enter a valid target size in KB.');
      return;
    }
    if (targetKB >= currentKB) {
      alert('Target size must be smaller than the original (' + currentKB + ' KB).');
      return;
    }

    processPDF(originalFile, targetKB);
  });

  // ═══════════════════ CORE COMPRESSION ═══════════════════
  async function processPDF(file, targetKB) {
    settingsPanel.style.display = 'none';
    processingPanel.classList.add('active');
    processingDesc.textContent = 'Loading PDF pages...';

    const targetBytes = targetKB * 1024;

    try {
      const arrayBuffer = await file.arrayBuffer();

      // ── 1. Load PDF with pdf.js ──
      const loadTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadTask.promise;
      const numPages = pdfDoc.numPages;

      // ── 2. Render every page to a canvas ──
      processingDesc.textContent = `Rendering ${numPages} page(s)...`;
      const canvases = [];
      for (let i = 1; i <= numPages; i++) {
        processingDesc.textContent = `Rendering page ${i} of ${numPages}...`;
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // decent quality
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        canvases.push(canvas);
      }

      // ── 3. Binary-search JPEG quality to hit target size ──
      processingDesc.textContent = 'Optimizing compression...';
      let lo = 0.05, hi = 0.95, bestQuality = 0.5;
      let bestBlobs = null;
      const MAX_ITER = 8;

      for (let iter = 0; iter < MAX_ITER; iter++) {
        const mid = (lo + hi) / 2;
        const blobs = await canvasesToJpegBlobs(canvases, mid);
        const totalSize = blobs.reduce((s, b) => s + b.size, 0);
        // pdf-lib overhead is ~1-3 KB per page for wrapper
        const overhead = numPages * 2500 + 1000;
        const estTotal = totalSize + overhead;

        processingDesc.textContent = `Testing quality ${Math.round(mid * 100)}%... (${formatBytes(estTotal)})`;

        if (estTotal <= targetBytes) {
          bestQuality = mid;
          bestBlobs = blobs;
          lo = mid; // try higher quality
        } else {
          hi = mid; // need lower quality
        }
      }

      // If we never found anything under the target, use lowest quality
      if (!bestBlobs) {
        bestBlobs = await canvasesToJpegBlobs(canvases, 0.05);
        bestQuality = 0.05;
      }

      // ── 4. Rebuild PDF with pdf-lib ──
      processingDesc.textContent = 'Rebuilding PDF document...';
      const newPdf = await PDFLib.PDFDocument.create();

      for (let i = 0; i < bestBlobs.length; i++) {
        processingDesc.textContent = `Embedding page ${i + 1} of ${numPages}...`;
        const jpegBytes = new Uint8Array(await bestBlobs[i].arrayBuffer());
        const jpegImage = await newPdf.embedJpg(jpegBytes);

        const page = newPdf.addPage([jpegImage.width, jpegImage.height]);
        page.drawImage(jpegImage, {
          x: 0, y: 0,
          width: jpegImage.width,
          height: jpegImage.height
        });
      }

      const pdfBytes = await newPdf.save();
      compressedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      // If compressed is still larger, fall back to original
      if (compressedBlob.size >= file.size) {
        compressedBlob = file;
      }

      // ── 5. Update UI ──
      const origSize = file.size;
      const finalSize = compressedBlob.size;
      let savings = ((origSize - finalSize) / origSize) * 100;

      fileNameEl.textContent = file.name;
      origSizeEl.textContent = formatBytes(origSize);
      newSizeEl.textContent = formatBytes(finalSize);

      if (savings > 0) {
        savedPercentEl.textContent = savings.toFixed(1) + '%';
        savedPercentEl.className = 'stat-value text-emerald';
      } else {
        savedPercentEl.textContent = 'Already Optimized';
        savedPercentEl.className = 'stat-value text-muted';
      }

      processingPanel.classList.remove('active');
      toolPanel.style.display = 'block';
      toolPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
      console.error('PDF Compression failed:', error);
      alert('An error occurred while compressing the PDF. The file might be password-protected or corrupted.');
      resetTool();
    }
  }

  // Helper: convert array of canvases to JPEG blobs at given quality
  function canvasesToJpegBlobs(canvases, quality) {
    return Promise.all(canvases.map(c => new Promise(resolve => {
      c.toBlob(blob => resolve(blob), 'image/jpeg', quality);
    })));
  }

  // ═══════════════════ DOWNLOAD ═══════════════════
  document.getElementById('download-btn').addEventListener('click', () => {
    if (!compressedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(compressedBlob);
    const name = originalFile.name.replace(/\.[^.]+$/, '');
    a.download = `${name}-compressed.pdf`;
    a.click();
  });

  // ═══════════════════ RESET TOOL ═══════════════════
  document.getElementById('reset-tool-btn').addEventListener('click', resetTool);

  function resetTool() {
    originalFile = null;
    compressedBlob = null;
    fileInput.value = '';

    uploadZone.classList.remove('has-file');
    uploadZone.style.display = '';
    if (previewName) previewName.textContent = '';
    if (previewSize) previewSize.textContent = '';
    settingsPanel.style.display = 'none';
    processingPanel.classList.remove('active');
    toolPanel.style.display = 'none';

    window.scrollTo({ top: uploadZone.offsetTop - 100, behavior: 'smooth' });
  }

  // ═══════════════════ UTILS ═══════════════════
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
});
