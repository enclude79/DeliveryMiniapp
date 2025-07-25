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

// Git Workflow маршруты
const gitWorkflowRoutes = require('./routes/git-workflow');
app.use('/api/git-workflow', apiRateLimiter, authenticateToken, gitWorkflowRoutes);

// Endpoint для копирования базы prod → staging
app.post('/api/database/copy-prod-to-staging', apiRateLimiter, authenticateToken, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const BackupProtection = require('../scripts/backup-protection');
    const protection = new BackupProtection();
    
    const sourceDb = '/home/enclude/automation/production/delivery.db';
    const targetDb = '/home/enclude/automation/staging/delivery.db';
    const includeMedia = req.body.includeMedia === true;
    
    log('info', `Запрос копирования базы prod → staging (медиафайлы: ${includeMedia ? 'включены' : 'отключены'})`);
    
    // Проверяем существование исходной базы
    if (!fs.existsSync(sourceDb)) {
      return res.status(404).json({
        success: false,
        error: 'Исходная база данных production не найдена'
      });
    }
    
    // Создаем защитный бэкап staging перед операцией
    log('info', 'Создание защитного бэкапа staging...');
    const protectionBackup = await protection.createProtectionBackup('staging', 'copy_prod_to_staging');
    
    if (!protectionBackup.success) {
      return res.status(500).json({
        success: false,
        error: `Не удалось создать защитный бэкап: ${protectionBackup.error}`
      });
    }
    
    log('info', `Защитный бэкап создан: ${protectionBackup.backupName}`);
    
    // Выполняем копирование базы данных
    const dbCommand = `cp -f "${sourceDb}" "${targetDb}"`;
    log('info', `Выполняется копирование базы: ${dbCommand}`);
    
    const { stdout, stderr } = await execAsync(dbCommand);
    
    if (stderr) {
      log('warning', `Предупреждение при копировании базы: ${stderr}`);
    }
    
    // Проверяем результат копирования базы
    if (!fs.existsSync(targetDb)) {
      throw new Error('База данных не была создана после копирования');
    }
    
    const dbStats = fs.statSync(targetDb);
    log('info', `База успешно скопирована. Размер: ${dbStats.size} байт`);
    
    const result = {
      success: true,
      message: 'База данных успешно скопирована из production в staging',
      details: {
        database: {
          source: sourceDb,
          target: targetDb,
          size: dbStats.size,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    // Копирование медиафайлов (если включено)
    if (includeMedia) {
      try {
        const sourceUploads = '/home/enclude/automation/production/public/uploads';
        const targetUploads = '/home/enclude/automation/staging/public/uploads';
        
        // Проверяем существование исходной папки uploads
        if (!fs.existsSync(sourceUploads)) {
          log('warning', 'Исходная папка uploads не найдена');
          result.details.media = { copied: false, error: 'Исходная папка uploads не найдена' };
        } else {
          // Очищаем staging uploads (кроме .gitkeep)
          const clearCommand = `find "${targetUploads}" -type f ! -name '.gitkeep' -delete`;
          log('info', `Очистка staging uploads: ${clearCommand}`);
          await execAsync(clearCommand);
          
          // Копируем медиафайлы
          const mediaCommand = `cp -r "${sourceUploads}"/* "${targetUploads}/" 2>/dev/null || true`;
          log('info', `Копирование медиафайлов: ${mediaCommand}`);
          await execAsync(mediaCommand);
          
          // Подсчитываем скопированные файлы
          const files = fs.readdirSync(targetUploads).filter(file => file !== '.gitkeep');
          const totalSize = files.reduce((size, file) => {
            const filePath = path.join(targetUploads, file);
            return size + (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
          }, 0);
          
          log('info', `Медиафайлы скопированы. Файлов: ${files.length}, размер: ${totalSize} байт`);
          
          result.details.media = {
            copied: true,
            files: files.length,
            size: totalSize,
            timestamp: new Date().toISOString()
          };
          
          // Обновляем сообщение
          result.message = 'База данных и медиафайлы успешно скопированы из production в staging';
        }
      } catch (mediaError) {
        log('error', `Ошибка копирования медиафайлов: ${mediaError.message}`);
        result.details.media = { 
          copied: false, 
          error: mediaError.message,
          timestamp: new Date().toISOString()
        };
      }
    } else {
      result.details.media = { copied: false, reason: 'Флаг отключен' };
    }
    
    res.json(result);
    
  } catch (error) {
    log('error', `Ошибка копирования: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `Ошибка копирования: ${error.message}`
    });
  }
});

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

// Git Workflow страница
app.get('/git-workflow', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'git-workflow.html'));
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