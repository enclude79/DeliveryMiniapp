# STAGING СЕРВЕР - ПОЛНАЯ ДОКУМЕНТАЦИЯ

## КОНФИГУРАЦИЯ БАЗЫ ДАННЫХ

### Файл: `/home/enclude/automation/staging/database.js`
```javascript
// СТРОКА 12: ПРАВИЛЬНЫЙ ПУТЬ К БАЗЕ ДАННЫХ
const dbPath = path.join(__dirname, 'delivery-staging.db');
```

**ВАЖНО**: База данных должна называться `delivery-staging.db`, НЕ `delivery.db`

## SYSTEMD СЕРВИС

### Файл: `/etc/systemd/system/delivery-app-staging.service`
```ini
[Service]
WorkingDirectory=/home/enclude/automation/staging
Environment=PORT=3002
Environment=HTTPS_PORT=3445
ExecStart=/usr/bin/node server.js
TimeoutStartSec=120  # УВЕЛИЧЕНО ДЛЯ ИНИЦИАЛИЗАЦИИ БД
WatchdogSec=30
```

## КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ

### Запуск сервиса:
```bash
sudo systemctl start delivery-app-staging
```

### Остановка сервиса:
```bash
sudo systemctl stop delivery-app-staging
```

### Перезапуск сервиса:
```bash
sudo systemctl restart delivery-app-staging
```

### Проверка статуса:
```bash
sudo systemctl status delivery-app-staging
```

### Просмотр логов:
```bash
sudo journalctl -u delivery-app-staging -f
```

## ПРОВЕРКА РАБОТОСПОСОБНОСТИ

### Health check:
```bash
curl http://localhost:3002/health
```

### Проверка базы данных:
```bash
sqlite3 staging/delivery-staging.db "SELECT COUNT(*) FROM products;"
sqlite3 staging/delivery-staging.db "SELECT COUNT(*) FROM users;"
```

## КОПИРОВАНИЕ ДАННЫХ ИЗ PRODUCTION

### Команда для обновления данных:
```bash
cp /home/enclude/automation/production/delivery.db /home/enclude/automation/staging/delivery-staging.db
sudo systemctl restart delivery-app-staging
```

## DASHBOARD КНОПКА

### API endpoint:
```
POST /api/deployment/environments/restart
Body: {"env": "staging"}
```

### Логика в коде:
- `dashboard/routes/deployment.js` → `serverManager.restartEnvironment('staging')`
- `scripts/server-manager.js` → `sudo systemctl restart delivery-app-staging`

## ВОЗМОЖНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### 1. Watchdog timeout (30s)
**Причина**: Приложение не успевает инициализироваться
**Решение**: Увеличить `TimeoutStartSec=120` в systemd конфигурации

### 2. База данных не найдена
**Причина**: Неправильный путь в `database.js`
**Решение**: Убедиться что путь `delivery-staging.db`

### 3. Пустые данные в приложении
**Причина**: База данных не скопирована из production
**Решение**: Выполнить команду копирования выше

### 4. Кнопка "Запустить сервер" не работает
**Причина**: Systemd сервис не настроен
**Решение**: Проверить существование `/etc/systemd/system/delivery-app-staging.service`

## АВТОМАТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ

### Скрипт для полного восстановления:
```bash
#!/bin/bash
# Восстановление staging сервера

echo "🔄 Восстановление staging сервера..."

# 1. Остановка сервиса
sudo systemctl stop delivery-app-staging

# 2. Копирование данных из production
cp /home/enclude/automation/production/delivery.db /home/enclude/automation/staging/delivery-staging.db

# 3. Проверка конфигурации
if ! grep -q "delivery-staging.db" /home/enclude/automation/staging/database.js; then
    echo "❌ Ошибка: Неправильная конфигурация БД в staging/database.js"
    exit 1
fi

# 4. Запуск сервиса
sudo systemctl start delivery-app-staging

# 5. Проверка статуса
sleep 5
if sudo systemctl is-active --quiet delivery-app-staging; then
    echo "✅ Staging сервер восстановлен"
else
    echo "❌ Ошибка запуска staging сервера"
    sudo systemctl status delivery-app-staging
    exit 1
fi
```

## ДАТА НАСТРОЙКИ
**Настроено**: 24 июля 2025
**Настройщик**: Claude Sonnet 4
**Статус**: ✅ РАБОТАЕТ 