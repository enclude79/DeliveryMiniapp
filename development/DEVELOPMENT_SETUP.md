# 🚀 Development Environment Setup
# Настройка Development контура DeliveryVLG

## 📋 Проблема
Development контур запускает production сервис и использует production базу данных вместо изолированной development среды.

## ✅ Решение
Создана система для полной изоляции development и production контуров.

---

## 🛠️ Быстрая настройка

### 1. Проверка текущего состояния
```bash
cd /home/enclude/automation/development
chmod +x check-dev-status.sh
./check-dev-status.sh
```

### 2. Переключение на Development контур
```bash
cd /home/enclude/automation/development
chmod +x switch-to-dev.sh
sudo ./switch-to-dev.sh
```

### 3. Проверка результата
```bash
./check-dev-status.sh
```

---

## 📁 Структура файлов

```
/home/enclude/automation/development/
├── 📄 .env                           # Переменные окружения (создать)
├── 📄 config.js                      # Конфигурация (исправлен)
├── 📄 database.js                    # База данных (исправлен)
├── 📄 server.js                      # Сервер (готов)
├── 📄 delivery-app-dev.service       # Systemd сервис (создан)
├── 📄 switch-to-dev.sh              # Скрипт переключения (создан)
├── 📄 check-dev-status.sh           # Скрипт проверки (создан)
├── 📄 delivery-dev.db               # Development база данных
├── 📄 delivery.db                   # Production база (удалить)
└── 📁 logs/                         # Логи
    ├── app-dev.log                  # Логи приложения
    └── error-dev.log                # Логи ошибок
```

---

## 🔧 Конфигурация

### Переменные окружения (.env)
```bash
NODE_ENV=development
PORT=3001
HTTPS_PORT=3444
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
TELEGRAM_BOT_TOKEN=7635888665:AAH-BWmG7g8jnwFjnKG1RnfYtlftwgtSx9k
JWT_SECRET=delivery-app-secret-key-2024-dev
YANDEX_GEOCODER_API_KEY=a5accd3f-5b10-4c88-9101-f895d76512f6
LOG_LEVEL=debug
```

### Systemd сервис
- **Имя:** `delivery-app-dev`
- **Порт HTTP:** 3001
- **Порт HTTPS:** 3444
- **База данных:** `delivery-dev.db`
- **Рабочая директория:** `/home/enclude/automation/development`

---

## 🎯 Команды управления

### Development сервис
```bash
# Статус
sudo systemctl status delivery-app-dev

# Запуск
sudo systemctl start delivery-app-dev

# Остановка
sudo systemctl stop delivery-app-dev

# Перезапуск
sudo systemctl restart delivery-app-dev

# Включить автозапуск
sudo systemctl enable delivery-app-dev

# Отключить автозапуск
sudo systemctl disable delivery-app-dev
```

### Production сервис
```bash
# Статус
sudo systemctl status delivery-app

# Запуск
sudo systemctl start delivery-app

# Остановка
sudo systemctl stop delivery-app
```

### Логи
```bash
# Development логи
tail -f /home/enclude/automation/development/logs/app-dev.log
tail -f /home/enclude/automation/development/logs/error-dev.log

# Systemd логи
sudo journalctl -u delivery-app-dev -f
sudo journalctl -u delivery-app -f
```

---

## 🌐 Доступ к сервисам

### Development
- **HTTP:** http://localhost:3001
- **HTTPS:** https://localhost:3444
- **Админ панель:** http://localhost:3001/admin

### Production
- **HTTP:** http://localhost:3000
- **HTTPS:** https://localhost:3443
- **Админ панель:** http://localhost:3000/admin

---

## 🔍 Диагностика

### Проверка процессов
```bash
# Все процессы Node.js
ps aux | grep node

# Процессы по портам
netstat -tlnp | grep :3001
netstat -tlnp | grep :3000
```

### Проверка баз данных
```bash
# Размер файлов
ls -lh /home/enclude/automation/development/*.db

# Подключения к базам
lsof | grep delivery
```

### Проверка конфигурации
```bash
# Переменные окружения
cat /home/enclude/automation/development/.env

# Systemd конфигурация
sudo systemctl show delivery-app-dev --property=Environment
```

---

## ⚠️ Важные моменты

### Безопасность
1. **Разные порты** для development и production
2. **Разные базы данных** для изоляции данных
3. **Разные JWT секреты** для безопасности
4. **Разные логи** для мониторинга

### Рекомендации
1. **Всегда используйте скрипты** для переключения
2. **Проверяйте статус** перед и после изменений
3. **Создавайте backup** перед критическими операциями
4. **Мониторьте логи** для выявления проблем

### Ограничения
1. **Не запускайте** development и production одновременно
2. **Не копируйте** production данные в development
3. **Не используйте** production токены в development
4. **Не изменяйте** production конфигурацию

---

## 🚨 Устранение неполадок

### Development сервис не запускается
```bash
# Проверка ошибок
sudo journalctl -u delivery-app-dev --no-pager -n 50

# Проверка прав доступа
ls -la /home/enclude/automation/development/

# Проверка зависимостей
cd /home/enclude/automation/development
npm install
```

### Порт занят
```bash
# Поиск процесса
sudo lsof -i :3001

# Остановка процесса
sudo kill -9 <PID>
```

### База данных недоступна
```bash
# Проверка файла
ls -la /home/enclude/automation/development/delivery-dev.db

# Проверка прав
chmod 644 /home/enclude/automation/development/delivery-dev.db
```

---

## 📞 Поддержка

При возникновении проблем:

1. **Запустите диагностику:**
   ```bash
   ./check-dev-status.sh
   ```

2. **Проверьте логи:**
   ```bash
   tail -50 /home/enclude/automation/development/logs/error-dev.log
   ```

3. **Создайте backup:**
   ```bash
   cp /home/enclude/automation/development/delivery-dev.db /home/enclude/automation/backup/
   ```

4. **Откатитесь к production:**
   ```bash
   sudo systemctl stop delivery-app-dev
   sudo systemctl start delivery-app
   ```

---

## ✅ Чеклист настройки

- [ ] Создан .env файл с NODE_ENV=development
- [ ] Исправлен config.js для правильной базы данных
- [ ] Создан delivery-app-dev.service
- [ ] Скопирован systemd сервис в /etc/systemd/system/
- [ ] Включен автозапуск development сервиса
- [ ] Остановлен production сервис
- [ ] Запущен development сервис
- [ ] Проверена работа на порту 3001
- [ ] Проверено подключение к delivery-dev.db
- [ ] Протестированы основные функции

**🎉 Development контур готов к использованию!** 