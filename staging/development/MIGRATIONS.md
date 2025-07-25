# 🗄️ Система миграций DeliveryVLG

## 📖 Обзор

DeliveryVLG использует простую и надежную систему SQL миграций для управления изменениями в базе данных. Система обеспечивает безопасные обновления схемы без простоев (zero-downtime deployments).

## 🏗️ Архитектура

```
📁 migrations/                          # Директория миграций
├── 000_create_migrations_table.sql     # Системная миграция
├── 001_example_add_user_avatar.sql     # Пример: добавление аватаров
├── 002_example_add_product_ratings.sql # Пример: рейтинги продуктов
└── YYYYMMDD_HHMMSS_your_migration.sql  # Ваши миграции

📁 scripts/
├── migrate.js                          # CLI менеджер миграций
└── create-migration.sh                 # Bash скрипт для создания

📊 База данных:
└── migrations (таблица)                # Отслеживание выполненных миграций
    ├── id, filename
    ├── executed_at, execution_time_ms
    └── checksum, description
```

## 🚀 Быстрый старт

### 1. Проверка статуса миграций

```bash
# Производственное окружение
npm run migrate:status

# Разработка
npm run migrate:status:dev
```

### 2. Создание новой миграции

```bash
# Способ 1: Через npm
npm run migrate:create "add user notifications"

# Способ 2: Через bash скрипт (рекомендуется)
./scripts/create-migration.sh "add user notifications"
```

### 3. Выполнение миграций

```bash
# Производство
npm run migrate:run

# Разработка  
npm run migrate:run:dev
```

## 📋 Полный список команд

| Команда | Окружение | Описание |
|---------|-----------|----------|
| `npm run migrate:status` | production | Показать статус миграций |
| `npm run migrate:status:dev` | development | Статус в dev окружении |
| `npm run migrate:run` | production | Выполнить новые миграции |
| `npm run migrate:run:dev` | development | Выполнить в dev окружении |
| `npm run migrate:create <name>` | любое | Создать новую миграцию |
| `./scripts/create-migration.sh <name>` | любое | Создать через bash |

## 📝 Создание миграций

### Структура файла миграции

```sql
-- Миграция: описание_изменения
-- Файл: YYYYMMDD_HHMMSS_migration_name.sql
-- Автор: DeliveryVLG Migration System  
-- Дата: YYYY-MM-DD
-- Описание: Подробное описание изменений

-- ========================================
-- МИГРАЦИЯ ВПЕРЕД (UP)
-- ========================================

-- Ваш SQL код здесь
CREATE TABLE example (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

-- Комментарии о совместимости
-- Объяснение зачем нужна миграция
```

### Принципы именования

```bash
# Формат: YYYYMMDD_HHMMSS_название.sql
20241229_143022_add_user_avatars.sql
20241229_143055_create_notifications_table.sql
20241229_143128_add_product_rating_index.sql
```

### Автоматическая генерация

```bash
# Создание миграции
./scripts/create-migration.sh "add user notifications"

# Результат:
✅ Создана новая миграция: 20241229_143200_add_user_notifications.sql

💡 Следующие шаги:
1. Отредактируйте файл миграции
2. Проверьте статус: npm run migrate:status  
3. Выполните миграцию: npm run migrate:run
```

## 🛡️ Принципы Zero-Downtime

### ✅ Безопасные операции

```sql
-- ✅ Добавление новых таблиц
CREATE TABLE new_table (...);

-- ✅ Добавление nullable колонок
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- ✅ Добавление колонок с default значениями  
ALTER TABLE products ADD COLUMN rating REAL DEFAULT 0;

-- ✅ Создание индексов
CREATE INDEX idx_users_email ON users(email);

-- ✅ Добавление CHECK constraints (SQLite 3.37+)
-- только для новых записей
```

### ⚠️ Осторожные операции

```sql
-- ⚠️ Переименование колонок - делать в 2 этапа:
-- Этап 1: Добавить новую колонку
ALTER TABLE users ADD COLUMN full_name TEXT;
-- Этап 2 (в следующей миграции): Заполнить + удалить старую

-- ⚠️ Изменение типа данных - через новую колонку:
ALTER TABLE products ADD COLUMN price_new DECIMAL(10,2);
-- Затем копировать данные и переключиться
```

### ❌ Опасные операции

