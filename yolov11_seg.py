import cv2
from ultralytics import YOLO
import numpy as np
import time
from typing import Tuple, Optional, List
import threading
from collections import deque

def load_model(model_path: str = 'yolo11n-seg.pt') -> YOLO:
    """Загружает модель YOLO для сегментации."""
    try:
        model = YOLO(model_path)
        print(f"Модель {model_path} успешно загружена")
        return model
    except Exception as e:
        print(f"Ошибка загрузки модели: {e}")
        raise

def load_background(background_path: str = 'background.png', target_size: Tuple[int, int] = (640, 480)) -> np.ndarray:
    """Загружает фоновое изображение или создаёт чёрный фон."""
    try:
        background = cv2.imread(background_path)
        if background is None:
            print("Используется чёрный фон. Загрузите background.png для кастомного фона")
            background = np.zeros((target_size[1], target_size[0], 3), dtype=np.uint8)
        else:
            print("Фон успешно загружен")
            # Предварительно изменяем размер фона до целевого
            background = cv2.resize(background, target_size, interpolation=cv2.INTER_AREA)
        
        return background
    except Exception as e:
        print(f"Ошибка загрузки фона: {e}")
        return np.zeros((target_size[1], target_size[0], 3), dtype=np.uint8)

def initialize_camera(camera_index: int = 0, target_size: Tuple[int, int] = (640, 480)) -> cv2.VideoCapture:
    """Инициализирует захват видео с камеры."""
    cap = cv2.VideoCapture(camera_index)
    
    # Устанавливаем параметры камеры
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, target_size[0])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, target_size[1])
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
    
    # Проверяем, поддерживает ли камера запрошенное разрешение
    actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Разрешение камеры: {actual_width}x{actual_height}")
    
    if not cap.isOpened():
        raise RuntimeError(f"Не удалось открыть камеру с индексом {camera_index}")
    
    return cap

class MaskProcessor:
    """Класс для оптимизированной обработки масок."""
    
    def __init__(self):
        # Предварительно созданные ядра для морфологических операций
        self.kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        self.kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        self.kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    
    def create_human_mask(self, results, h: int, w: int, conf_threshold: float = 0.3) -> np.ndarray:
        """Создаёт маску для класса 'person' с оптимизацией."""
        human_mask = np.zeros((h, w), dtype=np.uint8)
        
        for result in results:
            if result.masks is not None:
                masks = result.masks.data.cpu().numpy()
                classes = result.boxes.cls.cpu().numpy()
                confidences = result.boxes.conf.cpu().numpy()
                
                # Фильтрация по классу 'person' и уверенности
                person_indices = np.where((classes == 0) & (confidences > conf_threshold))[0]
                
                for idx in person_indices:
                    mask = masks[idx]
                    # Используем билинейную интерполяцию для лучшего качества
                    mask_resized = cv2.resize(mask, (w, h), interpolation=cv2.INTER_LINEAR)
                    human_mask = np.maximum(human_mask, (mask_resized > 0.3).astype(np.uint8) * 255)
        
        return human_mask
    
    def apply_morphological_operations(self, mask: np.ndarray) -> np.ndarray:
        """Применяет морфологические операции для улучшения маски."""
        # Убираем шум
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.kernel_open)
        # Заполняем небольшие дыры
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.kernel_close)
        # Утончаем границы
        mask = cv2.morphologyEx(mask, cv2.MORPH_ERODE, self.kernel_erode)
        # Сглаживаем границы
        mask = cv2.GaussianBlur(mask, (5, 5), 1)
        
        return mask.astype(np.float32) / 255.0

