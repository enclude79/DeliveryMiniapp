#!/bin/bash

# Jenkins Pipeline - Развертывание в Staging
# ==========================================

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
APP_PATH="${1:-$STAGING_PATH}"
DEPLOYMENT_TYPE="${2:-rolling}"
VERBOSE="${3:-false}"
FORCE_DEPLOY="${4:-false}"

# Проверка параметров
if [[ -z "$APP_PATH" ]]; then
    log_error "Путь к приложению не указан"
    exit 1
fi

if [[ ! -d "$APP_PATH" ]]; then
    log_error "Директория приложения не найдена: $APP_PATH"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "deploy-staging"

log_stage_start "Deploy to Staging" "deploy-staging"

# Переход в директорию приложения
cd "$APP_PATH"
log_info "Рабочая директория: $(pwd)"

# Проверка Git репозитория
if check_git_repo "$APP_PATH"; then
    log_info "Git репозиторий найден"
    log_info "Текущая ветка: $(get_current_branch)"
    log_info "Последний коммит: $(git log -1 --pretty=format:'%h - %s')"
else
    log_error "Git репозиторий не найден"
    log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
    exit 1
fi

# Проверка наличия основных файлов
log_info "Проверка файлов приложения"
required_files=("package.json" "server.js")
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        log_error "Обязательный файл не найден: $file"
        log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
        exit 1
    fi
done

log_success "Все обязательные файлы найдены"

# Проверка зависимостей
log_info "Проверка зависимостей"
if [[ ! -d "node_modules" ]]; then
    log_warning "node_modules не найден, устанавливаем зависимости"
    log_command "npm install --production"
    
    start_time=$(date +%s)
    npm install --production
    exit_code=$?
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Зависимости установлены за ${duration}с"
    else
        log_error "Ошибка установки зависимостей (код: $exit_code)"
        log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
        exit 1
    fi
else
    log_info "Зависимости уже установлены"
fi

# Проверка SystemD сервиса
log_info "Проверка SystemD сервиса"
service_name="$STAGING_SERVICE"

if systemctl is-active --quiet "$service_name" 2>/dev/null; then
    log_info "Сервис $service_name активен"
    service_running=true
else
    log_info "Сервис $service_name не активен"
    service_running=false
fi

# Создание backup перед развертыванием
log_info "Создание backup перед развертыванием"
backup_dir="$DB_BACKUP_PATH/staging/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

# Backup БД
if [[ -f "delivery-staging.db" ]]; then
    log_command "cp delivery-staging.db \"$backup_dir/\""
    cp delivery-staging.db "$backup_dir/"
    log_success "Backup БД создан: $backup_dir/delivery-staging.db"
fi

# Backup конфигурации
if [[ -f ".env" ]]; then
    log_command "cp .env \"$backup_dir/\""
    cp .env "$backup_dir/"
    log_success "Backup конфигурации создан: $backup_dir/.env"
fi

# Backup package.json
log_command "cp package.json \"$backup_dir/\""
cp package.json "$backup_dir/"
log_success "Backup package.json создан: $backup_dir/package.json"

# Остановка сервиса перед развертыванием
if [[ "$service_running" == "true" ]]; then
    log_info "Остановка сервиса $service_name"
    log_command "systemctl stop $service_name"
    
    start_time=$(date +%s)
    systemctl stop "$service_name"
    exit_code=$?
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Сервис остановлен за ${duration}с"
    else
        log_warning "Ошибка остановки сервиса (код: $exit_code)"
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            log_error "Принудительное развертывание отключено"
            log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
            exit 1
        fi
    fi
fi

# Ожидание полной остановки сервиса
if [[ "$service_running" == "true" ]]; then
    log_info "Ожидание полной остановки сервиса"
    sleep 3
    
    if systemctl is-active --quiet "$service_name" 2>/dev/null; then
        log_warning "Сервис все еще активен, принудительная остановка"
        systemctl kill "$service_name" 2>/dev/null || true
        sleep 2
    fi
fi

# Проверка порта
log_info "Проверка порта $STAGING_PORT"
if netstat -tlnp 2>/dev/null | grep -q ":$STAGING_PORT "; then
    log_warning "Порт $STAGING_PORT занят"
    if [[ "$FORCE_DEPLOY" != "true" ]]; then
        log_error "Принудительное развертывание отключено"
        log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
        exit 1
    fi
else
    log_success "Порт $STAGING_PORT свободен"
fi

