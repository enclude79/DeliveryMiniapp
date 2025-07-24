#!/bin/bash

# Скрипт переключения между окружениями (dev/prod)
# Автор: DevOps система DeliveryVLG
# Дата: 2025-01-15

TARGET_ENV="$1"

if [ -z "$TARGET_ENV" ]; then
    echo "🔍 ТЕКУЩЕЕ ОКРУЖЕНИЕ"
    echo "===================="
    
    # Определяем текущее окружение по NODE_ENV
    if [ -f ".env" ]; then
        current_env=$(grep "NODE_ENV" .env | cut -d'=' -f2)
        echo "📍 NODE_ENV в .env: $current_env"
    fi
    
    # Проверяем переменную в shell
    echo "📍 NODE_ENV в shell: ${NODE_ENV:-не установлена}"
    
    # Показываем активные порты
    echo ""
    echo "🌐 АКТИВНЫЕ СЕРВИСЫ:"
    if systemctl is-active --quiet delivery-app; then
        echo "✅ ПРОДАКШН (3000/3443): работает"
    else
        echo "❌ ПРОДАКШН (3000/3443): остановлен"
    fi
    
    if systemctl is-active --quiet delivery-app-dev; then
        echo "✅ DEV (3001/3444): работает"
    else
        echo "❌ DEV (3001/3444): остановлен"
    fi
    
    echo ""
    echo "💡 Использование:"
    echo "   ./switch-env.sh development  # Переключиться на dev"
    echo "   ./switch-env.sh production   # Переключиться на prod"
    exit 0
fi

echo "🔄 ПЕРЕКЛЮЧЕНИЕ ОКРУЖЕНИЯ"
echo "========================"

# Определяем текущее окружение
current_env="unknown"
if [ -f ".env" ]; then
    current_env=$(grep "NODE_ENV" .env | cut -d'=' -f2 2>/dev/null || echo "unknown")
fi

echo "📍 Текущее: $current_env"
echo "🎯 Целевое: $TARGET_ENV"

# Валидация целевого окружения
if [ "$TARGET_ENV" != "development" ] && [ "$TARGET_ENV" != "production" ]; then
    echo "❌ Неизвестное окружение: $TARGET_ENV"
    echo "💡 Доступные: development, production"
    exit 1
fi

# Проверка что не переключаемся на то же окружение
if [ "$current_env" = "$TARGET_ENV" ]; then
    echo "⚠️ Уже используется окружение: $TARGET_ENV"
    exit 0
fi

echo ""
echo "🔄 Переключение конфигурации..."

# Переключение на development
if [ "$TARGET_ENV" = "development" ]; then
    export NODE_ENV=development
    
    # Копируем dev конфигурацию в основную
    if [ -f ".env.dev" ]; then
        cp .env.dev .env
        echo "✅ NODE_ENV=development"
        echo "✅ Конфигурация обновлена (.env.dev → .env)"
    else
        echo "❌ Файл .env.dev не найден!"
        exit 1
    fi
fi

# Переключение на production
if [ "$TARGET_ENV" = "production" ]; then
    export NODE_ENV=production
    
    # Создаем или обновляем production .env
    if [ -f ".env.prod" ]; then
        cp .env.prod .env
    else
        # Создаем базовую prod конфигурацию
        cat > .env << EOF
NODE_ENV=production
PORT=3000
HTTPS_PORT=3443
DB_NAME=delivery.db
EOF
    fi
    echo "✅ NODE_ENV=production"
    echo "✅ Конфигурация обновлена"
fi

echo ""
echo "🔄 Применение изменений..."

# Экспорт переменных в текущую сессию
export NODE_ENV=$TARGET_ENV
echo "✅ Переменные окружения обновлены"

# Информация о новой конфигурации
echo ""
echo "✅ ПЕРЕКЛЮЧЕНИЕ ЗАВЕРШЕНО"
echo "========================"
echo "Активное окружение: $TARGET_ENV"

if [ "$TARGET_ENV" = "development" ]; then
    echo "Порт: 3001"
    echo "HTTPS: 3444"
    echo "База данных: delivery-dev.db"
    echo "🌐 URL: http://localhost:3001"
    echo "🔍 Сервис: delivery-app-dev"
    echo "📊 Логи: sudo journalctl -fu delivery-app-dev"
else
    echo "Порт: 3000"
    echo "HTTPS: 3443"
    echo "База данных: delivery.db"
    echo "🌐 URL: http://localhost:3000"
    echo "🔍 Сервис: delivery-app"
    echo "📊 Логи: sudo journalctl -fu delivery-app"
fi

echo ""
echo "💡 Для постоянного переключения добавьте в ~/.bashrc:"
echo "   export NODE_ENV=$TARGET_ENV"
echo "" 