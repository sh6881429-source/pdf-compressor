/* ═══════════════════ TOOL PAGE JS ═══════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // ── Mobile menu toggle ──
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    links.classList.toggle('open');
  });
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('open');
    });
  });

  // ── Scroll to top ──
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ═══════════════════ UPLOAD HANDLING ═══════════════════
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const toolPanel = document.getElementById('tool-panel');
  let originalFile = null;
  let compressedBlob = null;

  if (uploadZone) {
    // Drag & drop
    ['dragenter', 'dragover'].forEach(evt => {
      uploadZone.addEventListener(evt, e => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      uploadZone.addEventListener(evt, e => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
      });
    });
    uploadZone.addEventListener('drop', e => {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFile(file);
    });

    // Click to upload
    uploadZone.addEventListener('click', e => {
      if (e.target.closest('.upload-btn') || e.target === fileInput) return;
      fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });
  }

  function handleFile(file) {
    originalFile = file;
    uploadZone.classList.add('has-file');

    // Show the file name in upload zone
    const titleEl = uploadZone.querySelector('.upload-title');
    titleEl.textContent = file.name;
    const hintEl = uploadZone.querySelector('.upload-hint');
    hintEl.textContent = formatBytes(file.size);

    // Show tool panel
    toolPanel.classList.add('active');

    // Load before image
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('before-img').src = e.target.result;
      document.getElementById('after-img').src = e.target.result;
      document.getElementById('stat-original').textContent = formatBytes(file.size);
    };
    reader.readAsDataURL(file);
  }

  // ═══════════════════ QUALITY SLIDER ═══════════════════
  const qualitySlider = document.getElementById('quality-slider');
  const qualityValue = document.getElementById('quality-value');
  if (qualitySlider && qualityValue) {
    qualitySlider.addEventListener('input', () => {
      qualityValue.textContent = qualitySlider.value + '%';
    });
  }

  // ═══════════════════ COMPRESSION ═══════════════════
  const compressBtn = document.getElementById('compress-btn');
  const previewSection = document.getElementById('preview-section');
  const downloadSection = document.getElementById('download-section');

  if (compressBtn) {
    compressBtn.addEventListener('click', () => {
      if (!originalFile) return;
      compressBtn.innerHTML = '<i data-lucide="loader" class="btn-icon spin"></i> Compressing...';

      setTimeout(() => {
        compressImage(originalFile, +qualitySlider.value / 100).then(result => {
          compressedBlob = result.blob;

          // Update after image
          document.getElementById('after-img').src = result.url;

          // Stats
          document.getElementById('stat-original').textContent = formatBytes(originalFile.size);
          document.getElementById('stat-compressed').textContent = formatBytes(result.blob.size);
          const saved = ((1 - result.blob.size / originalFile.size) * 100).toFixed(1);
          document.getElementById('stat-saved').textContent = saved + '%';

          // Show sections
          if (previewSection) previewSection.style.display = 'block';
          if (downloadSection) downloadSection.style.display = 'flex';

          compressBtn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Done!';
          if (window.lucide) lucide.createIcons();

          setTimeout(() => {
            compressBtn.innerHTML = '<i data-lucide="zap" class="btn-icon"></i> Compress Now';
            if (window.lucide) lucide.createIcons();
          }, 2000);
        });
      }, 400);
    });
  }

  function compressImage(file, quality) {
    return new Promise(resolve => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const formatSelect = document.getElementById('format-select');
          const format = formatSelect ? formatSelect.value : 'jpeg';
          let mime = file.type;
          if (format === 'jpeg') mime = 'image/jpeg';
          else if (format === 'png') mime = 'image/png';
          else if (format === 'webp') mime = 'image/webp';

          canvas.toBlob(blob => {
            resolve({ blob, url: URL.createObjectURL(blob) });
          }, mime, quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ═══════════════════ DOWNLOAD ═══════════════════
  const downloadBtnEl = document.getElementById('download-btn');
  if (downloadBtnEl && document.getElementById('format-select')) {
    downloadBtnEl.addEventListener('click', () => {
      if (!compressedBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(compressedBlob);
      const ext = document.getElementById('format-select').value;
      const name = originalFile.name.replace(/\.[^.]+$/, '');
      a.download = name + '-compressed.' + (ext === 'original' ? originalFile.name.split('.').pop() : ext);
      a.click();
    });
  }

  // Reset
  const resetBtnEl = document.getElementById('reset-btn');
  if (resetBtnEl && uploadZone) {
    resetBtnEl.addEventListener('click', () => {
      originalFile = null;
      compressedBlob = null;
      fileInput.value = '';
      uploadZone.classList.remove('has-file');
      uploadZone.querySelector('.upload-title').textContent = 'Drop your image here';
      uploadZone.querySelector('.upload-hint').textContent = 'or click to browse — JPG, PNG, WebP up to 10 MB';
      if (toolPanel) toolPanel.classList.remove('active');
      if (previewSection) previewSection.style.display = '';
      if (downloadSection) downloadSection.style.display = '';
      window.scrollTo({ top: uploadZone.offsetTop - 100, behavior: 'smooth' });
    });
  }

  // ═══════════════════ BEFORE/AFTER SLIDER ═══════════════════
  const baContainer = document.getElementById('ba-container');
  const baSlider = document.getElementById('ba-slider');
  const baAfter = document.getElementById('ba-after');

  if (baContainer && baSlider) {
    let isDragging = false;

    function updateSlider(x) {
      const rect = baContainer.getBoundingClientRect();
      let pos = ((x - rect.left) / rect.width) * 100;
      pos = Math.max(5, Math.min(95, pos));
      baSlider.style.left = pos + '%';
      baAfter.style.clipPath = `inset(0 0 0 ${pos}%)`;
    }

    baSlider.addEventListener('mousedown', () => isDragging = true);
    baSlider.addEventListener('touchstart', () => isDragging = true, { passive: true });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('touchend', () => isDragging = false);

    window.addEventListener('mousemove', e => {
      if (isDragging) updateSlider(e.clientX);
    });
    window.addEventListener('touchmove', e => {
      if (isDragging) updateSlider(e.touches[0].clientX);
    }, { passive: true });

    // Click to set position
    baContainer.addEventListener('click', e => {
      if (e.target.closest('.ba-slider')) return;
      updateSlider(e.clientX);
    });
  }

  // ═══════════════════ FAQ ACCORDION ═══════════════════
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      // Toggle clicked
      if (!isOpen) item.classList.add('open');
    });
  });

  // ═══════════════════ UTILITIES ═══════════════════
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
});

/* Spin animation for loader */
const style = document.createElement('style');
style.textContent = `.spin { animation: spinIcon 1s linear infinite; } @keyframes spinIcon { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
