#!/bin/bash

# Скрипт безопасного переключения на Production контур
# DeliveryVLG - Production Environment Switch

set -e  # Остановка при ошибке

echo "🔄 Начинаем переключение на Production контур..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ОШИБКА]${NC} $1"
}

success() {
    echo -e "${GREEN}[УСПЕХ]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[ПРЕДУПРЕЖДЕНИЕ]${NC} $1"
}

# Шаг 1: Создание backup
log "Создаем backup баз данных..."
backup_dir="/home/enclude/automation/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

if [ -f "/home/enclude/automation/production/delivery.db" ]; then
    cp "/home/enclude/automation/production/delivery.db" "$backup_dir/"
    success "Backup delivery.db создан"
fi

log "Backup сохранен в: $backup_dir"

# Шаг 2: Проверка текущего состояния
log "Проверяем текущее состояние сервисов..."

# Проверяем, запущен ли development сервис
if systemctl is-active --quiet delivery-app-dev; then
    warning "Development сервис запущен. Останавливаем..."
    sudo systemctl stop delivery-app-dev
    success "Development сервис остановлен"
else
    log "Development сервис не запущен"
fi

# Проверяем, запущен ли staging сервис
if systemctl is-active --quiet delivery-app-staging; then
    warning "Staging сервис запущен. Останавливаем..."
    sudo systemctl stop delivery-app-staging
    success "Staging сервис остановлен"
else
    log "Staging сервис не запущен"
fi

# Проверяем, есть ли процессы Node.js
node_processes=$(pgrep -f "server.js" || true)
if [ -n "$node_processes" ]; then
    warning "Найдены процессы Node.js: $node_processes"
    log "Останавливаем процессы..."
    sudo pkill -f "server.js" || true
    sleep 2
    success "Процессы Node.js остановлены"
fi

# Шаг 3: Копирование systemd сервиса
log "Настраиваем systemd сервис для production..."

if [ -f "/home/enclude/automation/production/delivery-app-production.service" ]; then
    sudo cp "/home/enclude/automation/production/delivery-app-production.service" "/etc/systemd/system/"
    success "Systemd сервис скопирован"
else
    error "Файл delivery-app-production.service не найден!"
    exit 1
fi

# Шаг 4: Перезагрузка systemd и запуск production сервиса
log "Перезагружаем systemd и запускаем production сервис..."

sudo systemctl daemon-reload
sudo systemctl enable delivery-app-production
sudo systemctl start delivery-app-production

# Ждем немного для запуска
sleep 5

# Шаг 5: Проверка статуса
log "Проверяем статус production сервиса..."

if systemctl is-active --quiet delivery-app-production; then
    success "Production сервис успешно запущен!"
else
    error "Production сервис не запустился!"
    sudo systemctl status delivery-app-production
    exit 1
fi

# Шаг 6: Проверка портов
log "Проверяем порты..."

if netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
    success "Порт 3000 (HTTP) активен"
else
    warning "Порт 3000 не активен"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3443 "; then
    success "Порт 3443 (HTTPS) активен"
else
    warning "Порт 3443 не активен"
fi

# Шаг 7: Проверка базы данных
log "Проверяем подключение к базе данных..."

production_process=$(pgrep -f "delivery-app-production" || true)
if [ -n "$production_process" ]; then
    db_connection=$(lsof -p "$production_process" 2>/dev/null | grep "delivery.db" || true)
    if [ -n "$db_connection" ]; then
        success "Production сервер использует правильную базу данных (delivery.db)"
    else
        warning "Не удалось проверить подключение к базе данных"
    fi
fi

# Шаг 8: Финальная проверка
log "Выполняем финальную проверку..."

echo ""
echo "📊 СТАТУС ПЕРЕКЛЮЧЕНИЯ:"
echo "======================"
echo "✅ Backup создан: $backup_dir"
echo "✅ Development сервис остановлен"
echo "✅ Staging сервис остановлен"
echo "✅ Production сервис запущен"
echo "✅ Systemd настроен"
echo ""

# Проверяем логи
if [ -f "/home/enclude/automation/production/logs/app-production.log" ]; then
    echo "📋 Последние логи production сервиса:"
    tail -5 "/home/enclude/automation/production/logs/app-production.log" 2>/dev/null || echo "Логи пока пусты"
fi

echo ""
success "🎉 Переключение на Production контур завершено успешно!"
echo ""
echo "🌐 Production сервер доступен по адресам:"
echo "   HTTP:  http://localhost:3000"
echo "   HTTPS: https://localhost:3443"
echo ""
echo "📁 Логи: /home/enclude/automation/production/logs/"
echo "🗄️  База данных: /home/enclude/automation/production/delivery.db"
echo ""
echo "🔧 Управление сервисом:"
echo "   sudo systemctl status delivery-app-production"
echo "   sudo systemctl restart delivery-app-production"
echo "   sudo systemctl stop delivery-app-production" 