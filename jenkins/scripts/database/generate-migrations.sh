#!/bin/bash

# Jenkins Pipeline - Генерация миграций на основе сравнения схем
# =============================================================

set -euo pipefail

# Загрузка конфигурации и утилит
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../../config/environments.conf"
UTILS_DIR="${SCRIPT_DIR}/../../utils"

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Загрузка утилит
source "${UTILS_DIR}/log-utils.sh"
source "${UTILS_DIR}/git-utils.sh"

# Параметры
STAGING_DB_PATH="${1:-$STAGING_DB_PATH}"
MIGRATIONS_PATH="${2:-$MIGRATIONS_PATH}"
TARGET_BRANCH="${3:-develop}"
VERBOSE="${4:-false}"

# Проверка параметров
if [[ -z "$STAGING_DB_PATH" ]]; then
    log_error "Путь к staging БД не указан"
    exit 1
fi

if [[ ! -f "$STAGING_DB_PATH" ]]; then
    log_error "Staging БД не найдена: $STAGING_DB_PATH"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "generate-migrations"

log_stage_start "Generate Migrations" "generate-migrations"

# Проверка Git репозитория
if ! check_git_repo; then
    log_error "Git репозиторий не найден"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
fi

# Проверка SQLite
if ! command -v sqlite3 &> /dev/null; then
    log_error "sqlite3 не установлен"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
fi

# Получение схемы из Git (target schema)
log_info "Получение схемы из ветки $TARGET_BRANCH"
local target_schema_file="/tmp/target_schema.sql"

# Проверка существования файла схемы в Git
if ! git show "$TARGET_BRANCH:migrations/current_schema.sql" &> /dev/null; then
    log_error "Файл схемы не найден в ветке $TARGET_BRANCH"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
fi

log_command "git show \"$TARGET_BRANCH:migrations/current_schema.sql\" > \"$target_schema_file\""
git show "$TARGET_BRANCH:migrations/current_schema.sql" > "$target_schema_file"

if [[ $? -eq 0 ]]; then
    log_success "Схема из Git получена"
else
    log_error "Ошибка получения схемы из Git"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
fi

# Экспорт текущей схемы staging
log_info "Экспорт текущей схемы staging БД"
local current_schema_file="/tmp/current_staging_schema.sql"

log_command "sqlite3 \"$STAGING_DB_PATH\" \".schema\" > \"$current_schema_file\""
sqlite3 "$STAGING_DB_PATH" ".schema" > "$current_schema_file"

if [[ $? -eq 0 ]]; then
    log_success "Текущая схема staging экспортирована"
else
    log_error "Ошибка экспорта схемы staging"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
fi

# Сравнение схем
log_info "Сравнение схем staging и target"
local diff_file="/tmp/schema_diff.txt"

log_command "diff \"$current_schema_file\" \"$target_schema_file\" > \"$diff_file\" || true"
diff "$current_schema_file" "$target_schema_file" > "$diff_file" || true

local diff_size=$(wc -l < "$diff_file")
log_info "Найдено различий: $diff_size строк"

if [[ $diff_size -eq 0 ]]; then
    log_info "Схемы идентичны, миграции не требуются"
    log_stage_end "Generate Migrations" "true" "" "generate-migrations"
    exit 0
fi

# Анализ различий и генерация миграций
log_info "Анализ различий и генерация миграций"
local migration_timestamp=$(date +%Y%m%d_%H%M%S)
local migration_file="${MIGRATIONS_PATH}/${migration_timestamp}_schema_update.sql"

# Создание файла миграции
cat > "$migration_file" << EOF
-- Schema Migration: Staging to Target
-- Сгенерировано: $(date '+%Y-%m-%d %H:%M:%S')
-- Источник: $STAGING_DB_PATH
-- Цель: $TARGET_BRANCH
-- Различий найдено: $diff_size

BEGIN TRANSACTION;

-- ===========================================
-- АВТОМАТИЧЕСКИ СГЕНЕРИРОВАННАЯ МИГРАЦИЯ
-- ВНИМАНИЕ: Проверьте перед применением!
-- ===========================================

EOF

# Анализ различий и генерация SQL команд
log_info "Генерация SQL команд для миграции"

local in_table=false
local table_name=""
local current_table=""

