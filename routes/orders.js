const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const { query } = require('../database');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Вспомогательная функция: получить минимальную сумму заказа (в рублях)
async function getMinimumOrderAmountSafe() {
    try {
        const [setting] = await query(
            'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
            ['minimum_order_amount']
        );
        const value = setting ? Number(setting.setting_value) : NaN;
        if (Number.isNaN(value) || value < 0) {
            return 500; // безопасный дефолт
        }
        return value;
    } catch (_) {
        return 500; // при ошибке — дефолт
    }
}

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

        // Получаем или создаем пользователя (с полями профиля)
        let [user] = await query('SELECT id, full_name, phone_number, privacy_consent FROM users WHERE telegram_id = ?', [user_id]);
        let userId;

        if (!user) {
            console.log(`[ORDERS API] Creating new user with telegram_id: ${user_id}`);
            const result = await query(
                'INSERT INTO users (telegram_id, first_name, last_name, username) VALUES (?, ?, ?, ?)',
                [user_id, user_data?.first_name || '', user_data?.last_name || '', user_data?.username || '']
            );
            userId = result.lastID;
            // Загружаем полные данные пользователя для дальнейшей проверки
            const [createdUser] = await query('SELECT id, full_name, phone_number, privacy_consent FROM users WHERE id = ?', [userId]);
            user = createdUser;
        } else {
            userId = user.id;
            console.log(`[ORDERS API] Using existing user ID: ${userId}`);
        }

        // Серверная валидация профиля и согласия (для Mini App)
        const missingName = !user?.full_name || String(user.full_name).trim() === '';
        const missingPhone = !user?.phone_number || String(user.phone_number).trim() === '';
        const noConsent = !user?.privacy_consent;
        if (missingName || missingPhone || noConsent) {
            console.log('[ORDERS API] MiniApp profile validation failed', { missingName, missingPhone, noConsent });
            return res.status(400).json({
                error: 'Для оформления заказа укажите имя и номер телефона и подтвердите согласие на обработку данных'
            });
        }

        // Проверяем минимальную сумму
        const minAmount = await getMinimumOrderAmountSafe();
        const totalNumber = Number(total);
        if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
            console.log('[ORDERS API] Invalid total amount');
            return res.status(400).json({ error: 'Некорректная сумма заказа' });
        }
        if (totalNumber < minAmount) {
            console.log(`[ORDERS API] Total below minimum: total=${totalNumber}, min=${minAmount}`);
            return res.status(400).json({ error: `Минимальная сумма заказа ${minAmount}₽` });
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

        // Получаем пользователя с полями профиля для проверки
        let [user] = await query('SELECT id, full_name, phone_number, privacy_consent FROM users WHERE telegram_id = ?', [telegram_id]);
        let userId;

        if (!user) {
            console.log(`[ORDERS API] User not found with telegram_id: ${telegram_id}`);
            return res.status(400).json({ error: 'Пользователь не найден' });
        } else {
            userId = user.id;
            console.log(`[ORDERS API] Using user ID: ${userId}`);
        }

        // Серверная валидация профиля и согласия
        const missingName = !user.full_name || String(user.full_name).trim() === '';
        const missingPhone = !user.phone_number || String(user.phone_number).trim() === '';
        const noConsent = !user.privacy_consent;
        if (missingName || missingPhone || noConsent) {
            console.log('[ORDERS API] Profile validation failed', {
                missingName,
                missingPhone,
                noConsent
            });
            return res.status(400).json({
                error: 'Для оформления заказа укажите имя и номер телефона и подтвердите согласие на обработку данных'
            });
        }

        // Проверяем минимальную сумму
        const minAmount = await getMinimumOrderAmountSafe();
        const totalNumber = Number(total);
        if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
            console.log('[ORDERS API] Invalid total amount');
            return res.status(400).json({ error: 'Некорректная сумма заказа' });
        }
        if (totalNumber < minAmount) {
            console.log(`[ORDERS API] Total below minimum: total=${totalNumber}, min=${minAmount}`);
            return res.status(400).json({ error: `Минимальная сумма заказа ${minAmount}₽` });
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

// Получить детали заказа
router.get('/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[ORDERS API] Getting order details for order: ${id}`);
        
        // Получаем основную информацию о заказе
        const [order] = await query(`
            SELECT o.*, u.first_name, u.last_name, u.username, u.telegram_id
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `, [id]);
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        // Получаем товары заказа из order_items (если есть)
        const orderItems = await query(`
            SELECT oi.*, p.name as product_name, p.image, p.description
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [id]);
        
        // Если нет записей в order_items, парсим JSON из поля items
        let items = [];
        if (orderItems.length > 0) {
            items = orderItems.map(item => ({
                id: item.product_id,
                name: item.product_name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                description: item.description
            }));
        } else if (order.items) {
            try {
                items = JSON.parse(order.items);
            } catch (e) {
                console.error('[ORDERS API] Error parsing items JSON:', e);
                items = [];
            }
        }
        
        const orderDetails = {
            id: order.id,
            user: {
                id: order.user_id,
                telegram_id: order.telegram_id,
                first_name: order.first_name,
                last_name: order.last_name,
                username: order.username
            },
            items: items,
            total: order.total,
            address: order.address,
            status: order.status,
            comment: order.comment,
            operator_message: order.operator_message,
            created_at: order.created_at
        };
        
        console.log(`[ORDERS API] Order details retrieved for order ${id}`);
        res.json(orderDetails);
    } catch (error) {
        console.error('[ORDERS API] Ошибка получения деталей заказа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отменить заказ
router.put('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;
        
        console.log(`[ORDERS API] Cancelling order ${id} by user ${user_id}`);
        
        // Получаем заказ и проверяем принадлежность пользователю
        const [order] = await query(`
            SELECT o.*, u.telegram_id
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ? AND u.telegram_id = ?
        `, [id, user_id]);
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден или не принадлежит пользователю' });
        }
        
        // Получаем критический статус из настроек
        const [criticalStatusSetting] = await query(
            'SELECT setting_value FROM app_settings WHERE setting_key = ?',
            ['critical_order_status']
        );
        
        const criticalStatus = criticalStatusSetting ? criticalStatusSetting.setting_value : 'собирается';
        
        // Получаем информацию о текущем статусе заказа
        const [currentStatusInfo] = await query(
            'SELECT * FROM order_statuses WHERE key = ?',
            [order.status]
        );
        
        // Получаем информацию о критическом статусе
        const [criticalStatusInfo] = await query(
            'SELECT * FROM order_statuses WHERE key = ?',
            [criticalStatus]
        );
        
        if (!currentStatusInfo) {
            console.error(`[ORDERS API] Current status not found: ${order.status}`);
            return res.status(400).json({ error: 'Неизвестный статус заказа' });
        }
        
        if (!criticalStatusInfo) {
            console.error(`[ORDERS API] Critical status not found: ${criticalStatus}`);
            return res.status(400).json({ error: 'Неизвестный критический статус' });
        }
        
        // Проверяем, можно ли отменить заказ по очередности
        if (currentStatusInfo.order_priority >= criticalStatusInfo.order_priority && order.status !== 'отменен') {
            return res.status(400).json({ 
                error: 'Заказ нельзя отменить на данном этапе',
                current_status: order.status,
                current_priority: currentStatusInfo.order_priority,
                critical_status: criticalStatus,
                critical_priority: criticalStatusInfo.order_priority
            });
        }
        
        if (order.status === 'отменен') {
            return res.status(400).json({ error: 'Заказ уже отменен' });
        }
        
        // Отменяем заказ
        await query('UPDATE orders SET status = ? WHERE id = ?', ['отменен', id]);
        
        console.log(`[ORDERS API] Order ${id} cancelled successfully`);
        res.json({ 
            success: true, 
            message: 'Заказ успешно отменен',
            order_id: id,
            new_status: 'отменен'
        });
    } catch (error) {
        console.error('[ORDERS API] Ошибка отмены заказа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 