#!/bin/bash

# Jenkins Pipeline - Управление SystemD сервисами
# ===============================================

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
SERVICE_NAME="${1:-}"
ACTION="${2:-status}"
ENVIRONMENT="${3:-staging}"
VERBOSE="${4:-false}"

# Определение сервиса по окружению
case "$ENVIRONMENT" in
    "dev"|"development")
        SERVICE_NAME="${SERVICE_NAME:-$DEV_SERVICE}"
        SERVICE_PORT="$DEV_PORT"
        SERVICE_URL="$DEV_URL"
        ;;
    "staging")
        SERVICE_NAME="${SERVICE_NAME:-$STAGING_SERVICE}"
        SERVICE_PORT="$STAGING_PORT"
        SERVICE_URL="$STAGING_URL"
        ;;
    "prod"|"production")
        SERVICE_NAME="${SERVICE_NAME:-$PROD_SERVICE}"
        SERVICE_PORT="$PROD_PORT"
        SERVICE_URL="$PROD_URL"
        ;;
    "dashboard")
        SERVICE_NAME="${SERVICE_NAME:-$DASHBOARD_SERVICE}"
        SERVICE_PORT="$DASHBOARD_PORT"
        SERVICE_URL="$DASHBOARD_URL"
        ;;
    *)
        log_error "Неизвестное окружение: $ENVIRONMENT"
        exit 1
        ;;
esac

# Проверка параметров
if [[ -z "$SERVICE_NAME" ]]; then
    log_error "Имя сервиса не указано"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "manage-service"

log_stage_start "Manage Service" "manage-service"

log_info "Управление сервисом: $SERVICE_NAME"
log_info "Действие: $ACTION"
log_info "Окружение: $ENVIRONMENT"
log_info "Порт: $SERVICE_PORT"
log_info "URL: $SERVICE_URL"

# Проверка существования сервиса
if ! systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"; then
    log_error "Сервис $SERVICE_NAME не найден"
    log_stage_end "Manage Service" "false" "" "manage-service"
    exit 1
fi

log_success "Сервис $SERVICE_NAME найден"

