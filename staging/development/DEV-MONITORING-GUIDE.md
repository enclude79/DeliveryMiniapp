# 🛡️ DEV-МОНИТОРИНГ: РУКОВОДСТВО ДЛЯ СПЕЦИАЛИСТОВ

## 📋 ОБЗОР СИСТЕМЫ

### Что это такое?
Система автоматического мониторинга для **DEV-сервера** (сервера разработки) приложения доставки. Отслеживает состояние сервера и автоматически восстанавливает его при сбоях.

### Архитектура
```
┌─────────────────────────────────────────────────────────────┐
│                    DEV-СЕРВЕР                              │
│  🔌 Порт 3001 (HTTP) - Админка                            │
│  🔌 Порт 3444 (HTTPS) - Telegram Bot                      │
│  📁 Директория: /home/enclude/delivery-app-dev            │
│  🗄️ База данных: delivery-dev.db                         │
│  🔧 Systemd сервис: delivery-app-dev                      │
└─────────────────────────────────────────────────────────────┘
                              ⬆️
                    Мониторинг каждые 5 минут
                              ⬆️
┌─────────────────────────────────────────────────────────────┐
│              СКРИПТ МОНИТОРИНГА                            │
│  📄 Файл: check-dev-server.sh                             │
│  📝 Лог: dev-monitor.log                                  │
│  🔄 Автоперезапуск при сбоях                              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 БЫСТРЫЙ СТАРТ

### 1. Проверка текущего состояния
```bash
# Перейти в директорию dev-сервера
cd /home/enclude/delivery-app-dev

# Запустить проверку вручную
./check-dev-server.sh
```

### 2. Просмотр статуса сервиса
```bash
# Статус systemd сервиса
sudo systemctl status delivery-app-dev

# Проверка портов
netstat -tlnp | grep -E ':3001|:3444'

# Health check
curl http://localhost:3001/health
```

### 3. Просмотр логов
```bash
# Лог мониторинга (последние 50 строк)
tail -n 50 dev-monitor.log

# Лог самого сервера
tail -n 50 server-dev.log

# Systemd логи
sudo journalctl -u delivery-app-dev -f
```

## 🔧 НАСТРОЙКА АВТОМАТИЧЕСКОГО МОНИТОРИНГА

### Добавление в cron (рекомендуется)
```bash
# Открыть crontab для редактирования
crontab -e

# Добавить строку для проверки каждые 5 минут
*/5 * * * * /home/enclude/delivery-app-dev/check-dev-server.sh

# Проверить активные cron задачи
crontab -l
```

### Проверка работы cron
```bash
# Посмотреть логи cron
tail -f /var/log/cron

# Проверить, что задача добавлена
crontab -l | grep check-dev-server
```

## 📊 ДИАГНОСТИКА ПРОБЛЕМ

### Типичные проблемы и решения

#### 1. Сервер не отвечает на health check
**Симптомы:**
- `dev-ERROR: DEV процесс не найден`
- `dev-WARNING: DEV Health check не проходит`

**Решение:**
```bash
# Проверить процессы
ps aux | grep "node server.js"

# Проверить порты
netstat -tlnp | grep -E ':3001|:3444'

# Перезапустить вручную
sudo systemctl restart delivery-app-dev
```

#### 2. Порт занят другим процессом
**Симптомы:**
- `Error: listen EADDRINUSE: address already in use 0.0.0.0:3001`
- `dev-WARNING: Обнаружен процесс на dev-порту 3001`

**Решение:**
```bash
# Найти процесс, занимающий порт
lsof -i :3001
lsof -i :3444

# Убить процесс (если это не dev-сервер)
sudo kill -9 <PID>

# Перезапустить dev-сервер
sudo systemctl restart delivery-app-dev
```

#### 3. Превышен лимит перезапусков
**Симптомы:**
- `dev-ERROR: КРИТИЧНО: Превышено максимальное количество перезапусков (5)`
- `dev-ERROR: КРИТИЧНО: Требуется ручное вмешательство!`

**Решение:**
```bash
# Сбросить счетчик перезапусков
echo "0" > /tmp/delivery-app-dev-restart-count

# Проверить логи для выяснения причины
tail -n 100 dev-monitor.log
tail -n 100 server-dev.log

