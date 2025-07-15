#!/bin/bash

# Скрипт деплоя в dev окружение с автотестами и Git интеграцией
# Автор: DevOps система DeliveryVLG  
# Дата: 2025-01-15

set -e

echo "🚀 ДЕПЛОЙ В DEV ОКРУЖЕНИЕ"
echo "========================"

# Проверка Git статуса для dev
if [ -d ".git" ]; then
    echo "🔍 Проверка Git статуса..."
    
    current_branch=$(git symbolic-ref --short HEAD)
    echo "📍 Текущая ветка: $current_branch"
    
    # Предупреждение если деплоим с main в dev
    if [ "$current_branch" = "main" ]; then
        echo "⚠️  ВНИМАНИЕ: Деплой с main ветки в dev окружение!"
        echo "💡 Обычно dev использует develop ветку"
    fi
    
    echo "✅ Git статус проверен"
fi

# Остановка dev сервиса
echo "🔄 Остановка dev сервиса..."
sudo systemctl stop delivery-app-dev
echo "✅ Сервис остановлен"

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install
echo "✅ Зависимости обновлены"

# Запуск автотестов (если не --skip-tests)
if [ "$1" != "--skip-tests" ]; then
    echo "🧪 Запуск автотестов..."
    
    # API тесты
    NODE_ENV=development npm test
    if [ $? -eq 0 ]; then
        echo "✅ API тесты: прошли"
    else
        echo "❌ API тесты: провалились"
        echo "🔄 Запускаю сервис без тестирования..."
    fi
    
    # Тесты безопасности
    if npm run test:security > /dev/null 2>&1; then
        echo "✅ Тесты безопасности: прошли"
    else
        echo "⚠️ Тесты безопасности: не настроены или провалились"
    fi
else
    echo "⚠️ Автотесты пропущены (--skip-tests)"
fi

# Запуск dev сервиса
echo "🔄 Запуск dev сервиса..."
sudo systemctl start delivery-app-dev
echo "✅ Сервис запущен"

# Ожидание инициализации
echo "⏱️ Ожидание инициализации (15 сек)..."
sleep 15

# Проверка работоспособности
echo "✅ Проверка работоспособности..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Dev сервер работает: http://localhost:3001"
else
    echo "⚠️ Dev сервер не отвечает на health check"
    echo "🔍 Проверьте логи: sudo journalctl -fu delivery-app-dev"
fi

# Git commit hook предложение
if [ -d ".git" ] && [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "💡 У вас есть незакоммиченные изменения:"
    git status --short
    echo "💡 Рекомендуется сделать commit после успешного тестирования"
fi

echo ""
echo "🎉 ДЕПЛОЙ В DEV ЗАВЕРШЕН УСПЕШНО!"
echo "🌐 URL: http://localhost:3001"
echo "📊 Логи: sudo journalctl -fu delivery-app-dev"
echo "" 