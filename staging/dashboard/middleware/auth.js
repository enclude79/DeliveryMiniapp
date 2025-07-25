const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Простая аутентификация для dashboard
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'dashboard-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Простая валидация логина
const validateLogin = (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }
    next();
};

// Проверка учетных данных
const checkCredentials = async (username, password) => {
    const expectedUsername = process.env.ADMIN_USERNAME || 'dev_admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'dev_password123';
    
    return username === expectedUsername && password === expectedPassword;
};

module.exports = {
    authenticateToken,
    validateLogin,
    checkCredentials
}; 