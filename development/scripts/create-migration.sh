#!/bin/bash

# Скрипт для создания новой миграции
# Использование: ./scripts/create-migration.sh "название миграции"

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверяем аргументы
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Ошибка: Необходимо указать название миграции${NC}"
    echo "Использование: $0 \"название миграции\""
    echo "Пример: $0 \"add user notifications\""
    exit 1
fi

MIGRATION_NAME="$1"

echo -e "${YELLOW}🚀 Создание новой миграции: ${MIGRATION_NAME}${NC}"

# Выполняем команду создания миграции
if npm run migrate:create "$MIGRATION_NAME"; then
    echo -e "${GREEN}✅ Миграция успешно создана!${NC}"
    echo -e "${YELLOW}💡 Следующие шаги:${NC}"
    echo "1. Отредактируйте созданный файл миграции"
    echo "2. Проверьте статус: npm run migrate:status"
    echo "3. Выполните миграцию: npm run migrate:run"
else
    echo -e "${RED}❌ Ошибка при создании миграции${NC}"
    exit 1
fi 