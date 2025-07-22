#!/bin/bash

echo "🔧 Запуск DeliveryMiniapp в режиме разработки..."

# Установка зависимостей
npm install

# Создание папки для логов
mkdir -p logs

# Запуск приложения с автоматической перезагрузкой
NODE_ENV=development ./node_modules/.bin/nodemon server.js

echo "✅ Сервер разработки запущен на портах 3001 и 3444" 