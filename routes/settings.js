const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { cache } = require('../cache');

// Получить все настройки
router.get('/', async (req, res) => {
    try {
        // Используем кэширование с TTL 5 минут
        const settingsMap = await cache.memoize('all_settings', async () => {
            console.log('[SETTINGS API] Loading all settings from database');
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
            
            return settingsMap;
        }, 5 * 60 * 1000);
        
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
        
        // Используем кэширование с TTL 5 минут
        const setting = await cache.memoize(`setting_${key}`, async () => {
            console.log(`[SETTINGS API] Loading setting ${key} from database`);
            const settings = await query('SELECT * FROM app_settings WHERE setting_key = ?', [key]);
            
            if (settings.length === 0) {
                return null;
            }
            
            return settings[0];
        }, 5 * 60 * 1000);
        
        if (!setting) {
            return res.status(404).json({ error: 'Настройка не найдена' });
        }
        
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
        
        // Сбрасываем кэш настроек
        cache.delete('all_settings');
        cache.delete(`setting_${key}`);
        
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
        
        // Сбрасываем кэш настроек
        cache.delete('all_settings');
        
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
        
        // Сбрасываем кэш настроек
        cache.delete('all_settings');
        cache.delete(`setting_${key}`);
        
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