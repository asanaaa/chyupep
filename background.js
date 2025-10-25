console.log('background.js loaded');

let currentBackground = './backgrounds/1920х1080.png';

// Вычисление средней яркости изображения для выбора контрастного текста
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
        
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        let rSum = 0, gSum = 0, bSum = 0;
        for (let i = 0; i < data.length; i += 4) {
            rSum += data[i];
            gSum += data[i + 1];
            bSum += data[i + 2];
        }
        const pixelCount = data.length / 4;
        const r = rSum / pixelCount / 255;
        const g = gSum / pixelCount / 255;
        const b = bSum / pixelCount / 255;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        callback(luminance);
    };
    img.onerror = () => callback(0.2);
}

// Выбор белого или черного цвета текста в зависимости от яркости
function getContrastColor(luminance) {
    return luminance > 0.4 ? '#000000' : '#FFFFFF';
}

// Применение всех изменений: фон, логотип, текст, приватность
function applyAllChanges() {
    const jsonString = generateJSON();
    let jsonData;
    try { jsonData = JSON.parse(jsonString); } 
    catch (e) { return; }

    const employee = jsonData.employee;
    const branding = employee.branding;
    const bgElement = document.getElementById('background');
    const employeeInfo = document.getElementById('employee-info');
    const employeeLogo = document.getElementById('employee-logo');

    // Установка фона (изображение или градиент)
    if (bgElement) {
        const primaryColor = branding.corporate_colors.primary || '#0052CC';
        const secondaryColor = branding.corporate_colors.secondary || '#00B8D9';
        if (currentBackground === 'gradient') {
            bgElement.style.background = `linear-gradient(to bottom, ${primaryColor}, ${secondaryColor})`;
        } else {
            bgElement.style.background = `url(${currentBackground})`;
            bgElement.style.backgroundSize = 'cover';
            bgElement.style.backgroundPosition = 'center';
            const img = new Image();
            img.src = currentBackground;
            img.onload = () => {};
            img.onerror = () => bgElement.style.background = primaryColor;
        }
    }

    // Настройка цвета текста и обводки для читаемости
    if (employeeInfo) {
        if (currentBackground === 'gradient') {
            const primaryColor = branding.corporate_colors.primary || '#0052CC';
            const r = parseInt(primaryColor.slice(1, 3), 16) / 255;
            const g = parseInt(primaryColor.slice(3, 5), 16) / 255;
            const b = parseInt(primaryColor.slice(5, 7), 16) / 255;
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const textColor = getContrastColor(luminance);
            employeeInfo.style.color = textColor;
            employeeInfo.style.textShadow = textColor === '#000000' 
                ? '0 0 4px rgba(255,255,255,1),0 0 6px rgba(255,255,255,1),0 0 8px rgba(255,255,255,0.9)'
                : '0 0 4px rgba(0,0,0,1),0 0 6px rgba(0,0,0,1),0 0 8px rgba(0,0,0,0.9)';
        } else {
            getImageLuminance(currentBackground, (lum) => {
                const textColor = getContrastColor(lum);
                employeeInfo.style.color = textColor;
                employeeInfo.style.textShadow = textColor === '#000000' 
                    ? '0 0 3px rgba(255,255,255,0.9),0 0 5px rgba(255,255,255,0.7)'
                    : '0 0 3px rgba(0,0,0,0.9),0 0 5px rgba(0,0,0,0.7)';
            });
        }
    }

    // Логотип компании
    if (employeeLogo && branding.logo_url) {
        employeeLogo.src = branding.logo_url;
        employeeLogo.style.display = 'block';
        employeeLogo.onerror = () => employeeLogo.style.display = 'none';
    } else if (employeeLogo) employeeLogo.style.display = 'none';

    // Отображение информации сотрудника с учетом приватности
    if (employeeInfo) {
        let infoText = `${employee.full_name || ''}\n${employee.position || ''}\n${employee.company || ''}`;
        if (employee.privacy_level !== 'high') infoText += `\n${employee.department || ''}\n${employee.office_location || ''}`;
        if (employee.privacy_level === 'low') infoText += `\n\nEmail: ${employee.contact.email || ''}\nTelegram: ${employee.contact.telegram || ''}`;
        employeeInfo.textContent = infoText.trim();
    }

    updatePrivacy(employee.privacy_level);
}

// Смена фона
function changeBackground(selectedBg) {
    currentBackground = selectedBg;
    document.querySelectorAll('.background-icon').forEach(i => i.classList.remove('selected'));
    const selectedIcon = document.querySelector(`.background-icon[data-bg="${selectedBg}"]`);
    if (selectedIcon) selectedIcon.classList.add('selected');
    applyAllChanges();
}

// Обновление приватности
function updatePrivacy(level) {
    document.querySelectorAll('.privacy-medium').forEach(el => el.parentElement.classList.toggle('hidden', level === 'high'));
    document.querySelectorAll('.privacy-high').forEach(el => el.parentElement.classList.toggle('hidden', level !== 'low'));
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

const debouncedApply = debounce(applyAllChanges, 300);

// События на странице
document.addEventListener('DOMContentLoaded', () => {
    applyAllChanges();

    document.querySelectorAll('.background-icon').forEach(icon => {
        icon.addEventListener('click', () => changeBackground(icon.dataset.bg));
    });

    document.querySelectorAll('#employeeForm input').forEach(input => {
        input.addEventListener('input', debouncedApply);
    });

    document.getElementById('primary_color').addEventListener('input', () => {
        document.getElementById('primaryColor').style.backgroundColor = document.getElementById('primary_color').value;
        debouncedApply();
    });

    document.getElementById('secondary_color').addEventListener('input', () => {
        document.getElementById('secondaryColor').style.backgroundColor = document.getElementById('secondary_color').value;
        debouncedApply();
    });

    document.querySelectorAll('input[name="privacy_level"]').forEach(radio => {
        radio.addEventListener('change', debouncedApply);
    });
});
