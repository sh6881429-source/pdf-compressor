/* ═══════════════════ COMPRESS IMAGE JS ═══════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // ── Nav toggle ──
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle) {
    toggle.addEventListener('click', () => { toggle.classList.toggle('active'); navLinks.classList.toggle('open'); });
  }
  document.querySelectorAll('.nav-link').forEach(l =>
    l.addEventListener('click', () => { if (toggle) { toggle.classList.remove('active'); navLinks.classList.remove('open'); } })
  );

  // ── Scroll to top ──
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', () => scrollBtn.classList.toggle('visible', window.scrollY > 400), { passive: true });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── FAQ Accordion ──
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // ═══════════════════ CONSTANTS ═══════════════════
  const MAX_SIZE_MB     = 200;
  const MAX_SIZE_BYTES  = MAX_SIZE_MB * 1024 * 1024;
  const WARN_SIZE_BYTES = 50 * 1024 * 1024;  // 50 MB

  // ═══════════════════ STATE ═══════════════════
  let originalFile   = null;
  let originalImg    = null;
  let compressedBlob = null;

  // ═══════════════════ DOM REFS ═══════════════════
  const uploadZone        = document.getElementById('upload-zone');
  const fileInput         = document.getElementById('file-input');
  const toolPanel         = document.getElementById('tool-panel');

  // Upload preview
  const previewImg        = document.getElementById('upload-preview-img');
  const previewName       = document.getElementById('upload-preview-name');
  const previewSize       = document.getElementById('upload-preview-size');
  const removeBtn         = document.getElementById('upload-remove-btn');
  const largeFileWarning  = document.getElementById('large-file-warning');
  const warningSize       = document.getElementById('warning-size');

  // Info bar
  const infoName          = document.getElementById('info-name');
  const infoDims          = document.getElementById('info-dims');
  const infoSize          = document.getElementById('info-size');

  // Controls
  const qualitySlider     = document.getElementById('quality-slider');
  const qualityVal        = document.getElementById('quality-val');
  const outFormat         = document.getElementById('out-format');
  const targetSizeInput   = document.getElementById('target-size');
  const compressBtn       = document.getElementById('compress-btn');
  const formatAutoMsg     = document.getElementById('format-auto-msg');

  // Presets
  const presetBtns        = document.querySelectorAll('.ci-preset-btn');

  // Output
  const previewSection    = document.getElementById('preview-section');
  const downloadSection   = document.getElementById('download-section');
  const beforeImg         = document.getElementById('before-img');
  const afterImg          = document.getElementById('after-img');
  const statOrigSize      = document.getElementById('stat-orig-size');
  const statNewSize       = document.getElementById('stat-new-size');
  const statSaved         = document.getElementById('stat-saved');

  // ═══════════════════ UPLOAD ═══════════════════
  ['dragenter', 'dragover'].forEach(e =>
    uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(e =>
    uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.remove('dragover'); })
  );
  uploadZone.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  });
  uploadZone.addEventListener('click', e => {
    if (!e.target.closest('.upload-remove-btn') && e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // Remove button
  if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); resetTool(); });

  // ═══════════════════ HANDLE FILE ═══════════════════
  function handleFile(file) {
    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Unsupported file type. Please upload a JPG, PNG, or WebP image.');
      fileInput.value = '';
      return;
    }
    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      alert(`File too large! Maximum allowed size is ${MAX_SIZE_MB} MB.\nYour file: ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      fileInput.value = '';
      return;
    }

    originalFile = file;

    // Auto-select JPEG output for PNGs because PNGs can't be compressed via quality sliders
    if (file.type === 'image/png') {
      outFormat.value = 'jpeg';
      if (formatAutoMsg) formatAutoMsg.style.display = 'block';
    } else {
      outFormat.value = 'original';
      if (formatAutoMsg) formatAutoMsg.style.display = 'none';
    }

    // Show large-file warning
    if (file.size > WARN_SIZE_BYTES) {
      warningSize.textContent = formatBytes(file.size);
      largeFileWarning.style.display = 'flex';
    } else {
      largeFileWarning.style.display = 'none';
    }

    // Show upload zone preview
    const objectUrl = URL.createObjectURL(file);
    uploadZone.classList.add('has-file');
    if (previewImg)  previewImg.src = objectUrl;
    if (previewName) previewName.textContent = file.name;
    if (previewSize) previewSize.textContent = formatBytes(file.size);
    if (window.lucide) lucide.createIcons();

    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      originalImg = img;
      infoName.textContent = file.name;
      infoDims.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      infoSize.textContent = formatBytes(file.size);
      beforeImg.src = objectUrl;

      // Show tool panel
      toolPanel.classList.add('active');
      previewSection.style.display  = 'none';
      downloadSection.style.display = 'none';
      compressedBlob = null;

      if (window.lucide) lucide.createIcons();
    };
    img.onerror = () => {
      alert('Failed to load image. The file may be corrupted.');
      resetTool();
    };
    img.src = objectUrl;
  }

  // ═══════════════════ PRESETS ═══════════════════
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = parseInt(btn.dataset.quality);
      qualitySlider.value = q;
      qualityVal.textContent = q + '%';
      // Clear target size when using preset
      targetSizeInput.value = '';

      // Trigger compression automatically when a preset is clicked
      if (originalImg) {
        compressAtQuality(q / 100);
      }
    });
  });

  // ═══════════════════ QUALITY SLIDER ═══════════════════
  qualitySlider.addEventListener('input', () => {
    qualityVal.textContent = qualitySlider.value + '%';
    // Deselect presets when user drags slider manually
    presetBtns.forEach(b => b.classList.remove('active'));
    // Clear target size
    targetSizeInput.value = '';
  });

  // ═══════════════════ COMPRESS ═══════════════════
  compressBtn.addEventListener('click', () => {
    if (!originalImg) return;

    const targetKB = parseInt(targetSizeInput.value);
    if (targetKB && targetKB > 0) {
      compressToTarget(targetKB);
    } else {
      compressAtQuality(parseInt(qualitySlider.value) / 100);
    }
  });

  // ── Compress at a fixed quality ──
  function compressAtQuality(quality) {
    setLoading(true);
    // Timeout lets browser repaint the loading indicator
    setTimeout(() => {
      try {
        const mime = getOutputMime();
        const canvas = renderToCanvas();
        
        // Only pass quality argument for formats that support it
        const supportsQuality = ['image/jpeg', 'image/webp'].includes(mime);
        
        canvas.toBlob(blob => {
          if (!blob) { alert('Compression failed. Try a different format.'); setLoading(false); return; }
          finishCompression(blob);
        }, mime, supportsQuality ? quality : undefined);
      } catch (err) {
        console.error('[Compress Image]', err);
        alert('Error: ' + err.message);
        setLoading(false);
      }
    }, 80);
  }

  // ── Compress to a target file size (binary search) ──
  function compressToTarget(targetKB) {
    const targetBytes = targetKB * 1024;
    const mime = getOutputMime();

    // PNG is lossless — quality doesn't help, warn the user
    if (mime === 'image/png') {
      alert('PNG is lossless — quality slider has no effect.\nSwitch to JPEG or WebP to compress to a target size.');
      setLoading(false); // Reset button state
      return;
    }

    setLoading(true);

    setTimeout(async () => {
      try {
        const canvas = renderToCanvas();

        let lo = 0.01, hi = 1.0;
        let bestBlob = null;
        const MAX_ITER = 12;

        for (let i = 0; i < MAX_ITER; i++) {
          const mid = (lo + hi) / 2;
          const blob = await canvasToBlob(canvas, mime, mid);

          if (blob.size <= targetBytes) {
            bestBlob = blob;
            lo = mid;  // try higher quality
          } else {
            hi = mid;  // need lower quality
          }
        }

        // Fallback: lowest quality
        if (!bestBlob) {
          bestBlob = await canvasToBlob(canvas, mime, 0.01);
        }

        finishCompression(bestBlob);

      } catch (err) {
        console.error('[Compress Image]', err);
        alert('Error: ' + err.message);
        setLoading(false);
      }
    }, 80);
  }

  // ── Shared: render original image onto a canvas ──
  function renderToCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width  = originalImg.naturalWidth;
    canvas.height = originalImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const mime = getOutputMime();
    // White background for JPEG (flatten alpha)
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(originalImg, 0, 0);
    return canvas;
  }

  // ── Promise wrapper for canvas.toBlob ──
  function canvasToBlob(canvas, mime, quality) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), mime, quality);
    });
  }

  // ── Determine output MIME ──
  function getOutputMime() {
    const fmt = outFormat.value;
    if (fmt === 'jpeg') return 'image/jpeg';
    if (fmt === 'png')  return 'image/png';
    if (fmt === 'webp') return 'image/webp';
    return originalFile.type; // "original"
  }

  // ── Show final result ──
  function finishCompression(blob) {
    compressedBlob = blob;
    const compUrl = URL.createObjectURL(blob);
    afterImg.src = compUrl;

    const origBytes = originalFile.size;
    const newBytes  = blob.size;
    const savedPct  = ((origBytes - newBytes) / origBytes * 100);

    statOrigSize.textContent = formatBytes(origBytes);
    statNewSize.textContent  = formatBytes(newBytes);
    
    let savedMsg = savedPct > 0 ? `${savedPct.toFixed(1)}% smaller` : `Larger (+${Math.abs(savedPct).toFixed(1)}%)`;
    if (blob.type === 'image/png' && savedPct <= 0) {
      savedMsg += " (PNG is lossless)";
    }
    statSaved.textContent = savedMsg;

    previewSection.style.display  = 'block';
    downloadSection.style.display = 'flex';

    if (window.lucide) lucide.createIcons();
    initBASlider();

    previewSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setLoading(false);

    // Flash "Done!" on button
    compressBtn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Done!';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => resetBtnLabel(), 2000);
  }

  // ── Loading state ──
  function setLoading(on) {
    compressBtn.disabled = on;
    if (on) {
      compressBtn.innerHTML = '<i data-lucide="loader" class="btn-icon ci-spin"></i> Compressing…';
    } else {
      // Will be overridden by "Done!" in finishCompression, or by resetBtnLabel
    }
    if (window.lucide) lucide.createIcons();
  }
  function resetBtnLabel() {
    compressBtn.disabled = false;
    compressBtn.innerHTML = '<i data-lucide="zap" class="btn-icon"></i> Compress Image';
    if (window.lucide) lucide.createIcons();
  }

  // ═══════════════════ DOWNLOAD ═══════════════════
  document.getElementById('download-btn').addEventListener('click', () => {
    if (!compressedBlob) return;
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(compressedBlob);
    const fmt  = outFormat.value;
    const base = originalFile.name.replace(/\.[^.]+$/, '');
    const ext  = fmt === 'jpeg' ? 'jpg' : fmt === 'png' ? 'png' : fmt === 'webp' ? 'webp'
               : originalFile.name.split('.').pop().toLowerCase();
    a.download = `${base}-compressed.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // ═══════════════════ RESET ═══════════════════
  document.getElementById('reset-btn').addEventListener('click', resetTool);

  function resetTool() {
    originalFile   = null;
    originalImg    = null;
    compressedBlob = null;
    fileInput.value = '';

    uploadZone.classList.remove('has-file');
    if (previewImg)  previewImg.src = '';
    if (previewName) previewName.textContent = '';
    if (previewSize) previewSize.textContent = '';

    toolPanel.classList.remove('active');
    previewSection.style.display  = 'none';
    downloadSection.style.display = 'none';
    largeFileWarning.style.display = 'none';

    // Reset controls
    qualitySlider.value    = 70;
    qualityVal.textContent = '70%';
    outFormat.value        = 'original';
    targetSizeInput.value  = '';
    if (formatAutoMsg) formatAutoMsg.style.display = 'none';

    // Reset presets
    presetBtns.forEach(b => b.classList.remove('active'));
    document.getElementById('preset-medium').classList.add('active');

    resetBtnLabel();
    window.scrollTo({ top: uploadZone.offsetTop - 100, behavior: 'smooth' });
  }

  // ═══════════════════ BEFORE / AFTER SLIDER ═══════════════════
  function initBASlider() {
    const container = document.getElementById('ba-container');
    const slider    = document.getElementById('ba-slider');
    const after     = document.getElementById('ba-after');
    if (!container || !slider) return;

    slider.style.left    = '50%';
    after.style.clipPath = 'inset(0 0 0 50%)';

    let dragging = false;

    function updateSlider(x) {
      const rect = container.getBoundingClientRect();
      let pos = ((x - rect.left) / rect.width) * 100;
      pos = Math.max(5, Math.min(95, pos));
      slider.style.left    = pos + '%';
      after.style.clipPath = `inset(0 0 0 ${pos}%)`;
    }

    // Clone to remove old listeners
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);

    newSlider.addEventListener('mousedown',  () => dragging = true);
    newSlider.addEventListener('touchstart', () => dragging = true, { passive: true });
    window.addEventListener('mouseup',   () => dragging = false);
    window.addEventListener('touchend',  () => dragging = false);
    window.addEventListener('mousemove', e => { if (dragging) updateSlider(e.clientX); });
    window.addEventListener('touchmove', e => { if (dragging) updateSlider(e.touches[0].clientX); }, { passive: true });
    container.addEventListener('click', e => { if (!e.target.closest('.ba-slider')) updateSlider(e.clientX); });
  }

  // ═══════════════════ UTILS ═══════════════════
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
});
