#!/bin/bash

# Скрипт проверки состояния Development контура
# DeliveryVLG - Development Environment Status Check

echo "🔍 Проверка состояния Development контура..."
echo "=============================================="

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
if systemctl is-active --quiet delivery-app-dev; then
    success "Development сервис (delivery-app-dev) - АКТИВЕН"
else
    error "Development сервис (delivery-app-dev) - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet delivery-app; then
    warning "Production сервис (delivery-app) - АКТИВЕН"
else
    info "Production сервис (delivery-app) - НЕ АКТИВЕН"
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
        if echo "$process_info" | grep -q "delivery-app-dev"; then
            success "  PID $pid - Development сервер"
        elif echo "$process_info" | grep -q "delivery-app"; then
            warning "  PID $pid - Production сервер"
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
if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
    success "Порт 3001 (HTTP) - ОТКРЫТ"
else
    error "Порт 3001 (HTTP) - ЗАКРЫТ"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3444 "; then
    success "Порт 3444 (HTTPS) - ОТКРЫТ"
else
    error "Порт 3444 (HTTPS) - ЗАКРЫТ"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
    warning "Порт 3000 (Production HTTP) - ОТКРЫТ"
else
    info "Порт 3000 (Production HTTP) - ЗАКРЫТ"
fi

echo ""
echo "🗄️  БАЗЫ ДАННЫХ:"
echo "==============="

# Проверка файлов баз данных
if [ -f "/home/enclude/automation/development/delivery-dev.db" ]; then
    size=$(ls -lh "/home/enclude/automation/development/delivery-dev.db" | awk '{print $5}')
    success "delivery-dev.db - СУЩЕСТВУЕТ ($size)"
else
    error "delivery-dev.db - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/development/delivery.db" ]; then
    size=$(ls -lh "/home/enclude/automation/development/delivery.db" | awk '{print $5}')
    warning "delivery.db (production) - СУЩЕСТВУЕТ ($size)"
else
    info "delivery.db (production) - НЕ НАЙДЕН"
fi

# Проверка подключения к базе данных
dev_process=$(pgrep -f "delivery-app-dev" || true)
if [ -n "$dev_process" ]; then
    db_connection=$(lsof -p "$dev_process" 2>/dev/null | grep "\.db" || true)
    if echo "$db_connection" | grep -q "delivery-dev.db"; then
        success "Development сервер использует delivery-dev.db"
    elif echo "$db_connection" | grep -q "delivery.db"; then
        error "Development сервер использует production базу (delivery.db)"
    else
        warning "Не удалось определить подключение к базе данных"
    fi
else
    error "Development процесс не найден"
fi

echo ""
echo "📁 ФАЙЛЫ КОНФИГУРАЦИИ:"
echo "====================="

# Проверка конфигурационных файлов
if [ -f "/home/enclude/automation/development/config.js" ]; then
    success "config.js - СУЩЕСТВУЕТ"
else
    error "config.js - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/development/.env" ]; then
    success ".env - СУЩЕСТВУЕТ"
    if grep -q "NODE_ENV=development" "/home/enclude/automation/development/.env"; then
        success "NODE_ENV=development установлен"
    else
        warning "NODE_ENV=development НЕ установлен"
    fi
else
    error ".env - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/development/delivery-app-dev.service" ]; then
    success "delivery-app-dev.service - СУЩЕСТВУЕТ"
else
    error "delivery-app-dev.service - НЕ НАЙДЕН"
fi

echo ""
echo "📋 ЛОГИ:"
echo "======="

# Проверка логов
if [ -f "/home/enclude/automation/development/logs/app-dev.log" ]; then
    size=$(ls -lh "/home/enclude/automation/development/logs/app-dev.log" | awk '{print $5}')
    success "app-dev.log - СУЩЕСТВУЕТ ($size)"
    echo "Последние 3 строки:"
    tail -3 "/home/enclude/automation/development/logs/app-dev.log" 2>/dev/null || echo "  Лог пуст"
else
    error "app-dev.log - НЕ НАЙДЕН"
fi

if [ -f "/home/enclude/automation/development/logs/error-dev.log" ]; then
    size=$(ls -lh "/home/enclude/automation/development/logs/error-dev.log" | awk '{print $5}')
    if [ "$size" != "0" ]; then
        warning "error-dev.log - СУЩЕСТВУЕТ ($size) - ЕСТЬ ОШИБКИ"
    else
        success "error-dev.log - СУЩЕСТВУЕТ ($size) - БЕЗ ОШИБОК"
    fi
else
    info "error-dev.log - НЕ НАЙДЕН"
fi

echo ""
echo "🔧 SYSTEMD СЕРВИСЫ:"
echo "=================="

# Проверка systemd сервисов
if systemctl list-unit-files | grep -q "delivery-app-dev"; then
    status=$(systemctl is-enabled delivery-app-dev 2>/dev/null || echo "unknown")
    if [ "$status" = "enabled" ]; then
        success "delivery-app-dev - ВКЛЮЧЕН в автозапуск"
    else
        warning "delivery-app-dev - НЕ ВКЛЮЧЕН в автозапуск"
    fi
else
    error "delivery-app-dev - НЕ ЗАРЕГИСТРИРОВАН в systemd"
fi

echo ""
echo "🎯 РЕКОМЕНДАЦИИ:"
echo "==============="

# Анализ и рекомендации
if ! systemctl is-active --quiet delivery-app-dev; then
    echo "❌ Запустите development сервис: sudo systemctl start delivery-app-dev"
fi

if systemctl is-active --quiet delivery-app; then
    echo "⚠️  Production сервис запущен одновременно с development"
fi

if [ -f "/home/enclude/automation/development/delivery.db" ]; then
    echo "⚠️  В development контуре есть production база данных"
fi

if ! grep -q "NODE_ENV=development" "/home/enclude/automation/development/.env" 2>/dev/null; then
    echo "⚠️  Добавьте NODE_ENV=development в .env файл"
fi

echo ""
echo "✅ Проверка завершена!" 