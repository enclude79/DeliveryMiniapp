const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

let db;

// Инициализация базы данных с обработкой ошибок
function initDB() {
    const dbPath = path.join(__dirname, 'delivery.db');
    
    try {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к базе данных:', err);
                
                // Логируем ошибку подключения
                const errorLog = {
                    timestamp: new Date().toISOString(),
                    type: 'DATABASE_CONNECTION_ERROR',
                    error: err.message,
                    dbPath: dbPath
                };
                
                const logsDir = path.join(__dirname, 'logs');
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir);
                }
                
                fs.appendFileSync(
                    path.join(logsDir, 'error.log'),
                    JSON.stringify(errorLog) + '\n'
                );
                
                throw err;
            }
            console.log('✅ Подключение к SQLite базе данных установлено');
        });
        
        // Обработчик ошибок базы данных
        db.on('error', (err) => {
            console.error('❌ Ошибка базы данных:', err);
            
            const errorLog = {
                timestamp: new Date().toISOString(),
                type: 'DATABASE_ERROR',
                error: err.message
            };
            
            const logsDir = path.join(__dirname, 'logs');
            fs.appendFileSync(
                path.join(logsDir, 'error.log'),
                JSON.stringify(errorLog) + '\n'
            );
        });
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации БД:', error);
        process.exit(1);
    }
}

// Инициализируем БД
initDB();

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        const sqlUpper = sql.trim().toUpperCase();
        if (sqlUpper.startsWith('INSERT') || sqlUpper.startsWith('UPDATE') || sqlUpper.startsWith('DELETE')) {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        } else {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
}

async function initDatabase() {
    try {
        // Создание таблицы администраторов
        await query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создание таблицы категорий
        await query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создание таблицы продуктов
        await query(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category_id INTEGER,
                image TEXT,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )
        `);

        // Создание таблицы пользователей
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE NOT NULL,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Добавление новых столбцов в таблицу users если они не существуют
        try {
            await query('ALTER TABLE users ADD COLUMN first_name TEXT');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE users ADD COLUMN last_name TEXT');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE users ADD COLUMN username TEXT');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE users ADD COLUMN phone TEXT');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        } catch (e) { /* столбец уже существует */ }

        // Добавление новых столбцов в таблицу products если они не существуют
        try {
            await query('ALTER TABLE products ADD COLUMN weight REAL');
        } catch (e) { /* столбец уже существует */ }

        // Создание таблицы адресов пользователей
        await query(`
            CREATE TABLE IF NOT EXISTS user_addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                full_address TEXT,
                entrance TEXT,
                floor TEXT,
                apartment TEXT,
                intercom TEXT,
                comment TEXT,
                is_default BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        // Создание таблицы заказов
        await query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                items TEXT,
                total REAL NOT NULL,
                address TEXT,
                status TEXT DEFAULT 'pending',
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Создание таблицы товаров в заказе
        await query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `);

        // Создание администратора по умолчанию
        const adminExists = await query('SELECT id FROM admins WHERE username = ?', [process.env.ADMIN_USERNAME]);
        if (adminExists.length === 0) {
            const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            await query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', 
                [process.env.ADMIN_USERNAME, passwordHash]);
        }

    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
        throw error;
    }
}

module.exports = {
    query,
    initDatabase
}; 