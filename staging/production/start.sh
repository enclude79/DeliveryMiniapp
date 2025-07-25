#!/bin/bash

echo "🚀 Запуск DeliveryMiniapp в production режиме..."

# Установка зависимостей
npm install

# Создание папки для логов
mkdir -p logs

# Запуск приложения
NODE_ENV=production node server.js

echo "✅ Production сервер запущен на портах 3000 и 3443" 