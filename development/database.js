const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

let db;

// Инициализация базы данных с обработкой ошибок
function initDB() {
    // ЖЕСТКО ФИКСИРОВАННАЯ БД ДЛЯ РАЗРАБОТКИ - НИКАКОЙ ПУТАНИЦЫ!
    const dbFile = 'delivery-dev.db';
    const dbPath = path.join(__dirname, dbFile);
    
    console.log(`🔒 ФИКСИРОВАННАЯ БД: ${dbPath}`);
    
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

// Миграция статусов заказов из app_settings в order_statuses
async function migrateOrderStatuses() {
    try {
        // Проверяем, есть ли уже данные в таблице order_statuses
        const existingStatuses = await query('SELECT COUNT(*) as count FROM order_statuses');
        if (existingStatuses[0].count > 0) {
            console.log('[DB] Order statuses already migrated');
            return;
        }

        console.log('[DB] Migrating order statuses...');

        // Получаем текущие статусы из app_settings
        const [statusesSetting] = await query(
            'SELECT setting_value FROM app_settings WHERE setting_key = ?',
            ['order_statuses']
        );

        let statuses = ['pending', 'в_обработке', 'собирается', 'в_доставке', 'доставлен', 'отменен'];
        if (statusesSetting) {
            try {
                statuses = JSON.parse(statusesSetting.setting_value);
            } catch (e) {
                console.error('[DB] Error parsing order statuses, using defaults:', e);
            }
        }

        // Определяем свойства для каждого статуса
        const statusConfig = {
            'pending': { name: '⏳ Ожидает подтверждения', color: '#F59E0B', description: 'Заказ получен и ожидает подтверждения' },
            'в_обработке': { name: '🔄 В обработке', color: '#3B82F6', description: 'Заказ обрабатывается менеджером' },
            'собирается': { name: '📦 Собирается', color: '#8B5CF6', description: 'Заказ собирается на складе' },
            'в_доставке': { name: '🚚 В доставке', color: '#F59E0B', description: 'Заказ передан в доставку' },
            'доставлен': { name: '✅ Доставлен', color: '#10B981', description: 'Заказ успешно доставлен', is_final: true },
            'отменен': { name: '❌ Отменен', color: '#EF4444', description: 'Заказ отменен', is_final: true }
        };

        // Создаем записи в новой таблице
        for (let i = 0; i < statuses.length; i++) {
            const statusKey = statuses[i];
            const config = statusConfig[statusKey] || { 
                name: statusKey, 
                color: '#6B7280', 
                description: `Статус: ${statusKey}` 
            };

            await query(`
                INSERT INTO order_statuses 
                (key, name, description, order_priority, color, is_active, is_final) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                statusKey,
                config.name,
                config.description,
                i + 1, // Очередность начинается с 1
                config.color,
                1, // Все статусы активны по умолчанию
                config.is_final ? 1 : 0
            ]);
        }

        console.log(`[DB] Migrated ${statuses.length} order statuses successfully`);
    } catch (error) {
        console.error('[DB] Error migrating order statuses:', error);
        throw error;
    }
}

// Создание индексов для оптимизации производительности
async function createIndexes() {
    try {
        console.log('📊 Создание индексов для оптимизации...');
        
        // Индексы для таблицы orders
        await query('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
        await query('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)');
        await query('CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at)');
        
        // Индексы для таблицы products
        await query('CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)');
        await query('CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, active)');
        await query('CREATE INDEX IF NOT EXISTS idx_products_order_priority ON products(order_priority)');
        
        // Индексы для таблицы users
        await query('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)');
        await query('CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name)');
        
        // Индексы для таблицы order_items
        await query('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)');
        
        // Индексы для таблицы categories
        await query('CREATE INDEX IF NOT EXISTS idx_categories_order_priority ON categories(order_priority)');
        
        // Индексы для таблицы app_settings
        await query('CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key)');
        
        // Индексы для таблицы order_statuses
        await query('CREATE INDEX IF NOT EXISTS idx_order_statuses_key ON order_statuses(key)');
        await query('CREATE INDEX IF NOT EXISTS idx_order_statuses_priority ON order_statuses(order_priority)');
        await query('CREATE INDEX IF NOT EXISTS idx_order_statuses_active ON order_statuses(is_active)');
        
        // Индексы для таблицы user_addresses
        await query('CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id)');
        
        console.log('✅ Индексы созданы успешно');
    } catch (error) {
        console.error('❌ Ошибка создания индексов:', error);
        throw error;
    }
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

        // Добавление поля emoji для категорий
        try {
            await query('ALTER TABLE categories ADD COLUMN emoji TEXT');
        } catch (e) { /* столбец уже существует */ }

        // Добавление поля order_priority для категорий
        try {
            await query('ALTER TABLE categories ADD COLUMN order_priority INTEGER DEFAULT 0');
        } catch (e) { /* столбец уже существует */ }

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
        try {
            await query('ALTER TABLE users ADD COLUMN display_name TEXT');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE users ADD COLUMN privacy_consent BOOLEAN DEFAULT 0');
        } catch (e) { /* столбец уже существует */ }

        // Добавление новых столбцов в таблицу products если они не существуют
        try {
            await query('ALTER TABLE products ADD COLUMN weight REAL');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE products ADD COLUMN available INTEGER DEFAULT 1');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE products ADD COLUMN discontinued INTEGER DEFAULT 0');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE products ADD COLUMN network_price REAL');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE products ADD COLUMN order_priority INTEGER DEFAULT 0');
        } catch (e) { /* столбец уже существует */ }

        // Добавление поля operator_message для заказов
        try {
            await query('ALTER TABLE orders ADD COLUMN operator_message TEXT');
        } catch (e) { /* столбец уже существует */ }

        // Добавление новых столбцов в таблицу user_addresses для админских координат
        try {
            await query('ALTER TABLE user_addresses ADD COLUMN admin_latitude REAL');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE user_addresses ADD COLUMN admin_longitude REAL');
        } catch (e) { /* столбец уже существует */ }
        try {
            await query('ALTER TABLE user_addresses ADD COLUMN admin_coordinate_comment TEXT');
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

        // Создание таблицы настроек приложения
        await query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создание таблицы статусов заказов
        await query(`
            CREATE TABLE IF NOT EXISTS order_statuses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                order_priority INTEGER NOT NULL,
                color TEXT DEFAULT '#6B7280',
                is_active BOOLEAN DEFAULT 1,
                is_final BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создание индекса для быстрого поиска по очередности
        await query(`
            CREATE INDEX IF NOT EXISTS idx_order_statuses_priority 
            ON order_statuses(order_priority)
        `);

        // Инициализация настроек по умолчанию
        const settingsDefaults = [
            {
                key: 'critical_order_status',
                value: 'собирается',
                description: 'Критический статус заказа, после которого отмена невозможна'
            },
            {
                key: 'order_statuses',
                value: JSON.stringify(['pending', 'в_обработке', 'собирается', 'в_доставке', 'доставлен', 'отменен']),
                description: 'Доступные статусы заказов'
            }
        ];

        for (const setting of settingsDefaults) {
            const existing = await query('SELECT id FROM app_settings WHERE setting_key = ?', [setting.key]);
            if (existing.length === 0) {
                await query(
                    'INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
                    [setting.key, setting.value, setting.description]
                );
            }
        }

        // Миграция статусов заказов в новую таблицу
        await migrateOrderStatuses();

        // Создание индексов для оптимизации производительности
        await createIndexes();

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