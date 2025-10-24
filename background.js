console.log('background.js loaded');

// Глобальная переменная для хранения текущего выбранного фона
let currentBackground = './backgrounds/1920х1080.png';

// Функция для вычисления средней яркости изображения
function getImageLuminance(imageSrc, callback) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
        let rSum = 0, gSum = 0, bSum = 0;
        for (let i = 0; i < imageData.length; i += 4) {
            rSum += imageData[i];
            gSum += imageData[i + 1];
            bSum += imageData[i + 2];
        }
        const pixelCount = imageData.length / 4;
        const r = rSum / pixelCount / 255;
        const g = gSum / pixelCount / 255;
        const b = bSum / pixelCount / 255;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        console.log(`Image luminance for ${imageSrc}: ${luminance}`);
        callback(luminance);
    };
    img.onerror = () => {
        console.error(`Ошибка загрузки изображения для анализа яркости: ${imageSrc}`);
        callback(0.2);
    };
}

// Функция для выбора контрастного цвета
function getContrastColor(luminance) {
    return luminance > 0.4 ? '#000000' : '#FFFFFF';
}

// Основная функция применения всех изменений
function applyAllChanges() {
    console.log('applyAllChanges called');
    
    const jsonString = generateJSON();
    let jsonData;
    try {
        jsonData = JSON.parse(jsonString);
    } catch (e) {
        console.error('Ошибка парсинга JSON:', e);
        return;
    }
    const employee = jsonData.employee;
    const branding = employee.branding;

    // Установка фона #background
    const bgElement = document.getElementById('background');
    if (bgElement) {
        const primaryColor = branding.corporate_colors.primary || '#0052CC';
        const secondaryColor = branding.corporate_colors.secondary || '#00B8D9';
        console.log('Applying background:', currentBackground, 'primaryColor:', primaryColor, 'secondaryColor:', secondaryColor);
        if (currentBackground === 'gradient') {
            bgElement.style.background = `linear-gradient(to bottom, ${primaryColor}, ${secondaryColor})`;
        } else {
            bgElement.style.background = `url(${currentBackground})`;
            bgElement.style.backgroundSize = 'cover';
            bgElement.style.backgroundPosition = 'center';
            const img = new Image();
            img.src = currentBackground;
            img.onload = () => {
                console.log(`Background image loaded: ${currentBackground}`);
            };
            img.onerror = () => {
                console.error(`Ошибка загрузки фона: ${currentBackground}`);
                bgElement.style.background = primaryColor;
            };
        }
    }

    // Установка контрастного цвета текста и обводки
    const employeeInfo = document.getElementById('employee-info');
    if (employeeInfo) {
        if (currentBackground === 'gradient') {
            const primaryColor = branding.corporate_colors.primary || '#0052CC';
            const r = parseInt(primaryColor.slice(1, 3), 16) / 255;
            const g = parseInt(primaryColor.slice(3, 5), 16) / 255;
            const b = parseInt(primaryColor.slice(5, 7), 16) / 255;
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const textColor = getContrastColor(luminance);
            employeeInfo.style.color = textColor;
            // Обводка для читаемости
            employeeInfo.style.textShadow = textColor === '#000000' 
                ? '0 0 4px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.9)'
                : '0 0 4px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.9)';
        } else {
            getImageLuminance(currentBackground, (luminance) => {
                const textColor = getContrastColor(luminance);
                employeeInfo.style.color = textColor;
                // Обводка для читаемости
                employeeInfo.style.textShadow = textColor === '#000000' 
                    ? '0 0 3px rgba(255,255,255,0.9), 0 0 5px rgba(255,255,255,0.7)'
                    : '0 0 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.7)';
            });
        }
    }

    // Обновление логотипа компании
    const employeeLogo = document.getElementById('employee-logo');
    if (employeeLogo && branding.logo_url) {
        employeeLogo.src = branding.logo_url;
        employeeLogo.style.display = 'block';
        employeeLogo.onerror = () => {
            console.error(`Ошибка загрузки логотипа: ${branding.logo_url}`);
            employeeLogo.style.display = 'none';
        };
    } else if (employeeLogo) {
        employeeLogo.style.display = 'none';
    }

    // Обновление информации сотрудника на фоне
    if (employeeInfo) {
        let infoText = `${employee.full_name || ''}\n${employee.position || ''}\n${employee.company || ''}`;
        if (employee.privacy_level !== 'high') {
            infoText += `\n${employee.department || ''}\n${employee.office_location || ''}`;
        }
        if (employee.privacy_level === 'low') {
            infoText += `\n\nEmail: ${employee.contact.email || ''}\nTelegram: ${employee.contact.telegram || ''}`;
        }
        employeeInfo.textContent = infoText.trim();
        console.log('Employee info updated:', infoText);
    }

    // Применение приватности к форме
    updatePrivacy(employee.privacy_level);
}

// Функция для смены фона
function changeBackground(selectedBg) {
    console.log('changeBackground called with:', selectedBg);
    currentBackground = selectedBg;
    
    // Визуальное выделение выбранной иконки
    const bgIcons = document.querySelectorAll('.background-icon');
    bgIcons.forEach(i => i.classList.remove('selected'));
    const selectedIcon = document.querySelector(`.background-icon[data-bg="${selectedBg}"]`);
    if (selectedIcon) {
        selectedIcon.classList.add('selected');
    }
    
    // Применяем изменения
    applyAllChanges();
}

// Обновление приватности
function updatePrivacy(level) {
    console.log('Privacy level:', level);
    const mediumElements = document.querySelectorAll('.privacy-medium');
    const highElements = document.querySelectorAll('.privacy-high');
    
    mediumElements.forEach(el => {
        el.parentElement.classList.toggle('hidden', level === 'high');
    });
    highElements.forEach(el => {
        el.parentElement.classList.toggle('hidden', level !== 'low');
    });
}

// Дебаунс функция для оптимизации частых вызовов
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Оптимизированное применение изменений (с задержкой 300ms)
const debouncedApply = debounce(applyAllChanges, 300);

// События
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded');
    applyAllChanges();
    
    // Обработка кликов по иконкам фона - применяем сразу
    const bgIcons = document.querySelectorAll('.background-icon');
    bgIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            console.log('Background icon clicked:', icon.dataset.bg);
            changeBackground(icon.dataset.bg);
        });
    });
    
    // Обработка изменений в форме - применяем с задержкой
    const formInputs = document.querySelectorAll('#employeeForm input');
    formInputs.forEach(input => {
        input.addEventListener('input', debouncedApply);
    });
    
    // Обработка изменений цветов - обновляем превью и применяем
    document.getElementById('primary_color').addEventListener('input', () => {
        document.getElementById('primaryColor').style.backgroundColor = document.getElementById('primary_color').value;
        debouncedApply();
    });
    
    document.getElementById('secondary_color').addEventListener('input', () => {
        document.getElementById('secondaryColor').style.backgroundColor = document.getElementById('secondary_color').value;
        debouncedApply();
    });
    
    // Приватность применяется сразу
    document.querySelectorAll('input[name="privacy_level"]').forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('Privacy radio changed');
            debouncedApply();
        });
    });
});