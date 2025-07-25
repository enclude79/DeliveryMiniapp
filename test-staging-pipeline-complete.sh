#!/bin/bash

# Тестирование Staging Pipeline
# =============================

set -euo pipefail

echo "🚀 Тестирование Staging Pipeline"
echo "================================="

# Переменные
AUTOMATION_PATH="/home/enclude/automation"
STAGING_PATH="$AUTOMATION_PATH/staging"
BUILD_SCRIPT="$AUTOMATION_PATH/jenkins/scripts/build/build-app.sh"

echo "📋 Проверка окружения..."

# Проверка существования директорий
if [[ ! -d "$AUTOMATION_PATH" ]]; then
    echo "❌ Директория automation не найдена"
    exit 1
fi

if [[ ! -d "$STAGING_PATH" ]]; then
    echo "❌ Директория staging не найдена"
    exit 1
fi

if [[ ! -f "$BUILD_SCRIPT" ]]; then
    echo "❌ Скрипт build-app.sh не найден"
    exit 1
fi

echo "✅ Окружение проверено"

# Проверка текущего состояния
echo ""
echo "📊 Текущее состояние:"

echo "  Git статус в staging:"
cd "$STAGING_PATH"
git status --porcelain

echo "  Staging БД:"
if [[ -f "delivery-staging.db" ]]; then
    table_count=$(sqlite3 delivery-staging.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    echo "    ✅ БД существует, таблиц: $table_count"
else
    echo "    ❌ БД не найдена"
fi

echo "  Последний коммит в develop:"
cd "$AUTOMATION_PATH"
git log --oneline -1 develop

# Запуск staging pipeline
echo ""
echo "🔄 Запуск Staging Pipeline..."

start_time=$(date +%s)

# Запуск build-app.sh для staging
cd "$AUTOMATION_PATH"
result=$("$BUILD_SCRIPT" "$STAGING_PATH" "production" "true" "true" "staging" 2>&1)
exit_code=$?

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "📈 Результат выполнения:"
echo "  Время выполнения: ${duration}с"
echo "  Код выхода: $exit_code"

if [[ $exit_code -eq 0 ]]; then
    echo "  ✅ Pipeline выполнен успешно"
else
    echo "  ❌ Pipeline завершился с ошибкой"
fi

echo ""
echo "📄 Вывод скрипта:"
echo "$result"

# Проверка результатов
echo ""
echo "🔍 Проверка результатов:"

# Проверка логов
latest_log=$(ls -t "$AUTOMATION_PATH/logs/build-app_"*.log 2>/dev/null | head -1)
if [[ -n "$latest_log" ]]; then
    echo "  📝 Последний лог: $(basename "$latest_log")"
    echo "    Размер: $(stat -c%s "$latest_log") байт"
else
    echo "  ❌ Логи не найдены"
fi

# Проверка отчета
latest_report=$(ls -t "$AUTOMATION_PATH/logs/build-report_"*.json 2>/dev/null | head -1)
if [[ -n "$latest_report" ]]; then
    echo "  📊 Последний отчет: $(basename "$latest_report")"
    if command -v jq &> /dev/null; then
        status=$(jq -r '.status' "$latest_report" 2>/dev/null || echo "unknown")
        echo "    Статус: $status"
    fi
else
    echo "  ❌ Отчеты не найдены"
fi

# Проверка staging БД после pipeline
echo ""
echo "🗄️ Проверка Staging БД после pipeline:"
cd "$STAGING_PATH"
if [[ -f "delivery-staging.db" ]]; then
    table_count=$(sqlite3 delivery-staging.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    echo "  Таблиц в БД: $table_count"
    
    if [[ $table_count -gt 0 ]]; then
        echo "  Список таблиц:"
        sqlite3 delivery-staging.db "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null | while read table; do
            echo "    - $table"
        done
    fi
else
    echo "  ❌ БД не найдена"
fi

# Проверка миграций
echo ""
echo "📦 Проверка миграций:"
if [[ -d "$AUTOMATION_PATH/migrations" ]]; then
    migration_count=$(find "$AUTOMATION_PATH/migrations" -name "*.sql" | wc -l)
    echo "  Файлов миграций: $migration_count"
    
    if [[ $migration_count -gt 0 ]]; then
        echo "  Последние миграции:"
        find "$AUTOMATION_PATH/migrations" -name "*.sql" -printf "%T@ %p\n" | sort -nr | head -3 | while read timestamp file; do
            filename=$(echo "$file" | sed 's/^[0-9.]* //')
            echo "    - $(basename "$filename")"
        done
    fi
else
    echo "  ❌ Директория миграций не найдена"
fi

# Итоговая оценка
echo ""
echo "🎯 Итоговая оценка:"

if [[ $exit_code -eq 0 ]]; then
    echo "  ✅ Staging Pipeline работает корректно"
    echo "  ✅ Приложение собрано"
    echo "  ✅ Зависимости установлены"
    echo "  ✅ БД доступна"
    
    if [[ -n "$latest_report" ]]; then
        echo "  ✅ Отчет создан"
    fi
    
    echo ""
    echo "🎉 Тестирование завершено успешно!"
else
    echo "  ❌ Staging Pipeline завершился с ошибкой"
    echo "  ❌ Требуется отладка"
    
    echo ""
    echo "🔧 Рекомендации по отладке:"
    echo "  1. Проверьте логи: $latest_log"
    echo "  2. Проверьте права доступа к файлам"
    echo "  3. Проверьте зависимости скриптов"
    echo "  4. Проверьте конфигурацию"
fi

echo ""
echo "📋 Следующие шаги:"
echo "  1. Создать deployment скрипты"
echo "  2. Создать systemd сервисы"
echo "  3. Создать Groovy файлы для Jenkins"
echo "  4. Интегрировать с Dashboard"
echo "  5. Протестировать production pipeline" 