# Выполнение действия
case "$ACTION" in
    "start")
        log_info "Запуск сервиса $SERVICE_NAME"
        log_command "systemctl start $SERVICE_NAME"
        
        start_time=$(date +%s)
        systemctl start "$SERVICE_NAME"
        exit_code=$?
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [[ $exit_code -eq 0 ]]; then
            log_success "Сервис запущен за ${duration}с"
            
            # Ожидание запуска
            sleep 3
            
            # Проверка статуса
            if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
                log_success "Сервис активен"
            else
                log_error "Сервис не активен после запуска"
                log_stage_end "Manage Service" "false" "" "manage-service"
                exit 1
            fi
        else
            log_error "Ошибка запуска сервиса (код: $exit_code)"
            log_stage_end "Manage Service" "false" "" "manage-service"
            exit 1
        fi
        ;;
        
    "stop")
        log_info "Остановка сервиса $SERVICE_NAME"
        log_command "systemctl stop $SERVICE_NAME"
        
        start_time=$(date +%s)
        systemctl stop "$SERVICE_NAME"
        exit_code=$?
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [[ $exit_code -eq 0 ]]; then
            log_success "Сервис остановлен за ${duration}с"
        else
            log_warning "Ошибка остановки сервиса (код: $exit_code)"
            # Не прерываем выполнение, так как сервис может быть уже остановлен
        fi
        ;;
        
    "restart")
        log_info "Перезапуск сервиса $SERVICE_NAME"
        log_command "systemctl restart $SERVICE_NAME"
        
        start_time=$(date +%s)
        systemctl restart "$SERVICE_NAME"
        exit_code=$?
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [[ $exit_code -eq 0 ]]; then
            log_success "Сервис перезапущен за ${duration}с"
            
            # Ожидание запуска
            sleep 3
            
            # Проверка статуса
            if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
                log_success "Сервис активен после перезапуска"
            else
                log_error "Сервис не активен после перезапуска"
                log_stage_end "Manage Service" "false" "" "manage-service"
                exit 1
            fi
        else
            log_error "Ошибка перезапуска сервиса (код: $exit_code)"
            log_stage_end "Manage Service" "false" "" "manage-service"
            exit 1
        fi
        ;;
        
    "reload")
        log_info "Перезагрузка конфигурации сервиса $SERVICE_NAME"
        log_command "systemctl reload $SERVICE_NAME"
        
        start_time=$(date +%s)
        systemctl reload "$SERVICE_NAME"
        exit_code=$?
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [[ $exit_code -eq 0 ]]; then
            log_success "Конфигурация перезагружена за ${duration}с"
        else
            log_warning "Ошибка перезагрузки конфигурации (код: $exit_code)"
        fi
        ;;
        
    "status")
        log_info "Проверка статуса сервиса $SERVICE_NAME"
        
        # Получение статуса
        if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            service_status="active"
            log_success "Сервис активен"
        else
            service_status="inactive"
            log_warning "Сервис не активен"
        fi
        
        # Получение дополнительной информации
        service_info=$(systemctl show "$SERVICE_NAME" --property=MainPID,ExecStart,Restart,RestartSec 2>/dev/null || echo "")
        
        # Проверка порта
        port_status="unknown"
        if command -v netstat &> /dev/null; then
            if netstat -tlnp 2>/dev/null | grep -q ":$SERVICE_PORT "; then
                port_status="listening"
                log_success "Порт $SERVICE_PORT слушает"
            else
                port_status="not_listening"
                log_warning "Порт $SERVICE_PORT не слушает"
            fi
        fi
        
        # Health check
        health_status="unknown"
        if [[ "$service_status" == "active" ]]; then
            health_check_url="$SERVICE_URL/health"
            if curl -s -f "$health_check_url" > /dev/null 2>&1; then
                health_status="healthy"
                log_success "Health check пройден"
            else
                health_status="unhealthy"
                log_warning "Health check не пройден"
            fi
        fi
        ;;
        
    "enable")
        log_info "Включение автозапуска сервиса $SERVICE_NAME"
        log_command "systemctl enable $SERVICE_NAME"
        
        systemctl enable "$SERVICE_NAME"
        exit_code=$?
        
        if [[ $exit_code -eq 0 ]]; then
            log_success "Автозапуск включен"
        else
            log_error "Ошибка включения автозапуска (код: $exit_code)"
            log_stage_end "Manage Service" "false" "" "manage-service"
            exit 1
        fi
        ;;
        
    "disable")
        log_info "Отключение автозапуска сервиса $SERVICE_NAME"
        log_command "systemctl disable $SERVICE_NAME"
        
        systemctl disable "$SERVICE_NAME"
        exit_code=$?
        
        if [[ $exit_code -eq 0 ]]; then
            log_success "Автозапуск отключен"
        else
            log_error "Ошибка отключения автозапуска (код: $exit_code)"
            log_stage_end "Manage Service" "false" "" "manage-service"
            exit 1
        fi
        ;;
        
    "logs")
        log_info "Получение логов сервиса $SERVICE_NAME"
        log_command "journalctl -u $SERVICE_NAME --no-pager -n 50"
        
        # Получение последних логов
        service_logs=$(journalctl -u "$SERVICE_NAME" --no-pager -n 50 2>/dev/null || echo "Логи недоступны")
        log_info "Последние логи сервиса:"
        echo "$service_logs"
        ;;
        
    *)
        log_error "Неизвестное действие: $ACTION"
        log_error "Доступные действия: start, stop, restart, reload, status, enable, disable, logs"
        log_stage_end "Manage Service" "false" "" "manage-service"
        exit 1
        ;;
esac

# Создание отчета
log_info "Создание отчета о действии"
action_report="${LOG_PATH}/service-action-$(date +%Y%m%d_%H%M%S).json"

cat > "$action_report" << EOF
{
  "service_info": {
    "timestamp": "$(date -Iseconds)",
    "service_name": "$SERVICE_NAME",
    "action": "$ACTION",
    "environment": "$ENVIRONMENT",
    "port": "$SERVICE_PORT",
    "url": "$SERVICE_URL"
  },
  "action_result": {
    "status": "$(if [[ $exit_code -eq 0 ]]; then echo "success"; else echo "failed"; fi)",
    "exit_code": "$exit_code",
    "duration": "${duration:-0}"
  },
  "service_status": {
    "active": "$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")",
    "enabled": "$(systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || echo "disabled")",
    "port_listening": "$port_status",
    "health_check": "$health_status"
  },
  "logs": {
    "available": "$(if journalctl -u "$SERVICE_NAME" --no-pager -n 1 >/dev/null 2>&1; then echo "true"; else echo "false"; fi)"
  }
}
EOF

log_success "Отчет о действии создан: $action_report"

# Итоговая статистика
total_duration=$(($(date +%s) - $(date -d "$(date '+%Y-%m-%d %H:%M:%S')" +%s)))
log_performance "Manage Service" "$total_duration" "manage-service"

log_stage_end "Manage Service" "true" "$total_duration" "manage-service"

log_success "Управление сервисом завершено успешно"
echo "$action_report" 