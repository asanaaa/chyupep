import cv2
from ultralytics import YOLO
import numpy as np
import time

def load_model(model_path: str = 'yolo11n-seg.pt'):
    """Загружает модель YOLO для сегментации."""
    return YOLO(model_path)

def load_background(background_path: str = 'background.png'):
    """Загружает фоновое изображение или создаёт чёрный фон."""
    background = cv2.imread(background_path)
    if background is None:
        print("Используется чёрный фон. Загрузите background.png для кастомного фона")
        return np.zeros((480, 640, 3), dtype=np.uint8)
    print("Фон успешно загружен")
    return background

def initialize_camera(camera_index: int = 0):
    """Инициализирует захват видео с камеры."""
    return cv2.VideoCapture(camera_index)

def process_frame(
    frame: np.ndarray,
    model,
    background: np.ndarray,
    prev_mask: np.ndarray = None,
    conf_threshold: float = 0.5,
    mask_smoothing_alpha: float = 0.7
) -> tuple[np.ndarray, np.ndarray]:
    """
    Обрабатывает кадр: выполняет сегментацию, создаёт маску, накладывает фон.
    Возвращает финальный кадр и обновлённую маску.
    """
    h, w = frame.shape[:2]
    background_resized = cv2.resize(background, (w, h)) if background.shape[:2] != (h, w) else background

    # Сегментация
    results = model(frame, verbose=False, conf=conf_threshold)
    human_mask = create_human_mask(results, h, w)

    # Морфологические операции
    human_mask = apply_morphological_operations(human_mask)

    # Временная согласованность масок
    if prev_mask is not None:
        human_mask = mask_smoothing_alpha * human_mask + (1 - mask_smoothing_alpha) * prev_mask

    # Создание финального кадра
    final_frame = blend_frames(frame, background_resized, human_mask)

    return final_frame, human_mask

def create_human_mask(results, h: int, w: int) -> np.ndarray:
    """Создаёт маску для класса 'person'."""
    human_mask = np.zeros((h, w), dtype=np.uint8)
    for result in results:
        if result.masks is not None:
            masks = result.masks.data.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy()
            for mask, cls in zip(masks, classes):
                if cls == 0:  # Класс 'person' в COCO
                    mask_resized = cv2.resize(mask, (w, h))
                    human_mask = np.logical_or(human_mask, mask_resized > 0.3)
    return human_mask.astype(np.uint8) * 255

def apply_morphological_operations(mask: np.ndarray) -> np.ndarray:
    """Применяет морфологические операции для улучшения маски."""
    kernel_close = np.ones((5, 5), np.uint8)
    kernel_erode = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
    mask = cv2.morphologyEx(mask, cv2.MORPH_ERODE, kernel_erode)
    mask = cv2.GaussianBlur(mask, (7, 7), 2)
    return mask.astype(float) / 255.0

def blend_frames(foreground: np.ndarray, background: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Накладывает фон на передний план с использованием маски."""
    mask_3ch = np.stack([mask] * 3, axis=-1)
    foreground_part = foreground * mask_3ch
    background_part = background * (1 - mask_3ch)
    return (foreground_part + background_part).astype(np.uint8)

def calculate_fps(frame_count: int, start_time: float) -> float:
    """Вычисляет FPS."""
    return frame_count / (time.time() - start_time)

def main():
    model = load_model()
    background = load_background()
    cap = initialize_camera()

    frame_count = 0
    start_time = time.time()
    prev_mask = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        final_frame, prev_mask = process_frame(frame, model, background, prev_mask)

        # Отображение FPS каждые 30 кадров
        frame_count += 1
        if frame_count % 30 == 0:
            fps = calculate_fps(frame_count, start_time)
            print(f"FPS: {fps:.1f}, Время на кадр: {1000/fps:.1f}ms")

        # Отображение результата
        cv2.imshow('Background Replacement', final_frame)
        cv2.imshow('Human Mask', (prev_mask * 255).astype(np.uint8))

        # Выход по нажатию 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
