#!/bin/bash

echo "🏗️ Создание новой архитектуры..."

# Создание папок
mkdir -p ~/www/production/app
mkdir -p ~/www/development/app  
mkdir -p ~/www/staging/app

echo "✅ Папки созданы"

# Копирование приложений
cp -r /home/enclude/delivery-app/* ~/www/production/app/
cp -r /home/enclude/delivery-app-dev/* ~/www/development/app/

echo "✅ Приложения скопированы"

# Копирование БД
cp /home/enclude/delivery-app/delivery.db ~/www/production/
cp /home/enclude/delivery-app-dev/delivery-dev.db ~/www/development/
cp /home/enclude/delivery-app/delivery.db ~/www/staging/delivery-staging.db

echo "✅ Базы данных скопированы"

echo "🎉 Миграция завершена!"
echo "📁 Новая структура: ~/www/" 