#!/bin/bash

# 🚀 Скрипт миграции архитектуры DeliveryMiniapp
# Этап 2: Создание новой структуры

set -e  # Остановка при ошибке

echo "🏗️  Этап 2: Создание новой архитектуры"
echo "========================================"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Проверка прав доступа
if [ "$EUID" -ne 0 ]; then
    warn "Скрипт запущен без sudo. Некоторые операции могут не выполниться."
fi

# 1. Создание структуры папок
log "Создание структуры папок..."

# Попытка создать в /var/www/
if sudo mkdir -p /var/www/{production,development,staging} 2>/dev/null; then
    WWW_ROOT="/var/www"
    log "Структура создана в /var/www/"
else
    # Альтернатива в домашней папке
    mkdir -p ~/www/{production,development,staging}
    WWW_ROOT="$HOME/www"
    log "Структура создана в $WWW_ROOT"
fi

# 2. Создание подпапок для каждой среды
for env in production development staging; do
    mkdir -p "$WWW_ROOT/$env"/{app,logs,config,backup}
    log "Создана структура для $env"
done

# 3. Копирование существующих приложений
log "Копирование существующих приложений..."

# Продакшн
if [ -d "/home/enclude/delivery-app" ]; then
    cp -r /home/enclude/delivery-app "$WWW_ROOT/production/app/"
    log "Скопирован продакшн в $WWW_ROOT/production/app/"
else
    warn "Папка /home/enclude/delivery-app не найдена"
fi

# Разработка
if [ -d "/home/enclude/delivery-app-dev" ]; then
    cp -r /home/enclude/delivery-app-dev "$WWW_ROOT/development/app/"
    log "Скопирована разработка в $WWW_ROOT/development/app/"
else
    warn "Папка /home/enclude/delivery-app-dev не найдена"
fi

# 4. Настройка Git веток
log "Настройка Git веток..."

# Продакшн - переключение на main
if [ -d "$WWW_ROOT/production/app/.git" ]; then
    cd "$WWW_ROOT/production/app"
    if git checkout main 2>/dev/null; then
        log "Продакшн переключен на ветку main"
    else
        warn "Не удалось переключить продакшн на main, оставляем текущую ветку"
    fi
fi

# Разработка - переключение на develop
if [ -d "$WWW_ROOT/development/app/.git" ]; then
    cd "$WWW_ROOT/development/app"
    if git checkout develop 2>/dev/null; then
        log "Разработка переключена на ветку develop"
    else
        warn "Не удалось переключить разработку на develop, оставляем текущую ветку"
    fi
fi

# 5. Настройка баз данных
log "Настройка баз данных..."

# Копирование БД
if [ -f "/home/enclude/delivery-app/delivery.db" ]; then
    cp /home/enclude/delivery-app/delivery.db "$WWW_ROOT/production/delivery.db"
    log "Скопирована продакшн БД"
fi

if [ -f "/home/enclude/delivery-app-dev/delivery-dev.db" ]; then
    cp /home/enclude/delivery-app-dev/delivery-dev.db "$WWW_ROOT/development/delivery-dev.db"
    log "Скопирована БД разработки"
fi

# Создание staging БД
if [ -f "$WWW_ROOT/production/delivery.db" ]; then
    cp "$WWW_ROOT/production/delivery.db" "$WWW_ROOT/staging/delivery-staging.db"
    log "Создана staging БД"
fi

# 6. Создание конфигурационных файлов
log "Создание конфигурационных файлов..."

# Продакшн конфиг
cat > "$WWW_ROOT/production/config.prod.js" << 'EOF'
module.exports = {
    environment: 'production',
    port: 3000,
    httpsPort: 3443,
    database: './delivery.db',
    logLevel: 'info',
    cors: {
        origin: ['https://yourdomain.com', 'http://89.169.182.9:3000']
    }
};
EOF

# Разработка конфиг
cat > "$WWW_ROOT/development/config.dev.js" << 'EOF'
module.exports = {
    environment: 'development',
    port: 3001,
    httpsPort: 3444,
    database: './delivery-dev.db',
    logLevel: 'debug',
    cors: {
        origin: ['http://localhost:3001', 'http://89.169.182.9:3001']
    }
};
EOF

# Staging конфиг
cat > "$WWW_ROOT/staging/config.staging.js" << 'EOF'
module.exports = {
    environment: 'staging',
    port: 3002,
    httpsPort: 3445,
    database: './delivery-staging.db',
    logLevel: 'debug',
    cors: {
        origin: ['http://localhost:3002', 'http://89.169.182.9:3002']
    }
};
EOF

