const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { query } = require('../database');

const router = express.Router();

// Проверка подписи Telegram Web App
function verifyTelegramWebAppData(initData, botToken) {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
}

// Middleware для проверки Telegram Web App данных
const verifyTelegramUser = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'] || req.body.initData;
    
    if (!initData) {
        // В режиме разработки можем пропустить проверку
        if (process.env.NODE_ENV === 'development') {
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const isValid = verifyTelegramWebAppData(initData, process.env.TELEGRAM_BOT_TOKEN);
        if (!isValid && process.env.NODE_ENV !== 'development') {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Парсим данные пользователя
        const urlParams = new URLSearchParams(initData);
        const userParam = urlParams.get('user');
        if (userParam) {
            req.telegramUser = JSON.parse(decodeURIComponent(userParam));
        }
        
        next();
    } catch (error) {
        console.error('Ошибка проверки Telegram данных:', error);
        res.status(401).json({ error: 'Invalid data' });
    }
};

// Главная страница Mini App
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'miniapp.html'));
});

// Получение категорий
router.get('/categories', async (req, res) => {
    try {
        const categories = await query('SELECT * FROM categories ORDER BY name');
        res.json(categories);
    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение товаров по категории
router.get('/category/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const products = await query(
            'SELECT * FROM products WHERE category_id = ? ORDER BY name',
            [categoryId]
        );
        res.json(products);
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение всех товаров
router.get('/products', async (req, res) => {
    try {
        const products = await query(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY c.name, p.name
        `);
        res.json(products);
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение информации о товаре
router.get('/product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const [product] = await query(
            `SELECT p.*, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ?`,
            [productId]
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создание заказа
router.post('/order', verifyTelegramUser, async (req, res) => {
    try {
        const { items, total, customer_name, phone, address } = req.body;
        const userId = req.telegramUser?.id || 'anonymous';

        // Создаем заказ
        const orderResult = await query(
            `INSERT INTO orders (user_id, status, created_at, customer_name, phone, address, total_amount) 
             VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
            [userId, 'new', customer_name, phone, address, total]
        );
        
        const orderId = orderResult.lastID;

        // Добавляем товары заказа
        for (const item of items) {
            await query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price]
            );
        }

        res.json({
            success: true,
            orderId,
            message: 'Заказ успешно создан'
        });

    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});

// Получение заказов пользователя
router.get('/orders', verifyTelegramUser, async (req, res) => {
    try {
        const userId = req.telegramUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Пользователь не авторизован' });
        }

        const orders = await query(
            `SELECT o.*, 
                    GROUP_CONCAT(
                        CONCAT(p.name, ' x', oi.quantity, ' = ', (oi.price * oi.quantity), ' ₽')
                        SEPARATOR '; '
                    ) as items_description
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE o.user_id = ?
             GROUP BY o.id
             ORDER BY o.created_at DESC`,
            [userId]
        );

        res.json(orders);
    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        res.status(500).json({ error: 'Ошибка при получении заказов' });
    }
});

// Webhook для обработки данных от Telegram Web App
router.post('/webhook', (req, res) => {
    try {
        const { queryId, user, data } = req.body;
        
        // Обрабатываем данные заказа полученные от Mini App
        const orderData = JSON.parse(data);
        
        console.log('Получены данные заказа:', orderData);
        console.log('От пользователя:', user);
        
        // Здесь можно обработать заказ и ответить пользователю
        // через Telegram Bot API
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка webhook:', error);
        res.status(500).json({ error: 'Ошибка обработки webhook' });
    }
});

module.exports = router; 