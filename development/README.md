# 🚀 DeliveryVLG - Telegram Mini App для доставки

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/database-SQLite-blue.svg)](https://www.sqlite.org/)

Современное веб-приложение для доставки еды с интеграцией Telegram Mini App. Включает в себя мощную систему безопасности, админ-панель и оптимизированный пользовательский интерфейс.

## 📱 Особенности

- **🤖 Telegram Mini App** - Полная интеграция с Telegram
- **🛡️ Зональная система безопасности** - 4 уровня защиты
- **⚡ Быстрая загрузка** - Оптимизированный для мобильных устройств
- **🔐 Админ панель** - Управление заказами, продуктами и пользователями
- **📊 Аналитика** - Детальная статистика заказов
- **🎨 Современный UI** - Адаптивный дизайн

## 🏗️ Архитектура

```
DeliveryMiniapp/
├── 📁 database/           # DDL и миграции базы данных
├── 📁 middleware/         # Система безопасности
├── 📁 public/            # Статические файлы и Mini App
├── 📁 routes/            # API маршруты
├── 📁 services/          # Бизнес логика
├── 📁 ssl/               # SSL сертификаты (не в Git)
├── 📄 server.js          # Основной сервер
├── 📄 database.js        # Работа с базой данных
└── 📄 package.json       # Зависимости проекта
```

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/enclude79/DeliveryMiniapp.git
cd DeliveryMiniapp
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка конфигурации

```bash
# Скопируйте пример конфигурации
cp env.example .env

# Отредактируйте .env файл
nano .env
```

### 4. Инициализация базы данных

```bash
# База данных создается автоматически при первом запуске
# Или можно создать вручную:
sqlite3 delivery.db < database/schema.sql

# НОВИНКА: Система миграций
npm run migrate:status        # Проверить статус миграций
npm run migrate:run           # Выполнить все новые миграции
```

### 5. Запуск приложения

```bash
# Разработка
npm run dev

# Продакшн
npm start

# Автоматический деплой с миграциями
./scripts/deploy-with-migrations.sh production
```

## 📊 База данных

### Структура таблиц

| Таблица | Описание |
|---------|----------|
| `admins` | Администраторы системы |
| `categories` | Категории товаров |
| `products` | Продукты для доставки |
| `users` | Пользователи Telegram |
| `user_addresses` | Адреса доставки |
| `orders` | Заказы пользователей |
| `order_items` | Товары в заказе |

### DDL Script

Полная схема базы данных доступна в файле `database/schema.sql`. Включает:

- ✅ Создание всех таблиц
- ✅ Индексы для оптимизации
- ✅ Внешние ключи
- ✅ Тестовые данные

## 🛡️ Система безопасности

### Зональная архитектура

| Зона | Уровень | Описание | Rate Limit |
|------|---------|----------|------------|
| **HIGH** | 🔴 | Админ панель | 100/15мин |
| **MEDIUM** | 🟡 | API эндпоинты | 200/мин |
| **LOW** | 🟢 | Telegram Mini App | 1000/мин |
| **PUBLIC** | ⚪ | Статические файлы | Без лимита |

### CSP (Content Security Policy)

- **Telegram-совместимая** политика безопасности
- **Frame integration** для Mini Apps
- **XSS защита** на всех уровнях

## 🔧 API Endpoints

### Продукты
```http
GET    /products           # Все продукты
GET    /products/category/:id  # Продукты по категории
GET    /products/categories    # Все категории
```

### Заказы
```http
POST   /orders            # Создать заказ
GET    /orders/user/:id   # Заказы пользователя
```

### Администрирование
```http
POST   /api/admin/login   # Вход в админку
GET    /api/admin/orders  # Все заказы
GET    /api/admin/customers # Все клиенты
```

## 📱 Telegram Mini App

### Настройка бота

1. Создайте бота через @BotFather
2. Настройте Mini App URL: `https://yourdomain.com:3443/app`
3. Укажите токен в `.env` файле

### Особенности интеграции

- **Автоматическая авторизация** через Telegram
- **Адаптивный интерфейс** для мобильных устройств
- **Поддержка тем** Telegram
- **Безопасная передача данных**

## 🔐 Конфигурация

### Обязательные переменные

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password
BOT_TOKEN=your_telegram_bot_token
```

### SSL/HTTPS

Для Telegram Mini App требуется HTTPS. Поместите сертификаты в папку `ssl/`:

```
ssl/
├── certificate.crt
├── private.key
└── ca_bundle.crt
```

## 📈 Мониторинг

### Доступные эндпоинты

- **Health Check**: `/health`
- **Security Stats**: `/security/stats` (только localhost)

### Логирование

Все события записываются в:
- `logs/error.log` - Ошибки системы
- `logs/debug-reports.log` - Диагностика

## 🧪 Тестирование

```bash
# Проверка работы сервера
curl http://localhost:3000/health

# Тест Telegram Mini App
curl https://yourdomain.com:3443/app
```

## 📦 Deployment

### Docker (опционально)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 3443
CMD ["npm", "start"]
```

### Systemd Service

```bash
# Настройка автозапуска
sudo systemctl enable delivery-app.service
sudo systemctl start delivery-app.service
```

## 🤝 Contributing

1. Fork проект
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 License

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 🆘 Поддержка

- 📧 Email: support@deliveryvlg.xyz
- 🐛 Issues: [GitHub Issues](https://github.com/enclude79/DeliveryMiniapp/issues)
- 📱 Telegram: [@DeliveryVLG_Support](https://t.me/DeliveryVLG_Support)

## 🙏 Благодарности

- [Telegram](https://telegram.org/) - за отличную платформу Mini Apps
- [Node.js](https://nodejs.org/) - за мощный runtime
- [SQLite](https://www.sqlite.org/) - за быструю базу данных

---

**⭐ Если проект помог вам, поставьте звездочку!**
