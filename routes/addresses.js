const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { getAddressByCoordinates } = require('../services/yandex-maps');

// Логирование для отладки
function logAddresses(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[ADDRESSES API] ${type} - ${message} - ${timestamp}`, data);
}

// GET /addresses/:telegramId - получить все адреса пользователя
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        logAddresses('GET', `Получение адресов для пользователя: ${telegramId}`);
        
        // Получаем ID пользователя
        const user = await query(
            'SELECT id FROM users WHERE telegram_id = ?',
            [telegramId]
        );
        
        if (user.length === 0) {
            logAddresses('ERROR', `Пользователь не найден: ${telegramId}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Получаем адреса пользователя
        const addresses = await query(
            'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
            [user[0].id]
        );
        
        logAddresses('SUCCESS', `Найдено адресов: ${addresses.length}`);
        res.json(addresses);
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при получении адресов', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /addresses - создать новый адрес
router.post('/', async (req, res) => {
    try {
        const { 
            telegram_id, 
            name, 
            latitude, 
            longitude, 
            full_address, 
            entrance, 
            floor, 
            apartment, 
            intercom, 
            comment, 
            is_default 
        } = req.body;
        
        logAddresses('POST', `Создание нового адреса для пользователя: ${telegram_id}`, {
            name,
            full_address,
            is_default
        });
        
        // Валидация обязательных полей
        if (!telegram_id) {
            logAddresses('ERROR', 'Не указан telegram_id');
            return res.status(400).json({ error: 'Не указан telegram_id' });
        }
        
        if (!name || !full_address) {
            logAddresses('ERROR', 'Не указаны обязательные поля: name или full_address');
            return res.status(400).json({ error: 'Обязательные поля: название и полный адрес' });
        }
        
        // Получаем ID пользователя
        const user = await query(
            'SELECT id FROM users WHERE telegram_id = ?',
            [telegram_id]
        );
        
        if (user.length === 0) {
            logAddresses('ERROR', `Пользователь не найден: ${telegram_id}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const userId = user[0].id;
        
        // Если новый адрес устанавливается как основной, убираем флаг у других адресов
        if (is_default) {
            await query(
                'UPDATE user_addresses SET is_default = 0 WHERE user_id = ?',
                [userId]
            );
            logAddresses('INFO', `Сброшен флаг is_default для других адресов пользователя ${telegram_id}`);
        }
        
        // Создаем новый адрес
        const result = await query(
            `INSERT INTO user_addresses 
             (user_id, name, latitude, longitude, full_address, entrance, floor, apartment, intercom, comment, is_default) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, 
                name || '', 
                latitude || null, 
                longitude || null, 
                full_address || '', 
                entrance || null, 
                floor || null, 
                apartment || null, 
                intercom || null, 
                comment || null, 
                is_default ? 1 : 0
            ]
        );
        
        logAddresses('SUCCESS', `Адрес создан с ID: ${result.lastID}`);
        
        // Возвращаем созданный адрес
        const newAddress = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [result.lastID]
        );
        
        res.status(201).json(newAddress[0]);
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при создании адреса', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUT /addresses/:addressId - обновить адрес
router.put('/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        const { 
            name, 
            latitude, 
            longitude, 
            full_address, 
            entrance, 
            floor, 
            apartment, 
            intercom, 
            comment, 
            is_default 
        } = req.body;
        
        logAddresses('PUT', `Обновление адреса ID: ${addressId}`, {
            name,
            full_address,
            is_default
        });
        
        // Получаем текущий адрес
        const currentAddress = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (currentAddress.length === 0) {
            logAddresses('ERROR', `Адрес не найден: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        const userId = currentAddress[0].user_id;
        
        // Если адрес устанавливается как основной, убираем флаг у других адресов
        if (is_default) {
            await query(
                'UPDATE user_addresses SET is_default = 0 WHERE user_id = ? AND id != ?',
                [userId, addressId]
            );
            logAddresses('INFO', `Сброшен флаг is_default для других адресов пользователя`);
        }
        
        // Обновляем все поля включая адрес и координаты (если переданы)
        const result = await query(
            `UPDATE user_addresses 
             SET name = ?, entrance = ?, floor = ?, apartment = ?, intercom = ?, comment = ?, 
                 is_default = ?, updated_at = CURRENT_TIMESTAMP, full_address = ?,
                 latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude)
             WHERE id = ?`,
            [name, entrance, floor, apartment, intercom, comment, is_default ? 1 : 0, full_address, latitude, longitude, addressId]
        );
        
        if (result.changes === 0) {
            logAddresses('ERROR', `Не удалось обновить адрес: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        logAddresses('SUCCESS', `Адрес обновлен: ${addressId}`, { changes: result.changes });
        
        // Возвращаем обновленный адрес
        const updatedAddress = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        logAddresses('DEBUG', `Адрес после обновления:`, { 
            id: updatedAddress[0]?.id, 
            full_address: updatedAddress[0]?.full_address,
            updated_at: updatedAddress[0]?.updated_at
        });
        
        res.json(updatedAddress[0]);
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при обновлении адреса', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// DELETE /addresses/:addressId - удалить адрес
router.delete('/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        logAddresses('DELETE', `Удаление адреса ID: ${addressId}`);
        
        // Проверяем, существует ли адрес
        const address = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (address.length === 0) {
            logAddresses('ERROR', `Адрес не найден: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        // Удаляем адрес
        const result = await query(
            'DELETE FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (result.changes === 0) {
            logAddresses('ERROR', `Не удалось удалить адрес: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        logAddresses('SUCCESS', `Адрес удален: ${addressId}`);
        res.json({ message: 'Адрес успешно удален' });
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при удалении адреса', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /addresses/geocode - геокодирование координат в адрес
router.post('/geocode', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        logAddresses('POST', `Геокодирование координат: ${latitude}, ${longitude}`);
        
        if (!latitude || !longitude) {
            logAddresses('ERROR', 'Отсутствуют координаты для геокодирования');
            return res.status(400).json({ error: 'Требуются координаты latitude и longitude' });
        }
        
        // Используем интеграцию с Яндекс.Картами
        const addressData = await getAddressByCoordinates(latitude, longitude);
        
        logAddresses('SUCCESS', `Геокодирование выполнено: ${addressData.full_address}`);
        res.json(addressData);
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при геокодировании', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// GET /addresses/:addressId - получить конкретный адрес
router.get('/address/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        logAddresses('GET', `Получение адреса ID: ${addressId}`);
        
        const address = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (address.length === 0) {
            logAddresses('ERROR', `Адрес не найден: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        logAddresses('SUCCESS', `Адрес найден: ${address[0].name}`);
        res.json(address[0]);
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при получении адреса', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUT /addresses/address/:addressId/default - установить адрес по умолчанию
router.put('/address/:addressId/default', async (req, res) => {
    try {
        const { addressId } = req.params;
        logAddresses('PUT', `Установка адреса по умолчанию ID: ${addressId}`);
        
        // Получаем адрес для проверки существования
        const address = await query(
            'SELECT user_id FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (address.length === 0) {
            logAddresses('ERROR', `Адрес не найден: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        const userId = address[0].user_id;
        
        // Сбрасываем флаг по умолчанию для всех адресов пользователя
        await query(
            'UPDATE user_addresses SET is_default = 0 WHERE user_id = ?',
            [userId]
        );
        
        // Устанавливаем новый адрес по умолчанию
        await query(
            'UPDATE user_addresses SET is_default = 1 WHERE id = ?',
            [addressId]
        );
        
        logAddresses('SUCCESS', `Адрес ${addressId} установлен по умолчанию`);
        res.json({ success: true, message: 'Адрес установлен по умолчанию' });
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при установке адреса по умолчанию', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// DELETE /addresses/address/:addressId - удалить адрес
router.delete('/address/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        logAddresses('DELETE', `Удаление адреса ID: ${addressId}`);
        
        // Проверяем существование адреса
        const address = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (address.length === 0) {
            logAddresses('ERROR', `Адрес не найден: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        // Удаляем адрес
        await query(
            'DELETE FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        logAddresses('SUCCESS', `Адрес ${addressId} удален`);
        res.json({ success: true, message: 'Адрес удален' });
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при удалении адреса', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUT /addresses/admin/:addressId - обновить админские координаты (только для админов)
router.put('/admin/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        const { admin_latitude, admin_longitude, admin_coordinate_comment } = req.body;
        
        logAddresses('PUT', `Обновление админских координат для адреса ID: ${addressId}`, {
            admin_latitude,
            admin_longitude,
            admin_coordinate_comment
        });
        
        // Проверяем существование адреса
        const address = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        if (address.length === 0) {
            logAddresses('ERROR', `Адрес не найден: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        // Обновляем только админские поля
        const result = await query(
            `UPDATE user_addresses 
             SET admin_latitude = ?, admin_longitude = ?, admin_coordinate_comment = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [admin_latitude, admin_longitude, admin_coordinate_comment, addressId]
        );
        
        if (result.changes === 0) {
            logAddresses('ERROR', `Не удалось обновить админские координаты: ${addressId}`);
            return res.status(404).json({ error: 'Адрес не найден' });
        }
        
        logAddresses('SUCCESS', `Админские координаты обновлены для адреса: ${addressId}`);
        
        // Возвращаем обновленный адрес
        const updatedAddress = await query(
            'SELECT * FROM user_addresses WHERE id = ?',
            [addressId]
        );
        
        res.json(updatedAddress[0]);
    } catch (error) {
        logAddresses('ERROR', 'Ошибка при обновлении админских координат', { error: error.message });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router; 