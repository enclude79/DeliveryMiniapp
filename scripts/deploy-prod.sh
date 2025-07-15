#!/bin/bash

# Скрипт деплоя в продакшн с резервным копированием и Git интеграцией
# Автор: DevOps система DeliveryVLG
# Дата: 2025-01-15

set -e

echo "🏭 ДЕПЛОЙ В ПРОДАКШН"
echo "==================="

# Проверка Git статуса
if [ -d ".git" ]; then
    echo "🔍 Проверка Git статуса..."
    
    # Проверяем что мы на main ветке
    current_branch=$(git symbolic-ref --short HEAD)
    if [ "$current_branch" != "main" ]; then
        echo "⚠️  ВНИМАНИЕ: Вы не на main ветке! (текущая: $current_branch)"
        echo "💡 Рекомендуется переключиться: git checkout main"
        if [ "$1" != "--force" ]; then
            echo "❌ Деплой отменен. Используйте --force для принудительного деплоя."
            exit 1
        fi
    fi
    
    # Проверяем что нет uncommitted изменений
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  Есть незакоммиченные изменения!"
        git status --short
        if [ "$1" != "--force" ]; then
            echo "❌ Сначала сделайте commit. Или используйте --force."
            exit 1
        fi
    fi
    
    echo "✅ Git статус: OK"
fi

# Создание backup
BACKUP_FILE="delivery-app-backup-$(date +%Y%m%d-%H%M).tar.gz"
echo "💾 Создание резервной копии..."

tar -czf "$BACKUP_FILE" \
    --exclude="node_modules" \
    --exclude="*.log" \
    --exclude=".git" \
    .

echo "✅ Backup создан: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))"

# Подтверждение деплоя (если не --force)
if [ "$1" != "--force" ]; then
    echo ""
    echo "⚠️  ВНИМАНИЕ: Деплой в ПРОДАКШН!"
    echo "🏭 Сервис будет перезапущен"
    echo "📦 Зависимости будут обновлены"
    echo ""
    read -p "Продолжить? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Деплой отменен пользователем"
        exit 1
    fi
fi

# Предварительные тесты
echo "🧪 Предварительные тесты..."
NODE_ENV=production npm test

if [ $? -ne 0 ]; then
    echo "❌ Тесты не прошли! Деплой отменен."
    exit 1
fi

echo "✅ Все тесты прошли успешно"

# Остановка продакшн сервиса
echo "🔄 Остановка продакшн сервиса..."
sudo systemctl stop delivery-app
echo "✅ Сервис остановлен (graceful shutdown)"

# Обновление продакшн окружения
echo "📦 Обновление продакшн окружения..."
npm install --production
echo "✅ Зависимости обновлены"

# Запуск продакшн сервиса
echo "🔄 Запуск продакшн сервиса..."
sudo systemctl start delivery-app

# Ожидание запуска
echo "⏱️ Ожидание инициализации (15 сек)..."
sleep 15

# Проверка работоспособности
echo "⏱️ Проверка работоспособности..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Продакшн работает: http://localhost:3000"
else
    echo "❌ Продакшн не отвечает! Проверьте логи:"
    echo "   sudo journalctl -fu delivery-app"
    exit 1
fi

# Git tag для успешного деплоя
if [ -d ".git" ] && [ "$1" != "--no-tag" ]; then
    echo "🏷️ Создание Git тега..."
    timestamp=$(date +%Y%m%d-%H%M)
    git tag -a "deploy-prod-$timestamp" -m "Production deploy $timestamp"
    echo "✅ Создан тег: deploy-prod-$timestamp"
fi

echo ""
echo "🎉 ДЕПЛОЙ В ПРОДАКШН ЗАВЕРШЕН!"
echo "💾 Backup: $BACKUP_FILE"
echo "🌐 URL: http://localhost:3000"
echo "📊 Мониторинг: sudo journalctl -fu delivery-app"
echo "" 