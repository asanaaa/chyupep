const cameraButton = document.getElementById('camera_turn');
const cameraVideo = document.getElementById('cameraVideo');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d')

let session;
let running = false;

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

async function loadModel() {
    const response = await fetch('yolo11n-seg.onnx');
    const arrayBuffer = await response.arrayBuffer();
    session = await ort.InferenceSession.create(arrayBuffer);
    console.log('Модель загружена');
}

function buildMaskFromProto(maskProtoTensor, coeffs, thresh = 0.5) {
  const protoDims = maskProtoTensor.dims; // [1, C, H, W]
  const protoData = maskProtoTensor.data;
  const C = protoDims[1];
  const H = protoDims[2];
  const W = protoDims[3];
  const HW = H * W;

  // Итоговый массив накопления
  const accum = new Float32Array(HW);

  // coeffs length должен быть C
  for (let c = 0; c < C; c++) {
    const coef = coeffs[c];
    const baseIdx = c * HW; // если protoData упорядочен [C, H, W]
    if (coef === 0) continue;
    for (let i = 0; i < HW; i++) {
      accum[i] += protoData[baseIdx + i] * coef;
    }
  }

  // Применяем sigmoid и порог
  const mask = new Uint8ClampedArray(HW);
  for (let i = 0; i < HW; i++) {
    const p = sigmoid(accum[i]);
    mask[i] = p > thresh ? 1 : 0;
  }

  return { mask, H, W };
}

function preprocessImage(img) {
    const size = 640;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const floatData = new Float32Array(3 * size * size);

    for (let i = 0; i < size * size; i++) {
        floatData[i] = data[i * 4] / 255.0;        // R
        floatData[i + size*size] = data[i * 4 + 1] / 255.0; // G
        floatData[i + 2*size*size] = data[i * 4 + 2] / 255.0; // B
    }

    return new ort.Tensor('float32', floatData, [1, 3, size, size]);
}

function drawMask(maskProtoTensor) {
    const H = 160, W = 160;
    const targetSize = 640; // исходный фрейм
    const classId = 0; // например, person
    const mask = new Float32Array(H*W);

    for(let y=0; y<H; y++){
        for(let x=0; x<W; x++){
            const idx = classId*H*W + y*W + x;
            mask[y*W + x] = 1 / (1 + Math.exp(-maskProtoTensor.cpuData[idx])); // sigmoid
        }
    }

    const imgData = ctx.createImageData(W,H);
    for(let i=0;i<W*H;i++){
        const v = Math.round(mask[i]*255);
        imgData.data[i*4+0] = 0;   // R
        imgData.data[i*4+1] = v;   // G (зелёный)
        imgData.data[i*4+2] = 0;   // B
        imgData.data[i*4+3] = v;   // alpha
    }

    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    off.getContext('2d').putImageData(imgData,0,0);

    ctx.drawImage(off, 0, 0, targetSize, targetSize);
}

async function processFrame() {
  if (!running) return;

  const inputTensor = preprocessImage(cameraVideo);
  const feeds = { images: inputTensor }; 
  const results = await session.run(feeds);

  const detectionTensor = results['output0']; // [1, channels, numBoxes]
  
  const maskProtoTensor = results['output1']; // [1, C, H, W]
  console.log(maskProtoTensor.cpuData)

  drawMask(maskProtoTensor)

  requestAnimationFrame(processFrame);
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraVideo.srcObject = stream;
        await cameraVideo.play();

        overlay.width = cameraVideo.videoWidth;
        overlay.height = cameraVideo.videoHeight;

        running = true;
        processFrame();
    } catch (err) {
        console.error('Не удалось получить доступ к камере', err);
        alert('Не удалось получить доступ к камере.');
    }
}

cameraButton.addEventListener('click', async () => {
    if (!session) await loadModel();
    startCamera();
});