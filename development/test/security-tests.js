const fetch = require('node-fetch');

async function securityTests(baseUrl) {
    console.log('\n🛡️ ТЕСТЫ БЕЗОПАСНОСТИ\n');
    let passed = 0;
    let total = 0;

    // Тест блокировки ботов
    total++;
    try {
        const botPaths = ['/wp-admin/', '/xmlrpc.php', '/.env'];
        let blocked = 0;
        
        for (const path of botPaths) {
            const response = await fetch(`${baseUrl}${path}`);
            if (response.status === 404 || response.status === 403) {
                blocked++;
            }
        }
        
        if (blocked === botPaths.length) {
            console.log('✅ Защита от ботов работает');
            passed++;
        } else {
            console.log(`❌ Защита от ботов: заблокировано ${blocked}/${botPaths.length} путей`);
        }
    } catch (error) {
        console.log(`❌ Защита от ботов: ${error.message}`);
    }

    // Тест rate limiting
    total++;
    try {
        const requests = Array(5).fill().map(() => fetch(`${baseUrl}/health`));
        const responses = await Promise.all(requests);
        const allSuccess = responses.every(r => r.status === 200);
        
        if (allSuccess) {
            console.log('✅ Rate limiting тест пройден');
            passed++;
        } else {
            console.log('❌ Rate limiting: некоторые запросы заблокированы');
        }
    } catch (error) {
        console.log(`❌ Rate limiting: ${error.message}`);
    }

    // Тест заголовков безопасности
    total++;
    try {
        const response = await fetch(`${baseUrl}/health`);
        const hasSecurityHeaders = response.headers.get('x-content-type-options') || 
                                  response.headers.get('x-frame-options');
        
        if (hasSecurityHeaders) {
            console.log('✅ Заголовки безопасности присутствуют');
            passed++;
        } else {
            console.log('❌ Заголовки безопасности отсутствуют');
        }
    } catch (error) {
        console.log(`❌ Заголовки безопасности: ${error.message}`);
    }

    console.log(`\n📊 Тесты безопасности: ${passed}/${total} пройдено`);
    return passed === total;
}

// Запуск если вызван напрямую
if (require.main === module) {
    const env = process.env.NODE_ENV || 'production';
    const port = env === 'development' ? 3001 : 3000;
    const baseUrl = `http://127.0.0.1:${port}`;
    
    securityTests(baseUrl).then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = securityTests;
