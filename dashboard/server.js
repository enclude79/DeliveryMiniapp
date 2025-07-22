require('dotenv').config({ path: '../dashboard.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

// Импорт роутов и orchestrator
const deploymentRoutes = require('./routes/deployment');
const databaseRoutes = require('./routes/database');
const backupRoutes = require('./routes/backup');
const logsRoutes = require('./routes/logs');
const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./middleware/auth');
const { generalRateLimiter, loginRateLimiter, apiRateLimiter } = require('./middleware/rateLimit');
const DeploymentOrchestrator = require('../scripts/deployment-orchestrator');
const config = require('./config');

// Создаем глобальный orchestrator
global.orchestrator = new DeploymentOrchestrator();

const app = express();
const PORT = config.port;

// Создание папки для логов если не существует
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Простое логирование
const log = (level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
};

// Безопасность - отключаем HSTS для HTTP
app.use(helmet({
  hsts: false, // Отключаем HSTS
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:"]
    }
  }
}));

// Убираем upgrade-insecure-requests из CSP
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; script-src-attr 'unsafe-inline'; img-src 'self' data: http: https:; connect-src 'self' http: https:; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; object-src 'none'");
  next();
});

// Редирект с HTTPS на HTTP (если браузер пытается использовать HTTPS)
app.use((req, res, next) => {
  // Проверяем различные способы определения HTTPS
  const isHttps = req.get('x-forwarded-proto') === 'https' || 
                  req.get('x-forwarded-ssl') === 'on' ||
                  req.get('x-forwarded-port') === '443' ||
                  req.secure;
  
  if (isHttps) {
    // Перенаправляем на нашу страницу объяснения
    return res.redirect(301, '/redirect.html');
  }
  next();
});

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003', 'http://89.169.182.9:3003'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(generalRateLimiter);

// Логирование запросов
app.use((req, res, next) => {
  log('info', `${req.method} ${req.path} - ${req.ip}`);
  next();
});



// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// API роуты с rate limiting
app.use('/api/auth', loginRateLimiter, authRoutes);
app.use('/api/deployment', apiRateLimiter, authenticateToken, deploymentRoutes);
app.use('/api/database', apiRateLimiter, authenticateToken, databaseRoutes);
app.use('/api/backup', apiRateLimiter, authenticateToken, backupRoutes);
app.use('/api/logs', apiRateLimiter, authenticateToken, logsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'automation-dashboard',
    version: '1.0.0'
  });
});

// Страница очистки кэша
app.get('/clear-cache', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clear-cache.html'));
});

// Страница тестирования кнопок
app.get('/test-buttons', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'button-test.html'));
});

// Редирект с неправильного URL на правильный
app.get('/test-button', (req, res) => {
  res.redirect(301, '/test-buttons');
});

// Страница отладки JavaScript
app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// Страница диагностики кнопок
app.get('/debug-buttons', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'debug-buttons.html'));
});

// Простой тест JavaScript
app.get('/test-simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-simple.html'));
});

// Конфигурация для фронтенда
app.get('/api/config', (req, res) => {
  res.json({
    logsPollingInterval: config.logsPollingInterval,
    maxLogLines: config.maxLogLines,
    environment: config.environment
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  log('error', `Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Обработка SSL ошибок
app.use((err, req, res, next) => {
  if (err.code === 'ECONNRESET' || err.code === 'ERR_SSL_PROTOCOL_ERROR') {
    const httpUrl = `http://${req.headers.host}${req.url}`;
    return res.redirect(301, httpUrl);
  }
  next(err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Запускаем HTTP сервер
app.listen(PORT, '0.0.0.0', () => {
  log('info', `🚀 Automation Dashboard запущен на порту ${PORT}`);
  log('info', `📊 Health check: http://localhost:${PORT}/health`);
  log('info', `🌐 Внешний доступ: http://89.169.182.9:${PORT}`);
  log('info', `🔒 Rate limiting: ${config.rateLimitMax} запросов за ${Math.ceil(config.rateLimitWindowMs / 1000 / 60)} минут`);
  log('info', `🔐 Login rate limiting: ${config.loginRateLimitMax} попыток за ${Math.ceil(config.loginRateLimitWindowMs / 1000 / 60)} минут`);
});



module.exports = app; 