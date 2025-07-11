const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Создаем директорию для загрузок, если она не существует
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Разрешены только изображения!'));
    }
});

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// ВРЕМЕННО БЕЗ СЛОЖНОЙ БЕЗОПАСНОСТИ
// const telegramSecurity = require('../middleware/telegram-security');

// Простая валидация
const validateLogin = (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }
    next();
};

// Авторизация администратора
router.post('/login', validateLogin, async (req, res) => {
    const { username, password } = req.body;

    try {
        const admin = await query('SELECT * FROM admins WHERE username = ?', [username]);
        
        if (admin.length === 0) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const adminData = admin[0];
        const isValidPassword = await bcrypt.compare(password, adminData.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: adminData.id, username: adminData.username }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });
        res.json({ token });
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение списка заказов с фильтрацией
router.get('/orders', authenticateToken, async (req, res) => {
    try {
        console.log('[ADMIN API] Getting orders list');
        
        // Извлекаем параметры фильтрации
        const { 
            date_from, 
            date_to, 
            user_id, 
            telegram_id,
            status,
            page = 1,
            limit = 50
        } = req.query;
        
        let whereConditions = [];
        let params = [];
        
        // Фильтр по датам
        if (date_from) {
            whereConditions.push('DATE(o.created_at) >= ?');
            params.push(date_from);
        }
        if (date_to) {
            whereConditions.push('DATE(o.created_at) <= ?');
            params.push(date_to);
        }
        
        // Фильтр по пользователю
        if (user_id) {
            whereConditions.push('o.user_id = ?');
            params.push(user_id);
        }
        
        if (telegram_id) {
            whereConditions.push('u.telegram_id = ?');
            params.push(telegram_id);
        }
        
        // Фильтр по статусу
        if (status) {
            whereConditions.push('o.status = ?');
            params.push(status);
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        // Получаем заказы с пагинацией
        const offset = (page - 1) * limit;
        const orders = await query(`
            SELECT o.*, u.telegram_id, u.first_name, u.last_name, u.username, u.phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);
        
        // Получаем общее количество для пагинации
        const [{ total }] = await query(`
            SELECT COUNT(*) as total
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ${whereClause}
        `, params);
        
        console.log(`[ADMIN API] Found ${orders.length} orders (total: ${total})`);
        
        // Форматируем данные для админки
        const formattedOrders = orders.map(order => {
            // Определяем имя клиента из доступных данных
            const customerName = [
                order.first_name || '',
                order.last_name || ''
            ].filter(Boolean).join(' ') || order.username || `ID: ${order.telegram_id}`;
            
            // Парсим JSON данные
            let address = '';
            let items = [];
            
            // Безопасный парсинг адреса
            if (order.address) {
                try {
                    // Проверяем, является ли строка JSON
                    if (order.address.trim().startsWith('{') && order.address.trim().endsWith('}')) {
                        const addressObj = JSON.parse(order.address);
                        address = addressObj.full_address || addressObj.full || addressObj.address || order.address;
                    } else {
                        // Если не JSON, используем как текст
                        address = order.address;
                    }
                } catch (e) {
                    console.error('[ADMIN API] Error parsing order address:', e);
                    // В случае ошибки используем исходную строку
                    address = order.address;
                }
            } else {
                address = 'Не указан';
            }
            
            try {
                if (order.items) {
                    items = JSON.parse(order.items);
                }
            } catch (e) {
                console.error('[ADMIN API] Error parsing order items:', e);
            }
            
            return {
                id: order.id,
                status: order.status || 'pending',
                customer_name: customerName,
                phone: order.phone || 'Не указан',
                address: address || 'Не указан',
                total_amount: order.total,
                items: items,
                created_at: order.created_at,
                telegram_id: order.telegram_id,
                user_id: order.user_id
            };
        });
        
        // Возвращаем массив заказов (без пагинации для упрощения)
        res.json(formattedOrders);
    } catch (error) {
        console.error('[ADMIN API] Ошибка при получении заказов:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение детальной информации о заказе
router.get('/orders/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[ADMIN API] Getting order details for ID: ${id}`);
        
        const [order] = await query(`
            SELECT o.*, u.telegram_id, u.first_name, u.last_name, u.username, u.phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `, [id]);
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        // Парсим данные заказа
        let address = '';
        let items = [];
        
        // Безопасный парсинг адреса
        if (order.address) {
            try {
                // Проверяем, является ли строка JSON
                if (order.address.trim().startsWith('{') && order.address.trim().endsWith('}')) {
                    const addressObj = JSON.parse(order.address);
                    address = addressObj.full_address || addressObj.full || addressObj.address || order.address;
                } else {
                    // Если не JSON, используем как текст
                    address = order.address;
                }
            } catch (e) {
                console.error('[ADMIN API] Error parsing order address in details:', e);
                // В случае ошибки используем исходную строку
                address = order.address;
            }
        } else {
            address = 'Не указан';
        }
        
        try {
            if (order.items) {
                items = JSON.parse(order.items);
            }
        } catch (e) {
            console.error('[ADMIN API] Error parsing order items:', e);
        }
        
        const customerName = [
            order.first_name || '',
            order.last_name || ''
        ].filter(Boolean).join(' ') || order.username || `ID: ${order.telegram_id}`;
        
        const orderDetails = {
            id: order.id,
            status: order.status || 'pending',
            customer_name: customerName,
            phone: order.phone || 'Не указан',
            address: address,
            total_amount: order.total,
            items: items,
            comment: order.comment || '',
            created_at: order.created_at,
            telegram_id: order.telegram_id,
            user_id: order.user_id
        };
        
        console.log(`[ADMIN API] Order details retrieved for #${id}`);
        res.json(orderDetails);
    } catch (error) {
        console.error('[ADMIN API] Ошибка при получении деталей заказа:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение информации о клиенте
router.get('/customers/:telegram_id', authenticateToken, async (req, res) => {
    try {
        const { telegram_id } = req.params;
        console.log(`[ADMIN API] Getting customer info for telegram_id: ${telegram_id}`);
        
        // Получаем информацию о пользователе
        const [customer] = await query(`
            SELECT * FROM users WHERE telegram_id = ?
        `, [telegram_id]);
        
        if (!customer) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        
        // Получаем адреса клиента
        const addresses = await query(`
            SELECT * FROM user_addresses 
            WHERE user_id = ? 
            ORDER BY is_default DESC, created_at DESC
        `, [customer.id]);
        
        // Получаем заказы клиента
        const orders = await query(`
            SELECT * FROM orders 
            WHERE user_id = ? 
            ORDER BY created_at DESC
            LIMIT 10
        `, [customer.id]);
        
        const customerInfo = {
            id: customer.id,
            telegram_id: customer.telegram_id,
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            username: customer.username || '',
            phone: customer.phone || '',
            created_at: customer.created_at,
            addresses: addresses,
            recent_orders: orders,
            total_orders: orders.length
        };
        
        console.log(`[ADMIN API] Customer info retrieved for ${telegram_id}`);
        res.json(customerInfo);
    } catch (error) {
        console.error('[ADMIN API] Ошибка при получении информации о клиенте:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение списка всех клиентов
router.get('/customers', authenticateToken, async (req, res) => {
    try {
        console.log('[ADMIN API] Getting customers list');
        
        const { search, page = 1, limit = 20 } = req.query;
        
        let whereConditions = [];
        let params = [];
        
        if (search) {
            whereConditions.push(`(
                first_name LIKE ? OR 
                last_name LIKE ? OR 
                username LIKE ? OR 
                telegram_id LIKE ?
            )`);
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        const offset = (page - 1) * limit;
        
        // Получаем клиентов с информацией о заказах
        const customers = await query(`
            SELECT u.*, 
                   COUNT(o.id) as total_orders,
                   MAX(o.created_at) as last_order_date,
                   SUM(o.total) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);
        
        const [{ total }] = await query(`
            SELECT COUNT(DISTINCT u.id) as total
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            ${whereClause}
        `, params);
        
        const formattedCustomers = customers.map(customer => ({
            id: customer.id,
            telegram_id: customer.telegram_id,
            name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.username || `ID: ${customer.telegram_id}`,
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            username: customer.username || '',
            phone: customer.phone || '',
            total_orders: customer.total_orders || 0,
            total_spent: customer.total_spent || 0,
            last_order_date: customer.last_order_date,
            created_at: customer.created_at
        }));
        
        console.log(`[ADMIN API] Found ${customers.length} customers (total: ${total})`);
        
        res.json({
            customers: formattedCustomers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN API] Ошибка при получении списка клиентов:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Обновление статуса заказа
router.put('/orders/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await query(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, id]
        );
        
        const [updatedOrder] = await query('SELECT * FROM orders WHERE id = ?', [id]);
        if (!updatedOrder) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        res.json(updatedOrder);
    } catch (error) {
        console.error('Ошибка при обновлении статуса заказа:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение списка категорий
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await query('SELECT * FROM categories ORDER BY name');
        res.json(categories);
    } catch (error) {
        console.error('Ошибка при получении категорий:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создание новой категории
router.post('/categories', authenticateToken, async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Название категории обязательно' });
    }

    try {
        const result = await query(
            'INSERT INTO categories (name) VALUES (?)',
            [name.trim()]
        );

        res.status(201).json({
            id: result.lastID,
            name: name.trim()
        });
    } catch (error) {
        console.error('Ошибка при создании категории:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Редактирование категории
router.put('/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Название категории обязательно' });
    }

    try {
        await query(
            'UPDATE categories SET name = ? WHERE id = ?',
            [name.trim(), id]
        );

        res.json({
            id: parseInt(id),
            name: name.trim()
        });
    } catch (error) {
        console.error('Ошибка при обновлении категории:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удаление категории
router.delete('/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        // Проверяем, есть ли товары в этой категории
        const products = await query(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [id]
        );

        if (products[0].count > 0) {
            return res.status(400).json({
                error: 'Нельзя удалить категорию, содержащую товары'
            });
        }

        await query('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ message: 'Категория удалена' });
    } catch (error) {
        console.error('Ошибка при удалении категории:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение списка товаров
router.get('/products', authenticateToken, async (req, res) => {
    try {
        const products = await query(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.name
        `);
        res.json(products);
    } catch (error) {
        console.error('Ошибка при получении товаров:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создание нового товара
router.post('/products', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, description, price, weight, category_id, active } = req.body;

    if (!name || !price || !category_id) {
        return res.status(400).json({
            error: 'Название, цена и категория обязательны'
        });
    }

    try {
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const result = await query(
            `INSERT INTO products (name, description, price, weight, category_id, active, image)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, description, price, weight || null, category_id, active ? 1 : 0, imageUrl]
        );

        res.status(201).json({
            id: result.lastID,
            name,
            description,
            price,
            weight,
            category_id,
            active: active ? 1 : 0,
            image: imageUrl
        });
    } catch (error) {
        console.error('Ошибка при создании товара:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Редактирование товара
router.put('/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description, price, weight, category_id, active } = req.body;

    if (!name || !price || !category_id) {
        return res.status(400).json({
            error: 'Название, цена и категория обязательны'
        });
    }

    try {
        let sqlQuery = `
            UPDATE products 
            SET name = ?, 
                description = ?, 
                price = ?, 
                weight = ?,
                category_id = ?,
                active = ?
        `;
        let params = [name, description, price, weight || null, category_id, active ? 1 : 0];

        // Если загружен новый файл, добавляем его в запрос
        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            sqlQuery += ', image = ?';
            params.push(imageUrl);
        }

        sqlQuery += ' WHERE id = ?';
        params.push(id);

        await query(sqlQuery, params);

        const updatedProduct = await query(
            `SELECT p.*, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ?`,
            [id]
        );

        res.json(updatedProduct[0]);
    } catch (error) {
        console.error('Ошибка при обновлении товара:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удаление товара
router.delete('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        // Получаем информацию о товаре для удаления изображения
        const product = await query('SELECT image FROM products WHERE id = ?', [id]);
        
        // Удаляем товар из базы данных
        await query('DELETE FROM products WHERE id = ?', [id]);

        // Если у товара было изображение, удаляем его
        if (product[0] && product[0].image) {
            const imagePath = path.join(__dirname, '..', 'public', product[0].image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.json({ message: 'Товар удален' });
    } catch (error) {
        console.error('Ошибка при удалении товара:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Загрузка изображения
router.post('/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

module.exports = router; 