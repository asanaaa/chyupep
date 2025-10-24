const cameraButton = document.getElementById('camera_turn');
const cameraVideo = document.getElementById('cameraVideo');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

let isCameraOn = false;
let camera = null;
let animationId = null;

// Статистика производительности
const stats = {
    fps: 0,
    frameCount: 0,
    lastTime: performance.now(),
    processingTime: 0,
    memory: 0
};

const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});

selfieSegmentation.setOptions({
    modelSelection: 1,
    smoothSegmentation: true,
    smoothness: 0.8,
});

selfieSegmentation.onResults(onResults);

// Создаем overlay для отладки
function createDebugOverlay() {
    const statsOverlay = document.createElement('div');
    statsOverlay.id = 'debug-stats';
    statsOverlay.className = 'debug-overlay';
    document.body.appendChild(statsOverlay);
    return statsOverlay;
}

const statsOverlay = createDebugOverlay();

// Обновление статистики
function updateStats() {
    stats.frameCount++;
    const currentTime = performance.now();
    const delta = currentTime - stats.lastTime;
    
    if (delta >= 1000) {
        stats.fps = Math.round((stats.frameCount * 1000) / delta);
        stats.frameCount = 0;
        stats.lastTime = currentTime;
        
        if (performance.memory) {
            stats.memory = Math.round(performance.memory.usedJSHeapSize / 1048576);
        }
        
        statsOverlay.innerHTML = `
            FPS: ${stats.fps}<br>
            Обработка: ${stats.processingTime.toFixed(1)}ms<br>
            Память: ${stats.memory}MB<br>
            Разрешение: ${canvasElement.width}x${canvasElement.height}
        `;
    }
    
    if (isCameraOn) {
        requestAnimationFrame(updateStats);
    }
}

function onResults(results) {
    if (!isCameraOn) return;
    
    const startTime = performance.now();
    const canvasWidth = canvasElement.width;
    const canvasHeight = canvasElement.height;
    
    canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    canvasCtx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasWidth;
    maskCanvas.height = canvasHeight;
    const maskCtx = maskCanvas.getContext('2d');
    
    maskCtx.drawImage(results.segmentationMask, 0, 0, canvasWidth, canvasHeight);

    const maskData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = maskData.data;

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i];
        let finalAlpha;
        
        if (alpha > 230) {
            finalAlpha = 255;
        } else if (alpha > 180) {
            finalAlpha = alpha;
        } else if (alpha > 120) {
            finalAlpha = Math.round(alpha * 0.7);
        } else if (alpha > 80) {
            finalAlpha = Math.round(alpha * 0.4);
        } else {
            finalAlpha = 0;
        }

        data[i + 3] = finalAlpha;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
    }
    
    maskCtx.putImageData(maskData, 0, 0);

    canvasCtx.save();
    canvasCtx.globalCompositeOperation = 'destination-in';
    canvasCtx.drawImage(maskCanvas, 0, 0, canvasWidth, canvasHeight);
    canvasCtx.restore();

    stats.processingTime = performance.now() - startTime;

    if (isCameraOn && camera) {
        cameraVideo.requestVideoFrameCallback(() => {
            selfieSegmentation.send({ image: cameraVideo });
        });
    }
}

function startCamera() {
    if (camera) return;
    
    camera = new Camera(cameraVideo, {
        onFrame: async () => {},
        width: 1280,
        height: 720
    });

    camera.start().then(() => {
        canvasElement.width = 1280;
        canvasElement.height = 720;
        
        canvasCtx.imageSmoothingEnabled = true;
        canvasCtx.imageSmoothingQuality = 'high';
        
        canvasElement.style.display = 'block';
        isCameraOn = true;
        cameraButton.textContent = '⏹️ Выключить камеру';
        
        updateStats();
        selfieSegmentation.send({ image: cameraVideo });
        
    }).catch(error => {
        console.error('Ошибка запуска камеры:', error);
        alert('Не удалось запустить камеру. Проверьте разрешения.');
    });
}

function stopCamera() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasElement.style.display = 'none';
    isCameraOn = false;
    cameraButton.textContent = '📷 Включить камеру';
    statsOverlay.innerHTML = 'Камера выключена';
}

// Обработчики событий
cameraButton.addEventListener('click', () => {
    if (isCameraOn) {
        stopCamera();
    } else {
        startCamera();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isCameraOn) {
        stopCamera();
    }
});

window.addEventListener('beforeunload', () => {
    if (isCameraOn) {
        stopCamera();
    }
});