# 🏗️ РУКОВОДСТВО ПО ИЗОЛЯЦИИ КОНТУРОВ DeliveryVLG

## 📋 Обзор

Данное руководство описывает полную настройку изолированных контуров для системы DeliveryVLG, включая development, staging и production среды.

## 🎯 Цель

Обеспечить полную изоляцию между контурами:
- ✅ Отдельные базы данных для каждого контура
- ✅ Отдельные systemd сервисы
- ✅ Отдельные порты
- ✅ Правильные переменные окружения
- ✅ Безопасное переключение между контурами

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ КОНТУРОВ

### ✅ Итоговая конфигурация

| Контур | Статус | Порт HTTP | Порт HTTPS | База данных | Systemd Сервис | NODE_ENV |
|--------|--------|-----------|------------|-------------|----------------|----------|
| **Development** | ✅ АКТИВЕН | 3001 | 3444 | delivery-dev.db | delivery-app-dev | development |
| **Staging** | ❌ ОСТАНОВЛЕН | 3002 | 3445 | delivery-staging.db | delivery-app-staging | staging |
| **Production** | ✅ АКТИВЕН | 3000 | 3443 | delivery.db | delivery-app-production | production |

### 🌐 Доступ к сервисам

```bash
# Development контур
http://localhost:3001
https://localhost:3444

# Staging контур  
http://localhost:3002
https://localhost:3445

# Production контур
http://localhost:3000
https://localhost:3443
```

---

## 📁 СТРУКТУРА ДИРЕКТОРИЙ

```
/home/enclude/automation/
├── 📂 development/
│   ├── ✅ delivery-dev.db (только development база)
│   ├── ✅ .env (NODE_ENV=development)
│   ├── ✅ database.js (подключение к delivery-dev.db)
│   ├── ✅ delivery-app-dev.service (systemd сервис)
│   ├── ✅ switch-to-dev.sh (скрипт переключения)
│   ├── ✅ check-dev-status.sh (скрипт диагностики)
│   └── 📂 backup-old-dbs/ (production и staging базы)
│
├── 📂 staging/
│   ├── ✅ delivery-staging.db (только staging база)
│   ├── ✅ .env (NODE_ENV=staging)
│   ├── ✅ database.js (подключение к delivery-staging.db)
│   ├── ✅ delivery-app-staging.service (systemd сервис)
│   ├── ✅ switch-to-staging.sh (скрипт переключения)
│   ├── ✅ check-staging-status.sh (скрипт диагностики)
│   └── 📂 backup-old-dbs/ (production и development базы)
│
└── 📂 production/
    ├── ✅ delivery.db (только production база)
    ├── ✅ .env (NODE_ENV=production)
    ├── ✅ database.js (подключение к delivery.db)
    ├── ✅ delivery-app-production.service (systemd сервис)
    ├── ✅ switch-to-production.sh (скрипт переключения)
    ├── ✅ check-production-status.sh (скрипт диагностики)
    └── 📂 backup-old-dbs/ (development и staging базы)
```

---

## 🛠️ УПРАВЛЕНИЕ КОНТУРАМИ

### 🔧 Systemd команды

```bash
# Development контур
sudo systemctl status delivery-app-dev
sudo systemctl start delivery-app-dev
sudo systemctl stop delivery-app-dev
sudo systemctl restart delivery-app-dev

# Staging контур
sudo systemctl status delivery-app-staging
sudo systemctl start delivery-app-staging
sudo systemctl stop delivery-app-staging
sudo systemctl restart delivery-app-staging

# Production контур
sudo systemctl status delivery-app-production
sudo systemctl start delivery-app-production
sudo systemctl stop delivery-app-production
sudo systemctl restart delivery-app-production
```

### 🔄 Скрипты переключения

```bash
# Переключение на Development
cd /home/enclude/automation/development
sudo ./switch-to-dev.sh

# Переключение на Staging
cd /home/enclude/automation/staging
sudo ./switch-to-staging.sh

# Переключение на Production
cd /home/enclude/automation/production
sudo ./switch-to-production.sh
```

