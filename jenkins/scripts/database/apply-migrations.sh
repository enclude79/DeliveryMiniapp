#!/bin/bash

# Jenkins Pipeline - Применение миграций к БД
# ===========================================

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
DB_PATH="${1:-}"
MIGRATION_FILE="${2:-}"
BACKUP_BEFORE="${3:-true}"
VERBOSE="${4:-false}"

# Проверка параметров
if [[ -z "$DB_PATH" ]]; then
    log_error "Путь к БД не указан"
    exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
    log_error "БД не найдена: $DB_PATH"
    exit 1
fi

if [[ -z "$MIGRATION_FILE" ]]; then
    log_error "Файл миграции не указан"
    exit 1
fi

if [[ ! -f "$MIGRATION_FILE" ]]; then
    log_error "Файл миграции не найден: $MIGRATION_FILE"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "apply-migrations"

log_stage_start "Apply Migrations" "apply-migrations"

# Проверка SQLite
if ! command -v sqlite3 &> /dev/null; then
    log_error "sqlite3 не установлен"
    log_stage_end "Apply Migrations" "false" "" "apply-migrations"
    exit 1
fi

# Проверка целостности БД перед миграцией
log_info "Проверка целостности БД перед миграцией"
local pre_integrity_check
pre_integrity_check=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>/dev/null)

if [[ "$pre_integrity_check" != "ok" ]]; then
    log_error "Ошибка целостности БД перед миграцией: $pre_integrity_check"
    log_stage_end "Apply Migrations" "false" "" "apply-migrations"
    exit 1
fi

log_success "Целостность БД проверена перед миграцией"

# Создание резервной копии
if [[ "$BACKUP_BEFORE" == "true" ]]; then
    log_info "Создание резервной копии БД"
    local backup_file="${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    
    log_command "cp \"$DB_PATH\" \"$backup_file\""
    cp "$DB_PATH" "$backup_file"
    
    if [[ $? -eq 0 ]]; then
        log_success "Резервная копия создана: $backup_file"
    else
        log_error "Ошибка создания резервной копии"
        log_stage_end "Apply Migrations" "false" "" "apply-migrations"
        exit 1
    fi
fi

# Анализ файла миграции
log_info "Анализ файла миграции"
local migration_lines=$(wc -l < "$MIGRATION_FILE")
local migration_size=$(stat -c%s "$MIGRATION_FILE" 2>/dev/null || echo 0)

log_info "Размер файла миграции: $migration_size байт"
log_info "Строк в файле: $migration_lines"

# Проверка синтаксиса SQL
log_info "Проверка синтаксиса SQL"
local syntax_check
syntax_check=$(sqlite3 "$DB_PATH" "PRAGMA foreign_keys=OFF; BEGIN; $(cat "$MIGRATION_FILE") ROLLBACK;" 2>&1)

if [[ $? -ne 0 ]]; then
    log_error "Ошибка синтаксиса SQL в миграции: $syntax_check"
    log_stage_end "Apply Migrations" "false" "" "apply-migrations"
    exit 1
fi

log_success "Синтаксис SQL проверен"

# Получение информации о БД до миграции
log_info "Получение информации о БД до миграции"
local tables_before=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0)
local indexes_before=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';" 2>/dev/null || echo 0)
local size_before=$(stat -c%s "$DB_PATH" 2>/dev/null || echo 0)

log_info "Таблиц до миграции: $tables_before"
log_info "Индексов до миграции: $indexes_before"
log_info "Размер БД до миграции: $size_before байт"

# Применение миграции
log_info "Применение миграции к БД"
log_command "sqlite3 \"$DB_PATH\" < \"$MIGRATION_FILE\""

local start_time=$(date +%s)
sqlite3 "$DB_PATH" < "$MIGRATION_FILE"
local exit_code=$?
local end_time=$(date +%s)
local duration=$((end_time - start_time))

if [[ $exit_code -eq 0 ]]; then
    log_success "Миграция применена за ${duration}с"
else
    log_error "Ошибка применения миграции (код: $exit_code)"
    
    # Восстановление из резервной копии при ошибке
    if [[ "$BACKUP_BEFORE" == "true" && -f "$backup_file" ]]; then
        log_info "Восстановление из резервной копии"
        cp "$backup_file" "$DB_PATH"
        log_success "БД восстановлена из резервной копии"
    fi
    
    log_stage_end "Apply Migrations" "false" "" "apply-migrations"
    exit 1
