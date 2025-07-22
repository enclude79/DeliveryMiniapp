const rateLimit = require('express-rate-limit');

// ===== УМНАЯ ДЕТЕКЦИЯ TELEGRAM ЗАПРОСОВ =====

function isTelegramRequest(req) {
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    
    return req.url.startsWith('/app') || 
           req.url.startsWith('/miniapp') ||
           userAgent.includes('Telegram') ||
           referer.includes('telegram') ||
           req.headers['x-telegram-bot-api-secret-token'] ||
           req.headers['x-telegram-init-data'];
}

function isTelegramBotRequest(req) {
    const userAgent = req.get('User-Agent') || '';
    return userAgent.includes('TelegramBot') || userAgent.includes('Telegram');
}

// ===== ЗОНАЛЬНАЯ СИСТЕМА БЕЗОПАСНОСТИ =====

const SecurityZones = {
    HIGH: 'high',       // Админ-панель
    MEDIUM: 'medium',   // API эндпоинты
    LOW: 'low',         // Telegram Mini App
    PUBLIC: 'public'    // Статические файлы
};

function getSecurityZone(req) {
    const url = req.url;
    
    // Высокая защита - админ-панель
    if (url.startsWith('/admin') || url.startsWith('/api/admin')) {
        return SecurityZones.HIGH;
    }
    
    // Публичная зона - статические файлы
    if (url.startsWith('/uploads') || 
        url.startsWith('/js') || 
        url.startsWith('/css') ||
        url.match(/\.(jpg|jpeg|png|gif|css|js|ico|svg)$/)) {
        return SecurityZones.PUBLIC;
    }
    
    // Telegram Mini App - низкая защита
    if (isTelegramRequest(req)) {
        return SecurityZones.LOW;
    }
    
    // API эндпоинты - средняя защита
    if (url.startsWith('/api') || 
        url.startsWith('/products') || 
        url.startsWith('/orders')) {
        return SecurityZones.MEDIUM;
    }
    
    // По умолчанию средняя защита
    return SecurityZones.MEDIUM;
}

// ===== TELEGRAM-FRIENDLY CSP =====

function getTelegramCSP() {
    return {
        "default-src": "'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
        "script-src": "'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://cdnjs.cloudflare.com https:",
        "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https:",
        "font-src": "'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data: https:",
        "img-src": "'self' data: https: blob:",
        "connect-src": "'self' https: wss: https://api.telegram.org",
        "frame-src": "'self' https://telegram.org https://web.telegram.org",
        "frame-ancestors": "'self' https://web.telegram.org https://telegram.org",
        "object-src": "'none'"
    };
}

function getAdminCSP() {
    return {
        "default-src": "'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
        "script-src": "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://stackpath.bootstrapcdn.com",
        "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://stackpath.bootstrapcdn.com",
        "font-src": "'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
        "img-src": "'self' data: https: blob:",
        "connect-src": "'self' https:",
        "frame-src": "'self'",
        "object-src": "'none'"
    };
}

function getStandardCSP() {
    return {
        "default-src": "'self'",
        "script-src": "'self' 'unsafe-inline'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' data: https:",
        "connect-src": "'self'",
        "object-src": "'none'"
    };
}

function formatCSP(cspObject) {
    return Object.entries(cspObject)
        .map(([directive, sources]) => `${directive} ${sources}`)
        .join('; ');
}

// ===== УМНЫЕ RATE LIMITERS =====

// Мягкий лимитер для Telegram Mini App
const telegramLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 1000, // 1000 запросов для Mini App
    message: { error: 'Слишком много запросов к Mini App' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Пропускаем статические файлы
        return req.url.startsWith('/uploads') || 
               req.url.match(/\.(jpg|jpeg|png|gif|css|js|ico|svg)$/);
    }
});

// Стандартный лимитер для API
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 200, // 200 запросов для API
    message: { error: 'Превышен лимит API запросов' },
    standardHeaders: true,
    legacyHeaders: false
});

// Строгий лимитер для админки
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // 100 запросов для админки
    message: { error: 'Превышен лимит запросов к админ панели' },
    standardHeaders: true,
    legacyHeaders: false
});