### 🔍 Скрипты диагностики

```bash
# Проверка Development
cd /home/enclude/automation/development
./check-dev-status.sh

# Проверка Staging
cd /home/enclude/automation/staging
./check-staging-status.sh

# Проверка Production
cd /home/enclude/automation/production
./check-production-status.sh
```

---

## 📋 КОНФИГУРАЦИОННЫЕ ФАЙЛЫ

### 🔧 .env файлы

**Development (.env):**
```bash
TELEGRAM_BOT_TOKEN=7635888665:AAH-BWmG7g8jnwFjnKG1RnfYtlftwgtSx9k
PORT=3001
JWT_SECRET=delivery-app-secret-key-2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
YANDEX_GEOCODER_API_KEY=a5accd3f-5b10-4c88-9101-f895d76512f6
NODE_ENV=development
HTTPS_PORT=3444
```

**Staging (.env):**
```bash
TELEGRAM_BOT_TOKEN=7604802968:AAFiCh_7cicXZGGmS5za_17FF96xIj3unx0
PORT=3002
JWT_SECRET=delivery-app-secret-key-2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
YANDEX_GEOCODER_API_KEY=a5accd3f-5b10-4c88-9101-f895d76512f6
NODE_ENV=staging
HTTPS_PORT=3445
```

**Production (.env):**
```bash
TELEGRAM_BOT_TOKEN=7992144068:AAHjnSP39jKGsYt2mZ_LjuzlOwZ8RVXpRtA
PORT=3000
JWT_SECRET=delivery-app-secret-key-2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
YANDEX_GEOCODER_API_KEY=a5accd3f-5b10-4c88-9101-f895d76512f6
NODE_ENV=production
HTTPS_PORT=3443
```

### 🗄️ Database.js файлы

**Development (database.js):**
```javascript
const dbPath = path.join(__dirname, 'delivery-dev.db');
```

**Staging (database.js):**
```javascript
const dbPath = path.join(__dirname, 'delivery-staging.db');
```

**Production (database.js):**
```javascript
const dbPath = path.join(__dirname, 'delivery.db');
```

---

## 🔄 ПРОЦЕСС ПЕРЕКЛЮЧЕНИЯ КОНТУРОВ

### 📋 Алгоритм переключения

#### Production (Основной контур)
1. **Production всегда остается активным** - Не останавливается при переключении других контуров
2. **Защита от случайной остановки** - Нельзя остановить через dashboard
3. **Независимая работа** - Работает параллельно с dev/staging

#### Development и Staging (Вспомогательные контуры)
1. **Создание backup** - Базы данных сохраняются в backup директорию
2. **Остановка другого dev/staging** - Останавливается только конкурирующий dev/staging сервис
3. **Production остается активным** - Основной сервис не затрагивается
4. **Запуск нового сервиса** - Запускается сервис выбранного контура
5. **Проверка статуса** - Проверяется корректность запуска и подключения к БД

### ⚠️ Важные моменты

- ✅ Production всегда остается активным и защищен
- ✅ Development и staging переключаются между собой
- ✅ Автоматическая остановка только конфликтующих dev/staging сервисов
- ✅ Проверка подключения к правильной базе данных
- ✅ Логирование всех операций
- ✅ Graceful shutdown для корректного завершения

---

## 🔍 ДИАГНОСТИКА ПРОБЛЕМ

### 🚨 Частые проблемы

**1. Сервис не запускается**
```bash
# Проверить логи
sudo journalctl -u delivery-app-production --no-pager -n 50

# Проверить статус
sudo systemctl status delivery-app-production
```

**2. Неправильная база данных**
```bash
# Найти процесс
ps aux | grep node

# Проверить подключение к БД
sudo lsof -p <PID> | grep db
```

**3. Конфликт портов**
```bash
# Проверить занятые порты
sudo netstat -tlnp | grep :300

# Остановить конфликтующий сервис
sudo systemctl stop delivery-app-dev
```

