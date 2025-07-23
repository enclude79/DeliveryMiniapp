const fetch = require('node-fetch');

async function testCopyDatabase() {
    try {
        console.log('🧪 Тестирование API копирования базы prod → staging...');
        
        // Получаем токен (в реальном сценарии это будет через логин)
        const loginResponse = await fetch('http://89.169.182.9:3003/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'dev_admin',
                password: 'dev_password123'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Ошибка логина: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        
        console.log('✅ Успешная аутентификация');
        
        // Тестируем копирование базы
        const copyResponse = await fetch('http://89.169.182.9:3003/api/database/copy-prod-to-staging', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!copyResponse.ok) {
            throw new Error(`Ошибка API: ${copyResponse.status}`);
        }
        
        const copyData = await copyResponse.json();
        
        if (copyData.success) {
            console.log('✅ Копирование базы успешно!');
            console.log('📊 Детали:');
            console.log(`   • Источник: ${copyData.details.source}`);
            console.log(`   • Назначение: ${copyData.details.target}`);
            console.log(`   • Размер: ${(copyData.details.size / 1024).toFixed(2)} KB`);
            console.log(`   • Время: ${copyData.details.timestamp}`);
        } else {
            console.log('❌ Ошибка копирования:', copyData.error);
        }
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error.message);
    }
}

testCopyDatabase(); 