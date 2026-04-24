document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('photo-canvas');
    const captureBtn = document.getElementById('capture-btn');
    const downloadLastBtn = document.getElementById('download-last-btn');
    const clearGalleryBtn = document.getElementById('clear-gallery-btn');
    const clearStickersBtn = document.getElementById('clear-stickers-btn');
    const gallery = document.getElementById('gallery');
    const flashOverlay = document.getElementById('flash-overlay');
    const viewfinder = document.getElementById('viewfinder');
    const stickerContainer = document.getElementById('sticker-container');
    const countdownDisplay = document.getElementById('countdown-display');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const drawCtx = drawingCanvas.getContext('2d');
    const brushColorOpts = document.querySelectorAll('#brush-color-selector .color-opt');
    const brushSizeInput = document.getElementById('brush-size');
    const clearDrawBtn = document.getElementById('clear-draw-btn');
    const brushCursor = document.getElementById('brush-cursor');
    
    const filterOptions = document.querySelectorAll('.filter-option');
    const orientationBtns = document.querySelectorAll('.orientation-btn');
    const stickerOptions = document.querySelectorAll('.sticker-opt');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const colorOpts = document.querySelectorAll('.color-opt');
    
    let currentFilter = 'none';
    let currentOrientation = 'landscape';
    let currentMode = 'single';
    let currentStripColor = '#ffffff';
    let currentBrushColor = '#ff0000';
    let currentBrushSize = 5;
    let stickers = [];
    let lastPhotoDataUrl = null;
    let isCapturing = false;
    let isDrawing = false;

    // 1. Initialize Camera & Drawing Canvas
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
                audio: false 
            });
            video.srcObject = stream;
            resizeDrawingCanvas();
        } catch (err) {
            console.error("Camera error: ", err);
            alert("無法存取攝影機！");
        }
    }

    function resizeDrawingCanvas() {
        const rect = viewfinder.getBoundingClientRect();
        drawingCanvas.width = rect.width;
        drawingCanvas.height = rect.height;
        // Restore context settings after resize
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
    }

    window.addEventListener('resize', resizeDrawingCanvas);

    // Drawing Logic
    function updateBrushCursor(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = viewfinder.getBoundingClientRect();
        
        // Only show if inside viewfinder
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            brushCursor.style.display = 'block';
            brushCursor.style.left = `${clientX - rect.left}px`;
            brushCursor.style.top = `${clientY - rect.top}px`;
            brushCursor.style.width = `${currentBrushSize}px`;
            brushCursor.style.height = `${currentBrushSize}px`;
            brushCursor.style.backgroundColor = currentBrushColor;
        } else {
            brushCursor.style.display = 'none';
        }
    }

    function startDrawing(e) {
        isDrawing = true;
        const pos = getMousePos(e);
        drawCtx.beginPath();
        drawCtx.strokeStyle = currentBrushColor;
        drawCtx.lineWidth = currentBrushSize;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        drawCtx.moveTo(pos.x, pos.y);
        // Draw a small dot immediately on click
        drawCtx.lineTo(pos.x, pos.y);
        drawCtx.stroke();
        updateBrushCursor(e);
    }

    function draw(e) {
        updateBrushCursor(e);
        if (!isDrawing) return;
        const pos = getMousePos(e);
        drawCtx.strokeStyle = currentBrushColor;
        drawCtx.lineWidth = currentBrushSize;
        drawCtx.lineTo(pos.x, pos.y);
        drawCtx.stroke();
        e.preventDefault();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    function getMousePos(e) {
        const rect = drawingCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Calculate the scale between the canvas internal size and display size
        const scaleX = drawingCanvas.width / rect.width;
        const scaleY = drawingCanvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    viewfinder.addEventListener('mousemove', updateBrushCursor);
    viewfinder.addEventListener('mouseleave', () => brushCursor.style.display = 'none');
    window.addEventListener('mouseup', stopDrawing);
    
    drawingCanvas.addEventListener('touchstart', (e) => { startDrawing(e); e.preventDefault(); }, { passive: false });
    drawingCanvas.addEventListener('touchmove', (e) => { draw(e); e.preventDefault(); }, { passive: false });
    window.addEventListener('touchend', stopDrawing);

    brushColorOpts.forEach(opt => opt.addEventListener('click', () => {
        brushColorOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        currentBrushColor = opt.getAttribute('data-color');
    }));

    brushSizeInput.addEventListener('input', () => {
        currentBrushSize = brushSizeInput.value;
    });

    clearDrawBtn.addEventListener('click', () => {
        drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    });

    // 2. Toggles
    orientationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isCapturing) return;
            orientationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrientation = btn.getAttribute('data-orient');
            viewfinder.className = `viewfinder-wrapper ${currentOrientation}`;
            setTimeout(resizeDrawingCanvas, 100); // Wait for CSS transition
            clearStickers();
        });
    });

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isCapturing) return;
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.getAttribute('data-mode');
        });
    });

    // Color Selector Logic
    colorOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            colorOpts.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            currentStripColor = opt.getAttribute('data-color');
        });
    });

    // 3. Selectors
    filterOptions.forEach(opt => opt.addEventListener('click', () => {
        filterOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        currentFilter = opt.getAttribute('data-filter');
        video.style.filter = currentFilter;
    }));

    stickerOptions.forEach(opt => opt.addEventListener('click', () => addSticker(opt.getAttribute('data-sticker'))));

    // 4. Capture Logic
    captureBtn.addEventListener('click', async () => {
        if (isCapturing) return;
        isCapturing = true;
        captureBtn.disabled = true;

        if (currentMode === 'single') {
            await runCaptureSequence(1);
        } else {
            await runCaptureSequence(3);
        }

        isCapturing = false;
        captureBtn.disabled = false;
    });

    async function runCaptureSequence(count) {
        const frames = [];
        
        for (let i = 0; i < count; i++) {
            for (let c = 3; c > 0; c--) {
                countdownDisplay.innerText = c;
                countdownDisplay.classList.add('visible');
                await new Promise(r => setTimeout(r, 800));
                countdownDisplay.classList.remove('visible');
                await new Promise(r => setTimeout(r, 200));
            }

            const frameData = await captureFrameToCanvas();
            frames.push(frameData);
            
            flashOverlay.classList.remove('active');
            void flashOverlay.offsetWidth;
            flashOverlay.classList.add('active');

            if (i < count - 1) await new Promise(r => setTimeout(r, 1000));
        }

        if (count > 1) {
            const collageUrl = await createCollage(frames);
            lastPhotoDataUrl = collageUrl;
            addPhotoToGallery(collageUrl, 'strip');
        } else {
            lastPhotoDataUrl = frames[0];
            addPhotoToGallery(frames[0], currentOrientation);
        }
    }

    async function captureFrameToCanvas() {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const w = currentOrientation === 'landscape' ? 1280 : 960;
        const h = currentOrientation === 'landscape' ? 960 : 1280;
        tempCanvas.width = w; tempCanvas.height = h;

        // Draw Video
        ctx.save();
        ctx.translate(w, 0); ctx.scale(-1, 1);
        ctx.filter = currentFilter;
        const vW = video.videoWidth, vH = video.videoHeight;
        const tA = w / h, vA = vW / vH;
        let dW, dH, oX, oY;
        if (vA > tA) { dH = vH; dW = vH * tA; oX = (vW - dW) / 2; oY = 0; }
        else { dW = vW; dH = vW / tA; oX = 0; oY = (vH - dH) / 2; }
        ctx.drawImage(video, oX, oY, dW, dH, 0, 0, w, h);
        ctx.restore();

        // Draw Drawing Canvas
        ctx.drawImage(drawingCanvas, 0, 0, drawingCanvas.width, drawingCanvas.height, 0, 0, w, h);

        // Draw Stickers
        ctx.font = `${w * 0.1}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        stickers.forEach(s => ctx.fillText(s.emoji, (s.x / 100) * w, (s.y / 100) * h));

        return tempCanvas.toDataURL('image/png');
    }

    async function createCollage(frames) {
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');
        const imgObjs = await Promise.all(frames.map(src => new Promise(res => {
            const img = new Image(); img.onload = () => res(img); img.src = src;
        })));

        const fW = imgObjs[0].width;
        const fH = imgObjs[0].height;
        const padding = fW * 0.05;
        
        finalCanvas.width = fW + (padding * 2);
        finalCanvas.height = (fH * 3) + (padding * 4);
        
        // Use the selected strip color!
        ctx.fillStyle = currentStripColor;
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        imgObjs.forEach((img, i) => {
            ctx.drawImage(img, padding, padding + (i * (fH + padding)), fW, fH);
        });

        return finalCanvas.toDataURL('image/png');
    }

    // 5. Stickers
    function addSticker(emoji) {
        const id = Date.now();
        const el = document.createElement('div');
        el.className = 'placed-sticker'; el.innerText = emoji;
        el.style.left = '50%'; el.style.top = '50%'; el.style.transform = 'translate(-50%, -50%)';
        stickerContainer.appendChild(el);
        const obj = { id, emoji, x: 50, y: 50, el };
        stickers.push(obj);
        makeDraggable(el, obj);
    }

    function makeDraggable(el, obj) {
        let isD = false, sX, sY;
        const start = e => {
            isD = true; const ev = e.type === 'touchstart' ? e.touches[0] : e;
            sX = ev.clientX; sY = ev.clientY;
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
            document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', end);
            e.preventDefault();
        };
        const move = e => {
            if (!isD) return; const ev = e.type === 'touchmove' ? e.touches[0] : e;
            const r = viewfinder.getBoundingClientRect();
            obj.x += ((ev.clientX - sX) / r.width) * 100;
            obj.y += ((ev.clientY - sY) / r.height) * 100;
            obj.x = Math.max(0, Math.min(100, obj.x)); obj.y = Math.max(0, Math.min(100, obj.y));
            el.style.left = `${obj.x}%`; el.style.top = `${obj.y}%`;
            sX = ev.clientX; sY = ev.clientY; e.preventDefault();
        };
        const end = () => { isD = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', end); };
        el.addEventListener('mousedown', start); el.addEventListener('touchstart', start, { passive: false });
        el.addEventListener('dblclick', () => { el.remove(); stickers = stickers.filter(s => s.id !== obj.id); });
    }

    function clearStickers() { stickerContainer.innerHTML = ''; stickers = []; }
    clearStickersBtn.addEventListener('click', clearStickers);

    // 6. Gallery / Download
    downloadLastBtn.addEventListener('click', () => {
        if (!lastPhotoDataUrl) return alert('請先拍照！');
        const l = document.createElement('a'); l.href = lastPhotoDataUrl; l.download = `booth-${Date.now()}.png`; l.click();
    });

    function addPhotoToGallery(src, mode) {
        const card = document.createElement('div');
        card.className = `photo-card ${mode}`;
        const img = document.createElement('img'); img.src = src;
        const over = document.createElement('div'); over.className = 'photo-overlay';
        const dl = document.createElement('a'); dl.href = src; dl.download = `booth-${Date.now()}.png`; dl.className = 'download-btn'; dl.innerHTML = '<span>💾 下載</span>';
        over.appendChild(dl); card.appendChild(img); card.appendChild(over);
        gallery.insertBefore(card, gallery.firstChild);
    }

    clearGalleryBtn.addEventListener('click', () => { if (confirm('清空相簿？')) gallery.innerHTML = ''; });
    initCamera();
});
