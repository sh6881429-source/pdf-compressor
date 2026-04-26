/* ═══════════════════ MERGE PDF JS ═══════════════════ */
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
  let loadedPDFs = {}; // Stores { id: { file, pdfjsDoc, pdflibDoc, name } }
  let docCounter = 0;
  let finalMergedBlob = null;

  const initialUploadZone = document.getElementById('initial-upload-zone');
  const initialFileInput = document.getElementById('initial-file-input');
  
  const mergeEditor = document.getElementById('merge-editor');
  const pagesGrid = document.getElementById('pages-grid');
  const totalPagesBadge = document.getElementById('total-pages-badge');
  const addMoreInput = document.getElementById('add-more-input');
  const mergeBtn = document.getElementById('merge-btn');

  const processingPanel = document.getElementById('processing-panel');
  const processingDesc = document.getElementById('processing-desc');
  const progressBar = document.getElementById('progress-bar');
  
  const toolPanel = document.getElementById('tool-panel');

  // Initialize SortableJS for drag and drop
  let sortable = new Sortable(pagesGrid, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    delay: window.innerWidth < 768 ? 200 : 0, // Delay on mobile to allow scrolling
    delayOnTouchOnly: true
  });

  // ═══════════════════ UPLOAD & LOAD PDFS ═══════════════════
  // Initial Upload
  ['dragenter', 'dragover'].forEach(e => initialUploadZone.addEventListener(e, ev => { ev.preventDefault(); initialUploadZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(e => initialUploadZone.addEventListener(e, ev => { ev.preventDefault(); initialUploadZone.classList.remove('dragover'); }));
  
  initialUploadZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  initialFileInput.addEventListener('change', e => handleFiles(e.target.files));
  
  // Add More Upload
  addMoreInput.addEventListener('change', e => handleFiles(e.target.files));

  async function handleFiles(files) {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      alert('Please select valid PDF files.');
      return;
    }

    // Switch UI if first time
    if (initialUploadZone.style.display !== 'none') {
      initialUploadZone.style.display = 'none';
      mergeEditor.style.display = 'block';
    }

    // Process each PDF file
    for (const file of pdfFiles) {
      const docId = `doc_${++docCounter}`;
      const shortName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // 1. Load via PDF.js for rendering thumbnails
        // Use a copy to prevent Web Worker transfer issues
        const loadTask = pdfjsLib.getDocument({ data: uint8Array.slice() });
        const pdfjsDoc = await loadTask.promise;
        const numPages = pdfjsDoc.numPages;

        // 2. Load via pdf-lib for eventual merging
        const pdflibDoc = await PDFLib.PDFDocument.load(uint8Array);

        loadedPDFs[docId] = { file, pdfjsDoc, pdflibDoc, name: shortName };

        // 3. Render thumbnails to grid
        for (let i = 1; i <= numPages; i++) {
          createPageThumbnail(docId, i, pdfjsDoc, shortName);
        }

        updatePageCount();

      } catch (err) {
        console.error(`Failed to load ${file.name}:`, err);
        alert(`Failed to load ${file.name}. It might be encrypted or corrupted.`);
      }
    }
    
    // Clear inputs
    initialFileInput.value = '';
    addMoreInput.value = '';
  }

  // ═══════════════════ RENDER THUMBNAILS ═══════════════════
  async function createPageThumbnail(docId, pageNum, pdfjsDoc, docName) {
    // Create HTML structure
    const item = document.createElement('div');
    item.className = 'page-item';
    item.dataset.docId = docId;
    item.dataset.pageNum = pageNum; // 1-indexed

    item.innerHTML = `
      <button class="page-remove-btn" title="Remove page" aria-label="Remove page">
        <i data-lucide="trash-2"></i>
      </button>
      <div class="page-canvas-wrapper">
        <div class="page-loading-spinner"></div>
        <canvas style="display:none;"></canvas>
      </div>
      <div class="page-info">
        <div class="page-num">Page ${pageNum}</div>
        <div class="page-doc" title="${docName}">${docName}</div>
      </div>
    `;

    pagesGrid.appendChild(item);
    if (window.lucide) lucide.createIcons({ root: item });

    // Handle Delete
    item.querySelector('.page-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      item.remove();
      updatePageCount();
    });

    // Render Canvas via PDF.js
    try {
      const page = await pdfjsDoc.getPage(pageNum);
      // We want a low-res thumbnail for speed
      const viewport = page.getViewport({ scale: 0.5 });
      
      const canvas = item.querySelector('canvas');
      const spinner = item.querySelector('.page-loading-spinner');
      const ctx = canvas.getContext('2d');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
      
      spinner.style.display = 'none';
      canvas.style.display = 'block';

    } catch (err) {
      console.error('Render error:', err);
      item.querySelector('.page-loading-spinner').style.display = 'none';
    }
  }

  function updatePageCount() {
    const count = pagesGrid.querySelectorAll('.page-item').length;
    totalPagesBadge.textContent = `${count} Page${count !== 1 ? 's' : ''}`;
  }

  // ═══════════════════ MERGE EXECUTION ═══════════════════
  mergeBtn.addEventListener('click', async () => {
    const items = Array.from(pagesGrid.querySelectorAll('.page-item'));
    if (items.length === 0) {
      alert("No pages to merge! Please add some PDFs.");
      return;
    }

    mergeEditor.style.display = 'none';
    processingPanel.classList.add('active');
    
    try {
      // Create a brand new PDF document
      const mergedPdf = await PDFLib.PDFDocument.create();
      let processedCount = 0;
      
      processingDesc.textContent = `Merging 0 of ${items.length} pages...`;
      progressBar.parentElement.style.display = 'block';
      progressBar.style.width = '0%';

      for (const item of items) {
        const docId = item.dataset.docId;
        const pageNum = parseInt(item.dataset.pageNum, 10); // 1-indexed

        const sourcePdf = loadedPDFs[docId].pdflibDoc;
        
        // Copy the specific page (pdf-lib is 0-indexed)
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageNum - 1]);
        mergedPdf.addPage(copiedPage);

        processedCount++;
        const percent = Math.round((processedCount / items.length) * 100);
        
        processingDesc.textContent = `Merging ${processedCount} of ${items.length} pages...`;
        progressBar.style.width = percent + '%';
        
        // Small delay to let UI update
        if (processedCount % 5 === 0) await new Promise(r => setTimeout(r, 10));
      }

      processingDesc.textContent = `Saving final document...`;
      const pdfBytes = await mergedPdf.save();
      finalMergedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Show Result
      processingPanel.classList.remove('active');
      toolPanel.style.display = 'block';
      toolPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (err) {
      console.error("Merge failed:", err);
      alert("An error occurred while merging. One of the documents might be restricted.");
      
      processingPanel.classList.remove('active');
      mergeEditor.style.display = 'block';
    }
  });

  // ═══════════════════ DOWNLOAD & RESET ═══════════════════
  document.getElementById('download-btn').addEventListener('click', () => {
    if (!finalMergedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(finalMergedBlob);
    a.download = `merged-document-${Date.now()}.pdf`;
    a.click();
  });

  document.getElementById('reset-tool-btn').addEventListener('click', () => {
    loadedPDFs = {};
    docCounter = 0;
    finalMergedBlob = null;
    pagesGrid.innerHTML = '';
    updatePageCount();
    
    toolPanel.style.display = 'none';
    initialUploadZone.style.display = '';
    
    window.scrollTo({ top: initialUploadZone.offsetTop - 100, behavior: 'smooth' });
  });

});