// Специальный лимитер для логина (более строгий)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // 5 попыток входа
    message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Не считать успешные запросы
});

// Валидация данных для логина
const validateLogin = (req, res, next) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            error: 'Имя пользователя и пароль обязательны' 
        });
    }
    
    if (username.length < 3 || password.length < 6) {
        return res.status(400).json({ 
            error: 'Некорректные учетные данные' 
        });
    }
    
    next();
};

// ===== MIDDLEWARE ФУНКЦИИ =====

// Умный CSP middleware
const smartCSP = (req, res, next) => {
    const zone = getSecurityZone(req);
    let csp;
    
    switch (zone) {
        case SecurityZones.HIGH:
            csp = getAdminCSP();
            break;
        case SecurityZones.LOW:
            csp = getTelegramCSP();
            break;
        case SecurityZones.PUBLIC:
            // Для статических файлов CSP не нужен
            return next();
        default:
            csp = getStandardCSP();
    }
    
    res.setHeader('Content-Security-Policy', formatCSP(csp));
    next();
};

// Умные заголовки безопасности
const smartSecurityHeaders = (req, res, next) => {
    const zone = getSecurityZone(req);
    
    // Базовые заголовки для всех
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    if (zone === SecurityZones.LOW) {
        // Telegram Mini App - мягкие заголовки
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    } else if (zone === SecurityZones.HIGH) {
        // Админ-панель - строгие заголовки
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    } else if (zone === SecurityZones.PUBLIC) {
        // Статические файлы - кеширование
        res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else {
        // Стандартные заголовки
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    
    next();
};

// Умный rate limiting
const smartRateLimit = (req, res, next) => {
    const zone = getSecurityZone(req);
    
    switch (zone) {
        case SecurityZones.HIGH:
            return adminLimiter(req, res, next);
        case SecurityZones.MEDIUM:
            return apiLimiter(req, res, next);
        case SecurityZones.LOW:
            return telegramLimiter(req, res, next);
        case SecurityZones.PUBLIC:
            // Статические файлы без лимитов
            return next();
        default:
            return apiLimiter(req, res, next);
    }
};

// Умная защита от ботов (только для неTelegram запросов)
const smartBotProtection = (req, res, next) => {
    const zone = getSecurityZone(req);
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress;
    
    // Пропускаем Telegram запросы
    if (zone === SecurityZones.LOW || isTelegramBotRequest(req)) {
        return next();
    }
    
    // Пропускаем статические файлы
    if (zone === SecurityZones.PUBLIC) {
        return next();
    }
    
    // Подозрительные паттерны только для админки и API
    const suspiciousPatterns = [
        /wp-admin|wordpress|wp-content|wp-includes/i,
        /\.php$/i,
        /phpmyadmin|pma/i,
        /xmlrpc\.php/i,
        /\/administrator\/|\/adminer\/|\/cpanel\//i,
        /\/\.env|\/config\.|\/backup/i,
        /\/sql|\/database|\/db/i,
        /\.\.|\/etc\/|\/var\/|\/tmp\//i,
        /nikto|sqlmap|nmap|dirb|gobuster|wfuzz|burp/i
    ];
    
    // Проверяем только если это админка или важный API
    if (zone === SecurityZones.HIGH || 
        (zone === SecurityZones.MEDIUM && req.url.includes('/admin'))) {
        
        if (suspiciousPatterns.some(pattern => pattern.test(req.url))) {
            console.log(`[SECURITY] Blocked suspicious request: ${ip} -> ${req.url}`);
            return res.status(404).send('Not Found');
        }
    }
    
    next();
};

module.exports = {
    isTelegramRequest,
    isTelegramBotRequest,
    getSecurityZone,
    SecurityZones,
    smartCSP,
    smartSecurityHeaders,
    smartRateLimit,
    smartBotProtection,
    
    // Экспортируем отдельные лимитеры для гибкости
    telegramLimiter,
    apiLimiter,
    adminLimiter,
    loginLimiter,
    validateLogin
}; 