def process_frame(
    frame: np.ndarray,
    model: YOLO,
    background: np.ndarray,
    mask_processor: MaskProcessor,
    prev_mask: Optional[np.ndarray] = None,
    conf_threshold: float = 0.3,
    mask_smoothing_alpha: float = 0.7
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Обрабатывает кадр: выполняет сегментацию, создаёт маску, накладывает фон.
    Возвращает финальный кадр и обновлённую маску.
    """
    h, w = frame.shape[:2]
    
    # Сегментация с оптимизацией
    results = model(frame, verbose=False, conf=conf_threshold, imgsz=640)
    
    # Создание маски
    human_mask = mask_processor.create_human_mask(results, h, w, conf_threshold)
    
    # Морфологические операции
    human_mask_processed = mask_processor.apply_morphological_operations(human_mask)
    
    # Временная согласованность масок
    if prev_mask is not None:
        human_mask_processed = (mask_smoothing_alpha * human_mask_processed + 
                              (1 - mask_smoothing_alpha) * prev_mask)
    
    # Создание финального кадра
    final_frame = blend_frames(frame, background, human_mask_processed)
    
    return final_frame, human_mask_processed

def blend_frames(foreground: np.ndarray, background: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Накладывает фон на передний план с использованием маски."""
    # Оптимизация: используем умножение вместо stack для экономии памяти
    mask_3ch = mask[:, :, np.newaxis]  # Создаем 3D маску более эффективно
    foreground_part = foreground * mask_3ch
    background_part = background * (1 - mask_3ch)
    return (foreground_part + background_part).astype(np.uint8)

class FPSCounter:
    """Класс для подсчёта FPS с улучшенной точностью."""
    def __init__(self, window_size: int = 30):
        self.times = deque(maxlen=window_size)
    
    def update(self) -> float:
        """Обновляет счётчик и возвращает текущий FPS."""
        current_time = time.time()
        self.times.append(current_time)
        
        if len(self.times) >= 2:
            fps = (len(self.times) - 1) / (self.times[-1] - self.times[0])
            return fps
        return 0.0

class FrameProcessor:
    """Класс для асинхронной обработки кадров (опционально)."""
    
    def __init__(self, model, background, target_size):
        self.model = model
        self.background = background
        self.target_size = target_size
        self.mask_processor = MaskProcessor()
        self.prev_mask = None
        
    def process(self, frame):
        """Обрабатывает один кадр."""
        # Изменяем размер кадра до целевого
        if frame.shape[:2] != self.target_size[::-1]:
            frame = cv2.resize(frame, self.target_size, interpolation=cv2.INTER_AREA)
        
        final_frame, self.prev_mask = process_frame(
            frame, self.model, self.background, self.mask_processor, self.prev_mask
        )
        return final_frame

def main():
    try:
        # Инициализация
        TARGET_SIZE = (640, 480)  # Фиксируем размер для оптимизации
        
        model = load_model()
        background = load_background('background.png', TARGET_SIZE)
        cap = initialize_camera(target_size=TARGET_SIZE)
        
        # Получаем размер первого кадра
        ret, first_frame = cap.read()
        if not ret:
            print("Ошибка: не удалось получить кадр с камеры")
            return
        
        # Инициализация процессора кадров
        frame_processor = FrameProcessor(model, background, TARGET_SIZE)
        
        fps_counter = FPSCounter()
        frame_count = 0

        print("Обработка видео начата. Нажмите:")
        print("  'q' - выход")
        
        while True:
            start_time = time.time()
            
            ret, frame = cap.read()
            if not ret:
                break

            # Обработка кадра
            final_frame = frame_processor.process(frame)

            # Обновление FPS
            fps = fps_counter.update()
            frame_count += 1
            
            # Вывод статистики каждые 30 кадров
            if frame_count % 30 == 0:
                print(f"FPS: {fps:.1f}, Кадров: {frame_count}")

            # Отображение информации на кадре
            cv2.putText(final_frame, f"FPS: {fps:.1f}", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            cv2.imshow('Background Replacement', final_frame)

            # Обработка клавиш
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break

    except Exception as e:
        print(f"Произошла ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Освобождение ресурсов
        if 'cap' in locals():
            cap.release()

        cv2.destroyAllWindows()
        
        print(f"Обработано кадров: {frame_count}")
        print("Ресурсы освобождены")

if __name__ == "__main__":
    main()