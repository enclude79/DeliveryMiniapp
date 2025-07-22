# 🚀 Быстрый старт: Система миграций DeliveryVLG

## ⚡ 3 шага для начала работы

### 1️⃣ Проверьте текущий статус

```bash
# В dev окружении
npm run migrate:status:dev

# В production
npm run migrate:status
```

### 2️⃣ Создайте новую миграцию

```bash
# Рекомендуемый способ через bash скрипт
./scripts/create-migration.sh "добавить уведомления для пользователей"

# Альтернативный способ
npm run migrate:create "добавить уведомления для пользователей"
```

### 3️⃣ Отредактируйте и выполните

```bash
# 1. Отредактируйте созданный файл миграции
nano migrations/YYYYMMDD_HHMMSS_добавить_уведомления_для_пользователей.sql

# 2. Выполните в dev
npm run migrate:run:dev

# 3. Проверьте результат
npm run migrate:status:dev

# 4. При готовности к prod - выполните на сервере
npm run migrate:run
```

## 📋 Все команды

| Команда | Описание |
|---------|----------|
| `npm run migrate:status` | Статус (production) |
| `npm run migrate:status:dev` | Статус (development) |
| `npm run migrate:run` | Выполнить (production) |
| `npm run migrate:run:dev` | Выполнить (development) |
| `npm run migrate:create "<name>"` | Создать миграцию |
| `./scripts/create-migration.sh "<name>"` | Создать (удобнее) |

## ✅ Принципы безопасных миграций

```sql
-- ✅ БЕЗОПАСНО
ALTER TABLE users ADD COLUMN avatar_url TEXT;                    -- Nullable колонки
ALTER TABLE products ADD COLUMN rating REAL DEFAULT 0;          -- С default значением
CREATE TABLE notifications (...);                               -- Новые таблицы
CREATE INDEX idx_users_email ON users(email);                   -- Индексы

-- ⚠️ ОСТОРОЖНО  
ALTER TABLE users ADD COLUMN email TEXT NOT NULL;               -- NOT NULL без default
-- Лучше: ADD COLUMN email TEXT; потом заполнить, потом NOT NULL

-- ❌ ОПАСНО (НЕ ДЕЛАТЬ!)
DROP TABLE old_table;                                           -- Удаление таблиц
DROP COLUMN old_field;                                          -- SQLite не поддерживает
ALTER COLUMN field_name SET NOT NULL;                          -- Делать обязательными
```

## 🔄 Workflow деплоя

### В разработке:
```bash
./scripts/create-migration.sh "новая фича"
# Редактируем миграцию
npm run migrate:run:dev
git add migrations/ && git commit -m "feat: новая фича"
```

### На сервере:
```bash
git pull origin main
npm run migrate:run
sudo systemctl restart delivery-app
```

## 📖 Полная документация

Смотрите [`MIGRATIONS.md`](./MIGRATIONS.md) для детального руководства.

---

**💡 Помните**: Всегда тестируйте миграции в dev окружении перед применением в production! 