from ultralytics import YOLO

model = YOLO("yolo11n-seg.pt")  # загружаем модель
model.export(format="onnx") 