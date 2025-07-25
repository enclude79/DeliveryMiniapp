#!/bin/bash

# Скрипт проверки состояния Production контура
# DeliveryVLG - Production Environment Status Check

echo "🔍 Проверка состояния Production контура..."
echo "============================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo ""
echo "📊 СТАТУС СЕРВИСОВ:"
echo "=================="

# Проверка systemd сервисов
if systemctl is-active --quiet delivery-app-production; then
    success "Production сервис (delivery-app-production) - АКТИВЕН"
else
    error "Production сервис (delivery-app-production) - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet delivery-app-dev; then
    warning "Development сервис (delivery-app-dev) - АКТИВЕН"
else
    info "Development сервис (delivery-app-dev) - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet delivery-app-staging; then
    warning "Staging сервис (delivery-app-staging) - АКТИВЕН"
else
    info "Staging сервис (delivery-app-staging) - НЕ АКТИВЕН"
fi

echo ""
echo "🖥️  ПРОЦЕССЫ NODE.JS:"
echo "===================="

# Проверка процессов Node.js
node_processes=$(pgrep -f "server.js" || true)
if [ -n "$node_processes" ]; then
    info "Найдены процессы Node.js:"
    for pid in $node_processes; do
        process_info=$(ps -p "$pid" -o pid,ppid,cmd --no-headers 2>/dev/null || true)
        if echo "$process_info" | grep -q "delivery-app-production"; then
            success "  PID $pid - Production сервер"
        elif echo "$process_info" | grep -q "delivery-app-dev"; then
            warning "  PID $pid - Development сервер"
        elif echo "$process_info" | grep -q "delivery-app-staging"; then
            warning "  PID $pid - Staging сервер"
        else
            info "  PID $pid - Неизвестный процесс"
        fi
    done
else
    error "Процессы Node.js не найдены"
fi

echo ""
echo "🌐 ПРОВЕРКА ПОРТОВ:"
echo "=================="

# Проверка портов
if netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
    success "Порт 3000 (Production HTTP) - ОТКРЫТ"
else
    error "Порт 3000 (Production HTTP) - ЗАКРЫТ"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3443 "; then
    success "Порт 3443 (Production HTTPS) - ОТКРЫТ"
else
    error "Порт 3443 (Production HTTPS) - ЗАКРЫТ"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
    warning "Порт 3001 (Development HTTP) - ОТКРЫТ"
else
    info "Порт 3001 (Development HTTP) - ЗАКРЫТ"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3002 "; then
    warning "Порт 3002 (Staging HTTP) - ОТКРЫТ"
else
    info "Порт 3002 (Staging HTTP) - ЗАКРЫТ"
fi

echo ""
echo "🗄️  БАЗЫ ДАННЫХ:"
echo "==============="

# Проверка файлов баз данных
if [ -f "/home/enclude/automation/production/delivery.db" ]; then
    size=$(ls -lh "/home/enclude/automation/production/delivery.db" | awk '{print $5}')
    success "delivery.db (production) - СУЩЕСТВУЕТ ($size)"
else
    error "delivery.db (production) - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/production/delivery-dev.db" ]; then
    size=$(ls -lh "/home/enclude/automation/production/delivery-dev.db" | awk '{print $5}')
    warning "delivery-dev.db (development) - СУЩЕСТВУЕТ ($size)"
else
    info "delivery-dev.db (development) - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/production/delivery-staging.db" ]; then
    size=$(ls -lh "/home/enclude/automation/production/delivery-staging.db" | awk '{print $5}')
    warning "delivery-staging.db (staging) - СУЩЕСТВУЕТ ($size)"
else
    info "delivery-staging.db (staging) - НЕ НАЙДЕН"
fi

