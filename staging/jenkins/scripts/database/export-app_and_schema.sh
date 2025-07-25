#!/bin/bash

# Jenkins Pipeline - Экспорт приложения и схемы БД
# ================================================

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
DEV_DB_PATH="${1:-$DEV_DB_PATH}"
MIGRATIONS_PATH="${2:-$MIGRATIONS_PATH}"
COMMIT_MESSAGE="${3:-"Feature: update application + export DB schema"}"
VERBOSE="${4:-false}"

# Проверка параметров
if [[ -z "$DEV_DB_PATH" ]]; then
    log_error "Путь к development БД не указан"
    exit 1
fi

if [[ ! -f "$DEV_DB_PATH" ]]; then
    log_error "Development БД не найдена: $DEV_DB_PATH"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "export-app-and-schema"

log_stage_start "Export Application and Schema" "export-app-and-schema"

# Проверка Git репозитория
if ! check_git_repo; then
    log_error "Git репозиторий не найден"
    log_stage_end "Export Application and Schema" "false" "" "export-app-and-schema"
    exit 1
fi

# Проверка текущей ветки
current_branch=$(get_current_branch)
if [[ "$current_branch" != "develop" ]]; then
    log_warning "Текущая ветка: $current_branch (ожидалась develop)"
    log_info "Переключение на ветку develop"
    switch_branch "develop"
fi

# Получение последних изменений
log_info "Получение последних изменений из develop"
pull_latest "develop"

# Создание директории migrations если не существует
if [[ ! -d "$MIGRATIONS_PATH" ]]; then
    log_info "Создание директории migrations: $MIGRATIONS_PATH"
    mkdir -p "$MIGRATIONS_PATH"
fi

# Проверка SQLite
if ! command -v sqlite3 &> /dev/null; then
    log_error "sqlite3 не установлен"
    log_stage_end "Export Application and Schema" "false" "" "export-app-and-schema"
    exit 1
fi

# Проверка целостности БД
log_info "Проверка целостности development БД"
integrity_check=$(sqlite3 "$DEV_DB_PATH" "PRAGMA integrity_check;" 2>/dev/null)

if [[ "$integrity_check" != "ok" ]]; then
    log_error "Ошибка целостности БД: $integrity_check"
    log_stage_end "Export Application and Schema" "false" "" "export-app-and-schema"
    exit 1
fi

log_success "Целостность БД проверена"

# Экспорт схемы БД
log_info "Экспорт схемы development БД"
schema_file="${MIGRATIONS_PATH}/current_schema.sql"
timestamp=$(date '+%Y-%m-%d %H:%M:%S')

# Создание файла схемы с заголовком
cat > "$schema_file" << EOF
-- Development Database Schema
-- Экспортировано: $timestamp
-- База данных: $DEV_DB_PATH
-- Ветка: $(get_current_branch)
-- Коммит: $(git rev-parse HEAD)

EOF

# Экспорт схемы
log_command "sqlite3 \"$DEV_DB_PATH\" \".schema\" >> \"$schema_file\""
sqlite3 "$DEV_DB_PATH" ".schema" >> "$schema_file"

if [[ $? -eq 0 ]]; then
    log_success "Схема экспортирована в $schema_file"
else
    log_error "Ошибка экспорта схемы"
    log_stage_end "Export Application and Schema" "false" "" "export-app-and-schema"
    exit 1
fi

# Проверка размера файла схемы
schema_size=$(wc -l < "$schema_file")
log_info "Строк в схеме: $schema_size"

if [[ $schema_size -lt 5 ]]; then
    log_warning "Файл схемы слишком маленький, возможно ошибка экспорта"
fi

# Экспорт дополнительной информации о БД
log_info "Экспорт дополнительной информации о БД"
info_file="${MIGRATIONS_PATH}/database_info.json"

