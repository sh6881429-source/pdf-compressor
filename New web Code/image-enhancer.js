/* ═══════════════════ IMAGE ENHANCER JS ═══════════════════ */
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

  // ═══════════════════ STATE & ELEMENTS ═══════════════════
  let originalFile = null;
  let originalImg = null;
  let enhancedBlob = null;
  
  // Create an offscreen canvas to process original image data
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const toolPanel = document.getElementById('tool-panel');
  const beforeImg = document.getElementById('before-img');
  const previewCanvas = document.getElementById('preview-canvas');
  const previewCtx = previewCanvas.getContext('2d');
  
  const sliders = {
    brightness: document.getElementById('brightness-slider'),
    contrast: document.getElementById('contrast-slider'),
    saturation: document.getElementById('saturation-slider'),
    sharpness: document.getElementById('sharpness-slider')
  };
  
  const values = {
    brightness: document.getElementById('brightness-val'),
    contrast: document.getElementById('contrast-val'),
    saturation: document.getElementById('saturation-val'),
    sharpness: document.getElementById('sharpness-val')
  };

  // ═══════════════════ UPLOAD PREVIEW ELEMENTS ═══════════════════
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

  if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); resetTool(); });

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
    if (previewImg)  { previewImg.src = URL.createObjectURL(file); }
    if (previewName) { previewName.textContent = file.name; }
    if (previewSize) { previewSize.textContent = formatBytes(file.size); }
    if (window.lucide) lucide.createIcons();

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        originalImg = img;
        
        // Set up original view
        beforeImg.src = e.target.result;
        
        // Set up offscreen canvas to natural resolution
        offscreenCanvas.width = img.naturalWidth;
        offscreenCanvas.height = img.naturalHeight;
        offscreenCtx.drawImage(img, 0, 0);

        // Reset sliders
        resetSliders();

        // Show panel
        toolPanel.classList.add('active');
        
        // Apply initial (zeroed) filters to draw onto preview canvas
        applyFilters();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ═══════════════════ SLIDER LOGIC ═══════════════════
  let renderTimeout;
  
  function handleSliderChange(name) {
    values[name].textContent = sliders[name].value;
    
    // Debounce live preview slightly for performance, especially sharpness
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(applyFilters, 50);
  }

  Object.keys(sliders).forEach(name => {
    sliders[name].addEventListener('input', () => handleSliderChange(name));
  });

  // ═══════════════════ AUTO ENHANCE & RESET ═══════════════════
  document.getElementById('auto-enhance-btn').addEventListener('click', () => {
    sliders.brightness.value = 10;
    sliders.contrast.value = 15;
    sliders.saturation.value = 20;
    sliders.sharpness.value = 25;
    
    Object.keys(sliders).forEach(name => { values[name].textContent = sliders[name].value; });
    applyFilters();
  });

  document.getElementById('reset-sliders-btn').addEventListener('click', resetSliders);

  function resetSliders() {
    sliders.brightness.value = 0;
    sliders.contrast.value = 0;
    sliders.saturation.value = 0;
    sliders.sharpness.value = 0;
    Object.keys(sliders).forEach(name => { values[name].textContent = sliders[name].value; });
    if (originalImg) applyFilters();
  }

  // ═══════════════════ IMAGE PROCESSING ═══════════════════
  function applyFilters() {
    if (!originalImg) return;
    
    // We process directly onto the preview canvas
    // First, set canvas to match image dimensions
    previewCanvas.width = originalImg.naturalWidth;
    previewCanvas.height = originalImg.naturalHeight;
    
    const b = parseInt(sliders.brightness.value); // -100 to 100
    const c = parseInt(sliders.contrast.value);   // -100 to 100
    const s = parseInt(sliders.saturation.value); // -100 to 100
    const sh = parseInt(sliders.sharpness.value); // 0 to 100

    // CSS Filters equivalent values:
    // Brightness: 0 = 100%. -100 = 0%, 100 = 200%
    const bVal = 100 + b;
    // Contrast: 0 = 100%. -100 = 0%, 100 = 200%
    const cVal = 100 + c;
    // Saturation: 0 = 100%. -100 = 0%, 100 = 200%
    const sVal = 100 + s;

    // Apply basic CSS-style filters via Canvas context
    previewCtx.filter = `brightness(${bVal}%) contrast(${cVal}%) saturate(${sVal}%)`;
    previewCtx.drawImage(originalImg, 0, 0);
    previewCtx.filter = 'none'; // reset
    
    // Apply Sharpening if needed (manual pixel manipulation via convolution)
    if (sh > 0) {
      applySharpen(previewCtx, previewCanvas.width, previewCanvas.height, sh / 100);
    }
  }

  // Convolution matrix for sharpening
  function applySharpen(ctx, w, h, amount) {
    // amount is 0 to 1. We scale the sharpening effect.
    // A basic unsharp mask kernel:
    //  0 -1  0
    // -1  5 -1
    //  0 -1  0
    // We mix it with the identity matrix based on 'amount'
    
    const mix = amount * 3; // Boost the effect scale
    const center = 1 + (4 * mix);
    const edge = -mix;
    
    const weights = [
       0,    edge,  0,
      edge, center, edge,
       0,    edge,  0
    ];
    
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    
    const srcData = ctx.getImageData(0, 0, w, h);
    const src = srcData.data;
    const sw = w;
    const sh = h;
    
    const dstData = ctx.createImageData(w, h);
    const dst = dstData.data;
    
    const alphaFac = 1;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0, a = 0;
        
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = Math.min(Math.max(y + cy - halfSide, 0), sh - 1);
            const scx = Math.min(Math.max(x + cx - halfSide, 0), sw - 1);
            const srcOff = (scy * sw + scx) * 4;
            const wt = weights[cy * side + cx];
            
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
        
        dst[dstOff] = r;
        dst[dstOff + 1] = g;
        dst[dstOff + 2] = b;
        dst[dstOff + 3] = src[dstOff + 3]; // keep original alpha
      }
    }
    
    ctx.putImageData(dstData, 0, 0);
  }

  // ═══════════════════ APPLY & ENHANCE (Generate Blob) ═══════════════════
  const applyBtn = document.getElementById('apply-btn');
  const downloadSection = document.getElementById('download-section');

  applyBtn.addEventListener('click', () => {
    if (!originalImg) return;
    
    applyBtn.innerHTML = '<i data-lucide="loader" class="btn-icon spin"></i> Processing...';
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      // previewCanvas already has the fully rendered image. We just extract it.
      let mime = originalFile.type;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) mime = 'image/jpeg';
      
      previewCanvas.toBlob(blob => {
        enhancedBlob = blob;
        downloadSection.style.display = 'flex';
        downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        applyBtn.innerHTML = '<i data-lucide="check-circle" class="btn-icon"></i> Enhanced!';
        if (window.lucide) lucide.createIcons();
        
        setTimeout(() => {
          applyBtn.innerHTML = '<i data-lucide="check-circle" class="btn-icon"></i> Apply & Enhance';
          if (window.lucide) lucide.createIcons();
        }, 2000);
      }, mime, 0.95);
    }, 100);
  });

  // ═══════════════════ DOWNLOAD ═══════════════════
  document.getElementById('download-btn').addEventListener('click', () => {
    if (!enhancedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(enhancedBlob);
    
    const extMatch = originalFile.name.match(/\.(jpg|jpeg|png|webp)$/i);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const name = originalFile.name.replace(/\.[^.]+$/, '');
    
    a.download = `${name}-enhanced.${ext}`;
    a.click();
  });

  // ═══════════════════ RESET TOOL ═══════════════════
  document.getElementById('reset-tool-btn').addEventListener('click', resetTool);

  function resetTool() {
    originalFile = null; originalImg = null; enhancedBlob = null;
    fileInput.value = '';
    uploadZone.classList.remove('has-file');
    if (previewImg)  { previewImg.src = ''; }
    if (previewName) { previewName.textContent = ''; }
    if (previewSize) { previewSize.textContent = ''; }
    toolPanel.classList.remove('active');
    downloadSection.style.display = 'none';
    resetSliders();
    window.scrollTo({ top: uploadZone.offsetTop - 100, behavior: 'smooth' });
  }

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
