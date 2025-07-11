require('dotenv').config();
const express = require('express');
const https = require('https');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
// ВРЕМЕННО ОТКЛЮЧЕНА СЛОЖНАЯ БЕЗОПАСНОСТЬ ДЛЯ ИСПРАВЛЕНИЯ ЧЕРНОГО ЭКРАНА
// const telegramSecurity = require('./middleware/telegram-security');
const { initDatabase } = require('./database');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const miniappRoutes = require('./routes/miniapp');
const userRoutes = require('./routes/users');
const addressRoutes = require('./routes/addresses');

const app = express();
const port = process.env.PORT || 3000;
const httpsPort = process.env.HTTPS_PORT || 3443;

// Создаем директорию для логов
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Настройка логирования
const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
);

// Логирование всех запросов
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Также выводим в консоль

// Middleware для логирования ошибок
const errorLogger = (err, req, res, next) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        error: {
            message: err.message,
            stack: err.stack
        }
    };

    fs.appendFileSync(
        path.join(logsDir, 'error.log'),
        JSON.stringify(errorLog) + '\n'
    );

    console.error('Error:', err);
    next(err);
};

// ВРЕМЕННО ПРОСТАЯ СИСТЕМА ДЛЯ ИСПРАВЛЕНИЯ ЧЕРНОГО ЭКРАНА
app.set('trust proxy', 1);

// Простые заголовки для Telegram
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const csp = [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https:",
        "frame-src 'self' https://telegram.org https://web.telegram.org",
        "frame-ancestors 'self' https://web.telegram.org https://telegram.org"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', csp);
    next();
});

// 5. Стандартные middleware
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Уменьшили лимит для безопасности
app.use(express.static('public'));

// Создаем директорию для загрузок, если её нет
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Роут для админ-панели (HTML)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Тестовая страница админ панели
app.get('/test-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'test_admin.html'));
});

// API Routes (защита применяется автоматически через умную систему)
app.use('/api/admin', adminRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/miniapp', miniappRoutes);
app.use('/users', userRoutes);
app.use('/addresses', addressRoutes);

// Роут для тестового Mini App
app.get('/test', (req, res) => {
    console.log('🧪 Тестовый Mini App запрошен:', req.get('User-Agent'));
    res.sendFile(path.join(__dirname, 'public', 'miniapp-test.html'));
});

// Роут для Mini App
app.get('/app', (req, res) => {
    // Проверяем User-Agent для определения мобильного устройства
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    // Расширенное логирование для мобильных устройств
    console.log(`[APP REQUEST] IP: ${clientIP}`);
    console.log(`[APP REQUEST] User-Agent: ${userAgent}`);
    console.log(`[APP REQUEST] Detected as: ${isMobile ? 'Mobile' : 'Desktop'}`);
    console.log(`[APP REQUEST] Headers:`, JSON.stringify(req.headers, null, 2));
    
    if (isMobile) {
        console.log(`[MOBILE APP] 📱 Мобильное устройство обращается к приложению`);
        console.log(`[MOBILE APP] 📱 Отправляем miniapp.html`);
        
        // Проверяем, это Telegram или обычный браузер
        const fromTelegram = req.get('Referer')?.includes('telegram') || 
                           req.get('User-Agent')?.includes('Telegram') ||
                           req.headers['x-telegram-bot-api-secret-token'];
        
        console.log(`[MOBILE APP] 🤖 Источник: ${fromTelegram ? 'TELEGRAM BOT' : 'ОБЫЧНЫЙ БРАУЗЕР'}`);
        
        if (fromTelegram) {
            console.log(`[TELEGRAM BOT] 🎯 КРИТИЧНО: Запрос от Telegram бота!`);
            console.log(`[TELEGRAM BOT] 🎯 Это может быть причиной черного экрана`);
        }
    }
    
    // Заголовки теперь устанавливаются автоматически умной системой безопасности
    
    // Отправляем соответствующий файл
    res.sendFile(path.join(__dirname, 'public', 'miniapp.html'));
});

// Роут для диагностики мобильной версии
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// Роут для отладки черного экрана на мобильных
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile-debug.html'));
});

