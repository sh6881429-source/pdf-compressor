/* ═══════════════════ BG REMOVER JS ═══════════════════ */
import { removeBackground } from 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

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
  let transparentBlob = null;

  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  
  const processingPanel = document.getElementById('processing-panel');
  const progressBar = document.getElementById('progress-bar');
  const processingDesc = document.getElementById('processing-desc');
  
  const toolPanel = document.getElementById('tool-panel');
  const beforeImg = document.getElementById('before-img');
  const afterImg = document.getElementById('after-img');

  // ═══════════════════ UPLOAD PREVIEW ELEMENTS ═══════════════════
  const previewImg    = document.getElementById('upload-preview-img');
  const previewName   = document.getElementById('upload-preview-name');
  const previewSize   = document.getElementById('upload-preview-size');
  const removeBtn     = document.getElementById('upload-remove-btn');
  const MAX_SIZE_MB   = 200;
  const MAX_SIZE_BYTES= MAX_SIZE_MB * 1024 * 1024;

  // ═══════════════════ UPLOAD & PROCESS ═══════════════════
  ['dragenter', 'dragover'].forEach(e => uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(e => uploadZone.addEventListener(e, ev => { ev.preventDefault(); uploadZone.classList.remove('dragover'); }));
  
  uploadZone.addEventListener('drop', e => { 
    const f = e.dataTransfer.files[0]; 
    if (f && f.type.startsWith('image/')) showPreviewAndConfirm(f); 
  });
  uploadZone.addEventListener('click', e => { 
    if (!e.target.closest('.upload-remove-btn') && e.target !== fileInput) fileInput.click(); 
  });
  fileInput.addEventListener('change', () => { 
    if (fileInput.files[0]) showPreviewAndConfirm(fileInput.files[0]); 
  });

  if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); resetTool(); });

  function showPreviewAndConfirm(file) {
    // 200MB size guard
    if (file.size > MAX_SIZE_BYTES) {
      alert(`File too large! Maximum allowed size is ${MAX_SIZE_MB} MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      fileInput.value = '';
      return;
    }
    // Show thumbnail in upload zone
    uploadZone.classList.add('has-file');
    if (previewImg)  { previewImg.src = URL.createObjectURL(file); }
    if (previewName) { previewName.textContent = file.name; }
    if (previewSize) { previewSize.textContent = formatBytes(file.size); }
    if (window.lucide) lucide.createIcons();
    // Kick off AI processing
    processImage(file);
  }

  async function processImage(file) {
    originalFile = file;
    
    // Set before image preview
    beforeImg.src = URL.createObjectURL(file);
    
    // Switch UI
    uploadZone.style.display = 'none';
    processingPanel.classList.add('active');
    progressBar.style.width = '0%';
    
    try {
      // Configuration for @imgly/background-removal
      const config = {
        progress: (key, current, total) => {
          // Calculate overall progress based on fetch/compute steps
          const percent = Math.round((current / total) * 100);
          
          if (key.includes('fetch')) {
            processingDesc.textContent = `Downloading AI model... (${percent}%) - Only required on first run.`;
            progressBar.style.width = (percent * 0.4) + '%'; // First 40% is download
          } else {
            processingDesc.textContent = `Processing image... (${percent}%)`;
            progressBar.style.width = (40 + (percent * 0.6)) + '%'; // Last 60% is processing
          }
        }
      };

      // Call the AI model
      const blob = await removeBackground(file, config);
      
      // Success
      transparentBlob = blob;
      afterImg.src = URL.createObjectURL(blob);
      
      // Update UI
      processingPanel.classList.remove('active');
      toolPanel.classList.add('active');
      
      // Reset slider to center
      document.getElementById('ba-slider').style.left = '50%';
      document.getElementById('ba-after').style.clipPath = 'inset(0 0 0 50%)';

    } catch (error) {
      console.error("Background removal failed:", error);
      alert("An error occurred during background removal. Please try again with a different image or check your connection.");
      resetTool();
    }
  }

  // ═══════════════════ DOWNLOAD ═══════════════════
  document.getElementById('download-btn').addEventListener('click', () => {
    if (!transparentBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(transparentBlob);
    const name = originalFile.name.replace(/\.[^.]+$/, '');
    // Always force PNG for transparency
    a.download = `${name}-nobg.png`;
    a.click();
  });

  // ═══════════════════ RESET TOOL ═══════════════════
  document.getElementById('reset-tool-btn').addEventListener('click', resetTool);

  function resetTool() {
    originalFile = null; 
    transparentBlob = null;
    fileInput.value = '';
    
    uploadZone.classList.remove('has-file');
    uploadZone.style.display = '';
    if (previewImg)  { previewImg.src = ''; }
    if (previewName) { previewName.textContent = ''; }
    if (previewSize) { previewSize.textContent = ''; }
    processingPanel.classList.remove('active');
    toolPanel.classList.remove('active');
    
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