fi

# Проверка целостности БД после миграции
log_info "Проверка целостности БД после миграции"
local post_integrity_check
post_integrity_check=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>/dev/null)

if [[ "$post_integrity_check" != "ok" ]]; then
    log_error "Ошибка целостности БД после миграции: $post_integrity_check"
    
    # Восстановление из резервной копии при ошибке
    if [[ "$BACKUP_BEFORE" == "true" && -f "$backup_file" ]]; then
        log_info "Восстановление из резервной копии"
        cp "$backup_file" "$DB_PATH"
        log_success "БД восстановлена из резервной копии"
    fi
    
    log_stage_end "Apply Migrations" "false" "" "apply-migrations"
    exit 1
fi

log_success "Целостность БД проверена после миграции"

# Получение информации о БД после миграции
log_info "Получение информации о БД после миграции"
local tables_after=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0)
local indexes_after=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';" 2>/dev/null || echo 0)
local size_after=$(stat -c%s "$DB_PATH" 2>/dev/null || echo 0)

log_info "Таблиц после миграции: $tables_after"
log_info "Индексов после миграции: $indexes_after"
log_info "Размер БД после миграции: $size_after байт"

# Проверка внешних ключей
log_info "Проверка внешних ключей"
local foreign_key_check
foreign_key_check=$(sqlite3 "$DB_PATH" "PRAGMA foreign_key_check;" 2>/dev/null)

if [[ -n "$foreign_key_check" ]]; then
    log_warning "Найдены проблемы с внешними ключами: $foreign_key_check"
else
    log_success "Внешние ключи проверены"
fi

# Дополнительные проверки
log_info "Дополнительные проверки"

# Проверка количества таблиц
local tables_diff=$((tables_after - tables_before))
if [[ $tables_diff -ne 0 ]]; then
    log_info "Изменение количества таблиц: $tables_diff"
fi

# Проверка размера БД
local size_diff=$((size_after - size_before))
if [[ $size_diff -ne 0 ]]; then
    log_info "Изменение размера БД: $size_diff байт"
fi

# Создание отчета о миграции
log_info "Создание отчета о миграции"
local migration_report="${LOG_PATH}/migration-apply-report-$(date +%Y%m%d_%H%M%S).json"

cat > "$migration_report" << EOF
{
  "migration_info": {
    "timestamp": "$(date -Iseconds)",
    "database_path": "$DB_PATH",
    "migration_file": "$MIGRATION_FILE",
    "backup_created": $BACKUP_BEFORE
  },
  "database_before": {
    "tables_count": $tables_before,
    "indexes_count": $indexes_before,
    "size_bytes": $size_before
  },
  "database_after": {
    "tables_count": $tables_after,
    "indexes_count": $indexes_after,
    "size_bytes": $size_after
  },
  "changes": {
    "tables_diff": $tables_diff,
    "indexes_diff": $((indexes_after - indexes_before)),
    "size_diff": $size_diff
  },
  "integrity_checks": {
    "before_migration": "$pre_integrity_check",
    "after_migration": "$post_integrity_check",
    "foreign_keys": "$(echo "$foreign_key_check" | tr '\n' ' ' | sed 's/ *$//')"
  },
  "performance": {
    "migration_duration_seconds": $duration,
    "migration_file_size": $migration_size,
    "migration_lines": $migration_lines
  },
  "status": "success"
}
EOF

log_success "Отчет о миграции создан: $migration_report"

# Очистка старых резервных копий (оставляем только последние 5)
if [[ "$BACKUP_BEFORE" == "true" ]]; then
    log_info "Очистка старых резервных копий"
    local backup_dir=$(dirname "$DB_PATH")
    local backup_pattern=$(basename "$DB_PATH").backup.*
    
    # Удаление старых резервных копий, оставляя только 5 последних
    find "$backup_dir" -name "$backup_pattern" -type f -printf '%T@ %p\n' | \
    sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -f
    
    log_success "Старые резервные копии очищены"
fi

# Итоговая статистика
local total_duration=$(($(date +%s) - $(date -d "$(date '+%Y-%m-%d %H:%M:%S')" +%s)))
log_performance "Применение миграций" "$total_duration" "apply-migrations"

log_stage_end "Apply Migrations" "true" "$total_duration" "apply-migrations"

log_success "Применение миграций завершено успешно"
echo "$migration_report" 