while IFS= read -r line; do
    # Пропускаем пустые строки и комментарии
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*-- ]]; then
        continue
    fi
    
    # Определяем тип изменения
    if [[ "$line" =~ ^[0-9]+[acd][0-9]+ ]]; then
        # Строка diff - определяем тип изменения
        local change_type=$(echo "$line" | sed 's/^[0-9]*\([acd]\)[0-9]*.*/\1/')
        
        case "$change_type" in
            "a") # Добавление
                echo "-- ADD: Добавление новой структуры" >> "$migration_file"
                ;;
            "d") # Удаление
                echo "-- REMOVE: Удаление структуры" >> "$migration_file"
                ;;
            "c") # Изменение
                echo "-- MODIFY: Изменение структуры" >> "$migration_file"
                ;;
        esac
    elif [[ "$line" =~ ^CREATE[[:space:]]+TABLE ]]; then
        # Новая таблица
        table_name=$(echo "$line" | sed 's/CREATE TABLE \([^[:space:]]*\).*/\1/')
        echo "-- Создание таблицы: $table_name" >> "$migration_file"
        echo "$line;" >> "$migration_file"
        echo "" >> "$migration_file"
    elif [[ "$line" =~ ^CREATE[[:space:]]+INDEX ]]; then
        # Новый индекс
        echo "-- Создание индекса" >> "$migration_file"
        echo "$line;" >> "$migration_file"
        echo "" >> "$migration_file"
    elif [[ "$line" =~ ^ALTER[[:space:]]+TABLE ]]; then
        # Изменение таблицы
        echo "-- Изменение таблицы" >> "$migration_file"
        echo "$line;" >> "$migration_file"
        echo "" >> "$migration_file"
    elif [[ "$line" =~ ^DROP[[:space:]]+TABLE ]]; then
        # Удаление таблицы
        table_name=$(echo "$line" | sed 's/DROP TABLE \([^[:space:]]*\).*/\1/')
        echo "-- Удаление таблицы: $table_name" >> "$migration_file"
        echo "$line;" >> "$migration_file"
        echo "" >> "$migration_file"
    elif [[ "$line" =~ ^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]+[A-Za-z_][A-Za-z0-9_]* ]]; then
        # Определение колонки
        echo "-- Добавление колонки" >> "$migration_file"
        echo "ALTER TABLE $current_table ADD COLUMN $line;" >> "$migration_file"
        echo "" >> "$migration_file"
    fi
done < "$diff_file"

# Добавление проверок целостности
cat >> "$migration_file" << EOF

-- ===========================================
-- ПРОВЕРКИ ЦЕЛОСТНОСТИ
-- ===========================================

-- Проверка целостности БД после миграции
PRAGMA integrity_check;

-- Проверка внешних ключей
PRAGMA foreign_key_check;

-- Проверка количества таблиц
SELECT 'Tables count: ' || COUNT(*) as info FROM sqlite_master WHERE type='table';

COMMIT;

-- ===========================================
-- МИГРАЦИЯ ЗАВЕРШЕНА
-- ===========================================
EOF

log_success "Файл миграции создан: $migration_file"

# Создание отчета о миграции
log_info "Создание отчета о миграции"
local migration_report="${LOG_PATH}/migration-report-$(date +%Y%m%d_%H%M%S).json"

cat > "$migration_report" << EOF
{
  "migration_info": {
    "timestamp": "$(date -Iseconds)",
    "staging_db": "$STAGING_DB_PATH",
    "target_branch": "$TARGET_BRANCH",
    "migration_file": "$migration_file",
    "diff_file": "$diff_file"
  },
  "schema_comparison": {
    "differences_count": $diff_size,
    "current_schema_lines": $(wc -l < "$current_schema_file"),
    "target_schema_lines": $(wc -l < "$target_schema_file")
  },
  "generated_migration": {
    "file_size": $(stat -c%s "$migration_file" 2>/dev/null || echo 0),
    "lines_count": $(wc -l < "$migration_file")
  },
  "status": "generated"
}
EOF

log_success "Отчет о миграции создан: $migration_report"

# Очистка временных файлов
log_info "Очистка временных файлов"
rm -f "$target_schema_file" "$current_schema_file" "$diff_file"

# Итоговая статистика
local total_duration=$(($(date +%s) - $(date -d "$(date '+%Y-%m-%d %H:%M:%S')" +%s)))
log_performance "Генерация миграций" "$total_duration" "generate-migrations"

log_stage_end "Generate Migrations" "true" "$total_duration" "generate-migrations"

log_success "Генерация миграций завершена успешно"
echo "$migration_file"
echo "$migration_report" 