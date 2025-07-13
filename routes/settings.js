const express = require('express');
const router = express.Router();
const { query } = require('../database');

// Получить все настройки
router.get('/', async (req, res) => {
    try {
        const settings = await query('SELECT * FROM app_settings ORDER BY setting_key');
        
        // Преобразуем в удобный формат
        const settingsMap = {};
        settings.forEach(setting => {
            settingsMap[setting.setting_key] = {
                value: setting.setting_value,
                description: setting.description,
                updated_at: setting.updated_at
            };
        });
        
        res.json(settingsMap);
    } catch (error) {
        console.error('Ошибка получения настроек:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить конкретную настройку
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const settings = await query('SELECT * FROM app_settings WHERE setting_key = ?', [key]);
        
        if (settings.length === 0) {
            return res.status(404).json({ error: 'Настройка не найдена' });
        }
        
        const setting = settings[0];
        res.json({
            key: setting.setting_key,
            value: setting.setting_value,
            description: setting.description,
            updated_at: setting.updated_at
        });
    } catch (error) {
        console.error('Ошибка получения настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить настройку
router.put('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        
        if (!value) {
            return res.status(400).json({ error: 'Значение настройки обязательно' });
        }
        
        // Проверяем существование настройки
        const existing = await query('SELECT id FROM app_settings WHERE setting_key = ?', [key]);
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Настройка не найдена' });
        }
        
        // Обновляем настройку
        await query(
            'UPDATE app_settings SET setting_value = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
            [value, description || null, key]
        );
        
        res.json({ 
            success: true, 
            message: 'Настройка обновлена',
            key,
            value,
            description
        });
    } catch (error) {
        console.error('Ошибка обновления настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новую настройку
router.post('/', async (req, res) => {
    try {
        const { key, value, description } = req.body;
        
        if (!key || !value) {
            return res.status(400).json({ error: 'Ключ и значение настройки обязательны' });
        }
        
        // Проверяем, что настройка не существует
        const existing = await query('SELECT id FROM app_settings WHERE setting_key = ?', [key]);
        
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Настройка с таким ключом уже существует' });
        }
        
        // Создаем новую настройку
        await query(
            'INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
            [key, value, description || null]
        );
        
        res.status(201).json({ 
            success: true, 
            message: 'Настройка создана',
            key,
            value,
            description
        });
    } catch (error) {
        console.error('Ошибка создания настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить настройку
router.delete('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        
        // Проверяем существование настройки
        const existing = await query('SELECT id FROM app_settings WHERE setting_key = ?', [key]);
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Настройка не найдена' });
        }
        
        // Удаляем настройку
        await query('DELETE FROM app_settings WHERE setting_key = ?', [key]);
        
        res.json({ 
            success: true, 
            message: 'Настройка удалена',
            key
        });
    } catch (error) {
        console.error('Ошибка удаления настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 