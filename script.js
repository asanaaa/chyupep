// Обновление предпросмотра логотипа
document.getElementById('logo_url').addEventListener('input', function(e) {
    const preview = document.getElementById('logoPreview');
    if (e.target.value) {
        preview.src = e.target.value;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
});

// Обновление цветов предпросмотра
document.getElementById('primary_color').addEventListener('input', function(e) {
    document.getElementById('primaryColor').style.backgroundColor = e.target.value;
});

document.getElementById('secondary_color').addEventListener('input', function(e) {
    document.getElementById('secondaryColor').style.backgroundColor = e.target.value;
});

// Генерация JSON
function generateJSON() {
    const form = document.getElementById('employeeForm');
    const formData = new FormData(form);
    
    const employeeData = {
        employee: {
            full_name: formData.get('full_name'),
            position: formData.get('position'),
            company: formData.get('company'),
            department: formData.get('department'),
            office_location: formData.get('office_location'),
            contact: {
                email: formData.get('contact_email'),
                telegram: formData.get('contact_telegram')
            },
            branding: {
                logo_url: formData.get('logo_url'),
                corporate_colors: {
                    primary: formData.get('primary_color'),
                    secondary: formData.get('secondary_color')
                },
                slogan: formData.get('slogan')
            },
            privacy_level: formData.get('privacy_level')
        }
    };

    jsonContent = JSON.stringify(employeeData, null, 2);
    
    return jsonContent;
}

// Обработка отправки формы
document.getElementById('employeeForm').addEventListener('submit', function(e) {
    e.preventDefault();
    jsonContent = generateJSON();
    console.log(jsonContent);
    alert('Данные успешно сохранены!');
});

// Инициализация предпросмотра логотипа при загрузке
window.addEventListener('load', function() {
    const logoUrl = document.getElementById('logo_url').value;
    if (logoUrl) {
        document.getElementById('logoPreview').src = logoUrl;
        document.getElementById('logoPreview').style.display = 'block';
    }
});