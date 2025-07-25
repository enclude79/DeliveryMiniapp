#!/bin/bash

echo "🚀 Быстрый старт DeliveryMiniapp"
echo "================================"

# Проверяем статус всех сред
echo ""
echo "📊 Статус сред:"
./manage-environments.sh production status
./manage-environments.sh development status
./manage-environments.sh staging status

echo ""
echo "🌐 Доступ к приложениям:"
echo "  Продакшн: http://89.169.182.9:3000 (HTTP) / https://89.169.182.9:3443 (HTTPS)"
echo "  Разработка: http://localhost:3001 (HTTP) / https://localhost:3444 (HTTPS)"
echo "  Staging: http://localhost:3002 (HTTP) / https://localhost:3445 (HTTPS)"

echo ""
echo "🔧 Команды управления:"
echo "  Запуск продакшн: ./manage-environments.sh production start"
echo "  Запуск разработки: ./manage-environments.sh development start"
echo "  Остановка: ./manage-environments.sh production stop"

echo ""
echo "📁 Структура проекта:"
echo "  production/     - Продакшн среда (порты 3000, 3443)"
echo "  development/    - Среда разработки (порты 3001, 3444)"
echo "  staging/        - Staging среда (порты 3002, 3445)"

echo ""
echo "✅ Система готова к работе!" 