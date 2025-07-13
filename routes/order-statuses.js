const express = require('express');
const router = express.Router();
const { query } = require('../database');

// Получить все статусы заказов
router.get('/', async (req, res) => {
    try {
        const statuses = await query(`
            SELECT * FROM order_statuses 
            WHERE is_active = 1 
            ORDER BY order_priority ASC
        `);
        
        res.json(statuses);
    } catch (error) {
        console.error('Ошибка получения статусов заказов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить конкретный статус
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [status] = await query('SELECT * FROM order_statuses WHERE id = ?', [id]);
        
        if (!status) {
            return res.status(404).json({ error: 'Статус не найден' });
        }
        
        res.json(status);
    } catch (error) {
        console.error('Ошибка получения статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новый статус
router.post('/', async (req, res) => {
    try {
        const { key, name, description, order_priority, color, is_final } = req.body;
        
        // Валидация обязательных полей
        if (!key || !name || !order_priority) {
            return res.status(400).json({ 
                error: 'Обязательные поля: key, name, order_priority' 
            });
        }
        
        // Проверяем уникальность ключа
        const [existingKey] = await query('SELECT id FROM order_statuses WHERE key = ?', [key]);
        if (existingKey) {
            return res.status(409).json({ error: 'Статус с таким ключом уже существует' });
        }
        
        // Проверяем уникальность приоритета
        const [existingPriority] = await query('SELECT id FROM order_statuses WHERE order_priority = ?', [order_priority]);
        if (existingPriority) {
            return res.status(409).json({ error: 'Статус с такой очередностью уже существует' });
        }
        
        // Создаем новый статус
        const result = await query(`
            INSERT INTO order_statuses 
            (key, name, description, order_priority, color, is_active, is_final) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            key,
            name,
            description || null,
            order_priority,
            color || '#6B7280',
            1, // Новые статусы активны по умолчанию
            is_final ? 1 : 0
        ]);
        
        // Получаем созданный статус
        const [newStatus] = await query('SELECT * FROM order_statuses WHERE id = ?', [result.lastID]);
        
        res.status(201).json(newStatus);
    } catch (error) {
        console.error('Ошибка создания статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить статус
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { key, name, description, order_priority, color, is_active, is_final } = req.body;
        
        // Проверяем существование статуса
        const [existingStatus] = await query('SELECT * FROM order_statuses WHERE id = ?', [id]);
        if (!existingStatus) {
            return res.status(404).json({ error: 'Статус не найден' });
        }
        
        // Если изменяется ключ, проверяем уникальность
        if (key && key !== existingStatus.key) {
            const [existingKey] = await query('SELECT id FROM order_statuses WHERE key = ? AND id != ?', [key, id]);
            if (existingKey) {
                return res.status(409).json({ error: 'Статус с таким ключом уже существует' });
            }
        }
        
        // Если изменяется приоритет, проверяем уникальность
        if (order_priority && order_priority !== existingStatus.order_priority) {
            const [existingPriority] = await query('SELECT id FROM order_statuses WHERE order_priority = ? AND id != ?', [order_priority, id]);
            if (existingPriority) {
                return res.status(409).json({ error: 'Статус с такой очередностью уже существует' });
            }
        }
        
        // Обновляем статус
        await query(`
            UPDATE order_statuses 
            SET key = COALESCE(?, key),
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                order_priority = COALESCE(?, order_priority),
                color = COALESCE(?, color),
                is_active = COALESCE(?, is_active),
                is_final = COALESCE(?, is_final),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [key, name, description, order_priority, color, is_active, is_final, id]);
        
        // Получаем обновленный статус
        const [updatedStatus] = await query('SELECT * FROM order_statuses WHERE id = ?', [id]);
        
        res.json(updatedStatus);
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить статус
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем существование статуса
        const [existingStatus] = await query('SELECT * FROM order_statuses WHERE id = ?', [id]);
        if (!existingStatus) {
            return res.status(404).json({ error: 'Статус не найден' });
        }
        
        // Проверяем, используется ли статус в заказах
        const [ordersWithStatus] = await query('SELECT COUNT(*) as count FROM orders WHERE status = ?', [existingStatus.key]);
        if (ordersWithStatus.count > 0) {
            return res.status(400).json({ 
                error: `Нельзя удалить статус, используется в ${ordersWithStatus.count} заказах` 
            });
        }
        
        // Удаляем статус
        await query('DELETE FROM order_statuses WHERE id = ?', [id]);
        
        res.json({ 
            success: true, 
            message: 'Статус успешно удален',
            deleted_status: existingStatus
        });
    } catch (error) {
        console.error('Ошибка удаления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Изменить порядок статусов (массовое обновление приоритетов)
router.put('/reorder', async (req, res) => {
    try {
        const { statusIds } = req.body;
        
        if (!Array.isArray(statusIds) || statusIds.length === 0) {
            return res.status(400).json({ error: 'Требуется массив ID статусов' });
        }
        
        // Обновляем приоритеты
        for (let i = 0; i < statusIds.length; i++) {
            await query(
                'UPDATE order_statuses SET order_priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [i + 1, statusIds[i]]
            );
        }
        
        // Получаем обновленный список
        const statuses = await query(`
            SELECT * FROM order_statuses 
            WHERE is_active = 1 
            ORDER BY order_priority ASC
        `);
        
        res.json({ 
            success: true, 
            message: 'Порядок статусов обновлен',
            statuses 
        });
    } catch (error) {
        console.error('Ошибка изменения порядка статусов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 