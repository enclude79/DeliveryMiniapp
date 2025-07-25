#!/bin/bash

echo "🚀 Запуск системы автоматизации DeliveryMiniapp..."

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js и попробуйте снова."
    exit 1
fi

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен. Установите npm и попробуйте снова."
    exit 1
fi

# Переходим в папку dashboard
cd dashboard

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Создаем папку для логов если не существует
mkdir -p ../logs

echo "🌐 Запуск dashboard на порту 3003..."
echo "📊 Локальный доступ: http://localhost:3003"
echo "🌐 Внешний доступ: http://89.169.182.9:3003"
echo "📊 Health check: http://89.169.182.9:3003/health"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запускаем сервер
npm start 