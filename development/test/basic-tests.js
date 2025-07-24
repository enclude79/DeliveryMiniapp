// Базовые тесты API для DeliveryVLG
const http = require('http');

console.log('🧪 Запуск базовых тестов...');

// Определяем порт на основе окружения
const port = process.env.NODE_ENV === 'development' ? 3001 : 3000;

// Функция для HTTP запроса
function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: path,
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data: data });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Тесты
async function runTests() {
    let passed = 0;
    let failed = 0;

    const tests = [
        {
            name: 'Главная страница доступна',
            path: '/',
            expectedStatus: 200
        },
        {
            name: 'Админка доступна',
            path: '/admin',
            expectedStatus: 200
        },
        {
            name: 'API статус доступен',
            path: '/api/status',
            expectedStatus: 200
        },
        {
            name: 'API заказов доступен',
            path: '/api/orders',
            expectedStatus: 200
        },
        {
            name: 'Несуществующий роут возвращает 404',
            path: '/nonexistent',
            expectedStatus: 404
        }
    ];

    for (const test of tests) {
        try {
            const result = await makeRequest(test.path);
            
            if (result.statusCode === test.expectedStatus) {
                console.log(`✅ ${test.name}`);
                passed++;
            } else {
                console.log(`❌ ${test.name} (ожидался ${test.expectedStatus}, получен ${result.statusCode})`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name} (ошибка: ${error.message})`);
            failed++;
        }
    }

    console.log(`\n📊 Результаты тестов:`);
    console.log(`✅ Прошло: ${passed}`);
    console.log(`❌ Провалилось: ${failed}`);
    console.log(`📈 Успешность: ${Math.round((passed / (passed + failed)) * 100)}%`);

    if (failed > 0) {
        console.log(`\n⚠️ Есть проваленные тесты!`);
        process.exit(1);
    } else {
        console.log(`\n🎉 Все тесты прошли успешно!`);
        process.exit(0);
    }
}

// Запуск тестов
runTests().catch(error => {
    console.error('❌ Критическая ошибка тестов:', error);
    process.exit(1);
}); 