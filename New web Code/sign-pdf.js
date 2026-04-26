/* ═══════════════════ SIGN PDF JS ═══════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // Navigation
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle.addEventListener('click', () => { toggle.classList.toggle('active'); navLinks.classList.toggle('open'); });
  navLinks.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => { toggle.classList.remove('active'); navLinks.classList.remove('open'); }));

  // Accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  // ═══════════════════ STATE ═══════════════════
  let currentFile = null;
  let originalPdfBytes = null;
  let pdfDocument = null; // pdf.js document
  let scale = 1.0;
  let activeElement = null; // Currently selected signature element

  const initialUploadZone = document.getElementById('initial-upload-zone');
  const initialFileInput = document.getElementById('initial-file-input');
  const pdfEditor = document.getElementById('app');
  const pdfPagesWrapper = document.getElementById('pdf-pages-wrapper');
  
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomLevelText = document.getElementById('zoom-level');
  
  const addSignBtn = document.getElementById('add-sign-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const savePdfBtn = document.getElementById('save-pdf-btn');
  const processingPanel = document.getElementById('processing-panel');

  // Signature Modal Elements
  const signModal = document.getElementById('sign-modal');
  const tabDraw = document.getElementById('tab-draw');
  const tabUpload = document.getElementById('tab-upload');
  const viewDraw = document.getElementById('view-draw');
  const viewUpload = document.getElementById('view-upload');
  
  const sigPad = document.getElementById('signature-pad');
  const ctx = sigPad.getContext('2d');
  let isDrawing = false;
  
  const uploadSigBox = document.getElementById('upload-sig-box');
  const sigImageInput = document.getElementById('sig-image-input');
  const sigImagePreviewContainer = document.getElementById('sig-image-preview-container');
  const sigImagePreview = document.getElementById('sig-image-preview');
  
  let uploadedSigDataURL = null; // Holds uploaded image

  // ═══════════════════ UPLOAD ═══════════════════
  ['dragenter', 'dragover'].forEach(e => initialUploadZone.addEventListener(e, ev => { ev.preventDefault(); initialUploadZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(e => initialUploadZone.addEventListener(e, ev => { ev.preventDefault(); initialUploadZone.classList.remove('dragover'); }));
  
  initialUploadZone.addEventListener('drop', e => handleFile(e.dataTransfer.files));
  initialFileInput.addEventListener('change', e => handleFile(e.target.files));

  async function handleFile(files) {
    const file = Array.from(files).find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!file) {
      alert("Please upload a valid PDF file.");
      return;
    }
    
    currentFile = file;
    initialUploadZone.style.display = 'none';
    pdfEditor.style.display = 'flex';
    document.body.classList.add('app-mode');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      originalPdfBytes = new Uint8Array(arrayBuffer); // Keep original to ensure ZERO quality loss
      
      const loadTask = pdfjsLib.getDocument({ data: originalPdfBytes.slice() });
      pdfDocument = await loadTask.promise;
      
      await renderAllPages();
    } catch (err) {
      console.error("Failed to load PDF:", err);
      alert("Error loading PDF. It may be encrypted.");
      location.reload();
    }
  }

  // ═══════════════════ HIGH-QUALITY RENDERING & LAZY LOADING ═══════════════════
  const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const pageDiv = entry.target;
        const pageNum = parseInt(pageDiv.dataset.pageNum);
        if (!pageDiv.dataset.rendered) {
          renderPage(pageNum, pageDiv);
          pageDiv.dataset.rendered = "true";
        }
      }
    });
  }, { rootMargin: '200px' });

  async function renderAllPages() {
    pdfPagesWrapper.innerHTML = '';
    
    // Determine the container width for "fit to width" rendering
    const containerWidth = document.getElementById('pdfContainer').clientWidth - 48; // minus padding
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      
      // Calculate initial scale to fit the container width
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const fitScale = containerWidth / unscaledViewport.width;
      
      // We'll use this fitScale as our "base" for this page to ensure no distortion
      const logicalViewport = page.getViewport({ scale: fitScale });
      
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.dataset.pageNum = i;
      pageDiv.dataset.fitScale = fitScale; // Store for renderPage
      
      // Set fixed logical dimensions to prevent stretching
      pageDiv.style.width = `${logicalViewport.width}px`;
      pageDiv.style.height = `${logicalViewport.height}px`;
      
      // Placeholder while loading
      pageDiv.innerHTML = '<div class="page-loader">Rendering...</div>';

      pdfPagesWrapper.appendChild(pageDiv);
      pageObserver.observe(pageDiv);

      // Deselect elements if clicking on the background
      pageDiv.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('pdf-page')) {
          clearSelection();
        }
      });
    }
  }

  async function renderPage(pageNum, container) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const containerWidth = document.getElementById('pdfContainer').clientWidth - 48; // Padding correction

      // Step 1: get original viewport
      const viewport = page.getViewport({ scale: 1 });

      // Step 2: calculate correct scale to fit container
      const scale = containerWidth / viewport.width;

      // Step 3: apply scale
      const scaledViewport = page.getViewport({ scale });

      // Step 4: create canvas
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      // Step 5: HIGH QUALITY FIX
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = scaledViewport.width * outputScale;
      canvas.height = scaledViewport.height * outputScale;

      canvas.style.width = scaledViewport.width + "px";
      canvas.style.height = scaledViewport.height + "px";
      canvas.style.display = 'block';

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      // Step 6: render page
      await page.render({
        canvasContext: context,
        viewport: scaledViewport
      }).promise;

      container.innerHTML = '';
      container.appendChild(canvas);
      
      // Re-enable clicks for selection clearing
      canvas.addEventListener('mousedown', (e) => {
        if (e.target === canvas) clearSelection();
      });
    } catch (err) {
      console.error(`Page ${pageNum} render failed:`, err);
      container.innerHTML = '<div class="page-error">Error rendering page</div>';
    }
  }

  // ═══════════════════ SIGNATURE PAD SETUP ═══════════════════
  function setupSignaturePad() {
    const dpr = window.devicePixelRatio || 1;
    const rect = sigPad.parentElement.getBoundingClientRect();
    const cssWidth = Math.min(500, rect.width - 48);
    const cssHeight = 200;

    sigPad.width = cssWidth * dpr;
    sigPad.height = cssHeight * dpr;
    sigPad.style.width = `${cssWidth}px`;
    sigPad.style.height = `${cssHeight}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
  }

  function clearSelection() {
    if (activeElement) {
      activeElement.classList.remove('selected');
      activeElement = null;
    }
  }

  // ═══════════════════ ZOOMING ═══════════════════
  zoomInBtn.addEventListener('click', () => { if (scale < 2.0) { scale += 0.2; updateZoom(); }});
  zoomOutBtn.addEventListener('click', () => { if (scale > 0.6) { scale -= 0.2; updateZoom(); }});

  async function updateZoom() {
    zoomLevelText.textContent = `${Math.round(scale * 100)}%`;
    pdfPagesWrapper.style.transform = `scale(${scale})`;
    pdfPagesWrapper.style.marginBottom = `${(scale - 1) * 100}%`;
  }

  // ═══════════════════ SIGNATURE MODAL UI ═══════════════════
  addSignBtn.addEventListener('click', () => {
    signModal.classList.add('active');
    setupSignaturePad();
  });

  // Fullscreen Logic
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      pdfEditor.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      fullscreenBtn.innerHTML = '<i data-lucide="minimize"></i> Exit Full Screen';
    } else {
      fullscreenBtn.innerHTML = '<i data-lucide="maximize"></i> Full Screen';
    }
    if (window.lucide) lucide.createIcons({root: fullscreenBtn});
  });

  document.getElementById('close-modal-btn').addEventListener('click', () => signModal.classList.remove('active'));
  document.getElementById('clear-sign-btn').addEventListener('click', () => {
    // Clear considering the transform
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sigPad.width, sigPad.height);
    ctx.restore();
  });

  // Tabs
  tabDraw.addEventListener('click', () => {
    tabDraw.classList.add('active'); tabUpload.classList.remove('active');
    viewDraw.style.display = 'flex'; viewUpload.style.display = 'none';
  });
  tabUpload.addEventListener('click', () => {
    tabUpload.classList.add('active'); tabDraw.classList.remove('active');
    viewUpload.style.display = 'block'; viewDraw.style.display = 'none';
  });

  // Upload Logic
  uploadSigBox.addEventListener('click', () => sigImageInput.click());
  sigImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedSigDataURL = ev.target.result;
        sigImagePreview.src = uploadedSigDataURL;
        uploadSigBox.style.display = 'none';
        sigImagePreviewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
  document.getElementById('remove-img-btn').addEventListener('click', () => {
    uploadedSigDataURL = null;
    sigImageInput.value = '';
    sigImagePreviewContainer.style.display = 'none';
    uploadSigBox.style.display = 'block';
  });

  // ═══════════════════ DRAWING LOGIC ═══════════════════
  function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.clientX || (evt.touches && evt.touches[0].clientX);
    const clientY = evt.clientY || (evt.touches && evt.touches[0].clientY);
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  sigPad.addEventListener('mousedown', (e) => { isDrawing = true; const pos = getMousePos(sigPad, e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); });
  sigPad.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; const pos = getMousePos(sigPad, e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }, {passive: false});
  sigPad.addEventListener('mousemove', (e) => { if (!isDrawing) return; const pos = getMousePos(sigPad, e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); });
  sigPad.addEventListener('touchmove', (e) => { e.preventDefault(); if (!isDrawing) return; const pos = getMousePos(sigPad, e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }, {passive: false});
  window.addEventListener('mouseup', () => isDrawing = false);
  window.addEventListener('touchend', () => isDrawing = false);

  // ═══════════════════ INSERT SIGNATURE ═══════════════════
  document.getElementById('save-sign-btn').addEventListener('click', () => {
    let finalDataURL = null;
    let isDrawingTab = tabDraw.classList.contains('active');

    if (isDrawingTab) {
      // Check if empty
      const blank = document.createElement('canvas');
      blank.width = sigPad.width; blank.height = sigPad.height;
      if (sigPad.toDataURL() === blank.toDataURL()) {
        alert("Please draw a signature first.");
        return;
      }
      finalDataURL = sigPad.toDataURL('image/png');
    } else {
      if (!uploadedSigDataURL) {
        alert("Please upload a signature image first.");
        return;
      }
      finalDataURL = uploadedSigDataURL;
    }

    signModal.classList.remove('active');

    // Add to Page 1 view by default
    const page1 = document.querySelector('.pdf-page[data-page-num="1"]');
    if (!page1) return;

    const signDiv = document.createElement('div');
    signDiv.className = 'signature-element';
    signDiv.style.left = '50px';
    signDiv.style.top = '100px';
    signDiv.style.width = '150px'; // default start width
    signDiv.style.height = 'auto'; // maintain aspect ratio based on img

    const img = document.createElement('img');
    img.src = finalDataURL;
    img.style.width = '100%';
    img.style.height = '100%';
    
    // Controls
    const btn = document.createElement('button');
    btn.className = 'remove-element-btn';
    btn.innerHTML = '<i data-lucide="x"></i>';
    btn.addEventListener('mousedown', (e) => { e.stopPropagation(); signDiv.remove(); activeElement = null; });
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    signDiv.appendChild(img);
    signDiv.appendChild(btn);
    signDiv.appendChild(resizeHandle);
    page1.appendChild(signDiv);
    
    makeDraggable(signDiv);
    makeResizable(signDiv, resizeHandle, img);
    if (window.lucide) lucide.createIcons({root: signDiv});
    
    clearSelection();
    activeElement = signDiv;
    signDiv.classList.add('selected');
  });

  // ═══════════════════ DRAG LOGIC ═══════════════════
  function makeDraggable(el) {
    let startX, startY, initialX, initialY;
    el.addEventListener('mousedown', dragStart);
    el.addEventListener('touchstart', dragStart, {passive: true});

    function dragStart(e) {
      if (e.target.closest('.remove-element-btn') || e.target.closest('.resize-handle')) return;
      clearSelection();
      activeElement = el;
      el.classList.add('selected');

      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

      startX = clientX; startY = clientY;
      initialX = parseFloat(el.style.left || 0);
      initialY = parseFloat(el.style.top || 0);

      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);
      document.addEventListener('touchmove', drag, {passive: false});
      document.addEventListener('touchend', dragEnd);
    }

    function drag(e) {
      e.preventDefault();
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      const dx = (clientX - startX) / scale;
      const dy = (clientY - startY) / scale;
      el.style.left = `${initialX + dx}px`;
      el.style.top = `${initialY + dy}px`;
    }

    function dragEnd() {
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('touchend', dragEnd);
    }
  }

  // ═══════════════════ RESIZE LOGIC ═══════════════════
  function makeResizable(el, handle, img) {
    let startX, startY, initialWidth, initialHeight;
    handle.addEventListener('mousedown', resizeStart);
    handle.addEventListener('touchstart', resizeStart, {passive: true});

    function resizeStart(e) {
      e.stopPropagation();
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      startX = clientX; startY = clientY;
      initialWidth = el.clientWidth;
      initialHeight = el.clientHeight;

      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', resizeEnd);
      document.addEventListener('touchmove', resize, {passive: false});
      document.addEventListener('touchend', resizeEnd);
    }

    function resize(e) {
      e.preventDefault();
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      // We only care about X to maintain aspect ratio proportionally
      const dx = (clientX - startX) / scale;
      
      const newWidth = Math.max(50, initialWidth + dx); // min width 50px
      const ratio = newWidth / initialWidth;
      
      el.style.width = `${newWidth}px`;
      el.style.height = `${initialHeight * ratio}px`;
    }

    function resizeEnd() {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', resizeEnd);
      document.removeEventListener('touchmove', resize);
      document.removeEventListener('touchend', resizeEnd);
    }
  }

  // ═══════════════════ SAVE PDF (ZERO QUALITY LOSS) ═══════════════════
  savePdfBtn.addEventListener('click', async () => {
    clearSelection();
    
    // We must measure all elements BEFORE hiding the editor
    // because display:none makes clientWidth and clientHeight equal 0!
    const pageData = [];
    const uiPages = document.querySelectorAll('.pdf-page');
    for (let i = 0; i < uiPages.length; i++) {
      const uiPage = uiPages[i];
      const pData = {
        uiWidth: parseFloat(uiPage.style.width),
        uiHeight: parseFloat(uiPage.style.height),
        signsData: []
      };
      
      const signs = uiPage.querySelectorAll('.signature-element');
      for (const sign of signs) {
        const imgEl = sign.querySelector('img');
        if (!imgEl) continue;
        pData.signsData.push({
          src: imgEl.src,
          left: parseFloat(sign.style.left) || 0,
          top: parseFloat(sign.style.top) || 0,
          width: sign.clientWidth,
          height: sign.clientHeight
        });
      }
      pageData.push(pData);
    }

    pdfEditor.style.display = 'none';
    processingPanel.classList.add('active');

    try {
      // Load ORIGINAL document directly. This guarantees 100% of the original vector quality is retained!
      const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();

      for (let i = 0; i < pageData.length; i++) {
        const pData = pageData[i];
        const pdfPage = pages[i];
        const pdfWidth = pdfPage.getWidth();
        const pdfHeight = pdfPage.getHeight();

        const ratioX = pdfWidth / pData.uiWidth;
        const ratioY = pdfHeight / pData.uiHeight;

        for (const sign of pData.signsData) {
          const pdfX = sign.left * ratioX;
          const pdfY = pdfHeight - ((sign.top + sign.height) * ratioY); // pdf-lib origin is bottom-left
          const pdfImgWidth = sign.width * ratioX;
          const pdfImgHeight = sign.height * ratioY;

          const imgBytes = await fetch(sign.src).then(res => res.arrayBuffer());
          
          let embeddedImg;
          // Handle both PNG (drawn) and JPEG (uploaded)
          if (sign.src.startsWith('data:image/jpeg')) {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          } else {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          }

          pdfPage.drawImage(embeddedImg, {
            x: pdfX,
            y: pdfY,
            width: pdfImgWidth,
            height: pdfImgHeight,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `signed-${currentFile.name}`;
      a.click();

      processingPanel.classList.remove('active');
      pdfEditor.style.display = 'flex';

    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to export PDF.");
      processingPanel.classList.remove('active');
      pdfEditor.style.display = 'flex';
    }
  });

  // ═══════════════════ RESPONSIVE RESIZE ═══════════════════
  let resizeTimeout;
  window.addEventListener("resize", () => {
    if (!pdfDocument) return;
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Clear container and re-render to recalculate scale for new width
      pdfPagesWrapper.innerHTML = '';
      renderAllPages();
    }, 300); // Debounce to prevent lag
  });

});
