const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { validateLogin, checkCredentials } = require('../middleware/auth');

// Логин для dashboard
router.post('/login', validateLogin, async (req, res) => {
    const { username, password } = req.body;

    try {
        const isValid = await checkCredentials(username, password);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const token = jwt.sign(
            { username: username, role: 'admin' }, 
            process.env.JWT_SECRET || 'dashboard-secret-key', 
            { expiresIn: '24h' }
        );
        
        res.json({ 
            success: true,
            token,
            user: { username, role: 'admin' }
        });
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Проверка токена
router.get('/verify', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'dashboard-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        res.json({ valid: true, user });
    });
});

module.exports = router; 