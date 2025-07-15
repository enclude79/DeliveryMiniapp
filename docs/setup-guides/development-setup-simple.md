# 🚀 СХЕМА РАЗДЕЛЕНИЯ КОНТУРОВ - ВАРИАНТ 3 (МИНИМАЛЬНЫЙ)

## 📊 Архитектура на переменных окружения

```
┌─────────────────────────────────────────────────────────────┐
│                    ПРОДАКШН КОНТУР                         │
│  ⚙️ NODE_ENV=production                                    │
│  🔒 PORT=3000, HTTPS_PORT=3443                            │
│  🗄️ delivery.db                                           │
│  🌐 https://www.deliveryvlg.xyz                           │
└─────────────────────────────────────────────────────────────┘
                              ⬆️
                    git push main
                              
┌─────────────────────────────────────────────────────────────┐
│                 РАЗРАБОТКА КОНТУР                          │
│  ⚙️ NODE_ENV=development                                   │
│  🔒 PORT=3001, HTTPS_PORT=3444                            │
│  🗄️ delivery-dev.db                                       │
│  🌐 https://dev.deliveryvlg.xyz                           │
└─────────────────────────────────────────────────────────────┘
```

## ⚡ Быстрая настройка (15 минут!)

### Шаг 1: Создание dev копии

```bash
# 1. Копируем проект
cd /home/enclude
cp -r delivery-app delivery-app-dev

# 2. Переходим в dev
cd delivery-app-dev

# 3. Создаем dev конфигурацию
cp .env .env.dev

# 4. Редактируем .env.dev
nano .env.dev
```

### Шаг 2: Конфигурация .env.dev

```env
# DEVELOPMENT ENVIRONMENT
NODE_ENV=development
PORT=3001
HTTPS_PORT=3444

# DEV ADMIN
ADMIN_USERNAME=dev_admin
ADMIN_PASSWORD=dev_password123

# TEST BOT (создайте тестового бота)
BOT_TOKEN=your_test_bot_token_here

# DEV URLS
ALLOWED_ORIGINS=https://dev.deliveryvlg.xyz:3444

# DEV LOGGING
LOG_LEVEL=debug
```

### Шаг 3: Модификация server.js для окружений

```javascript
// В начале server.js добавить:
const dotenv = require('dotenv');

// Загружаем соответствующий .env файл
const envFile = process.env.NODE_ENV === 'development' ? '.env.dev' : '.env';
dotenv.config({ path: envFile });

// Определяем базу данных по окружению
const dbFile = process.env.NODE_ENV === 'development' ? 'delivery-dev.db' : 'delivery.db';

// В database.js тоже нужно изменить путь к БД
```

### Шаг 4: Создание скриптов управления

```bash
# dev-start.sh
#!/bin/bash
cd /home/enclude/delivery-app-dev
NODE_ENV=development node server.js

# dev-stop.sh
#!/bin/bash
pkill -f "delivery-app-dev"

# prod-start.sh  
#!/bin/bash
cd /home/enclude/delivery-app
NODE_ENV=production node server.js

# Сделать исполняемыми
chmod +x *.sh
```

### Шаг 5: Systemd сервис для dev

```ini
# /etc/systemd/system/delivery-app-dev.service
[Unit]
Description=Delivery App Development Server
After=network.target

[Service]
Type=simple
User=enclude
WorkingDirectory=/home/enclude/delivery-app-dev
Environment=NODE_ENV=development
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Установка dev сервиса
sudo systemctl daemon-reload
sudo systemctl enable delivery-app-dev
sudo systemctl start delivery-app-dev
```

## 🧪 Простая система тестирования

### Создание test/simple-tests.js

```javascript
const fetch = require('node-fetch');

// Простые API тесты
async function testAPI() {
    const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'http://localhost:3000';
    
    console.log(`🧪 Тестирование ${baseUrl}...`);
    
    try {
        // Health check
        const health = await fetch(`${baseUrl}/health`);
        console.log(`✅ Health: ${health.status}`);
        
        // Products
        const products = await fetch(`${baseUrl}/products`);
        console.log(`✅ Products: ${products.status}`);
        
        // Categories
        const categories = await fetch(`${baseUrl}/products/categories`);
        console.log(`✅ Categories: ${categories.status}`);
        
        console.log('🎉 Все тесты прошли!');
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

testAPI();
```

