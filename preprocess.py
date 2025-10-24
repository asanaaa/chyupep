import cv2
import numpy as np

def preprocess_frame(frame: np.ndarray, target_size: tuple = None) -> np.ndarray:
    """
    Оптимизированная функция препроцессинга кадра.
    
    Args:
        frame: Исходный кадр с камеры
        target_size: Целевой размер кадра (ширина, высота). Если None - не изменяет размер.
    
    Returns:
        Обработанный кадр
    """
    # Изменение размера если необходимо
    if target_size is not None and frame.shape[:2] != target_size[::-1]:
        frame = resize_frame(frame, target_size)
    
    # Основные операции препроцессинга
    frame = apply_fast_denoising(frame)
    frame = enhance_edges_fast(frame)
    frame = improve_contrast_fast(frame)
    
    return frame

def resize_frame(frame: np.ndarray, target_size: tuple) -> np.ndarray:
    """
    Изменяет размер кадра до целевого размера.
    
    Args:
        frame: Входной кадр
        target_size: Целевой размер (ширина, высота)
    
    Returns:
        Кадр измененного размера
    """
    return cv2.resize(frame, target_size, interpolation=cv2.INTER_AREA)

def apply_fast_denoising(frame: np.ndarray) -> np.ndarray:
    """
    Быстрое удаление шума с оптимизированными параметрами.
    """
    # Быстрое удаление шума с оптимизированными параметрами
    return cv2.fastNlMeansDenoisingColored(
        frame, 
        None,
        h=3,           # Уменьшенная сила фильтрации для скорости
        hColor=3,
        templateWindowSize=5,  # Уменьшенные окна для производительности
        searchWindowSize=15
    )

def enhance_edges_fast(frame: np.ndarray) -> np.ndarray:
    """Быстрое улучшение границ для лучшей сегментации."""
    # Более эффективный фильтр для границ
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    return cv2.filter2D(frame, -1, kernel)

def improve_contrast_fast(frame: np.ndarray) -> np.ndarray:
    """Быстрое улучшение контраста через CLAHE."""
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # CLAHE только на канал яркости
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    
    lab = cv2.merge([l, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)