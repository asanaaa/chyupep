const cameraButton = document.getElementById('camera_turn');
const cameraVideo = document.getElementById('cameraVideo');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

const selfieSegmentation = new SelfieSegmentation({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});

selfieSegmentation.setOptions({
  modelSelection: 1 // 0 = general, 1 = landscape
});

selfieSegmentation.onResults(onResults);

function onResults(results) {
  const canvasWidth = canvasElement.width;
  const canvasHeight = canvasElement.height;
  canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Нарисовать видео человека на canvas
  canvasCtx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);

  // Применить маску, чтобы фон стал прозрачным
  const mask = results.segmentationMask;

  // Создадим временный canvas для маски
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.drawImage(mask, 0, 0);

  const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = maskData.data;

  // Проходим по всем пикселям и делаем фон прозрачным
  for (let i = 0; i < data.length; i += 4) {
    // Альфа = 255 * маска (белое = человек, черное = фон)
    data[i + 3] = data[i]; // берем значение R (маска серого) как альфу
  }
  maskCtx.putImageData(maskData, 0, 0);

  // Накладываем маску на оригинальное изображение
  canvasCtx.globalCompositeOperation = 'destination-in';
  canvasCtx.drawImage(maskCanvas, 0, 0, canvasWidth, canvasHeight);

  // Вернуть обычный режим рисования для будущих операций
  canvasCtx.globalCompositeOperation = 'source-over';
}

const camera = new Camera(cameraVideo, {
  onFrame: async () => {
    await selfieSegmentation.send({ image: cameraVideo });
  },
  width: 640,
  height: 480
});

camera.start();