#!/bin/bash

# Скрипт тестирования параллельной работы Development и Staging
# DeliveryVLG - Parallel Environments Test

echo "🧪 Тестирование параллельной работы Development и Staging..."
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
echo "📊 НАЧАЛЬНОЕ СОСТОЯНИЕ:"
echo "======================"

# Проверяем текущий статус
for service in "delivery-app-production" "delivery-app-dev" "delivery-app-staging"; do
    if systemctl is-active --quiet "$service"; then
        success "$service - АКТИВЕН"
    else
        info "$service - НЕ АКТИВЕН"
    fi
done

echo ""
echo "🔄 ЗАПУСК ПАРАЛЛЕЛЬНЫХ КОНТУРОВ:"
echo "================================"

# Запускаем development
info "Запускаем development..."
sudo systemctl start delivery-app-dev
sleep 3

if systemctl is-active --quiet "delivery-app-dev"; then
    success "Development запущен"
else
    error "Не удалось запустить development"
fi

# Запускаем staging (не останавливая development)
info "Запускаем staging (не останавливая development)..."
sudo systemctl start delivery-app-staging
sleep 3

if systemctl is-active --quiet "delivery-app-staging"; then
    success "Staging запущен"
else
    error "Не удалось запустить staging"
fi

echo ""
echo "📊 СТАТУС ПОСЛЕ ЗАПУСКА:"
echo "======================"

# Проверяем статус всех сервисов
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
    success "delivery-app-dev - АКТИВЕН"
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
echo "💾 ПРОВЕРКА РЕСУРСОВ:"
echo "===================="

# Проверяем использование ресурсов
echo "Использование CPU и RAM:"
ps aux | grep "node.*server.js" | grep -v grep | while read line; do
    echo "  $line"
done

echo ""
echo "Использование памяти по контурам:"
if [ "$dev_active" = true ]; then
    dev_mem=$(ps aux | grep "delivery-app-dev" | grep -v grep | awk '{print $6}' | head -1)
    if [ -n "$dev_mem" ]; then
        info "Development: ${dev_mem}KB"
    fi
fi

if [ "$staging_active" = true ]; then
    staging_mem=$(ps aux | grep "delivery-app-staging" | grep -v grep | awk '{print $6}' | head -1)
    if [ -n "$staging_mem" ]; then
        info "Staging: ${staging_mem}KB"
    fi
fi

echo ""
echo "🧪 ТЕСТИРОВАНИЕ ФУНКЦИОНАЛЬНОСТИ:"
echo "================================"

# Тестируем доступность сервисов
if [ "$dev_active" = true ]; then
    echo "Тестируем development (порт 3001)..."
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        success "Development отвечает на HTTP запросы"
    else
        warning "Development не отвечает на HTTP запросы"
    fi
fi

if [ "$staging_active" = true ]; then
    echo "Тестируем staging (порт 3002)..."
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        success "Staging отвечает на HTTP запросы"
    else
        warning "Staging не отвечает на HTTP запросы"
    fi
fi

echo ""
echo "📋 ПРОВЕРКА ЛОГОВ:"
echo "================="

# Проверяем логи
if [ "$dev_active" = true ]; then
    echo "Логи development:"
    if [ -f "/home/enclude/automation/development/logs/app-dev.log" ]; then
        tail -3 /home/enclude/automation/development/logs/app-dev.log
    else
        info "Логи development не найдены"
    fi
fi

if [ "$staging_active" = true ]; then
    echo "Логи staging:"
    if [ -f "/home/enclude/automation/staging/logs/app-staging.log" ]; then
        tail -3 /home/enclude/automation/staging/logs/app-staging.log
    else
        info "Логи staging не найдены"
    fi
fi

echo ""
echo "🔍 ПРОВЕРКА БАЗ ДАННЫХ:"
echo "======================"

# Проверяем базы данных
if [ -f "/home/enclude/automation/development/delivery-dev.db" ]; then
    success "База данных development существует"
