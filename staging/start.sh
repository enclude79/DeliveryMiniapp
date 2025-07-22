#!/bin/bash

echo "🧪 Запуск DeliveryMiniapp в staging режиме..."

# Установка зависимостей
npm install

# Создание папки для логов
mkdir -p logs

# Запуск приложения
NODE_ENV=staging node server.js

echo "✅ Staging сервер запущен на портах 3002 и 3445" 