### 🔧 Команды диагностики

```bash
# Проверка всех сервисов
sudo systemctl list-units --type=service | grep delivery

# Проверка процессов Node.js
ps aux | grep node | grep -v grep

# Проверка портов
sudo netstat -tlnp | grep :300

# Проверка логов
tail -f /home/enclude/automation/production/logs/app-production.log
```

---

## 📚 ЛУЧШИЕ ПРАКТИКИ

### ✅ Рекомендации

1. **Всегда используйте скрипты переключения** - Не переключайте контуры вручную
2. **Проверяйте статус после переключения** - Используйте скрипты диагностики
3. **Создавайте backup перед изменениями** - Скрипты делают это автоматически
4. **Мониторьте логи** - Регулярно проверяйте логи на ошибки
5. **Тестируйте на staging** - Всегда тестируйте изменения на staging перед production

### ❌ Что НЕ делать

1. **Не останавливайте production через dashboard** - Используйте командную строку для экстренной остановки
2. **Не запускайте несколько dev/staging одновременно** - Только один может быть активен
3. **Не изменяйте базы данных напрямую** - Используйте миграции
4. **Не удаляйте backup директории** - Они содержат важные данные
5. **Не изменяйте systemd сервисы вручную** - Используйте готовые файлы
6. **Не забывайте про NODE_ENV** - Всегда проверяйте переменные окружения

---

## 🔐 БЕЗОПАСНОСТЬ

### 🛡️ Меры безопасности

- ✅ Production всегда остается активным и защищен
- ✅ Защита от случайной остановки production через dashboard
- ✅ Изоляция баз данных между контурами
- ✅ Отдельные systemd сервисы с ограниченными правами
- ✅ Логирование всех операций
- ✅ Backup всех изменений
- ✅ Graceful shutdown для корректного завершения
- ✅ Проверка целостности данных

### 🔒 Доступ к сервисам

```bash
# Только локальный доступ (рекомендуется для development)
http://localhost:3001

# Внешний доступ (только для production)
http://your-domain.com:3000
```

---

## 📞 ПОДДЕРЖКА

### 🆘 В случае проблем

1. **Проверьте статус всех контуров:**
   ```bash
   ./check-dev-status.sh
   ./check-staging-status.sh
   ./check-production-status.sh
   ```

2. **Проверьте логи:**
   ```bash
   sudo journalctl -u delivery-app-production --no-pager -n 100
   ```

3. **Восстановите из backup:**
   ```bash
   # Найти backup
   ls -la /home/enclude/automation/backup/
   
   # Восстановить базу данных
   cp /home/enclude/automation/backup/YYYYMMDD_HHMMSS/delivery.db ./
   ```

4. **Перезапустите сервис:**
   ```bash
   sudo systemctl restart delivery-app-production
   ```

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ

### 🗓️ Дата: 2025-07-24

**Выполненные работы:**
- ✅ Настройка изоляции development контура
- ✅ Настройка изоляции staging контура  
- ✅ Настройка изоляции production контура
- ✅ Создание скриптов переключения и диагностики
- ✅ Очистка смешанных баз данных
- ✅ Создание backup директорий
- ✅ Настройка правильных systemd сервисов

**Результат:**
- ✅ Полная изоляция всех трех контуров
- ✅ Безопасное переключение между контурами
- ✅ Автоматическая диагностика состояния
- ✅ Backup всех изменений

---

## 🎯 ЗАКЛЮЧЕНИЕ

Система DeliveryVLG теперь имеет полностью изолированные контуры с безопасным управлением и диагностикой. Все контуры работают независимо и используют свои собственные ресурсы.

**Ключевые достижения:**
- ✅ 100% изоляция контуров
- ✅ Автоматизированное управление
- ✅ Безопасные процедуры переключения
- ✅ Полная диагностика состояния
- ✅ Backup и восстановление данных

**Система готова к продакшн использованию!** 🚀 