# 7. Создание systemd сервисов
log "Создание systemd сервисов..."

# Продакшн сервис
cat > "$WWW_ROOT/production/delivery-production.service" << EOF
[Unit]
Description=DeliveryMiniapp Production
After=network.target

[Service]
Type=simple
User=enclude
WorkingDirectory=$WWW_ROOT/production/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HTTPS_PORT=3443

[Install]
WantedBy=multi-user.target
EOF

# Разработка сервис
cat > "$WWW_ROOT/development/delivery-development.service" << EOF
[Unit]
Description=DeliveryMiniapp Development
After=network.target

[Service]
Type=simple
User=enclude
WorkingDirectory=$WWW_ROOT/development/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=development
Environment=PORT=3001
Environment=HTTPS_PORT=3444

[Install]
WantedBy=multi-user.target
EOF

# Staging сервис
cat > "$WWW_ROOT/staging/delivery-staging.service" << EOF
[Unit]
Description=DeliveryMiniapp Staging
After=network.target

[Service]
Type=simple
User=enclude
WorkingDirectory=$WWW_ROOT/staging/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=staging
Environment=PORT=3002
Environment=HTTPS_PORT=3445

[Install]
WantedBy=multi-user.target
EOF

# 8. Создание скриптов управления
log "Создание скриптов управления..."

# Скрипт управления продакшн
cat > "$WWW_ROOT/production/manage.sh" << 'EOF'
#!/bin/bash
case "$1" in
    start)
        sudo systemctl start delivery-production
        ;;
    stop)
        sudo systemctl stop delivery-production
        ;;
    restart)
        sudo systemctl restart delivery-production
        ;;
    status)
        sudo systemctl status delivery-production
        ;;
    logs)
        sudo journalctl -u delivery-production -f
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF

chmod +x "$WWW_ROOT/production/manage.sh"

# Скрипт управления разработкой
cat > "$WWW_ROOT/development/manage.sh" << 'EOF'
#!/bin/bash
case "$1" in
    start)
        sudo systemctl start delivery-development
        ;;
    stop)
        sudo systemctl stop delivery-development
        ;;
    restart)
        sudo systemctl restart delivery-development
        ;;
    status)
        sudo systemctl status delivery-development
        ;;
    logs)
        sudo journalctl -u delivery-development -f
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF

chmod +x "$WWW_ROOT/development/manage.sh"

# 9. Создание README
log "Создание документации..."

cat > "$WWW_ROOT/README.md" << 'EOF'
# 🚀 DeliveryMiniapp - Новая архитектура

## 📁 Структура

```
/var/www/ (или ~/www/)
├── production/          # Продакшн среда
│   ├── app/            # Код приложения (main branch)
│   ├── delivery.db     # Продакшн БД
│   ├── config.prod.js  # Конфигурация
│   ├── manage.sh       # Скрипт управления
│   └── logs/           # Логи
├── development/        # Среда разработки
│   ├── app/           # Код приложения (develop branch)
│   ├── delivery-dev.db # БД разработки
│   ├── config.dev.js  # Конфигурация
│   ├── manage.sh      # Скрипт управления
│   └── logs/          # Логи
└── staging/           # Тестовая среда
    ├── app/           # Код приложения (feature branches)
    ├── delivery-staging.db # БД тестирования
    ├── config.staging.js # Конфигурация
    ├── manage.sh      # Скрипт управления
    └── logs/          # Логи
```

## 🎯 Порты

- **Продакшн**: 3000 (HTTP), 3443 (HTTPS)
- **Разработка**: 3001 (HTTP), 3444 (HTTPS)
- **Staging**: 3002 (HTTP), 3445 (HTTPS)
- **Dashboard**: 3003 (HTTP)

## 🛠️ Управление

### Продакшн
```bash
cd /var/www/production
./manage.sh start|stop|restart|status|logs
```

### Разработка
```bash
cd /var/www/development
./manage.sh start|stop|restart|status|logs
```

### Staging
```bash
cd /var/www/staging
./manage.sh start|stop|restart|status|logs
```

## 🔄 Следующие шаги

1. Установить systemd сервисы
2. Настроить Nginx прокси
3. Протестировать все среды
4. Переключить трафик

EOF

log "✅ Этап 2 завершен!"
log "📁 Новая структура создана в: $WWW_ROOT"
log "📖 Документация: $WWW_ROOT/README.md"
log ""
log "🔄 Следующий шаг: Этап 3 - Настройка Git репозиториев" 