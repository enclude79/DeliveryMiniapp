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
        const { telegram_id, first_name, last_name, username, phone } = req.body;
        
        logUsers('POST', `Создание/обновление пользователя: ${telegram_id}`, {
            first_name,
            last_name,
            username,
            phone
        });
        
        // Проверяем, существует ли пользователь
        const existingUser = await query(
            'SELECT id FROM users WHERE telegram_id = ?',
            [telegram_id]
        );
        
        if (existingUser.length > 0) {
            // Обновляем существующего пользователя
            await query(
                `UPDATE users 
                 SET first_name = ?, last_name = ?, username = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE telegram_id = ?`,
                [first_name, last_name, username, phone, telegram_id]
            );
            
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
                `INSERT INTO users (telegram_id, first_name, last_name, username, phone) 
                 VALUES (?, ?, ?, ?, ?)`,
                [telegram_id, first_name, last_name, username, phone]
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