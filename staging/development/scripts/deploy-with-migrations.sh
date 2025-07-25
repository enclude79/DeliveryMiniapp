#!/bin/bash

# Скрипт автоматического деплоя с миграциями
# Использование: ./scripts/deploy-with-migrations.sh [environment]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Переменные
ENVIRONMENT=${1:-production}
SERVICE_NAME="delivery-app"

if [ "$ENVIRONMENT" = "development" ]; then
    SERVICE_NAME="delivery-app-dev"
fi

echo -e "${BLUE}🚀 Запуск деплоя для окружения: ${ENVIRONMENT}${NC}"

# 1. Обновление кода
echo -e "${YELLOW}📥 Обновление кода из Git...${NC}"
git pull origin main

# 2. Установка зависимостей (если package.json изменился)
if git diff HEAD~1 HEAD --name-only | grep -q package.json; then
    echo -e "${YELLOW}📦 Обновление зависимостей...${NC}"
    npm install
fi

# 3. Выполнение миграций
echo -e "${YELLOW}🗄️  Выполнение миграций базы данных...${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    npm run migrate:run:dev
else
    npm run migrate:run
fi

# 4. Проверка статуса миграций
echo -e "${YELLOW}📊 Проверка статуса миграций...${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    npm run migrate:status:dev
else
    npm run migrate:status
fi

# 5. Перезапуск сервиса
echo -e "${YELLOW}🔄 Перезапуск сервиса ${SERVICE_NAME}...${NC}"
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    sudo systemctl restart ${SERVICE_NAME}
    echo -e "${GREEN}✅ Сервис ${SERVICE_NAME} перезапущен${NC}"
else
    sudo systemctl start ${SERVICE_NAME}
    echo -e "${GREEN}✅ Сервис ${SERVICE_NAME} запущен${NC}"
fi

# 6. Проверка статуса сервиса
sleep 3
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Сервис работает корректно${NC}"
    
    # Показать последние логи
    echo -e "${YELLOW}📝 Последние логи сервиса:${NC}"
    sudo journalctl -u ${SERVICE_NAME} --no-pager -n 10
else
    echo -e "${RED}❌ Ошибка: Сервис не запустился${NC}"
    echo -e "${YELLOW}📝 Логи ошибок:${NC}"
    sudo journalctl -u ${SERVICE_NAME} --no-pager -n 20
    exit 1
fi

# 7. Финальная проверка
echo -e "${YELLOW}🔍 Финальная проверка доступности...${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    PORT=3001
else
    PORT=3000
fi

if curl -s http://localhost:${PORT}/api/health > /dev/null; then
    echo -e "${GREEN}🎉 Деплой успешно завершен!${NC}"
    echo -e "${GREEN}📍 Приложение доступно на порту ${PORT}${NC}"
else
    echo -e "${RED}⚠️  Приложение запущено, но health check не прошел${NC}"
    echo -e "${YELLOW}Проверьте логи приложения для диагностики${NC}"
fi

echo -e "${BLUE}🏁 Деплой завершен для окружения: ${ENVIRONMENT}${NC}" 