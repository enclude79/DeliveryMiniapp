const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const { query } = require('../database');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Middleware для логирования всех запросов к заказам
router.use((req, res, next) => {
    console.log(`[ORDERS API] ${req.method} ${req.url} - IP: ${req.ip} - Time: ${new Date().toISOString()}`);
    if (Object.keys(req.query).length > 0) {
        console.log(`[ORDERS API] Query params:`, req.query);
    }
    if (Object.keys(req.params).length > 0) {
        console.log(`[ORDERS API] Route params:`, req.params);
    }
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`[ORDERS API] Body:`, req.body);
    }
    next();
});

// НОВЫЙ МАРШРУТ: Создание заказа из Mini App
router.post('/miniapp', async (req, res) => {
    try {
        console.log('[ORDERS API] Creating order from Mini App');
        const { items, total, user_id, user_data } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.log('[ORDERS API] Invalid items data');
            return res.status(400).json({ error: 'Некорректные данные товаров' });
        }

        if (!total || total <= 0) {
            console.log('[ORDERS API] Invalid total amount');
            return res.status(400).json({ error: 'Некорректная сумма заказа' });
        }

        // Получаем или создаем пользователя
        let [user] = await query('SELECT id FROM users WHERE telegram_id = ?', [user_id]);
        let userId;

        if (!user) {
            console.log(`[ORDERS API] Creating new user with telegram_id: ${user_id}`);
            const result = await query(
                'INSERT INTO users (telegram_id, first_name, last_name, username) VALUES (?, ?, ?, ?)',
                [user_id, user_data?.first_name || '', user_data?.last_name || '', user_data?.username || '']
            );
            userId = result.lastID;
        } else {
            userId = user.id;
            console.log(`[ORDERS API] Using existing user ID: ${userId}`);
        }

        // Создаем заказ
        console.log(`[ORDERS API] Creating order for user ${userId}, total: ${total}₽, items: ${items.length}`);
        const result = await query(
            'INSERT INTO orders (user_id, total, items, address, status, created_at) VALUES (?, ?, ?, ?, "pending", datetime("now"))',
            [userId, total, JSON.stringify(items), JSON.stringify({})]
        );
        
        const orderId = result.lastID;
        console.log(`[ORDERS API] Created order #${orderId}`);

        // Добавляем товары заказа
        for (const item of items) {
            await query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price]
            );
            console.log(`[ORDERS API] Added item: ${item.name} x${item.quantity} = ${item.price * item.quantity}₽`);
        }

        // Отправляем уведомление в Telegram
        try {
            const itemsList = items.map(item => `• ${item.name} x${item.quantity} = ${item.price * item.quantity}₽`).join('\n');
            const message = `🆕 Новый заказ #${orderId}\n\n${itemsList}\n\n💰 Итого: ${total}₽\n\n✅ Заказ принят в обработку!`;
            await bot.sendMessage(user_id, message);
            console.log(`[ORDERS API] Notification sent to user ${user_id}`);
        } catch (botError) {
            console.error('[ORDERS API] Ошибка отправки уведомления:', botError);
        }

        res.json({ 
            success: true, 
            order_id: orderId,
            message: 'Заказ успешно создан!'
        });
    } catch (error) {
        console.error('[ORDERS API] Ошибка создания заказа из Mini App:', error);
        res.status(500).json({ error: 'Ошибка создания заказа' });
    }
});

// Создание заказа (новая версия)
router.post('/', async (req, res) => {
    try {
        console.log('[ORDERS API] Creating order');
        const { user_id, telegram_id, items, total, address, address_details, comment } = req.body;

        // Проверяем обязательные поля
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.log('[ORDERS API] Invalid items data');
            return res.status(400).json({ error: 'Некорректные данные товаров' });
        }

        if (!total || total <= 0) {
            console.log('[ORDERS API] Invalid total amount');
            return res.status(400).json({ error: 'Некорректная сумма заказа' });
        }

        if (!telegram_id) {
            console.log('[ORDERS API] Missing telegram_id');
            return res.status(400).json({ error: 'Не указан telegram_id' });
        }

        // Получаем пользователя
        let [user] = await query('SELECT id FROM users WHERE telegram_id = ?', [telegram_id]);
        let userId;

        if (!user) {
            console.log(`[ORDERS API] User not found with telegram_id: ${telegram_id}`);
            return res.status(400).json({ error: 'Пользователь не найден' });
        } else {
            userId = user.id;
            console.log(`[ORDERS API] Using user ID: ${userId}`);
        }

        // Создаем заказ
        console.log(`[ORDERS API] Creating order for user ${userId}, total: ${total}₽, items: ${items.length}`);
        const result = await query(
            'INSERT INTO orders (user_id, items, total, address, comment, status, created_at) VALUES (?, ?, ?, ?, ?, "pending", datetime("now"))',
            [userId, JSON.stringify(items), total, address || '', comment || '']
        );
        
        const orderId = result.lastID;
        console.log(`[ORDERS API] Created order #${orderId}`);

        // Добавляем товары заказа
        for (const item of items) {
            await query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price]
            );
            console.log(`[ORDERS API] Added item: ${item.name} x${item.quantity} = ${item.price * item.quantity}₽`);
        }

        // Отправляем уведомление в Telegram
        try {
            const itemsList = items.map(item => `• ${item.name} x${item.quantity} = ${item.price * item.quantity}₽`).join('\n');
            const addressText = address ? `📍 Адрес: ${address}` : '';
            const message = `🆕 Новый заказ #${orderId}\n\n${itemsList}\n\n💰 Итого: ${total}₽\n${addressText}\n\n✅ Заказ принят в обработку!`;
            
            await bot.sendMessage(telegram_id, message);
            console.log(`[ORDERS API] Notification sent to user ${telegram_id}`);
        } catch (botError) {
            console.error('[ORDERS API] Ошибка отправки уведомления:', botError);
        }

        // Возвращаем созданный заказ
        const [createdOrder] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
        
        res.json({ 
            success: true, 
            id: orderId,
            order_id: orderId,
            ...createdOrder,
            message: 'Заказ успешно создан!'
        });
    } catch (error) {
        console.error('[ORDERS API] Ошибка создания заказа:', error);
        res.status(500).json({ error: 'Ошибка создания заказа' });
    }
});

// Получение заказов пользователя
router.get('/user/:telegram_id', async (req, res) => {
    try {
        const { telegram_id } = req.params;
        console.log(`[ORDERS API] Getting orders for user: ${telegram_id}`);
        const orders = await query(`
            SELECT o.*
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE u.telegram_id = ?
            ORDER BY o.created_at DESC
        `, [telegram_id]);
        
        console.log(`[ORDERS API] Found ${orders.length} orders for user ${telegram_id}`);
        res.json(orders);
    } catch (error) {
        console.error('[ORDERS API] Ошибка получения заказов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 