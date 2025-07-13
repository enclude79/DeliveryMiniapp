const express = require('express');
const router = express.Router();
const { query } = require('../database');

// Middleware для логирования всех запросов к продуктам
router.use((req, res, next) => {
    console.log(`[PRODUCTS API] ${req.method} ${req.url} - IP: ${req.ip} - Time: ${new Date().toISOString()}`);
    if (Object.keys(req.query).length > 0) {
        console.log(`[PRODUCTS API] Query params:`, req.query);
    }
    if (Object.keys(req.params).length > 0) {
        console.log(`[PRODUCTS API] Route params:`, req.params);
    }
    next();
});

// Получение списка продуктов
router.get('/', async (req, res) => {
    try {
        const { category_id } = req.query;
        let sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1 AND (p.discontinued IS NULL OR p.discontinued = 0)';
        const params = [];
        
        if (category_id) {
            sql += ' AND p.category_id = ?';
            params.push(category_id);
        }
        
        sql += ' ORDER BY p.order_priority ASC, p.name ASC';
        console.log(`[PRODUCTS API] Executing SQL:`, sql, 'Params:', params);
        const products = await query(sql, params);
        console.log(`[PRODUCTS API] Found ${products.length} products`);
        res.json(products);
    } catch (error) {
        console.error('[PRODUCTS API] Ошибка получения продуктов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение списка категорий
router.get('/categories', async (req, res) => {
    try {
        console.log('[PRODUCTS API] Getting categories');
        const categories = await query('SELECT * FROM categories ORDER BY order_priority ASC, name ASC');
        console.log(`[PRODUCTS API] Found ${categories.length} categories:`, categories.map(c => c.name));
        res.json(categories);
    } catch (error) {
        console.error('[PRODUCTS API] Ошибка получения категорий:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// НОВЫЙ МАРШРУТ: Получение продуктов по категории (для Mini App)
router.get('/category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[PRODUCTS API] Getting products for category ID: ${id}`);
        
        const sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id = ? AND p.active = 1 ORDER BY p.order_priority ASC, p.name ASC';
        const products = await query(sql, [id]);
        
        console.log(`[PRODUCTS API] Found ${products.length} products for category ${id}`);
        if (products.length > 0) {
            console.log(`[PRODUCTS API] Products:`, products.map(p => `${p.name} (${p.price}₽)`));
        }
        
        res.json(products);
    } catch (error) {
        console.error('[PRODUCTS API] Ошибка получения продуктов категории:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение продукта по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[PRODUCTS API] Getting product by ID: ${id}`);
        const [product] = await query(
            'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
            [id]
        );
        
        if (!product) {
            console.log(`[PRODUCTS API] Product ${id} not found`);
            return res.status(404).json({ error: 'Продукт не найден' });
        }
        
        console.log(`[PRODUCTS API] Found product: ${product.name}`);
        res.json(product);
    } catch (error) {
        console.error('[PRODUCTS API] Ошибка получения продукта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 