#!/bin/bash

# Восстановление staging сервера
# Автор: Claude Sonnet 4
# Дата: 24 июля 2025

echo "🔄 Восстановление staging сервера..."

# 1. Остановка сервиса
echo "📋 Шаг 1: Остановка staging сервиса..."
sudo systemctl stop delivery-app-staging

# 2. Копирование данных из production
echo "📋 Шаг 2: Копирование данных из production..."
cp /home/enclude/automation/production/delivery.db /home/enclude/automation/staging/delivery-staging.db

# 3. Проверка конфигурации
echo "📋 Шаг 3: Проверка конфигурации БД..."
if ! grep -q "delivery-staging.db" /home/enclude/automation/staging/database.js; then
    echo "❌ Ошибка: Неправильная конфигурация БД в staging/database.js"
    echo "🔧 Исправление конфигурации..."
    sed -i 's/delivery\.db/delivery-staging.db/' /home/enclude/automation/staging/database.js
fi

# 4. Проверка systemd конфигурации
echo "📋 Шаг 4: Проверка systemd конфигурации..."
if ! grep -q "TimeoutStartSec=120" /etc/systemd/system/delivery-app-staging.service; then
    echo "🔧 Исправление systemd timeout..."
    sudo sed -i 's/TimeoutStartSec=30/TimeoutStartSec=120/' /etc/systemd/system/delivery-app-staging.service
    sudo systemctl daemon-reload
fi

# 5. Запуск сервиса
echo "📋 Шаг 5: Запуск staging сервиса..."
sudo systemctl start delivery-app-staging

# 6. Проверка статуса
echo "📋 Шаг 6: Проверка статуса..."
sleep 10
if sudo systemctl is-active --quiet delivery-app-staging; then
    echo "✅ Staging сервер восстановлен и работает"
    
    # Проверка health check
    if curl -s http://localhost:3002/health > /dev/null; then
        echo "✅ Health check прошел успешно"
    else
        echo "⚠️ Health check не отвечает, но сервис запущен"
    fi
    
    # Проверка данных
    PRODUCTS=$(sqlite3 /home/enclude/automation/staging/delivery-staging.db "SELECT COUNT(*) FROM products;" 2>/dev/null)
    USERS=$(sqlite3 /home/enclude/automation/staging/delivery-staging.db "SELECT COUNT(*) FROM users;" 2>/dev/null)
    
    echo "📊 Данные в БД:"
    echo "   • Товары: $PRODUCTS"
    echo "   • Пользователи: $USERS"
    
else
    echo "❌ Ошибка запуска staging сервера"
    echo "📋 Логи сервиса:"
    sudo systemctl status delivery-app-staging --no-pager
    echo "📋 Последние логи journalctl:"
    sudo journalctl -u delivery-app-staging --no-pager -n 10
    exit 1
fi

echo "🎉 Восстановление завершено!"
echo "🌐 URL для проверки: http://89.169.182.9:3002/app" 