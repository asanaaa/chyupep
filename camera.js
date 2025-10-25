console.log("camera.js loaded: BodyPix with WebGL + soft mask");

const cameraButton = document.getElementById("camera_turn");
const cameraVideo = document.getElementById("cameraVideo");
const canvasElement = document.getElementById("overlay");
const canvasCtx = canvasElement.getContext("2d");

let isCameraOn = false;
let net = null;
let stream = null;

// === СТАТИСТИКА ===
const stats = {
  fps: 0,
  frameCount: 0,
  lastTime: performance.now(),
  processingTime: 0,
  memory: 0
};

function createDebugOverlay() {
  const div = document.createElement("div");
  div.id = "debug-stats";
  div.className = "debug-overlay";
  document.body.appendChild(div);
  return div;
}
const statsOverlay = createDebugOverlay();

function updateStats() {
  stats.frameCount++;
  const now = performance.now();
  const delta = now - stats.lastTime;

  if (delta >= 1000) {
    stats.fps = Math.round((stats.frameCount * 1000) / delta);
    stats.frameCount = 0;
    stats.lastTime = now;

    if (performance.memory) stats.memory = Math.round(performance.memory.usedJSHeapSize / 1048576);

    statsOverlay.innerHTML = `
      FPS: ${stats.fps}<br>
      Обработка: ${stats.processingTime.toFixed(1)}ms<br>
      Память: ${stats.memory}MB<br>
      Разрешение: ${canvasElement.width}x${canvasElement.height}
    `;
  }

  if (isCameraOn) requestAnimationFrame(updateStats);
}

// === GLOBALS ===
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");
let mask = null;
let frameCounter = 0;
const maskUpdateInterval = 3; // обновляем маску раз в 3 кадра

// === Soft mask processing (dilate + blur) ===
function processMaskWithSoftEdges(maskImageData, blurRadius = 4) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = maskCanvas.width;
  tempCanvas.height = maskCanvas.height;
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.putImageData(maskImageData, 0, 0);

  // Простая дилатация
  tempCtx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 2; i++) {
    tempCtx.drawImage(tempCanvas, -1, 0);
    tempCtx.drawImage(tempCanvas, 1, 0);
    tempCtx.drawImage(tempCanvas, 0, -1);
    tempCtx.drawImage(tempCanvas, 0, 1);
  }

  // Размытие для плавного перехода
  tempCtx.filter = `blur(${blurRadius}px)`;
  tempCtx.drawImage(tempCanvas, 0, 0);
  tempCtx.filter = "none";

  return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
}

// === FRAME PROCESSING ===
async function processFrame() {
  if (!isCameraOn || !net) return;

  const startTime = performance.now();
  frameCounter++;

  // --- обновление маски раз в maskUpdateInterval кадров ---
  if (frameCounter % maskUpdateInterval === 0) {
    const segmentation = await net.segmentPerson(cameraVideo, {
      internalResolution: "medium",
      segmentationThreshold: 0.8,
      refineEdges: true
    });

    // Маска: человек — непрозрачный, фон — прозрачный
    mask = bodyPix.toMask(
      segmentation,
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 0, g: 0, b: 0, a: 0 },
      true
    );

    // Плавные края + дилатация
    mask = processMaskWithSoftEdges(mask, 4);
  }

  // --- Рисуем видео каждый кадр ---
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(cameraVideo, 0, 0, canvasElement.width, canvasElement.height);

  // --- Применяем последнюю маску ---
  if (mask) {
    maskCanvas.width = canvasElement.width;
    maskCanvas.height = canvasElement.height;
    maskCtx.putImageData(mask, 0, 0);

    canvasCtx.save();
    canvasCtx.globalCompositeOperation = "destination-in";
    canvasCtx.drawImage(maskCanvas, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();
  }

  stats.processingTime = performance.now() - startTime;

  if (isCameraOn) requestAnimationFrame(processFrame);
}

// === CAMERA START ===
async function startCamera() {
  if (isCameraOn) return;

  // Включаем WebGL backend
  await tf.setBackend("webgl");
  await tf.ready();

  if (!net) {
    statsOverlay.innerHTML = "Загрузка модели BodyPix...";
    net = await bodyPix.load({
      architecture: "MobileNetV1",
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2
    });
    statsOverlay.innerHTML = "Модель загружена ✅";
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false
    });
    cameraVideo.srcObject = stream;

    await new Promise(resolve => cameraVideo.onloadeddata = resolve);
    await cameraVideo.play();

    canvasElement.width = 1280;
    canvasElement.height = 720;
    canvasElement.style.display = "block";

    isCameraOn = true;
    cameraButton.textContent = "⏹️ Выключить камеру";

    updateStats();
    processFrame();
  } catch (error) {
    console.error("Ошибка запуска камеры:", error);
    alert("Не удалось запустить камеру. Проверьте разрешения.");
  }
}

// === CAMERA STOP ===
function stopCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;

  isCameraOn = false;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasElement.style.display = "none";
  cameraButton.textContent = "📷 Включить камеру";
  statsOverlay.innerHTML = "Камера выключена";
}

// === EVENTS ===
cameraButton.addEventListener("click", () => {
  if (isCameraOn) stopCamera();
  else startCamera();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && isCameraOn) stopCamera();
});

window.addEventListener("beforeunload", () => {
  if (isCameraOn) stopCamera();
});