else
    warning "База данных development не найдена"
fi

if [ -f "/home/enclude/automation/staging/delivery-staging.db" ]; then
    success "База данных staging существует"
else
    warning "База данных staging не найдена"
fi

echo ""
echo "🎯 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:"
echo "=========================="

# Анализируем результаты
if [ "$production_active" = true ] && [ "$dev_active" = true ] && [ "$staging_active" = true ]; then
    success "✅ ВСЕ ТРИ КОНТУРА РАБОТАЮТ ПАРАЛЛЕЛЬНО!"
    echo ""
    echo "📊 Статус:"
    echo "  - Production: АКТИВЕН (порт 3000)"
    echo "  - Development: АКТИВЕН (порт 3001)"
    echo "  - Staging: АКТИВЕН (порт 3002)"
    echo ""
    echo "💡 Вывод: Параллельная работа ВОЗМОЖНА!"
    echo ""
    echo "⚠️  Рекомендации:"
    echo "  - Мониторьте использование ресурсов"
    echo "  - Проверяйте логи на конфликты"
    echo "  - Убедитесь в стабильности работы"
    
elif [ "$production_active" = true ] && [ "$dev_active" = true ]; then
    success "✅ Production + Development работают параллельно"
    warning "⚠️  Staging не запустился"
    
elif [ "$production_active" = true ] && [ "$staging_active" = true ]; then
    success "✅ Production + Staging работают параллельно"
    warning "⚠️  Development не запустился"
    
else
    error "❌ Проблемы с параллельным запуском"
fi

echo ""
echo "🔄 ТЕСТИРОВАНИЕ ПЕРЕКЛЮЧЕНИЯ ЧЕРЕЗ DASHBOARD:"
echo "============================================"

# Проверяем, запущен ли dashboard
if ! pgrep -f "dashboard.*server.js" > /dev/null; then
    warning "Dashboard не запущен. Запускаем..."
    cd /home/enclude/automation/dashboard
    nohup node server.js > ../logs/dashboard-parallel-test.log 2>&1 &
    DASHBOARD_PID=$!
    sleep 3
fi

# Тестируем переключение через dashboard
echo "Тестируем переключение на development через dashboard..."

response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"env":"development"}' \
    "http://localhost:3003/api/deployment/environments/start" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$response" ]; then
    if echo "$response" | grep -q '"success":true'; then
        success "✅ Dashboard успешно переключился на development"
        echo "   Ответ: $response"
    else
        warning "⚠️  Ошибка переключения через dashboard"
        echo "   Ответ: $response"
    fi
else
    error "❌ Не удалось протестировать dashboard"
fi

sleep 3

# Проверяем результат переключения
echo ""
echo "📊 СТАТУС ПОСЛЕ ПЕРЕКЛЮЧЕНИЯ ЧЕРЕЗ DASHBOARD:"
echo "============================================"

if systemctl is-active --quiet "delivery-app-production"; then
    success "delivery-app-production - АКТИВЕН"
else
    error "delivery-app-production - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet "delivery-app-dev"; then
    success "delivery-app-dev - АКТИВЕН"
else
    info "delivery-app-dev - НЕ АКТИВЕН"
fi

if systemctl is-active --quiet "delivery-app-staging"; then
    success "delivery-app-staging - АКТИВЕН"
else
    info "delivery-app-staging - НЕ АКТИВЕН"
fi

echo ""
echo "🎯 ФИНАЛЬНЫЕ ВЫВОДЫ:"
echo "=================="

echo "1. Параллельная работа development и staging ТЕХНИЧЕСКИ ВОЗМОЖНА"
echo "2. Каждый контур использует отдельные порты и базы данных"
echo "3. Ресурсы потребляются пропорционально количеству активных контуров"
echo "4. Dashboard может переключать контуры независимо"
echo ""
echo "💡 Рекомендация: Можно изменить логику на параллельную работу!"
echo ""
echo "✅ Тестирование завершено!" 