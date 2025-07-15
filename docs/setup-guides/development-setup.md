# 🚀 СХЕМА РАЗДЕЛЕНИЯ КОНТУРОВ - ВАРИАНТ 1 (ПРОСТОЙ)

## 📊 Архитектура двух контуров

```
┌─────────────────────────────────────────────────────────────┐
│                    ПРОДАКШН КОНТУР                         │
│  ✅ Стабильная версия                                      │
│  ✅ Реальные пользователи                                  │
│  ✅ Telegram Mini App                                      │
│  📍 main ветка                                             │
│  🌐 https://www.deliveryvlg.xyz:3443                      │
└─────────────────────────────────────────────────────────────┘
                              ⬆️
                    Проверенные изменения
                              
┌─────────────────────────────────────────────────────────────┐
│                 РАЗРАБОТКА КОНТУР                          │
│  🧪 Новые функции                                         │
│  🧪 Исправления багов                                     │
│  🧪 Тестирование                                          │
│  📍 develop ветка                                          │
│  🌐 https://dev.deliveryvlg.xyz:3444                      │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Пошаговая настройка

### Шаг 1: Создание контура разработки

```bash
# 1. Создаем директорию для разработки
cd /home/enclude
cp -r delivery-app delivery-app-dev

# 2. Переходим в dev директорию
cd delivery-app-dev

# 3. Инициализируем Git для dev ветки
git checkout -b develop

# 4. Настраиваем dev конфигурацию
cp env.example .env.dev
```

### Шаг 2: Конфигурация dev окружения

Создать файл `.env.dev`:
```env
# DEV ENVIRONMENT
NODE_ENV=development
PORT=3001
HTTPS_PORT=3444

ADMIN_USERNAME=admin_dev
ADMIN_PASSWORD=dev_password_secure

BOT_TOKEN=your_test_bot_token
ALLOWED_ORIGINS=https://dev.deliveryvlg.xyz

# DEV DATABASE
DB_FILE=delivery-dev.db

# DEV LOGGING
LOG_LEVEL=debug
```

### Шаг 3: Создание systemd сервиса для dev

```bash
# Создать файл delivery-app-dev.service
sudo cp delivery-app.service /etc/systemd/system/delivery-app-dev.service

# Отредактировать пути и порты для dev
sudo nano /etc/systemd/system/delivery-app-dev.service
```

Конфигурация `delivery-app-dev.service`:
```ini
[Unit]
Description=Delivery App Development Server
After=network.target

[Service]
Type=simple
User=enclude
WorkingDirectory=/home/enclude/delivery-app-dev
Environment=NODE_ENV=development
Environment=PORT=3001
Environment=HTTPS_PORT=3444
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Шаг 4: Workflow разработки

```bash
# РАЗРАБОТКА
cd /home/enclude/delivery-app-dev

# 1. Создать новую фичу
git checkout -b feature/new-payment-method
# Разрабатываем...

# 2. Тестирование локально
npm run dev

# 3. Commit & Push
git add .
git commit -m "feat: добавлен новый способ оплаты"
git push origin feature/new-payment-method

# 4. Merge в develop
git checkout develop  
git merge feature/new-payment-method
sudo systemctl restart delivery-app-dev

# 5. Тестирование на dev сервере
curl https://dev.deliveryvlg.xyz:3444/health
```

### Шаг 5: Деплой в продакшн

```bash
# ПРОДАКШН
cd /home/enclude/delivery-app

# 1. Получаем изменения из develop
git checkout main
git merge develop

# 2. Деплоим
sudo systemctl restart delivery-app

# 3. Проверяем
curl https://www.deliveryvlg.xyz:3443/health
```

## 🧪 Система тестирования

### Автоматические тесты

Создать `package.json` скрипты:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "node test/run-tests.js",
    "test:api": "node test/api-tests.js",
    "test:integration": "node test/integration-tests.js"
  }
}
```

### Тестовые скрипты

1. **API тесты** (`test/api-tests.js`)
2. **Integration тесты** (`test/integration-tests.js`)  
3. **Health проверки** (`test/health-tests.js`)

## 🔄 Git Workflow

```bash
# 1. Новая фича
feature/payment-improvements → develop → main

# 2. Хотфикс
hotfix/critical-bug → main (напрямую)
                   → develop (backport)

# 3. Релиз
develop → release/v1.2.0 → main
```

## ✅ Преимущества варианта 1

- ✅ **Простота**: Минимальные изменения в коде
- ✅ **Скорость**: Быстрая настройка за 30 минут
- ✅ **Безопасность**: Изолированные базы данных
- ✅ **Тестирование**: Отдельный контур для проверок
- ✅ **Откат**: Легко вернуться к рабочей версии

## ⚠️ Ограничения варианта 1

- ⚠️ Ручной деплой (но быстрый)
- ⚠️ Нужно помнить переключать ветки
- ⚠️ Базовый уровень автоматизации

---

**⏱️ Время внедрения: 30-60 минут**  
**🎯 Подходит для: Команда 1-3 разработчика** 