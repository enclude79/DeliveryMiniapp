-- Development Database Schema
-- Экспортировано: 2025-07-25 08:34:42
-- База данных: /home/enclude/automation/development/delivery-dev.db
-- Ветка: [0;34m[INFO][0m 2025-07-25 08:34:42 - Git репозиторий найден в .
develop
-- Коммит: c6fa8c3568e6586a70303fe4de05456e2759f753

CREATE TABLE admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            , image TEXT, order_priority INTEGER DEFAULT 0, emoji TEXT);
CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category_id INTEGER,
                image TEXT,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, weight REAL, available INTEGER DEFAULT 1, discontinued INTEGER DEFAULT 0, network_price REAL, order_priority INTEGER DEFAULT 0,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            );
CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            , first_name TEXT, last_name TEXT, username TEXT, phone TEXT, updated_at DATETIME);
CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                address TEXT NOT NULL,
                status TEXT DEFAULT 'new',
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, operator_message TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
CREATE TABLE order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
CREATE TABLE user_addresses (
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
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, admin_latitude REAL, admin_longitude REAL, admin_coordinate_comment TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
CREATE TABLE app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
CREATE TABLE order_statuses (
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
            );
CREATE INDEX idx_order_statuses_priority 
            ON order_statuses(order_priority)
        ;
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_category_active ON products(category_id, active);
CREATE INDEX idx_products_order_priority ON products(order_priority);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_categories_order_priority ON categories(order_priority);
CREATE INDEX idx_app_settings_key ON app_settings(setting_key);
CREATE INDEX idx_order_statuses_key ON order_statuses(key);
CREATE INDEX idx_order_statuses_active ON order_statuses(is_active);
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE TABLE settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