```sql
-- ❌ НИКОГДА не делайте в производстве:
DROP TABLE ...;           -- Удаление таблиц
DROP COLUMN ...;           -- Удаление колонок (SQLite не поддерживает)
ALTER COLUMN NOT NULL;     -- Делать колонки обязательными
```

## 🔄 Workflow разработки

### 1. Разработка новой фичи

```bash
# 1. Создаем миграцию для новой фичи
./scripts/create-migration.sh "add user subscription system"

# 2. Редактируем созданный файл
nano migrations/20241229_143500_add_user_subscription_system.sql

# 3. Тестируем в dev окружении
npm run migrate:run:dev

# 4. Проверяем результат
npm run migrate:status:dev
```

### 2. Подготовка к деплою

```bash
# 1. Убеждаемся что все миграции работают в dev
npm run migrate:status:dev

# 2. Коммитим изменения
git add migrations/
git commit -m "feat: add user subscription system migration"

# 3. Пушим в репозиторий
git push origin feature/subscriptions
```

### 3. Продакшн деплой

```bash
# На продакшн сервере:

# 1. Получаем новый код
git pull origin main

# 2. Выполняем миграции
npm run migrate:run

# 3. Проверяем статус
npm run migrate:status

# 4. Перезапускаем приложение
sudo systemctl restart delivery-app
```

## 📊 Примеры миграций

### Пример 1: Добавление пользовательских аватаров

```sql
-- migrations/001_example_add_user_avatar.sql

-- Добавляем поля для аватаров
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at DATETIME;

-- Создаем частичный индекс только для пользователей с аватарами
CREATE INDEX IF NOT EXISTS idx_users_avatar ON users(avatar_url) 
WHERE avatar_url IS NOT NULL;
```

### Пример 2: Система рейтингов

```sql
-- migrations/002_example_add_product_ratings.sql

-- Новая таблица для отзывов
CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(product_id, user_id)
);

-- Индексы для производительности
CREATE INDEX idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);

-- Кэширование рейтинга в таблице продуктов
ALTER TABLE products ADD COLUMN average_rating REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN reviews_count INTEGER DEFAULT 0;
```

## 🔍 Мониторинг и отладка

### Просмотр статуса

```bash
npm run migrate:status
```

Вывод:
```
📊 Статус миграций (production):
📁 База данных: delivery.db
📁 Директория миграций: /path/to/migrations

Список миграций:

  ✅ Выполнено 000_create_migrations_table.sql
           📅 2024-12-29 14:30:22 (45ms)
           📝 Создание системы отслеживания миграций
           
  ✅ Выполнено 001_example_add_user_avatar.sql  
           📅 2024-12-29 14:35:10 (120ms)
           📝 Добавление поддержки аватаров пользователей
           
  ⏳ Ожидает 002_example_add_product_ratings.sql

📈 Всего миграций: 3
✅ Выполнено: 2  
⏳ Ожидает: 1
```

### Проверка целостности БД

```bash
# Проверка через SQLite CLI
sqlite3 delivery.db "PRAGMA integrity_check;"

# Просмотр таблицы миграций
sqlite3 delivery.db "SELECT * FROM migrations ORDER BY executed_at;"
```

### Логи выполнения

Система автоматически логирует:
- ✅ Время выполнения каждой миграции
- 🔐 Чексумму файла для обнаружения изменений  
- 📝 Описание из комментариев
- ❌ Детальные ошибки при сбоях

## 🚨 Решение проблем

### Проблема: Миграция не выполнилась

```bash
# 1. Проверьте синтаксис SQL в файле миграции
sqlite3 delivery.db < migrations/your_migration.sql

# 2. Проверьте логи ошибок
npm run migrate:run  # покажет детальную ошибку

# 3. Исправьте файл и повторите попытку
```

### Проблема: База данных заблокирована

```bash
# 1. Остановите приложение
sudo systemctl stop delivery-app

# 2. Выполните миграцию
npm run migrate:run

# 3. Запустите приложение
sudo systemctl start delivery-app
```

### Проблема: Хочется откатить миграцию

