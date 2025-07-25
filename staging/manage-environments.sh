#!/bin/bash

# Скрипт управления средами DeliveryMiniapp
# Использование: ./manage-environments.sh [production|development|staging] [start|stop|status]

ENVIRONMENT=$1
ACTION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$ACTION" ]; then
    echo "❌ Использование: $0 [production|development|staging] [start|stop|status]"
    echo ""
    echo "Примеры:"
    echo "  $0 production start    # Запустить продакшн"
    echo "  $0 development start   # Запустить разработку"
    echo "  $0 staging start       # Запустить staging"
    echo "  $0 production status   # Статус продакшн"
    exit 1
fi

# Проверка существования папки среды
if [ ! -d "$ENVIRONMENT" ]; then
    echo "❌ Папка среды '$ENVIRONMENT' не найдена!"
    exit 1
fi

cd "$ENVIRONMENT"

case $ACTION in
    "start")
        echo "🚀 Запуск $ENVIRONMENT..."
        ./start.sh
        ;;
    "stop")
        echo "🛑 Остановка $ENVIRONMENT..."
        # Находим и останавливаем процесс
        PORT=$(node -e "console.log(require('./config.js').port)")
        HTTPS_PORT=$(node -e "console.log(require('./config.js').httpsPort)")
        pkill -f "node.*$PORT" || echo "HTTP процесс не найден"
        pkill -f "node.*$HTTPS_PORT" || echo "HTTPS процесс не найден"
        ;;
    "status")
        echo "📊 Статус $ENVIRONMENT..."
        PORT=$(node -e "console.log(require('./config.js').port)")
        HTTPS_PORT=$(node -e "console.log(require('./config.js').httpsPort)")
        if pgrep -f "node.*server.js" > /dev/null; then
            echo "✅ $ENVIRONMENT HTTP запущен на порту $PORT"
        else
            echo "❌ $ENVIRONMENT HTTP не запущен"
        fi
        if pgrep -f "node.*server.js" > /dev/null; then
            echo "✅ $ENVIRONMENT HTTPS запущен на порту $HTTPS_PORT"
        else
            echo "❌ $ENVIRONMENT HTTPS не запущен"
        fi
        ;;
    *)
        echo "❌ Неизвестное действие: $ACTION"
        echo "Доступные действия: start, stop, status"
        exit 1
        ;;
esac 