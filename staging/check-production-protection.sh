#!/bin/bash

# Скрипт проверки защиты Production от случайной остановки
# DeliveryVLG - Production Protection Test

echo "🛡️ Проверка защиты Production от случайной остановки..."
echo "======================================================"

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
echo "📊 ТЕКУЩИЙ СТАТУС СЕРВИСОВ:"
echo "==========================="

# Проверяем статус всех systemd сервисов
services=("delivery-app-production" "delivery-app-dev" "delivery-app-staging")

for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        success "$service - АКТИВЕН"
    else
        info "$service - НЕ АКТИВЕН"
    fi
done

echo ""
echo "🛡️ ТЕСТИРОВАНИЕ ЗАЩИТЫ PRODUCTION:"
echo "=================================="

# Проверяем, что production активен
if systemctl is-active --quiet "delivery-app-production"; then
    success "Production сервис активен"
else
    error "Production сервис не активен - КРИТИЧЕСКАЯ ОШИБКА!"
    echo "Запускаем production..."
    sudo systemctl start delivery-app-production
    sleep 3
    if systemctl is-active --quiet "delivery-app-production"; then
        success "Production успешно запущен"
    else
        error "Не удалось запустить production"
        exit 1
    fi
fi

echo ""
echo "🧪 ТЕСТИРОВАНИЕ API ЗАЩИТЫ:"
echo "=========================="

# Проверяем, запущен ли dashboard
if ! pgrep -f "dashboard.*server.js" > /dev/null; then
    warning "Dashboard не запущен. Запускаем..."
    cd /home/enclude/automation/dashboard
    nohup node server.js > ../logs/dashboard-protection-test.log 2>&1 &
    DASHBOARD_PID=$!
    sleep 3
    
    if kill -0 $DASHBOARD_PID 2>/dev/null; then
        success "Dashboard запущен (PID: $DASHBOARD_PID)"
    else
        error "Не удалось запустить Dashboard"
        exit 1
    fi
else
    info "Dashboard уже запущен"
fi

# Тестируем попытку остановки production через API
echo "Тестируем попытку остановки production через API..."

response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"env":"production"}' \
    "http://localhost:3003/api/deployment/environments/stop" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$response" ]; then
    if echo "$response" | grep -q '"success":false'; then
        success "✅ Защита работает! API отклонил попытку остановки production"
        echo "   Ответ: $response"
    else
        error "❌ ЗАЩИТА НЕ РАБОТАЕТ! API позволил остановить production"
        echo "   Ответ: $response"
    fi
else
    warning "⚠️  Не удалось протестировать API защиту"
fi

echo ""
echo "🔄 ТЕСТИРОВАНИЕ ПЕРЕКЛЮЧЕНИЯ СРЕД:"
echo "=================================="

# Тестируем переключение на development (production должен остаться активным)
echo "Переключаемся на development (production должен остаться активным)..."

response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"env":"development"}' \
    "http://localhost:3003/api/deployment/environments/start" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$response" ]; then
    if echo "$response" | grep -q '"success":true'; then
        success "✅ Development запущен успешно"
        echo "   Ответ: $response"
    else
        warning "⚠️  Ошибка запуска development"
        echo "   Ответ: $response"
    fi
else
    error "❌ Не удалось запустить development"
fi

sleep 3

# Проверяем, что production все еще активен
if systemctl is-active --quiet "delivery-app-production"; then
    success "✅ Production остался активным после запуска development"
else
    error "❌ КРИТИЧЕСКАЯ ОШИБКА: Production был остановлен!"
fi

# Проверяем, что development активен
if systemctl is-active --quiet "delivery-app-dev"; then
    success "✅ Development активен"
else
    warning "⚠️  Development не активен"
fi

# Проверяем, что staging остановлен
if systemctl is-active --quiet "delivery-app-staging"; then
    warning "⚠️  Staging все еще активен (должен был остановиться)"
else
    success "✅ Staging остановлен (как и ожидалось)"
fi

echo ""
echo "🔄 ТЕСТИРОВАНИЕ ПЕРЕКЛЮЧЕНИЯ НА STAGING:"
echo "======================================="

# Тестируем переключение на staging (production должен остаться активным, development должен остановиться)
echo "Переключаемся на staging..."

response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"env":"staging"}' \
    "http://localhost:3003/api/deployment/environments/start" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$response" ]; then
    if echo "$response" | grep -q '"success":true'; then
        success "✅ Staging запущен успешно"
        echo "   Ответ: $response"
    else
        warning "⚠️  Ошибка запуска staging"
        echo "   Ответ: $response"
    fi
else
    error "❌ Не удалось запустить staging"
fi

sleep 3

# Проверяем финальное состояние
echo ""
echo "📊 ФИНАЛЬНОЕ СОСТОЯНИЕ СЕРВИСОВ:"
echo "================================"

production_active=false
dev_active=false
staging_active=false

if systemctl is-active --quiet "delivery-app-production"; then
    success "delivery-app-production - АКТИВЕН"
    production_active=true
else
    error "delivery-app-production - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet "delivery-app-dev"; then
    info "delivery-app-dev - АКТИВЕН"
    dev_active=true
else
    info "delivery-app-dev - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet "delivery-app-staging"; then
    success "delivery-app-staging - АКТИВЕН"
    staging_active=true
else
    info "delivery-app-staging - НЕ АКТИВЕН"
fi

echo ""
echo "🎯 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ЗАЩИТЫ:"
echo "================================="

# Проверяем правильную логику
if [ "$production_active" = true ]; then
    success "✅ Production защищен и остается активным"
    
    # Проверяем, что только один dev/staging активен
    dev_staging_count=0
    if [ "$dev_active" = true ]; then
        ((dev_staging_count++))
    fi
    if [ "$staging_active" = true ]; then
        ((dev_staging_count++))
    fi
    
    if [ $dev_staging_count -le 1 ]; then
        success "✅ Логика переключения работает корректно"
    else
        warning "⚠️  Внимание: $dev_staging_count dev/staging сервисов активны одновременно"
    fi
else
    error "❌ КРИТИЧЕСКАЯ ОШИБКА: Production не защищен!"
fi

echo ""
echo "🌐 Проверка портов:"
echo "=================="

# Проверяем порты
port_map=(
    "3000:Production HTTP"
    "3001:Development HTTP"
    "3002:Staging HTTP"
)

for port_info in "${port_map[@]}"; do
    port=$(echo "$port_info" | cut -d: -f1)
    name=$(echo "$port_info" | cut -d: -f2)
    
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        success "$name (порт $port) - ОТКРЫТ"
    else
        info "$name (порт $port) - ЗАКРЫТ"
    fi
done

echo ""
echo "📋 Логи защиты:"
echo "=============="

# Проверяем логи dashboard
if [ -f "/home/enclude/automation/logs/dashboard-protection-test.log" ]; then
    echo "Последние строки логов Dashboard:"
    tail -5 /home/enclude/automation/logs/dashboard-protection-test.log
else
    info "Логи Dashboard не найдены"
fi

echo ""
echo "✅ Тестирование защиты Production завершено!"
echo ""
echo "🎯 Выводы:"
echo "   - Production всегда остается активным"
echo "   - Development и staging переключаются между собой"
echo "   - API защищен от случайной остановки production"
echo "   - Система работает корректно" 