```bash
# ⚠️ Система не поддерживает автоматический откат!
# Нужно создать новую миграцию с обратными изменениями:

./scripts/create-migration.sh "revert user avatar feature"

# И написать SQL для отката:
# DROP INDEX idx_users_avatar;
# -- ALTER TABLE users DROP COLUMN avatar_url;  -- Не работает в SQLite
# -- Вместо этого создайте новую таблицу без этой колонки
```

## 📈 Лучшие практики

### 1. Всегда тестируйте в dev

```bash
# Перед продакшн деплоем:
npm run migrate:run:dev      # Выполнить в dev
npm run test                 # Прогнать тесты  
npm run migrate:run          # Только потом в продакшн
```

### 2. Делайте атомарные миграции

```sql
-- ✅ Хорошо: одна фича = одна миграция
-- migrations/20241229_add_user_avatars.sql

-- ❌ Плохо: много несвязанных изменений в одной миграции
-- CREATE TABLE avatars (...);
-- ALTER TABLE orders ADD status_v2;  
-- CREATE INDEX some_unrelated_index;
```

### 3. Документируйте изменения

```sql
-- ✅ Хорошие комментарии:
-- Описание: Добавление системы аватаров для улучшения UX
-- Задача: https://github.com/org/repo/issues/123
-- Совместимость: Полная обратная совместимость

-- Добавляем опциональное поле avatar_url
ALTER TABLE users ADD COLUMN avatar_url TEXT;
```

### 4. Следите за производительностью

```sql
-- ⚠️ Осторожно с большими таблицами:
-- CREATE INDEX на таблице с миллионами записей может занять часы

-- ✅ Лучше создавать индексы в maintenance окна:
-- или использовать частичные индексы
CREATE INDEX idx_active_users ON users(status) 
WHERE status = 'active';
```

## 🎯 Сценарии использования

### Сценарий 1: Добавление новой фичи

```bash
# 1. Создание миграции
./scripts/create-migration.sh "add push notifications"

# 2. Редактирование migrations/20241229_add_push_notifications.sql:
```

```sql
-- Создаем таблицу токенов устройств
CREATE TABLE user_device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, device_token)
);

-- Индексы
CREATE INDEX idx_device_tokens_user ON user_device_tokens(user_id);
CREATE INDEX idx_device_tokens_platform ON user_device_tokens(platform);

-- Настройки уведомлений для пользователей
ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1;
ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT 1;
ALTER TABLE users ADD COLUMN push_notifications BOOLEAN DEFAULT 1;
```

```bash
# 3. Тестирование
npm run migrate:run:dev
npm run migrate:status:dev

# 4. Деплой в продакшн
git add . && git commit -m "feat: add push notifications"
git push origin main
# На сервере: npm run migrate:run
```

### Сценарий 2: Переименование колонки (безопасно)

```sql
-- migrations/20241229_rename_user_phone_to_mobile.sql

-- Шаг 1: Добавляем новую колонку
ALTER TABLE users ADD COLUMN mobile_phone TEXT;

-- Шаг 2: Копируем данные (в приложении будем делать постепенно)
-- UPDATE users SET mobile_phone = phone WHERE phone IS NOT NULL;

-- Шаг 3: Создаем индекс для новой колонки
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_phone);

-- Примечание: Удаление старой колонки phone будет в отдельной миграции
-- после полного перехода приложения на использование mobile_phone
```

### Сценарий 3: Оптимизация производительности

```sql
-- migrations/20241229_optimize_orders_queries.sql

-- Составной индекс для частых запросов по статусу и дате
CREATE INDEX IF NOT EXISTS idx_orders_status_date 
ON orders(status, created_at DESC);

-- Частичный индекс только для активных заказов
CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders(user_id, created_at DESC) 
WHERE status IN ('pending', 'confirmed', 'preparing');

-- Индекс для поиска заказов по адресу доставки
CREATE INDEX IF NOT EXISTS idx_orders_address 
ON orders(address) WHERE address IS NOT NULL;
```

---

## 💡 Заключение

Система миграций DeliveryVLG обеспечивает:

- ✅ **Безопасность**: Zero-downtime deployments
- ✅ **Простоту**: Понятные SQL файлы  
- ✅ **Надежность**: Транзакции и откат при ошибках
- ✅ **Отслеживание**: Полная история изменений
- ✅ **Гибкость**: Поддержка dev/prod окружений

**Помните**: Миграции выполняются только вперед. Планируйте изменения заранее и всегда тестируйте в dev окружении! 