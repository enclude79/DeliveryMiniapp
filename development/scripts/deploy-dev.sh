#!/bin/bash
echo "🚀 Деплой в DEV окружение..."

cd /home/enclude/delivery-app-dev

# Получаем изменения
echo "📥 Получение изменений из Git..."
git pull origin develop || echo "⚠️ Git pull завершился с предупреждениями"

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
npm install

# Запускаем тесты
echo "🧪 Запуск тестов..."
NODE_ENV=development npm run test:dev

if [ $? -eq 0 ]; then
    echo "✅ Тесты прошли успешно"
    
    # Перезапускаем сервис
    echo "🔄 Перезапуск dev сервиса..."
    sudo systemctl restart delivery-app-dev
    
    # Проверяем статус
    sleep 3
    sudo systemctl status delivery-app-dev --no-pager -l
    
    echo -e "\n✅ DEV деплой завершен!"
    echo "🌐 Dev сервер: http://127.0.0.1:3001"
else
    echo "❌ Тесты провалились, деплой отменен"
    exit 1
fi
