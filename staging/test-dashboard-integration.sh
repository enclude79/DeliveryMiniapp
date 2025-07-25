#!/bin/bash

# Скрипт тестирования интеграции Dashboard с новыми systemd сервисами
# DeliveryVLG - Dashboard Integration Test

echo "🧪 Тестирование интеграции Dashboard с systemd сервисами..."
echo "=========================================================="

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
echo "📊 ТЕКУЩЕЕ СОСТОЯНИЕ СЕРВИСОВ:"
echo "============================="

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
echo "🌐 ПРОВЕРКА ПОРТОВ:"
echo "=================="

# Проверяем порты
port_map=(
    "3000:Production HTTP"
    "3001:Development HTTP"
    "3002:Staging HTTP"
    "3443:Production HTTPS"
    "3444:Development HTTPS"
    "3445:Staging HTTPS"
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
echo "🔧 ТЕСТИРОВАНИЕ API ENDPOINTS:"
echo "============================="

# Проверяем, запущен ли dashboard
if ! pgrep -f "dashboard.*server.js" > /dev/null; then
    warning "Dashboard не запущен. Запускаем..."
    cd /home/enclude/automation/dashboard
    nohup node server.js > ../logs/dashboard-test.log 2>&1 &
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

# Функция для тестирования API
test_api_endpoint() {
    local env=$1
    local endpoint="/api/deployment/environments/start"
    local data="{\"env\":\"$env\"}"
    
    echo "Тестируем запуск $env через API..."
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "http://localhost:3003$endpoint" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        if echo "$response" | grep -q '"success":true'; then
            success "API тест для $env - УСПЕШЕН"
            echo "   Ответ: $response"
        else
            warning "API тест для $env - ОШИБКА"
            echo "   Ответ: $response"
        fi
    else
        error "API тест для $env - НЕДОСТУПЕН"
    fi
}

# Тестируем API для каждой среды
environments=("development" "staging" "production")

for env in "${environments[@]}"; do
    test_api_endpoint "$env"
    echo ""
done

echo ""
echo "🔄 ТЕСТИРОВАНИЕ ПЕРЕКЛЮЧЕНИЯ СРЕД:"
echo "================================="

# Тестируем переключение между средами
for env in "${environments[@]}"; do
    info "Переключаемся на $env..."
    
    case $env in
        "development")
            cd /home/enclude/automation/development
            sudo ./switch-to-dev.sh > /dev/null 2>&1
            ;;
        "staging")
            cd /home/enclude/automation/staging
            sudo ./switch-to-staging.sh > /dev/null 2>&1
            ;;
        "production")
            cd /home/enclude/automation/production
            sudo ./switch-to-production.sh > /dev/null 2>&1
            ;;
    esac
    
    sleep 3
    
    # Проверяем результат
    service_map=(
        "development:delivery-app-dev"
        "staging:delivery-app-staging"
        "production:delivery-app-production"
    )
    
    for service_info in "${service_map[@]}"; do
        env_name=$(echo "$service_info" | cut -d: -f1)
        service_name=$(echo "$service_info" | cut -d: -f2)
        
        if [ "$env_name" = "$env" ]; then
            if systemctl is-active --quiet "$service_name"; then
                success "$env сервис активен"
            else
                warning "$env сервис не активен"
            fi
        fi
    done
    
    echo ""
done

echo ""
echo "📋 ПРОВЕРКА ЛОГОВ:"
echo "================="

# Проверяем логи dashboard
if [ -f "/home/enclude/automation/logs/dashboard-test.log" ]; then
    echo "Последние строки логов Dashboard:"
    tail -5 /home/enclude/automation/logs/dashboard-test.log
else
    info "Логи Dashboard не найдены"
fi

echo ""
echo "🎯 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:"
echo "=========================="

# Финальная проверка
active_services=0
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        ((active_services++))
    fi
done

# Проверяем правильную логику: production должен быть активен, + возможно dev или staging
production_active=false
dev_staging_active=0

for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        if [ "$service" = "delivery-app-production" ]; then
            production_active=true
        else
            ((dev_staging_active++))
        fi
    fi
done

if [ "$production_active" = true ]; then
    if [ $dev_staging_active -le 1 ]; then
        success "✅ Интеграция работает корректно! Production активен, dev/staging: $dev_staging_active"
    else
        warning "⚠️  Внимание: Production активен, но $dev_staging_active dev/staging сервисов активны"
    fi
else
    error "❌ КРИТИЧЕСКАЯ ОШИБКА: Production не активен!"
fi

echo ""
echo "🌐 Dashboard доступен по адресу:"
echo "   http://localhost:3003"
echo ""
echo "📊 Управление через Dashboard:"
echo "   1. Выберите среду в переключателе"
echo "   2. Нажмите 'Запустить сервер'"
echo "   3. Проверьте результат"
echo ""
echo "✅ Тестирование завершено!" 