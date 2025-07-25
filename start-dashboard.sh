#!/bin/bash

echo "🚀 Запуск Dashboard сервера..."

# Переходим в папку dashboard
cd /home/enclude/automation/dashboard

# Проверяем, не запущен ли уже сервер
if pgrep -f "node.*dashboard" > /dev/null; then
    echo "⚠️ Dashboard сервер уже запущен"
    echo "PID: $(pgrep -f 'node.*dashboard')"
    exit 0
fi

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Запускаем сервер
echo "🌐 Запускаем dashboard на порту 3003..."
nohup node server.js > dashboard.log 2>&1 &

# Ждем запуска
sleep 3

# Проверяем статус
if curl -s http://localhost:3003/health > /dev/null; then
    echo "✅ Dashboard успешно запущен!"
    echo "🌐 URL: http://localhost:3003"
    echo "📊 Health check: http://localhost:3003/health"
else
    echo "❌ Ошибка запуска dashboard"
    echo "📋 Логи: tail -f dashboard.log"
fi 