# Перезапустить вручную
sudo systemctl restart delivery-app-dev
```

#### 4. Проблемы с правами доступа
**Симптомы:**
- `Permission denied` в логах
- Сервис не может записать в лог-файлы

**Решение:**
```bash
# Проверить права на директорию
ls -la /home/enclude/delivery-app-dev/

# Исправить права (если нужно)
sudo chown -R enclude:enclude /home/enclude/delivery-app-dev/
sudo chmod 755 /home/enclude/delivery-app-dev/
```

## 📝 АНАЛИЗ ЛОГОВ

### Структура лог-файлов

#### dev-monitor.log
Основной лог мониторинга с префиксом `dev-`:
```
[dev-INFO] 2025-07-17 05:32:48 - 🔍 Начинаю проверку DEV сервера...
[dev-SUCCESS] 2025-07-17 05:32:48 - DEV сервер работает корректно
[dev-ERROR] 2025-07-17 05:32:48 - КРИТИЧНО: Перезапуск DEV сервера...
```

#### server-dev.log
Лог самого dev-сервера:
```
🚀 Запуск в режиме: development
📊 База данных: delivery-dev.db
🔌 Порты: HTTP 3001, HTTPS 3444
❌ КРИТИЧЕСКАЯ ОШИБКА: Error: listen EADDRINUSE
```

### Полезные команды для анализа

```bash
# Поиск ошибок в логах мониторинга
grep "dev-ERROR" dev-monitor.log

# Поиск перезапусков
grep "Перезапуск" dev-monitor.log

# Поиск критических ошибок в логах сервера
grep "КРИТИЧЕСКАЯ ОШИБКА" server-dev.log

# Мониторинг логов в реальном времени
tail -f dev-monitor.log
tail -f server-dev.log
```

## 🛠️ РУЧНОЕ УПРАВЛЕНИЕ

### Команды управления сервисом
```bash
# Запуск
sudo systemctl start delivery-app-dev

# Остановка
sudo systemctl stop delivery-app-dev

# Перезапуск
sudo systemctl restart delivery-app-dev

# Статус
sudo systemctl status delivery-app-dev

# Включение автозапуска
sudo systemctl enable delivery-app-dev

# Отключение автозапуска
sudo systemctl disable delivery-app-dev
```

### Команды диагностики
```bash
# Полная диагностика системы
./health-check.sh

# Проверка ресурсов
top -p $(pgrep -f "node server.js")

# Проверка сетевых соединений
ss -tlnp | grep -E ':3001|:3444'

# Проверка использования диска
df -h /home/enclude/delivery-app-dev/
```

## 🔄 ПРОЦЕСС ВОССТАНОВЛЕНИЯ

### Автоматическое восстановление
1. **Обнаружение проблемы** - скрипт проверяет процесс и health endpoint
2. **Диагностика** - проверка портов, ресурсов, systemd статуса
3. **Очистка** - убийство зависших процессов на dev-портах
4. **Перезапуск** - запуск через systemctl restart
5. **Проверка** - подтверждение успешного запуска

### Ручное восстановление
```bash
# 1. Остановить все node процессы
sudo pkill -f "node server.js"

# 2. Очистить порты
sudo lsof -ti:3001 | xargs kill -9
sudo lsof -ti:3444 | xargs kill -9

# 3. Сбросить счетчик перезапусков
echo "0" > /tmp/delivery-app-dev-restart-count

# 4. Запустить сервис
sudo systemctl start delivery-app-dev

# 5. Проверить статус
sudo systemctl status delivery-app-dev
curl http://localhost:3001/health
```

## 📞 КОНТАКТЫ И ПОДДЕРЖКА

### В случае критических проблем:
1. **Проверьте логи** - `tail -n 100 dev-monitor.log`
2. **Проверьте статус** - `sudo systemctl status delivery-app-dev`
3. **Проверьте порты** - `netstat -tlnp | grep -E ':3001|:3444'`
4. **Перезапустите вручную** - `sudo systemctl restart delivery-app-dev`

### Полезные файлы:
- **Скрипт мониторинга**: `/home/enclude/delivery-app-dev/check-dev-server.sh`
- **Лог мониторинга**: `/home/enclude/delivery-app-dev/dev-monitor.log`
- **Лог сервера**: `/home/enclude/delivery-app-dev/server-dev.log`
- **Systemd сервис**: `/etc/systemd/system/delivery-app-dev.service`

---

**Дата создания**: 2025-07-17  
**Версия**: 1.0  
**Статус**: Активно используется ✅ 