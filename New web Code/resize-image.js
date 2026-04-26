/* ═══════════════════ RESIZE IMAGE JS ═══════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // ── Nav toggle ──
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle.addEventListener('click', () => { toggle.classList.toggle('active'); navLinks.classList.toggle('open'); });
  navLinks.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => { toggle.classList.remove('active'); navLinks.classList.remove('open'); }));

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
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  // ═══════════════════ STATE ═══════════════════
  let originalFile = null;
  let originalImg = null;
  let aspectRatio = 1;
  let lockAspect = true;
  let resizedBlob = null;

  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const toolPanel = document.getElementById('tool-panel');
  const widthInput = document.getElementById('width-input');
  const heightInput = document.getElementById('height-input');
  const lockBtn = document.getElementById('aspect-lock');
  const qualitySlider = document.getElementById('out-quality');
  const qualityVal = document.getElementById('quality-val');

  // ═══════════════════ UPLOAD PREVIEW ELEMENTS ═══════════════════
  const previewEl     = document.getElementById('upload-preview');
  const previewImg    = document.getElementById('upload-preview-img');
  const previewName   = document.getElementById('upload-preview-name');
  const previewSize   = document.getElementById('upload-preview-size');
  const removeBtn     = document.getElementById('upload-remove-btn');
  const MAX_SIZE_MB   = 200;
  const MAX_SIZE_BYTES= MAX_SIZE_MB * 1024 * 1024;

  // ═══════════════════ UPLOAD ═══════════════════
  ['dragenter', 'dragover'].forEach(e => uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(e => uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.remove('dragover'); }));
  uploadZone.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleFile(f); });
  uploadZone.addEventListener('click', e => { if (!e.target.closest('.upload-btn') && !e.target.closest('.upload-remove-btn') && e.target !== fileInput) fileInput.click(); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  // Remove button
  if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); resetUpload(); });

  function handleFile(file) {
    // 200MB size guard
    if (file.size > MAX_SIZE_BYTES) {
      alert(`File too large! Maximum allowed size is ${MAX_SIZE_MB} MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      fileInput.value = '';
      return;
    }

    originalFile = file;
    uploadZone.classList.add('has-file');

    // Show image preview in upload zone
    const objectUrl = URL.createObjectURL(file);
    if (previewImg)  { previewImg.src = objectUrl; }
    if (previewName) { previewName.textContent = file.name; }
    if (previewSize) { previewSize.textContent = formatBytes(file.size); }
    if (window.lucide) lucide.createIcons();

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        originalImg = img;
        aspectRatio = img.naturalWidth / img.naturalHeight;

        // Fill info bar
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('original-dims').textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        document.getElementById('file-size').textContent = formatBytes(file.size);

        // Fill dimension inputs
        widthInput.value = img.naturalWidth;
        heightInput.value = img.naturalHeight;

        // Show before image
        document.getElementById('before-img').src = e.target.result;

        // Show panel
        toolPanel.classList.add('active');

        // Clear presets
        document.querySelectorAll('.preset-btn.active').forEach(b => b.classList.remove('active'));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetUpload() {
    originalFile = null; originalImg = null; resizedBlob = null;
    fileInput.value = '';
    uploadZone.classList.remove('has-file');
    if (previewImg)  { previewImg.src = ''; }
    if (previewName) { previewName.textContent = ''; }
    if (previewSize) { previewSize.textContent = ''; }
    toolPanel.classList.remove('active');
    previewSection.style.display = 'none';
    downloadSection.style.display = 'none';
    document.querySelectorAll('.preset-btn.active').forEach(b => b.classList.remove('active'));
    lockAspect = true;
    lockBtn.classList.add('locked');
    const icon = document.getElementById('lock-icon');
    icon.setAttribute('data-lucide', 'lock');
    if (window.lucide) lucide.createIcons();
    window.scrollTo({ top: uploadZone.offsetTop - 100, behavior: 'smooth' });
  }

  // ═══════════════════ ASPECT RATIO LOCK ═══════════════════
  lockBtn.classList.add('locked');
  lockBtn.addEventListener('click', () => {
    lockAspect = !lockAspect;
    lockBtn.classList.toggle('locked', lockAspect);
    const icon = document.getElementById('lock-icon');
    icon.setAttribute('data-lucide', lockAspect ? 'lock' : 'lock-open');
    if (window.lucide) lucide.createIcons();
  });

  widthInput.addEventListener('input', () => {
    if (lockAspect && originalImg) {
      heightInput.value = Math.round(+widthInput.value / aspectRatio);
    }
    clearActivePreset();
  });
  heightInput.addEventListener('input', () => {
    if (lockAspect && originalImg) {
      widthInput.value = Math.round(+heightInput.value * aspectRatio);
    }
    clearActivePreset();
  });

  function clearActivePreset() {
    document.querySelectorAll('.preset-btn.active').forEach(b => b.classList.remove('active'));
  }

  // ═══════════════════ PRESETS ═══════════════════
  document.getElementById('presets-grid').addEventListener('click', e => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    document.querySelectorAll('.preset-btn.active').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    widthInput.value = btn.dataset.w;
    heightInput.value = btn.dataset.h;
    // Unlock aspect since preset has fixed dimensions
    lockAspect = false;
    lockBtn.classList.remove('locked');
    const icon = document.getElementById('lock-icon');
    icon.setAttribute('data-lucide', 'lock-open');
    if (window.lucide) lucide.createIcons();
  });

  // ═══════════════════ QUALITY SLIDER ═══════════════════
  qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

  // ═══════════════════ RESIZE ═══════════════════
  const resizeBtn = document.getElementById('resize-btn');
  const previewSection = document.getElementById('preview-section');
  const downloadSection = document.getElementById('download-section');

  resizeBtn.addEventListener('click', () => {
    if (!originalImg) return;
    const w = +widthInput.value;
    const h = +heightInput.value;
    if (w < 1 || h < 1 || w > 10000 || h > 10000) {
      alert('Please enter valid dimensions (1–10000 px).');
      return;
    }

    resizeBtn.innerHTML = '<i data-lucide="loader" class="btn-icon spin"></i> Resizing...';
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(originalImg, 0, 0, w, h);

      const fmt = document.getElementById('out-format').value;
      let mime = originalFile.type;
      if (fmt === 'jpeg') mime = 'image/jpeg';
      else if (fmt === 'png') mime = 'image/png';
      else if (fmt === 'webp') mime = 'image/webp';

      const quality = +qualitySlider.value / 100;

      canvas.toBlob(blob => {
        resizedBlob = blob;
        const url = URL.createObjectURL(blob);

        // Update preview
        document.getElementById('after-img').src = url;
        document.getElementById('stat-orig-dims').textContent = `${originalImg.naturalWidth} × ${originalImg.naturalHeight}`;
        document.getElementById('stat-new-dims').textContent = `${w} × ${h}`;
        document.getElementById('stat-file-size').textContent = formatBytes(blob.size);

        previewSection.style.display = 'block';
        downloadSection.style.display = 'flex';

        resizeBtn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Done!';
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
          resizeBtn.innerHTML = '<i data-lucide="scaling" class="btn-icon"></i> Resize Image';
          if (window.lucide) lucide.createIcons();
        }, 2000);

        // Scroll to preview
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, mime, quality);
    }, 300);
  });

  // ═══════════════════ DOWNLOAD ═══════════════════
  document.getElementById('download-btn').addEventListener('click', () => {
    if (!resizedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resizedBlob);
    const ext = document.getElementById('out-format').value;
    const name = originalFile.name.replace(/\.[^.]+$/, '');
    const w = widthInput.value, h = heightInput.value;
    a.download = `${name}-${w}x${h}.${ext === 'original' ? originalFile.name.split('.').pop() : ext}`;
    a.click();
  });

  // ═══════════════════ RESET ═══════════════════
  document.getElementById('reset-btn').addEventListener('click', resetUpload);


  // ═══════════════════ BEFORE/AFTER SLIDER ═══════════════════
  const baContainer = document.getElementById('ba-container');
  const baSlider = document.getElementById('ba-slider');
  const baAfter = document.getElementById('ba-after');
  if (baContainer && baSlider) {
    let dragging = false;
    function updateSlider(x) {
      const rect = baContainer.getBoundingClientRect();
      let pos = ((x - rect.left) / rect.width) * 100;
      pos = Math.max(5, Math.min(95, pos));
      baSlider.style.left = pos + '%';
      baAfter.style.clipPath = `inset(0 0 0 ${pos}%)`;
    }
    baSlider.addEventListener('mousedown', () => dragging = true);
    baSlider.addEventListener('touchstart', () => dragging = true, { passive: true });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('touchend', () => dragging = false);
    window.addEventListener('mousemove', e => { if (dragging) updateSlider(e.clientX); });
    window.addEventListener('touchmove', e => { if (dragging) updateSlider(e.touches[0].clientX); }, { passive: true });
    baContainer.addEventListener('click', e => { if (!e.target.closest('.ba-slider')) updateSlider(e.clientX); });
  }

  // ═══════════════════ UTILS ═══════════════════
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
});

// Spin animation
const s = document.createElement('style');
s.textContent = `.spin{animation:spinIcon 1s linear infinite}@keyframes spinIcon{to{transform:rotate(360deg)}}`;
document.head.appendChild(s);
