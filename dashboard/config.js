// Конфигурация Dashboard
module.exports = {
    // Интервал обновления логов в миллисекундах (30 секунд)
    logsPollingInterval: parseInt(process.env.LOGS_POLLING_INTERVAL) || 30000,
    
    // Максимальное количество строк логов для отображения
    maxLogLines: parseInt(process.env.MAX_LOG_LINES) || 1000,
    
    // Окружение
    environment: process.env.NODE_ENV || 'development',
    
    // Порт сервера
    port: process.env.PORT || 3003,
    
    // JWT настройки
    jwtSecret: process.env.JWT_SECRET || 'dashboard-secret-key',
    jwtExpiresIn: '24h',
    
    // Административные учетные данные
    adminUsername: process.env.ADMIN_USERNAME || 'dev_admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'dev_password123',
    
    // Rate limiting настройки
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100, // максимум 100 запросов
    loginRateLimitWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
    loginRateLimitMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5 // максимум 5 попыток входа
}; 