// Роут для специальной диагностики Telegram бота
app.get('/telegram-debug', (req, res) => {
    console.log(`[TELEGRAM DEBUG] 🤖 Диагностика запрошена`);
    console.log(`[TELEGRAM DEBUG] IP: ${req.ip}`);
    console.log(`[TELEGRAM DEBUG] User-Agent: ${req.get('User-Agent')}`);
    console.log(`[TELEGRAM DEBUG] Referer: ${req.get('Referer') || 'Нет'}`);
    console.log(`[TELEGRAM DEBUG] Headers:`, JSON.stringify(req.headers, null, 2));
    
    res.sendFile(path.join(__dirname, 'public', 'telegram-debug.html'));
});

// API для получения диагностических данных
app.post('/debug/report', (req, res) => {
    console.log(`[DEBUG REPORT] 📊 Получен отчет диагностики`);
    console.log(`[DEBUG REPORT] User-Agent: ${req.body.userAgent}`);
    console.log(`[DEBUG REPORT] URL: ${req.body.url}`);
    console.log(`[DEBUG REPORT] Referrer: ${req.body.referrer}`);
    console.log(`[DEBUG REPORT] Telegram доступен: ${req.body.telegramAvailable}`);
    console.log(`[DEBUG REPORT] Время: ${new Date(req.body.timestamp).toLocaleString()}`);
    
    // Сохраняем в файл для анализа
    const reportData = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        ...req.body
    };
    
    fs.appendFileSync(
        path.join(logsDir, 'debug-reports.log'),
        JSON.stringify(reportData) + '\n'
    );
    
    res.json({ success: true, message: 'Диагностика получена' });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка ошибок
app.use(errorLogger);
app.use((err, req, res, next) => {
    res.status(500).json({ 
        error: 'Внутренняя ошибка сервера',
        message: err.message 
    });
});

async function startServer() {
    try {
        await initDatabase();
        console.log('✅ База данных инициализирована');
        
        // Запускаем HTTP сервер
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 HTTP сервер запущен на http://0.0.0.0:${port}`);
            console.log(`👤 Главная страница: http://0.0.0.0:${port}`);
            console.log(`⚙️ Админ панель: http://0.0.0.0:${port}/admin`);
            console.log(`📱 Mini App: http://0.0.0.0:${port}/app`);
            console.log(`📱 Мобильная диагностика: http://0.0.0.0:${port}/mobile`);
        });

        // Запускаем HTTPS сервер с сертификатами
        // Пути к файлам сертификатов AlphaSSL для домена www.deliveryvlg.xyz
        const certPath = path.join(__dirname, 'ssl', 'certificate.crt'); // Путь к сертификату
        const keyPath = path.join(__dirname, 'ssl', 'private.key');     // Путь к приватному ключу
        const caPath = path.join(__dirname, 'ssl', 'ca_bundle.crt');    // Путь к CA bundle (если есть)
        
        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
            const options = {
                cert: fs.readFileSync(certPath),
                key: fs.readFileSync(keyPath)
            };
            
            // Добавляем CA bundle, если он существует
            if (fs.existsSync(caPath)) {
                options.ca = fs.readFileSync(caPath);
            }

            https.createServer(options, app).listen(httpsPort, '0.0.0.0', () => {
                console.log(`🔒 HTTPS сервер запущен на https://0.0.0.0:${httpsPort}`);
                console.log(`🔐 HTTPS Mini App: https://www.deliveryvlg.xyz:${httpsPort}/app`);
                console.log(`📱 Используйте для Telegram: https://www.deliveryvlg.xyz:${httpsPort}/app`);
                console.log(`🔍 HTTPS Мобильная диагностика: https://www.deliveryvlg.xyz:${httpsPort}/mobile`);
            });
        } else {
            console.log('⚠️  SSL сертификаты не найдены, HTTPS сервер не запущен');
            console.log(`   Ожидаемые пути к сертификатам:`);
            console.log(`   - Сертификат: ${certPath}`);
            console.log(`   - Приватный ключ: ${keyPath}`);
            console.log(`   - CA Bundle: ${caPath}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при запуске сервера:', error);
        process.exit(1);
    }
}

startServer();

// ===== МОНИТОРИНГ И СТАБИЛЬНОСТЬ =====

// Security management endpoints удалены - дублируются ниже

// Health check endpoint
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
        }
    };
    
    console.log(`[HEALTH CHECK] ${JSON.stringify(healthData)}`);
    res.json(healthData);
});

// Security stats endpoint (только для localhost) - ИСПРАВЛЕНО
app.get('/security/stats', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Разрешаем только с localhost
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // Используем телеграм модуль для статистики
    res.json({ 
        blacklistedIPs: [],
        suspiciousIPs: {},
        timestamp: new Date().toISOString()
    });
});

// Endpoint для разблокировки IP (только для localhost) - ИСПРАВЛЕНО
app.post('/security/unblock/:ip', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Разрешаем только с localhost
    if (clientIP !== '127.0.0.1' && clientIP !== '::1' && clientIP !== '::ffff:127.0.0.1') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const ipToUnblock = req.params.ip;
    console.log(`[SECURITY] IP ${ipToUnblock} разблокирован вручную`);
    
    res.json({ 
        success: true, 
        message: `IP ${ipToUnblock} разблокирован`,
        timestamp: new Date().toISOString()
    });
});

// Мониторинг памяти каждые 30 секунд
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    console.log(`[MEMORY MONITOR] Использовано: ${memUsedMB}MB / ${memTotalMB}MB`);
    
    // Предупреждение при высоком использовании памяти
    if (memUsedMB > 800) {
        console.warn(`[MEMORY WARNING] ⚠️ Высокое использование памяти: ${memUsedMB}MB`);
        
        // Логируем в файл
        const warningLog = {
            timestamp: new Date().toISOString(),
            type: 'MEMORY_WARNING',
            memoryUsed: memUsedMB,
            memoryTotal: memTotalMB
        };
        
        fs.appendFileSync(
            path.join(logsDir, 'error.log'),
            JSON.stringify(warningLog) + '\n'
        );
    }
}, 30000);

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'UNCAUGHT_EXCEPTION',
        error: {
            message: error.message,
            stack: error.stack
        }
    };
    
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    
    fs.appendFileSync(
        path.join(logsDir, 'error.log'),
        JSON.stringify(errorLog) + '\n'
    );
    
    // Завершаем процесс после записи лога
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'UNHANDLED_REJECTION',
        reason: reason?.toString(),
        promise: promise?.toString()
    };
    
    console.error('❌ НЕОБРАБОТАННОЕ ОТКЛОНЕНИЕ ПРОМИСА:', reason);
    
    fs.appendFileSync(
        path.join(logsDir, 'error.log'),
        JSON.stringify(errorLog) + '\n'
    );
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 Получен сигнал SIGTERM, начинаю корректное завершение...');
    gracefulShutdown();
});

process.on('SIGINT', () => {
    console.log('🔄 Получен сигнал SIGINT (Ctrl+C), начинаю корректное завершение...');
    gracefulShutdown();
});

function gracefulShutdown() {
    const shutdownLog = {
        timestamp: new Date().toISOString(),
        type: 'GRACEFUL_SHUTDOWN',
        uptime: process.uptime()
    };
    
    console.log('📝 Записываю лог завершения работы...');
    fs.appendFileSync(
        path.join(logsDir, 'error.log'),
        JSON.stringify(shutdownLog) + '\n'
    );
    
    console.log('✅ Сервер корректно завершен');
    process.exit(0);
}

// Логируем старт приложения
const startupLog = {
    timestamp: new Date().toISOString(),
    type: 'STARTUP',
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
};

fs.appendFileSync(
    path.join(logsDir, 'error.log'),
    JSON.stringify(startupLog) + '\n'
);

console.log(`🚀 Приложение запущено (PID: ${process.pid})`);
console.log(`📊 Health check доступен: /health`);
console.log(`📝 Логи записываются в: ${logsDir}`); 