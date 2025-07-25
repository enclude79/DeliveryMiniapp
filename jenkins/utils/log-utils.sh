#!/bin/bash

# Jenkins Pipeline - Утилиты логирования
# ======================================

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Загрузка конфигурации
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/environments.conf"

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Настройки логирования
LOG_LEVEL="${LOG_LEVEL:-INFO}"
LOG_FILE="${LOG_FILE:-}"
LOG_FORMAT="${LOG_FORMAT:-json}"
LOG_ROTATION="${LOG_ROTATION:-daily}"
LOG_RETENTION="${LOG_RETENTION:-7}"

# Уровни логирования
declare -A LOG_LEVELS=(
    ["DEBUG"]=0
    ["INFO"]=1
    ["WARNING"]=2
    ["ERROR"]=3
    ["CRITICAL"]=4
)

# Получение текущего уровня логирования
get_log_level() {
    echo "${LOG_LEVELS[$LOG_LEVEL]:-1}"
}

# Проверка, нужно ли логировать
should_log() {
    local level="$1"
    local current_level=$(get_log_level)
    local message_level="${LOG_LEVELS[$level]:-1}"
    
    [[ $message_level -ge $current_level ]]
}

# Форматирование времени
format_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Форматирование JSON
format_json() {
    local level="$1"
    local message="$2"
    local context="${3:-}"
    
    local json="{\"timestamp\":\"$(format_timestamp)\",\"level\":\"$level\",\"message\":\"$message\""
    
    if [[ -n "$context" ]]; then
        json="$json,\"context\":\"$context\""
    fi
    
    if [[ -n "${JENKINS_BUILD_NUMBER:-}" ]]; then
        json="$json,\"build\":\"$JENKINS_BUILD_NUMBER\""
    fi
    
    if [[ -n "${JENKINS_JOB_NAME:-}" ]]; then
        json="$json,\"job\":\"$JENKINS_JOB_NAME\""
    fi
    
    echo "$json}"
}

# Форматирование простого текста
format_text() {
    local level="$1"
    local message="$2"
    local context="${3:-}"
    
    local timestamp=$(format_timestamp)
    local output="[$timestamp] [$level] $message"
    
    if [[ -n "$context" ]]; then
        output="$output (Context: $context)"
    fi
    
    echo "$output"
}

# Основная функция логирования
log_message() {
    local level="$1"
    local message="$2"
    local context="${3:-}"
    
    if ! should_log "$level"; then
        return 0
    fi
    
    local formatted_message
    case "$LOG_FORMAT" in
        "json")
            formatted_message=$(format_json "$level" "$message" "$context")
            ;;
        "text"|*)
            formatted_message=$(format_text "$level" "$message" "$context")
            ;;
    esac
    
    # Вывод в консоль с цветами
    case "$level" in
        "DEBUG")
            echo -e "${CYAN}${formatted_message}${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}${formatted_message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}${formatted_message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}${formatted_message}${NC}"
            ;;
        "CRITICAL")
            echo -e "${PURPLE}${formatted_message}${NC}"
            ;;
        *)
            echo "$formatted_message"
            ;;
    esac
    
    # Запись в файл
    if [[ -n "$LOG_FILE" ]]; then
        echo "$formatted_message" >> "$LOG_FILE"
    fi
}

# Функции для разных уровней логирования
log_debug() {
    log_message "DEBUG" "$1" "${2:-}"
}

log_info() {
    log_message "INFO" "$1" "${2:-}"
}

log_warning() {
    log_message "WARNING" "$1" "${2:-}"
}

log_error() {
    log_message "ERROR" "$1" "${2:-}"
}

log_critical() {
    log_message "CRITICAL" "$1" "${2:-}"
}

# Логирование с контекстом
log_with_context() {
    local level="$1"
    local message="$2"
    local context="$3"
    
    log_message "$level" "$message" "$context"
}

# Логирование команд
log_command() {
    local command="$1"
    local context="${2:-}"
    
    log_info "Выполнение команды: $command" "$context"
    
    if [[ "$LOG_LEVEL" == "DEBUG" ]]; then
        log_debug "Полная команда: $command" "$context"
    fi
}

