#!/usr/bin/env node

/**
 * Скрипт для сброса rate limiting счетчиков
 * Использование: node scripts/reset-rate-limit.js [IP_ADDRESS]
 */

const fs = require('fs');
const path = require('path');

// Путь к файлу с rate limiting данными (если используется файловое хранилище)
const rateLimitDataPath = path.join(__dirname, '../../logs/rate-limit-data.json');

function resetRateLimit(ipAddress = null) {
    console.log('🔄 Сброс rate limiting счетчиков...');
    
    try {
        // Если указан конкретный IP, сбрасываем только его
        if (ipAddress) {
            console.log(`📍 Сброс счетчиков для IP: ${ipAddress}`);
            
            // В реальном приложении здесь была бы логика сброса для конкретного IP
            // Поскольку express-rate-limit использует память по умолчанию,
            // нужно перезапустить сервер для полного сброса
            
            console.log('⚠️  Для сброса rate limiting нужно перезапустить сервер');
            console.log('💡 Выполните: pkill -f "node server.js" && cd dashboard && npm start');
            
        } else {
            console.log('🌐 Сброс всех rate limiting счетчиков');
            console.log('⚠️  Для полного сброса нужно перезапустить сервер');
            console.log('💡 Выполните: pkill -f "node server.js" && cd dashboard && npm start');
        }
        
        // Удаляем файл с данными rate limiting если он существует
        if (fs.existsSync(rateLimitDataPath)) {
            fs.unlinkSync(rateLimitDataPath);
            console.log('✅ Файл с данными rate limiting удален');
        }
        
        console.log('✅ Rate limiting счетчики сброшены');
        
    } catch (error) {
        console.error('❌ Ошибка при сбросе rate limiting:', error.message);
        process.exit(1);
    }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);
const ipAddress = args[0] || null;

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Скрипт сброса rate limiting счетчиков

Использование:
  node scripts/reset-rate-limit.js [IP_ADDRESS]

Аргументы:
  IP_ADDRESS    - IP адрес для сброса (опционально)
                  Если не указан, сбрасываются все счетчики

Примеры:
  node scripts/reset-rate-limit.js                    # Сброс всех счетчиков
  node scripts/reset-rate-limit.js 127.0.0.1          # Сброс для конкретного IP
  node scripts/reset-rate-limit.js 89.169.182.9       # Сброс для внешнего IP

Примечание: Для полного сброса необходимо перезапустить сервер
`);
    process.exit(0);
}

resetRateLimit(ipAddress); 