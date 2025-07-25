-- DeliveryVLG Database Schema
-- SQLite Database DDL для создания базы данных приложения доставки

-- ===============================================
-- 1. ТАБЛИЦА АДМИНИСТРАТОРОВ
-- ===============================================
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- 2. ТАБЛИЦА КАТЕГОРИЙ ТОВАРОВ
-- ===============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- 3. ТАБЛИЦА ПРОДУКТОВ
-- ===============================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category_id INTEGER,
    image TEXT,
    weight REAL,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
);

-- ===============================================
-- 4. ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ TELEGRAM
-- ===============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- 5. ТАБЛИЦА АДРЕСОВ ПОЛЬЗОВАТЕЛЕЙ
-- ===============================================
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
);

-- ===============================================
-- 6. ТАБЛИЦА ЗАКАЗОВ
-- ===============================================
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    items TEXT, -- JSON строка с товарами для совместимости
    total REAL NOT NULL,
    address TEXT,
    status TEXT DEFAULT 'pending',
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- ===============================================
-- 7. ТАБЛИЦА ТОВАРОВ В ЗАКАЗЕ (НОРМАЛИЗОВАННАЯ)
-- ===============================================
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
);

-- ===============================================
-- ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ПРОИЗВОДИТЕЛЬНОСТИ
-- ===============================================

-- Индексы для быстрого поиска пользователей
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Индексы для оптимизации запросов продуктов
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Индексы для заказов
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Индексы для товаров в заказе
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Индексы для адресов
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses(is_default);

-- ===============================================
-- ТЕСТОВЫЕ ДАННЫЕ (ОПЦИОНАЛЬНО)
-- ===============================================

-- Категории по умолчанию
INSERT OR IGNORE INTO categories (id, name) VALUES 
    (1, 'Мороженное'),
    (2, 'Пельмени');

-- Тестовые продукты
INSERT OR IGNORE INTO products (id, name, description, price, category_id, image, weight, active) VALUES 
    (1, 'Мороженное', 'Мороженное супер!', 91.0, 1, '/uploads/ice-cream-1.jpg', 100, 1),
    (2, 'Пельмени', 'Пельмени супер!', 120.0, 2, '/uploads/dumplings-1.jpg', NULL, 1),
    (3, 'Мороженное Мини', 'мини', 70.0, 1, '/uploads/ice-cream-mini.jpg', 30, 1),
    (4, 'Мороженное плюс', 'плюс', 85.0, 1, '/uploads/ice-cream-plus.jpg', 56, 1),
    (5, 'Мороженное new', 'new', 58.0, 1, '/uploads/ice-cream-new.jpg', 52, 1),
    (6, 'Пельмень плюс', 'плюс', 250.0, 2, '/uploads/dumplings-plus.jpg', 200, 1);

-- ===============================================
-- КОММЕНТАРИИ К СТРУКТУРЕ
-- ===============================================

-- users.telegram_id - Уникальный ID пользователя в Telegram
-- products.weight - Вес товара в граммах (может быть NULL)
-- products.active - Флаг активности товара (1 - активен, 0 - скрыт)
-- orders.items - JSON строка для обратной совместимости
-- orders.status - Статус заказа: 'pending', 'confirmed', 'delivered', 'cancelled'
-- user_addresses.is_default - Основной адрес пользователя
-- order_items - Нормализованная таблица для товаров в заказе 