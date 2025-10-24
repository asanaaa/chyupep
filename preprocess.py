import cv2
import numpy as np

# Предварительно вычисленные LUT для гамма-коррекции
GAMMA_LUT = {}
def get_gamma_lut(gamma: float) -> np.ndarray:
    """Получает или вычисляет LUT для гамма-коррекции."""
    if gamma not in GAMMA_LUT:
        inv_gamma = 1.0 / gamma
        GAMMA_LUT[gamma] = np.array([((i / 255.0) ** inv_gamma) * 255 
                                   for i in np.arange(0, 256)]).astype("uint8")
    return GAMMA_LUT[gamma]

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
    frame = adjust_brightness_contrast(frame)
    frame = apply_fast_denoising(frame)
    
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

def adjust_brightness_contrast(frame: np.ndarray, 
                             alpha: float = 1.1, 
                             beta: int = 5) -> np.ndarray:
    """
    Оптимизированная коррекция яркости и контрастности.
    """
    # Используем быстрое преобразование вместо convertScaleAbs когда возможно
    if alpha == 1.0 and beta == 0:
        return frame
    
    # Для небольших корректировок используем более быстрый метод
    if abs(alpha - 1.0) < 0.1 and abs(beta) < 10:
        if beta > 0:
            frame = cv2.add(frame, beta)
        elif beta < 0:
            frame = cv2.subtract(frame, -beta)
    else:
        frame = cv2.convertScaleAbs(frame, alpha=alpha, beta=beta)
    
    return frame

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

def enhance_details_fast(frame: np.ndarray) -> np.ndarray:
    """
    Быстрое улучшение деталей через увеличение резкости.
    """
    # Простой фильтр увеличения резкости
    kernel = np.array([[-1, -1, -1],
                       [-1, 9, -1],
                       [-1, -1, -1]])
    return cv2.filter2D(frame, -1, kernel)

def adjust_gamma_fast(frame: np.ndarray, gamma: float = 1.0) -> np.ndarray:
    """
    Быстрая гамма-коррекция с использованием предварительно вычисленных LUT.
    """
    if gamma == 1.0:
        return frame
    
    lut = get_gamma_lut(gamma)
    return cv2.LUT(frame, lut)

def auto_white_balance(frame: np.ndarray) -> np.ndarray:
    """
    Упрощенный автоматический баланс белого.
    """
    result = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    
    # Вычисляем средние значения каналов a и b
    avg_a = np.mean(result[:, :, 1])
    avg_b = np.mean(result[:, :, 2])
    
    # Корректируем с учетом яркости
    result[:, :, 1] = result[:, :, 1] - ((avg_a - 128) * 0.7)
    result[:, :, 2] = result[:, :, 2] - ((avg_b - 128) * 0.7)
    
    # Обрезаем значения до допустимого диапазона
    result[:, :, 1] = np.clip(result[:, :, 1], 0, 255)
    result[:, :, 2] = np.clip(result[:, :, 2], 0, 255)
    
    return cv2.cvtColor(result, cv2.COLOR_LAB2BGR)

# Альтернативная версия с тяжелым препроцессингом (для качественного режима)
def preprocess_frame_quality(frame: np.ndarray, target_size: tuple = None) -> np.ndarray:
    """
    Качественный препроцессинг для случаев когда важна детализация.
    """
    if target_size is not None:
        frame = resize_frame(frame, target_size)
    
    frame = adjust_brightness_contrast(frame, alpha=1.1, beta=8)
    frame = apply_denoising_quality(frame)
    frame = enhance_details_fast(frame)
    frame = auto_white_balance(frame)
    
    return frame

def apply_denoising_quality(frame: np.ndarray) -> np.ndarray:
    """
    Качественное удаление шума.
    """
    return cv2.fastNlMeansDenoisingColored(
        frame, 
        None,
        h=10,
        hColor=10,
        templateWindowSize=7,
        searchWindowSize=21
    )