### Добавление в package.json

```json
{
  "scripts": {
    "start": "NODE_ENV=production node server.js",
    "dev": "NODE_ENV=development nodemon server.js",
    "test": "node test/simple-tests.js",
    "test:dev": "NODE_ENV=development node test/simple-tests.js",
    "deploy:dev": "./deploy-dev.sh",
    "deploy:prod": "./deploy-prod.sh"
  }
}
```

## 🔄 Workflow разработки

### 1. Разработка новой функции

```bash
# Переключаемся на dev
cd /home/enclude/delivery-app-dev

# Создаем ветку
git checkout -b feature/new-feature

# Разрабатываем...
npm run dev

# Тестируем
npm run test:dev
```

### 2. Проверка на dev сервере

```bash
# Деплой на dev
git add .
git commit -m "feat: новая функция"
git push origin feature/new-feature

# Перезапуск dev сервера
sudo systemctl restart delivery-app-dev

# Проверка
curl https://dev.deliveryvlg.xyz:3444/health
```

### 3. Деплой в продакшн

```bash
# Переходим в продакшн директорию
cd /home/enclude/delivery-app

# Получаем изменения
git checkout main
git pull origin main

# Деплой
sudo systemctl restart delivery-app

# Проверка
curl https://www.deliveryvlg.xyz:3443/health
```

## 📝 Скрипты автоматизации

### deploy-dev.sh

```bash
#!/bin/bash
echo "🚀 Деплой в DEV окружение..."

cd /home/enclude/delivery-app-dev

# Получаем изменения
git pull origin develop

# Устанавливаем зависимости
npm install

# Перезапускаем сервис
sudo systemctl restart delivery-app-dev

# Проверяем статус
sleep 3
sudo systemctl status delivery-app-dev

echo "✅ DEV деплой завершен!"
```

### deploy-prod.sh

```bash
#!/bin/bash
echo "🚀 Деплой в ПРОДАКШН..."

cd /home/enclude/delivery-app

# Получаем изменения
git pull origin main

# Устанавливаем зависимости
npm install --only=production

# Перезапускаем сервис  
sudo systemctl restart delivery-app

# Проверяем статус
sleep 3
sudo systemctl status delivery-app

echo "✅ ПРОДАКШН деплой завершен!"
```

### check-both-servers.sh

```bash
#!/bin/bash
echo "🔍 Проверка обоих серверов..."

# Проверка DEV
echo "DEV сервер:"
curl -s http://localhost:3001/health | jq .

# Проверка PROD
echo "PROD сервер:"
curl -s http://localhost:3000/health | jq .

# Статус сервисов
sudo systemctl is-active delivery-app-dev
sudo systemctl is-active delivery-app
```

## 🔒 Безопасность окружений

### Разные пароли и токены

```bash
# .env (продакшн)
ADMIN_PASSWORD=super_secure_prod_password
BOT_TOKEN=real_bot_token

# .env.dev (разработка)  
ADMIN_PASSWORD=simple_dev_password
BOT_TOKEN=test_bot_token
```

### Разные SSL сертификаты

```bash
# Продакшн: ssl/
# Разработка: ssl-dev/
mkdir ssl-dev
# Поместить dev сертификаты
```

## ✅ Преимущества варианта 3

- ✅ **Скорость**: Настройка за 15 минут
- ✅ **Простота**: Минимальные изменения кода
- ✅ **Понятность**: Легко понять и поддерживать
- ✅ **Гибкость**: Легко переключаться между окружениями
- ✅ **Безопасность**: Изолированные БД и конфиги

## ⚠️ Ограничения варианта 3

- ⚠️ Ручной деплой (но простой)
- ⚠️ Базовое тестирование
- ⚠️ Нет автоматической CI/CD

---

**⏱️ Время внедрения: 15-30 минут**  
**🎯 Подходит для: Соло разработчик или команда до 2 человек**

## 🎯 Рекомендация

Этот вариант идеально подходит для вашего проекта, так как:
- Минимальная сложность
- Быстрое внедрение
- Полная изоляция окружений
- Простое управление 