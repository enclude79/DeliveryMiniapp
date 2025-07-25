#!/bin/bash

# Скрипт безопасного переключения на Development контур
# DeliveryVLG - Development Environment Switch

set -e  # Остановка при ошибке

echo "🔄 Начинаем переключение на Development контур..."

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

if [ -f "/home/enclude/automation/development/delivery-dev.db" ]; then
    cp "/home/enclude/automation/development/delivery-dev.db" "$backup_dir/"
    success "Backup delivery-dev.db создан"
fi

if [ -f "/home/enclude/automation/development/delivery.db" ]; then
    cp "/home/enclude/automation/development/delivery.db" "$backup_dir/"
    success "Backup delivery.db создан"
fi

if [ -f "/home/enclude/automation/production/delivery.db" ]; then
    cp "/home/enclude/automation/production/delivery.db" "$backup_dir/"
    success "Backup production/delivery.db создан"
fi

log "Backup сохранен в: $backup_dir"

# Шаг 2: Проверка текущего состояния
log "Проверяем текущее состояние сервисов..."

# Проверяем, запущен ли production сервис
if systemctl is-active --quiet delivery-app; then
    warning "Production сервис запущен. Останавливаем..."
    sudo systemctl stop delivery-app
    success "Production сервис остановлен"
else
    log "Production сервис не запущен"
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
log "Настраиваем systemd сервис для development..."

if [ -f "/home/enclude/automation/development/delivery-app-dev.service" ]; then
    sudo cp "/home/enclude/automation/development/delivery-app-dev.service" "/etc/systemd/system/"
    success "Systemd сервис скопирован"
else
    error "Файл delivery-app-dev.service не найден!"
    exit 1
fi

# Шаг 4: Перезагрузка systemd и запуск development сервиса
log "Перезагружаем systemd и запускаем development сервис..."

sudo systemctl daemon-reload
sudo systemctl enable delivery-app-dev
sudo systemctl start delivery-app-dev

# Ждем немного для запуска
sleep 3

# Шаг 5: Проверка статуса
log "Проверяем статус development сервиса..."

if systemctl is-active --quiet delivery-app-dev; then
    success "Development сервис успешно запущен!"
else
    error "Development сервис не запустился!"
    sudo systemctl status delivery-app-dev
    exit 1
fi

# Шаг 6: Проверка портов
log "Проверяем порты..."

if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
    success "Порт 3001 (HTTP) активен"
else
    warning "Порт 3001 не активен"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3444 "; then
    success "Порт 3444 (HTTPS) активен"
else
    warning "Порт 3444 не активен"
fi

# Шаг 7: Проверка базы данных
log "Проверяем подключение к базе данных..."

dev_process=$(pgrep -f "delivery-app-dev" || true)
if [ -n "$dev_process" ]; then
    db_connection=$(lsof -p "$dev_process" 2>/dev/null | grep "delivery-dev.db" || true)
    if [ -n "$db_connection" ]; then
        success "Development сервер использует правильную базу данных (delivery-dev.db)"
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
echo "✅ Production сервис остановлен"
echo "✅ Development сервис запущен"
echo "✅ Systemd настроен"
echo ""

# Проверяем логи
if [ -f "/home/enclude/automation/development/logs/app-dev.log" ]; then
    echo "📋 Последние логи development сервиса:"
    tail -5 "/home/enclude/automation/development/logs/app-dev.log" 2>/dev/null || echo "Логи пока пусты"
fi

echo ""
success "🎉 Переключение на Development контур завершено успешно!"
echo ""
echo "🌐 Development сервер доступен по адресам:"
echo "   HTTP:  http://localhost:3001"
echo "   HTTPS: https://localhost:3444"
echo ""
echo "📁 Логи: /home/enclude/automation/development/logs/"
echo "🗄️  База данных: /home/enclude/automation/development/delivery-dev.db"
echo ""
echo "🔧 Управление сервисом:"
echo "   sudo systemctl status delivery-app-dev"
echo "   sudo systemctl restart delivery-app-dev"
echo "   sudo systemctl stop delivery-app-dev" 