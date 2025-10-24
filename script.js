console.log('script.js loaded');

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

    return JSON.stringify(employeeData, null, 2);
}

// Инициализация предпросмотра логотипа при загрузке
window.addEventListener('load', function() {
    const logoUrl = document.getElementById('logo_url').value;
    if (logoUrl) {
        document.getElementById('logoPreview').src = logoUrl;
        document.getElementById('logoPreview').style.display = 'block';
        document.getElementById('employee-logo').src = logoUrl;
        document.getElementById('employee-logo').style.display = 'block';
    }
});