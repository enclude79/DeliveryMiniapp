const express = require('express');
const router = express.Router();
const { query } = require('../database');

// Логирование для отладки
function logUsers(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[USERS API] ${type} - ${message} - ${timestamp}`, data);
}

// GET /users/:telegramId - получить пользователя по Telegram ID
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        logUsers('GET', `Получение пользователя по Telegram ID: ${telegramId}`);
        
        const user = await query(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );
        
        if (user.length === 0) {
            logUsers('INFO', `Пользователь не найден: ${telegramId}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        logUsers('SUCCESS', `Пользователь найден: ${user[0].first_name} ${user[0].last_name}`);
        res.json(user[0]);
    } catch (error) {
        logUsers('ERROR', 'Ошибка при получении пользователя', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /users - создать или обновить пользователя
router.post('/', async (req, res) => {
    try {
        const { telegram_id, first_name, last_name, username, phone, display_name } = req.body;
        
        logUsers('POST', `Создание/обновление пользователя: ${telegram_id}`, {
            first_name,
            last_name,
            username,
            phone,
            display_name
        });
        
        // Проверяем, существует ли пользователь
        const existingUser = await query(
            'SELECT id FROM users WHERE telegram_id = ?',
            [telegram_id]
        );
        
        if (existingUser.length > 0) {
            // Обновляем существующего пользователя (НЕ ЗАТИРАЕМ ТЕЛЕФОН И DISPLAY_NAME!)
            if (phone !== undefined && display_name !== undefined) {
                // Обновляем включая телефон и display_name только если они явно переданы
                await query(
                    `UPDATE users 
                     SET first_name = ?, last_name = ?, username = ?, phone = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE telegram_id = ?`,
                    [first_name, last_name, username, phone, display_name, telegram_id]
                );
            } else if (phone !== undefined) {
                // Обновляем включая телефон только если он явно передан
                await query(
                    `UPDATE users 
                     SET first_name = ?, last_name = ?, username = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE telegram_id = ?`,
                    [first_name, last_name, username, phone, telegram_id]
                );
            } else if (display_name !== undefined) {
                // Обновляем включая display_name только если он явно передан
                await query(
                    `UPDATE users 
                     SET first_name = ?, last_name = ?, username = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE telegram_id = ?`,
                    [first_name, last_name, username, display_name, telegram_id]
                );
            } else {
                // Обновляем без изменения телефона и display_name
                await query(
                    `UPDATE users 
                     SET first_name = ?, last_name = ?, username = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE telegram_id = ?`,
                    [first_name, last_name, username, telegram_id]
                );
            }
            
            logUsers('SUCCESS', `Пользователь обновлен: ${telegram_id}`);
            
            // Возвращаем обновленного пользователя
            const updatedUser = await query(
                'SELECT * FROM users WHERE telegram_id = ?',
                [telegram_id]
            );
            
            res.json(updatedUser[0]);
        } else {
            // Создаем нового пользователя
            const result = await query(
                `INSERT INTO users (telegram_id, first_name, last_name, username, phone, display_name) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [telegram_id, first_name, last_name, username, phone, display_name]
            );
            
            logUsers('SUCCESS', `Новый пользователь создан: ${telegram_id}, ID: ${result.lastID}`);
            
            // Возвращаем созданного пользователя
            const newUser = await query(
                'SELECT * FROM users WHERE id = ?',
                [result.lastID]
            );
            
            res.status(201).json(newUser[0]);
        }
    } catch (error) {
        logUsers('ERROR', 'Ошибка при создании/обновлении пользователя', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUT /users/:telegramId - обновить пользователя
router.put('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const { first_name, last_name, username, phone } = req.body;
        
        logUsers('PUT', `Обновление пользователя: ${telegramId}`, {
            first_name,
            last_name,
            username,
            phone
        });
        
        const result = await query(
            `UPDATE users 
             SET first_name = ?, last_name = ?, username = ?, phone = ?
             WHERE telegram_id = ?`,
            [first_name, last_name, username, phone, telegramId]
        );
        
        if (result.changes === 0) {
            logUsers('ERROR', `Пользователь не найден для обновления: ${telegramId}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        logUsers('SUCCESS', `Пользователь обновлен: ${telegramId}`);
        
        // Возвращаем обновленного пользователя
        const updatedUser = await query(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );
        
        res.json(updatedUser[0]);
    } catch (error) {
        logUsers('ERROR', 'Ошибка при обновлении пользователя', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// GET /users/phone - получить номер телефона пользователя
router.post('/phone/get', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        
        logUsers('GET', `Получение телефона для пользователя: ${telegram_id}`);
        
        // Валидация входных данных
        if (!telegram_id) {
            logUsers('ERROR', 'Отсутствует telegram_id в запросе');
            return res.status(400).json({ error: 'Отсутствует telegram_id' });
        }
        
        // Получаем данные пользователя
        const user = await query(
            'SELECT id, telegram_id, first_name, last_name, username, phone, display_name, privacy_consent, privacy_consent_date FROM users WHERE telegram_id = ?',
            [telegram_id]
        );
        
        if (user.length === 0) {
            logUsers('ERROR', `Пользователь не найден: ${telegram_id}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Проверяем наличие номера телефона
        if (!user[0].phone) {
            logUsers('INFO', `Номер телефона отсутствует для пользователя: ${telegram_id}`);
            return res.status(404).json({ error: 'Отсутствует номер телефона' });
        }
        
        logUsers('SUCCESS', `Телефон найден для пользователя: ${telegram_id}`);
        res.json({
            success: true,
            user: user[0]
        });
        
    } catch (error) {
        logUsers('ERROR', 'Ошибка при получении телефона', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /users/phone - сохранить номер телефона, имя для обращения и согласие на обработку ПД
router.post('/phone', async (req, res) => {
    try {
        const { telegram_id, phone, display_name, privacy_consent } = req.body;
        
        logUsers('POST', `Сохранение телефона для пользователя: ${telegram_id}`, {
            phone: phone ? phone.substring(0, 8) + '***' : null, // Маскируем телефон в логах
            display_name,
            privacy_consent
        });
        
        // Валидация входных данных
        if (!telegram_id) {
            logUsers('ERROR', 'Отсутствует telegram_id');
            return res.status(400).json({ error: 'Отсутствует telegram_id' });
        }
        
        if (!phone) {
            logUsers('ERROR', 'Отсутствует номер телефона');
            return res.status(400).json({ error: 'Отсутствует номер телефона' });
        }
        
        if (!privacy_consent) {
            logUsers('ERROR', 'Отсутствует согласие на обработку ПД');
            return res.status(400).json({ error: 'Необходимо согласие на обработку персональных данных' });
        }
        
        // Валидация display_name
        if (!display_name || display_name.trim().length === 0) {
            logUsers('ERROR', 'Отсутствует имя для обращения');
            return res.status(400).json({ error: 'Необходимо указать имя для обращения' });
        }
        
        if (display_name.length > 50) {
            logUsers('ERROR', 'Имя для обращения слишком длинное');
            return res.status(400).json({ error: 'Имя для обращения не должно превышать 50 символов' });
        }
        
        // Проверяем, что имя содержит только буквы и пробелы
        const displayNameRegex = /^[а-яёa-zA-Z\s]+$/i;
        if (!displayNameRegex.test(display_name.trim())) {
            logUsers('ERROR', 'Имя для обращения содержит недопустимые символы');
            return res.status(400).json({ error: 'Имя для обращения может содержать только буквы и пробелы' });
        }
        
        // Валидация формата российского номера
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 11 || (!phoneDigits.startsWith('7') && !phoneDigits.startsWith('8'))) {
            logUsers('ERROR', 'Некорректный формат номера телефона');
            return res.status(400).json({ error: 'Некорректный формат номера телефона' });
        }
        
        // Проверка кода оператора (должен начинаться с 9)
        const operatorCode = phoneDigits.substring(1, 4);
        if (!operatorCode.startsWith('9')) {
            logUsers('ERROR', 'Некорректный код мобильного оператора');
            return res.status(400).json({ error: 'Номер должен быть мобильным российским' });
        }
        
        // Нормализуем номер (заменяем 8 на 7)
        const normalizedPhone = phoneDigits.startsWith('8') ? '7' + phoneDigits.substring(1) : phoneDigits;
        const formattedPhone = `+${normalizedPhone.substring(0, 1)} (${normalizedPhone.substring(1, 4)}) ${normalizedPhone.substring(4, 7)}-${normalizedPhone.substring(7, 9)}-${normalizedPhone.substring(9, 11)}`;
        
        // Проверяем, существует ли пользователь
        const existingUser = await query(
            'SELECT id, phone FROM users WHERE telegram_id = ?',
            [telegram_id]
        );
        
        if (existingUser.length === 0) {
            logUsers('ERROR', `Пользователь не найден: ${telegram_id}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Проверяем, не занят ли номер другим пользователем
        const phoneCheck = await query(
            'SELECT telegram_id FROM users WHERE phone = ? AND telegram_id != ?',
            [formattedPhone, telegram_id]
        );
        
        if (phoneCheck.length > 0) {
            logUsers('ERROR', `Номер телефона уже используется другим пользователем`);
            return res.status(409).json({ error: 'Этот номер телефона уже используется' });
        }
        
        // Обновляем номер телефона, имя для обращения и согласие
        await query(
            `UPDATE users 
             SET phone = ?, display_name = ?, privacy_consent = ?, privacy_consent_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE telegram_id = ?`,
            [formattedPhone, display_name.trim(), privacy_consent ? 1 : 0, telegram_id]
        );
        
        logUsers('SUCCESS', `Телефон и согласие на ПД сохранены для пользователя: ${telegram_id}`);
        
        // Возвращаем обновленные данные пользователя
        const updatedUser = await query(
            'SELECT id, telegram_id, first_name, last_name, username, phone, display_name, privacy_consent, privacy_consent_date FROM users WHERE telegram_id = ?',
            [telegram_id]
        );
        
        res.json({
            success: true,
            message: 'Номер телефона и согласие успешно сохранены',
            user: updatedUser[0]
        });
        
    } catch (error) {
        logUsers('ERROR', 'Ошибка при сохранении телефона и согласия', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// GET /users/:telegramId/addresses - получить все адреса пользователя
router.get('/:telegramId/addresses', async (req, res) => {
    try {
        const { telegramId } = req.params;
        logUsers('GET', `Получение адресов пользователя: ${telegramId}`);
        
        // Сначала получаем ID пользователя
        const user = await query(
            'SELECT id FROM users WHERE telegram_id = ?',
            [telegramId]
        );
        
        if (user.length === 0) {
            logUsers('ERROR', `Пользователь не найден: ${telegramId}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Получаем адреса пользователя
        const addresses = await query(
            'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
            [user[0].id]
        );
        
        logUsers('SUCCESS', `Найдено адресов: ${addresses.length} для пользователя ${telegramId}`);
        res.json(addresses);
    } catch (error) {
        logUsers('ERROR', 'Ошибка при получении адресов пользователя', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 