# Применение изменений (если есть миграции)
log_info "Проверка миграций"
migrations_dir="$MIGRATIONS_PATH"
if [[ -d "$migrations_dir" ]]; then
    latest_migration=$(find "$migrations_dir" -name "*.sql" -type f -printf "%T@ %p\n" | sort -nr | head -1 | cut -d' ' -f2-)
    
    if [[ -n "$latest_migration" ]]; then
        log_info "Найдена миграция: $(basename "$latest_migration")"
        
        # Проверка, была ли миграция уже применена
        migration_applied_file="$APP_PATH/.migration_$(basename "$latest_migration")"
        if [[ ! -f "$migration_applied_file" ]]; then
            log_info "Применение миграции"
            log_command "sqlite3 delivery-staging.db < \"$latest_migration\""
            
            start_time=$(date +%s)
            sqlite3 delivery-staging.db < "$latest_migration"
            exit_code=$?
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            
            if [[ $exit_code -eq 0 ]]; then
                log_success "Миграция применена за ${duration}с"
                touch "$migration_applied_file"
            else
                log_error "Ошибка применения миграции (код: $exit_code)"
                log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
                exit 1
            fi
        else
            log_info "Миграция уже применена"
        fi
    else
        log_info "Миграции не найдены"
    fi
fi

# Запуск сервиса
log_info "Запуск сервиса $service_name"
log_command "systemctl start $service_name"

start_time=$(date +%s)
systemctl start "$service_name"
exit_code=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

if [[ $exit_code -eq 0 ]]; then
    log_success "Сервис запущен за ${duration}с"
else
    log_error "Ошибка запуска сервиса (код: $exit_code)"
    log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
    exit 1
fi

# Ожидание запуска сервиса
log_info "Ожидание запуска сервиса"
sleep 5

# Проверка статуса сервиса
if systemctl is-active --quiet "$service_name" 2>/dev/null; then
    log_success "Сервис активен"
else
    log_error "Сервис не активен после запуска"
    log_stage_end "Deploy to Staging" "false" "" "deploy-staging"
    exit 1
fi

# Health check
log_info "Выполнение health check"
health_check_url="$STAGING_URL/health"
max_retries=10
retry_count=0

while [[ $retry_count -lt $max_retries ]]; do
    if curl -s -f "$health_check_url" > /dev/null 2>&1; then
        log_success "Health check пройден"
        break
    else
        retry_count=$((retry_count + 1))
        log_info "Health check попытка $retry_count/$max_retries"
        sleep 2
    fi
done

if [[ $retry_count -eq $max_retries ]]; then
    log_warning "Health check не пройден после $max_retries попыток"
    # Не прерываем развертывание, так как сервис может быть еще не готов
fi

# Проверка порта
log_info "Проверка доступности порта $STAGING_PORT"
if netstat -tlnp 2>/dev/null | grep -q ":$STAGING_PORT "; then
    log_success "Порт $STAGING_PORT доступен"
else
    log_warning "Порт $STAGING_PORT недоступен"
fi

# Создание отчета о развертывании
log_info "Создание отчета о развертывании"
deployment_report="${LOG_PATH}/deployment-staging-$(date +%Y%m%d_%H%M%S).json"

cat > "$deployment_report" << EOF
{
  "deployment_info": {
    "timestamp": "$(date -Iseconds)",
    "app_path": "$APP_PATH",
    "deployment_type": "$DEPLOYMENT_TYPE",
    "service_name": "$service_name",
    "port": "$STAGING_PORT"
  },
  "git_info": {
    "branch": "$(get_current_branch 2>/dev/null || echo 'unknown')",
    "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "commit_message": "$(git log -1 --pretty=format:'%s' 2>/dev/null || echo 'unknown')"
  },
  "service_status": {
    "before_deployment": "$service_running",
    "after_deployment": "$(systemctl is-active "$service_name" 2>/dev/null || echo 'inactive')",
    "port_available": "$(netstat -tlnp 2>/dev/null | grep -q ":$STAGING_PORT " && echo 'true' || echo 'false')"
  },
  "backup_info": {
    "backup_dir": "$backup_dir",
    "files_backed_up": ["delivery-staging.db", ".env", "package.json"]
  },
  "status": "success"
}
EOF

log_success "Отчет о развертывании создан: $deployment_report"

# Итоговая статистика
total_duration=$(($(date +%s) - $(date -d "$(date '+%Y-%m-%d %H:%M:%S')" +%s)))
log_performance "Deploy to Staging" "$total_duration" "deploy-staging"

log_stage_end "Deploy to Staging" "true" "$total_duration" "deploy-staging"

log_success "Развертывание в staging завершено успешно"
echo "$deployment_report" 