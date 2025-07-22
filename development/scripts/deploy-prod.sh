#!/bin/bash
echo "�� Деплой в ПРОДАКШН..."
echo "⚠️ ВНИМАНИЕ: Это продакшн деплой!"

cd /home/enclude/delivery-app

# Получаем изменения
echo "📥 Получение изменений из Git..."
git pull origin main || echo "⚠️ Git pull завершился с предупреждениями"

# Устанавливаем зависимости
echo "📦 Установка production зависимостей..."
npm install --only=production

# Запускаем тесты на продакшн версии
echo "🧪 Запуск продакшн тестов..."
npm run test

if [ $? -eq 0 ]; then
    echo "✅ Продакшн тесты прошли успешно"
    
    # Создаем резервную копию БД
    echo "💾 Создание backup БД..."
    cp delivery.db "delivery-backup-$(date +%Y%m%d-%H%M).db"
    
    # Перезапускаем сервис  
    echo "🔄 Перезапуск продакшн сервиса..."
    sudo systemctl restart delivery-app
    
    # Проверяем статус
    sleep 5
    sudo systemctl status delivery-app --no-pager -l
    
    echo -e "\n✅ ПРОДАКШН деплой завершен!"
    echo "🌐 Prod сервер: https://www.deliveryvlg.xyz"
else
    echo "❌ Продакшн тесты провалились, деплой отменен"
    exit 1
fi
