const rateLimit = require('express-rate-limit');
const config = require('../config');

// Общий rate limiter для всех API запросов
const generalRateLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs, // 15 минут
    max: config.rateLimitMax, // максимум 100 запросов
    message: {
        error: 'Слишком много запросов. Попробуйте позже.',
        retryAfter: Math.ceil(config.rateLimitWindowMs / 1000 / 60) // минуты
    },
    standardHeaders: true, // Возвращает заголовки `RateLimit-*`
    legacyHeaders: false, // Отключает заголовки `X-RateLimit-*`
    handler: (req, res) => {
        res.status(429).json({
            error: 'Слишком много запросов',
            message: `Превышен лимит запросов. Максимум ${config.rateLimitMax} запросов за ${Math.ceil(config.rateLimitWindowMs / 1000 / 60)} минут.`,
            retryAfter: Math.ceil(config.rateLimitWindowMs / 1000 / 60)
        });
    }
});

// Специальный rate limiter для логина (более строгий)
const loginRateLimiter = rateLimit({
    windowMs: config.loginRateLimitWindowMs, // 15 минут
    max: config.loginRateLimitMax, // максимум 5 попыток
    message: {
        error: 'Слишком много попыток входа. Попробуйте позже.',
        retryAfter: Math.ceil(config.loginRateLimitWindowMs / 1000 / 60) // минуты
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Не учитывает успешные попытки
    handler: (req, res) => {
        res.status(429).json({
            error: 'Слишком много попыток входа',
            message: `Превышен лимит попыток входа. Максимум ${config.loginRateLimitMax} попыток за ${Math.ceil(config.loginRateLimitWindowMs / 1000 / 60)} минут.`,
            retryAfter: Math.ceil(config.loginRateLimitWindowMs / 1000 / 60)
        });
    }
});

// Rate limiter для API endpoints (менее строгий)
const apiRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 минут
    max: 200, // максимум 200 запросов
    message: {
        error: 'Слишком много API запросов. Попробуйте позже.',
        retryAfter: 5 // минуты
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Слишком много API запросов',
            message: 'Превышен лимит API запросов. Попробуйте через 5 минут.',
            retryAfter: 5
        });
    }
});

module.exports = {
    generalRateLimiter,
    loginRateLimiter,
    apiRateLimiter
}; 