# Проверка подключения к базе данных
production_process=$(pgrep -f "delivery-app-production" || true)
if [ -n "$production_process" ]; then
    db_connection=$(lsof -p "$production_process" 2>/dev/null | grep "\.db" || true)
    if echo "$db_connection" | grep -q "delivery.db"; then
        success "Production сервер использует delivery.db"
    elif echo "$db_connection" | grep -q "delivery-dev.db"; then
        error "Production сервер использует development базу (delivery-dev.db)"
    elif echo "$db_connection" | grep -q "delivery-staging.db"; then
        error "Production сервер использует staging базу (delivery-staging.db)"
    else
        warning "Не удалось определить подключение к базе данных"
    fi
else
    error "Production процесс не найден"
fi

echo ""
echo "📁 ФАЙЛЫ КОНФИГУРАЦИИ:"
echo "====================="

# Проверка конфигурационных файлов
if [ -f "/home/enclude/automation/production/database.js" ]; then
    success "database.js - СУЩЕСТВУЕТ"
else
    error "database.js - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/production/.env" ]; then
    success ".env - СУЩЕСТВУЕТ"
    if grep -q "NODE_ENV=production" "/home/enclude/automation/production/.env"; then
        success "NODE_ENV=production установлен"
    else
        warning "NODE_ENV=production НЕ установлен"
    fi
else
    error ".env - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/production/delivery-app-production.service" ]; then
    success "delivery-app-production.service - СУЩЕСТВУЕТ"
else
    error "delivery-app-production.service - НЕ НАЙДЕН"
fi

echo ""
echo "📋 ЛОГИ:"
echo "======="

# Проверка логов
if [ -f "/home/enclude/automation/production/logs/app-production.log" ]; then
    size=$(ls -lh "/home/enclude/automation/production/logs/app-production.log" | awk '{print $5}')
    success "app-production.log - СУЩЕСТВУЕТ ($size)"
    echo "Последние 3 строки:"
    tail -3 "/home/enclude/automation/production/logs/app-production.log" 2>/dev/null || echo "  Лог пуст"
else
    error "app-production.log - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/production/logs/error-production.log" ]; then
    size=$(ls -lh "/home/enclude/automation/production/logs/error-production.log" | awk '{print $5}')
    if [ "$size" != "0" ]; then
        warning "error-production.log - СУЩЕСТВУЕТ ($size) - ЕСТЬ ОШИБКИ"
    else
        success "error-production.log - СУЩЕСТВУЕТ ($size) - БЕЗ ОШИБОК"
    fi
else
    info "error-production.log - НЕ НАЙДЕН"
fi

echo ""
echo "🔧 SYSTEMD СЕРВИСЫ:"
echo "=================="

# Проверка systemd сервисов
if systemctl list-unit-files | grep -q "delivery-app-production"; then
    status=$(systemctl is-enabled delivery-app-production 2>/dev/null || echo "unknown")
    if [ "$status" = "enabled" ]; then
        success "delivery-app-production - ВКЛЮЧЕН в автозапуск"
    else
        warning "delivery-app-production - НЕ ВКЛЮЧЕН в автозапуск"
    fi
else
    error "delivery-app-production - НЕ ЗАРЕГИСТРИРОВАН в systemd"
fi

echo ""
echo "🎯 РЕКОМЕНДАЦИИ:"
echo "==============="

# Анализ и рекомендации
if ! systemctl is-active --quiet delivery-app-production; then
    echo "❌ Запустите production сервис: sudo systemctl start delivery-app-production"
fi

if systemctl is-active --quiet delivery-app-dev; then
    echo "⚠️  Development сервис запущен одновременно с production"
fi

if systemctl is-active --quiet delivery-app-staging; then
    echo "⚠️  Staging сервис запущен одновременно с production"
fi

if [ -f "/home/enclude/automation/production/delivery-dev.db" ]; then
    echo "⚠️  В production контуре есть development база данных"
fi

if [ -f "/home/enclude/automation/production/delivery-staging.db" ]; then
    echo "⚠️  В production контуре есть staging база данных"
fi

if ! grep -q "NODE_ENV=production" "/home/enclude/automation/production/.env" 2>/dev/null; then
    echo "⚠️  Добавьте NODE_ENV=production в .env файл"
fi

echo ""
echo "✅ Проверка завершена!" 