cat > "$info_file" << EOF
{
  "export_info": {
    "timestamp": "$(date -Iseconds)",
    "database_path": "$DEV_DB_PATH",
    "branch": "$(get_current_branch)",
    "commit": "$(git rev-parse HEAD)",
    "commit_message": "$(git log -1 --pretty=format:'%s')",
    "author": "$(git log -1 --pretty=format:'%an <%ae>')"
  },
  "database_stats": {
    "size_bytes": $(stat -c%s "$DEV_DB_PATH" 2>/dev/null || echo 0),
    "tables_count": $(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0),
    "indexes_count": $(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';" 2>/dev/null || echo 0),
    "views_count": $(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='view';" 2>/dev/null || echo 0)
  },
  "tables": [
EOF

# Экспорт списка таблиц
tables=$(sqlite3 "$DEV_DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "")
first_table=true

for table in $tables; do
    if [[ "$first_table" == "true" ]]; then
        first_table=false
    else
        echo "," >> "$info_file"
    fi
    
    row_count=$(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo 0)
    cat >> "$info_file" << EOF
    {
      "name": "$table",
      "row_count": $row_count
    }
EOF
done

cat >> "$info_file" << EOF
  ]
}
EOF

log_success "Информация о БД экспортирована в $info_file"

# Проверка изменений в Git
log_info "Проверка изменений в Git"
git_status=$(git status --porcelain)

if [[ -z "$git_status" ]]; then
    log_warning "Нет изменений для коммита"
    log_stage_end "Export Application and Schema" "true" "" "export-app-and-schema"
    exit 0
fi

# Добавление ВСЕХ изменений в Git (код + схема)
log_info "Добавление всех изменений в Git (код + схема)"
log_command "git add ."
git add .

# Создание коммита с кодом и схемой
log_info "Создание коммита с кодом и схемой: $COMMIT_MESSAGE"
log_command "git commit -m \"$COMMIT_MESSAGE\""

start_time=$(date +%s)
git commit -m "$COMMIT_MESSAGE"
exit_code=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

if [[ $exit_code -eq 0 ]]; then
    log_success "Коммит создан за ${duration}с"
else
    log_error "Ошибка создания коммита (код: $exit_code)"
    log_stage_end "Export Application and Schema" "false" "" "export-app-and-schema"
    exit 1
fi

# Отправка изменений в удаленный репозиторий
log_info "Отправка изменений в удаленный репозиторий"
log_command "git push origin develop"

start_time=$(date +%s)
git push origin develop
exit_code=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

if [[ $exit_code -eq 0 ]]; then
    log_success "Изменения отправлены за ${duration}с"
else
    log_error "Ошибка отправки изменений (код: $exit_code)"
    log_stage_end "Export Application and Schema" "false" "" "export-app-and-schema"
    exit 1
fi

# Создание отчета
log_info "Создание отчета об экспорте"
export_report="${LOG_PATH}/schema-export-report-$(date +%Y%m%d_%H%M%S).json"

cat > "$export_report" << EOF
{
  "export_info": {
    "timestamp": "$(date -Iseconds)",
    "database_path": "$DEV_DB_PATH",
    "schema_file": "$schema_file",
    "info_file": "$info_file",
    "branch": "$(get_current_branch)",
    "commit": "$(git rev-parse HEAD)"
  },
  "database_stats": {
    "size_bytes": $(stat -c%s "$DEV_DB_PATH" 2>/dev/null || echo 0),
    "tables_count": $(sqlite3 "$DEV_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0),
    "schema_lines": $schema_size
  },
  "git_info": {
    "commit_message": "$COMMIT_MESSAGE",
    "author": "$(git log -1 --pretty=format:'%an <%ae>')",
    "commit_date": "$(git log -1 --pretty=format:'%cd')"
  },
  "status": "success"
}
EOF

log_success "Отчет об экспорте создан: $export_report"

# Итоговая статистика
total_duration=$(($(date +%s) - $(date -d "$(date '+%Y-%m-%d %H:%M:%S')" +%s)))
log_performance "Экспорт схемы development БД" "$total_duration" "export-app-and-schema"

log_stage_end "Export Application and Schema" "true" "$total_duration" "export-app-and-schema"

log_success "Экспорт схемы development БД завершен успешно"
echo "$export_report" 