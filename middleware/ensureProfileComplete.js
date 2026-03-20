const { query } = require('../database');

// Проверка заполненности профиля и согласия на обработку ПД
// Ищет пользователя по telegram_id (строка) или по user_id (число ID в БД)
module.exports = async function ensureProfileComplete(req, res, next) {
    try {
        // Попытка определить telegramId из разных мест запроса
        const telegramId = req.body?.telegram_id || req.body?.user_id || req.telegramUser?.id || req.params?.telegram_id;

        if (!telegramId) {
            return res.status(400).json({ error: 'Не указан telegram_id пользователя' });
        }

        const idStr = String(telegramId);
        const [user] = await query(
            'SELECT id, full_name, phone_number, privacy_consent FROM users WHERE telegram_id = ?',
            [idStr]
        );

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const missingName = !user.full_name || String(user.full_name).trim() === '';
        const missingPhone = !user.phone_number || String(user.phone_number).trim() === '';
        const noConsent = !user.privacy_consent;

        if (missingName || missingPhone || noConsent) {
            return res.status(400).json({
                error: 'Для оформления заказа укажите имя и номер телефона и подтвердите согласие на обработку данных'
            });
        }

        return next();
    } catch (error) {
        console.error('[MW ensureProfileComplete] Ошибка проверки профиля:', error);
        return res.status(500).json({ error: 'Ошибка проверки профиля' });
    }
}