# Логирование результатов команд
log_command_result() {
    local command="$1"
    local exit_code="$2"
    local output="${3:-}"
    local context="${4:-}"
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Команда выполнена успешно: $command" "$context"
        if [[ -n "$output" && "$LOG_LEVEL" == "DEBUG" ]]; then
            log_debug "Вывод команды: $output" "$context"
        fi
    else
        log_error "Команда завершилась с ошибкой (код: $exit_code): $command" "$context"
        if [[ -n "$output" ]]; then
            log_error "Вывод команды: $output" "$context"
        fi
    fi
}

# Логирование начала этапа
log_stage_start() {
    local stage_name="$1"
    local context="${2:-}"
    
    log_info "🚀 Начало этапа: $stage_name" "$context"
}

# Логирование завершения этапа
log_stage_end() {
    local stage_name="$1"
    local success="${2:-true}"
    local context="${3:-}"
    
    if [[ "$success" == "true" ]]; then
        log_success "✅ Этап завершен успешно: $stage_name" "$context"
    else
        log_error "❌ Этап завершен с ошибкой: $stage_name" "$context"
    fi
}

# Логирование производительности
log_performance() {
    local operation="$1"
    local duration="$2"
    local context="${3:-}"
    
    log_info "⏱️ $operation выполнено за ${duration}с" "$context"
}

# Создание лог-файла
setup_log_file() {
    local log_dir="${1:-$LOG_PATH}"
    local log_name="${2:-jenkins-pipeline}"
    
    if [[ -z "$log_dir" ]]; then
        log_dir="/tmp"
    fi
    
    # Создание директории для логов
    mkdir -p "$log_dir"
    
    # Создание имени файла с временной меткой
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    LOG_FILE="${log_dir}/${log_name}_${timestamp}.log"
    
    log_info "Лог-файл создан: $LOG_FILE"
}

# Ротация логов
rotate_logs() {
    local log_dir="${1:-$LOG_PATH}"
    local retention_days="${2:-$LOG_RETENTION}"
    
    if [[ -z "$log_dir" || ! -d "$log_dir" ]]; then
        log_warning "Директория логов не найдена: $log_dir"
        return 0
    fi
    
    log_info "Ротация логов в директории: $log_dir"
    
    # Удаление старых логов
    find "$log_dir" -name "*.log" -type f -mtime +$retention_days -delete
    
    log_success "Ротация логов завершена"
}

# Экспорт логов в Jenkins
export_logs_to_jenkins() {
    local log_file="$1"
    local jenkins_log_dir="${2:-$JENKINS_LOG_PATH}"
    
    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        log_warning "Лог-файл не найден: $log_file"
        return 0
    fi
    
    if [[ -z "$jenkins_log_dir" ]]; then
        jenkins_log_dir="/tmp"
    fi
    
    mkdir -p "$jenkins_log_dir"
    
    local jenkins_log_file="${jenkins_log_dir}/pipeline_$(date '+%Y%m%d_%H%M%S').log"
    cp "$log_file" "$jenkins_log_file"
    
    log_info "Логи экспортированы в Jenkins: $jenkins_log_file"
}

# Основная функция
main() {
    local action="${1:-help}"
    
    case "$action" in
        "setup")
            setup_log_file "${2:-}" "${3:-}"
            ;;
        "rotate")
            rotate_logs "${2:-}" "${3:-}"
            ;;
        "export")
            export_logs_to_jenkins "${2:-}" "${3:-}"
            ;;
        "test")
            log_debug "Тестовое сообщение DEBUG"
            log_info "Тестовое сообщение INFO"
            log_warning "Тестовое сообщение WARNING"
            log_error "Тестовое сообщение ERROR"
            log_critical "Тестовое сообщение CRITICAL"
            ;;
        "help"|*)
            echo "Использование: $0 <действие> [параметры]"
            echo ""
            echo "Действия:"
            echo "  setup [dir] [name]        - Настроить лог-файл"
            echo "  rotate [dir] [days]       - Ротация логов"
            echo "  export [file] [dir]       - Экспорт логов в Jenkins"
            echo "  test                      - Тест логирования"
            echo "  help                      - Показать эту справку"
            ;;
    esac
}

# Запуск основной функции
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 