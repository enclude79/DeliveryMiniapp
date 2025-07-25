#!/bin/bash

# Jenkins Pipeline - Генерация SQL миграций
# =========================================

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

# Параметры
TARGET_DB_PATH="${1:-}"
MIGRATIONS_PATH="${2:-}"
SOURCE_BRANCH="${3:-develop}"
VERBOSE="${4:-false}"

# Проверка параметров
if [[ -z "$TARGET_DB_PATH" ]]; then
    log_error "Путь к целевой БД не указан"
    exit 1
fi

if [[ -z "$MIGRATIONS_PATH" ]]; then
    log_error "Путь к миграциям не указан"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "generate-migrations"

log_stage_start "Generate Migrations" "generate-migrations"

# Проверка существования целевой БД
if [[ ! -f "$TARGET_DB_PATH" ]]; then
    log_error "Целевая БД не найдена: $TARGET_DB_PATH"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
fi

# Создание директории для миграций
if [[ ! -d "$MIGRATIONS_PATH" ]]; then
    log_info "Создание директории для миграций: $MIGRATIONS_PATH"
    mkdir -p "$MIGRATIONS_PATH"
fi

# Экспорт текущей схемы целевой БД
log_info "Экспорт текущей схемы целевой БД"
current_schema_file="/tmp/current_schema_$(date +%Y%m%d_%H%M%S).sql"

sqlite3 "$TARGET_DB_PATH" ".schema" > "$current_schema_file" 2>/dev/null || {
    log_error "Ошибка экспорта схемы из целевой БД"
    log_stage_end "Generate Migrations" "false" "" "generate-migrations"
    exit 1
}

log_success "Схема экспортирована: $current_schema_file"

# Получение схемы из Git (develop ветка)
log_info "Получение схемы из ветки $SOURCE_BRANCH"

# Временная директория для Git операций
temp_git_dir="/tmp/git_schema_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$temp_git_dir"

# Клонирование репозитория во временную директорию
log_command "git clone /home/enclude/automation/.git \"$temp_git_dir\""
git clone /home/enclude/automation/.git "$temp_git_dir"

cd "$temp_git_dir"

# Переключение на нужную ветку
log_command "git checkout $SOURCE_BRANCH"
git checkout "$SOURCE_BRANCH"

# Поиск файла схемы
schema_file=""
for possible_schema in "database/schema.sql" "schema.sql" "db/schema.sql" "migrations/latest.sql"; do
    if [[ -f "$possible_schema" ]]; then
        schema_file="$possible_schema"
        break
    fi
done

if [[ -z "$schema_file" ]]; then
    log_warning "Файл схемы не найден в ветке $SOURCE_BRANCH"
    log_info "Создание пустой миграции"
    
    # Создание пустой миграции
    migration_file="${MIGRATIONS_PATH}/$(date +%Y%m%d_%H%M%S)_no_changes.sql"
    echo "-- Миграция: нет изменений в схеме" > "$migration_file"
    echo "-- Дата: $(date)" >> "$migration_file"
    echo "-- Источник: $SOURCE_BRANCH" >> "$migration_file"
    echo "" >> "$migration_file"
    echo "-- Схема не изменилась" >> "$migration_file"
    
    log_success "Пустая миграция создана: $migration_file"
    
    # Очистка
    rm -rf "$temp_git_dir"
    rm -f "$current_schema_file"
    
    log_stage_end "Generate Migrations" "true" "" "generate-migrations"
    echo "$migration_file"
    echo "{\"status\":\"no_changes\",\"message\":\"Схема не изменилась\"}"
    exit 0
fi

log_info "Найден файл схемы: $schema_file"

# Сравнение схем
log_info "Сравнение схем"
diff_output="/tmp/schema_diff_$(date +%Y%m%d_%H%M%S).diff"

if diff "$current_schema_file" "$schema_file" > "$diff_output" 2>/dev/null; then
    log_info "Схемы идентичны, миграция не требуется"
    
    # Создание пустой миграции
    migration_file="${MIGRATIONS_PATH}/$(date +%Y%m%d_%H%M%S)_no_changes.sql"
    echo "-- Миграция: нет изменений в схеме" > "$migration_file"
    echo "-- Дата: $(date)" >> "$migration_file"
    echo "-- Источник: $SOURCE_BRANCH" >> "$migration_file"
    echo "" >> "$migration_file"
    echo "-- Схемы идентичны" >> "$migration_file"
    
    log_success "Пустая миграция создана: $migration_file"
    
    # Очистка
    rm -rf "$temp_git_dir"
    rm -f "$current_schema_file"
    rm -f "$diff_output"
    
    log_stage_end "Generate Migrations" "true" "" "generate-migrations"
    echo "$migration_file"
    echo "{\"status\":\"no_changes\",\"message\":\"Схемы идентичны\"}"
    exit 0
fi

log_info "Найдены различия в схемах"

# Создание миграции на основе различий
migration_file="${MIGRATIONS_PATH}/$(date +%Y%m%d_%H%M%S)_schema_update.sql"

log_info "Создание миграции: $migration_file"

# Заголовок миграции
cat > "$migration_file" << EOF
-- Миграция: обновление схемы БД
-- Дата: $(date)
-- Источник: $SOURCE_BRANCH
-- Целевая БД: $TARGET_DB_PATH
-- 
-- Автоматически сгенерированная миграция
-- ВНИМАНИЕ: Проверьте миграцию перед применением!

BEGIN TRANSACTION;

EOF

# Анализ различий и генерация SQL
log_info "Анализ различий и генерация SQL"

# Простой анализ различий (можно улучшить)
while IFS= read -r line; do
    if [[ "$line" =~ ^[0-9]+[acd][0-9]+ ]]; then
        # Это строка с информацией о различии
        continue
    elif [[ "$line" =~ ^\> ]]; then
        # Добавляемая строка (новая схема)
        sql_line="${line#> }"
        echo "$sql_line" >> "$migration_file"
    elif [[ "$line" =~ ^\< ]]; then
        # Удаляемая строка (старая схема) - можно добавить DROP
        continue
    fi
done < "$diff_output"

# Завершение миграции
cat >> "$migration_file" << EOF

-- Проверка целостности после миграции
PRAGMA integrity_check;

COMMIT;
EOF

log_success "Миграция создана: $migration_file"

# Создание отчета
report_file="${MIGRATIONS_PATH}/migration_report_$(date +%Y%m%d_%H%M%S).json"

cat > "$report_file" << EOF
{
  "migration_file": "$migration_file",
  "source_branch": "$SOURCE_BRANCH",
  "target_db": "$TARGET_DB_PATH",
  "timestamp": "$(date -Iseconds)",
  "status": "generated",
  "changes_detected": true,
  "file_size": "$(stat -c%s "$migration_file" 2>/dev/null || echo 'unknown')"
}
EOF

# Очистка временных файлов
rm -rf "$temp_git_dir"
rm -f "$current_schema_file"
rm -f "$diff_output"

log_stage_end "Generate Migrations" "true" "" "generate-migrations"

# Вывод результата
echo "$migration_file"
echo "$report_file" 