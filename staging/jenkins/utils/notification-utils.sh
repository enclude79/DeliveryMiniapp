#!/bin/bash

# Jenkins Pipeline - Утилиты уведомлений
# =====================================

set -euo pipefail

# Загрузка конфигурации
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/environments.conf"

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Загрузка утилит логирования
source "${SCRIPT_DIR}/log-utils.sh"

# Настройки уведомлений
TELEGRAM_ENABLED="${TELEGRAM_ENABLED:-false}"
SLACK_ENABLED="${SLACK_ENABLED:-false}"
EMAIL_ENABLED="${EMAIL_ENABLED:-false}"

# Проверка наличия curl
check_curl() {
    if ! command -v curl &> /dev/null; then
        log_warning "curl не установлен, уведомления будут отключены"
        return 1
    fi
    return 0
}

# Отправка уведомления в Telegram
send_telegram_notification() {
    local message="$1"
    local chat_id="${2:-$TELEGRAM_CHAT_ID}"
    local bot_token="${3:-$TELEGRAM_BOT_TOKEN}"
    
    if [[ "$TELEGRAM_ENABLED" != "true" || -z "$bot_token" || -z "$chat_id" ]]; then
        log_debug "Telegram уведомления отключены или не настроены"
        return 0
    fi
    
    if ! check_curl; then
        return 1
    fi
    
    local url="https://api.telegram.org/bot${bot_token}/sendMessage"
    local data="{\"chat_id\":\"${chat_id}\",\"text\":\"${message}\",\"parse_mode\":\"HTML\"}"
    
    log_info "Отправка уведомления в Telegram"
    
    local response
    response=$(curl -s -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        log_success "Уведомление отправлено в Telegram"
        log_debug "Ответ Telegram: $response"
    else
        log_error "Ошибка отправки уведомления в Telegram"
        return 1
    fi
}

# Отправка уведомления в Slack
send_slack_notification() {
    local message="$1"
    local channel="${2:-}"
    local webhook_url="${3:-$SLACK_WEBHOOK_URL}"
    
    if [[ "$SLACK_ENABLED" != "true" || -z "$webhook_url" ]]; then
        log_debug "Slack уведомления отключены или не настроены"
        return 0
    fi
    
    if ! check_curl; then
        return 1
    fi
    
    local payload="{\"text\":\"${message}\""
    
    if [[ -n "$channel" ]]; then
        payload="${payload},\"channel\":\"${channel}\""
    fi
    
    payload="${payload}}"
    
    log_info "Отправка уведомления в Slack"
    
    local response
    response=$(curl -s -X POST -H "Content-Type: application/json" -d "$payload" "$webhook_url" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        log_success "Уведомление отправлено в Slack"
        log_debug "Ответ Slack: $response"
    else
        log_error "Ошибка отправки уведомления в Slack"
        return 1
    fi
}

# Отправка email уведомления
send_email_notification() {
    local subject="$1"
    local message="$2"
    local recipient="${3:-}"
    
    if [[ "$EMAIL_ENABLED" != "true" ]]; then
        log_debug "Email уведомления отключены"
        return 0
    fi
    
    if ! command -v mail &> /dev/null; then
        log_warning "mail не установлен, email уведомления недоступны"
        return 1
    fi
    
    if [[ -z "$recipient" ]]; then
        log_warning "Получатель email не указан"
        return 1
    fi
    
    log_info "Отправка email уведомления на $recipient"
    
    echo "$message" | mail -s "$subject" "$recipient"
    
    if [[ $? -eq 0 ]]; then
        log_success "Email уведомление отправлено"
    else
        log_error "Ошибка отправки email уведомления"
        return 1
    fi
}

# Форматирование сообщения для уведомлений
format_notification_message() {
    local title="$1"
    local message="$2"
    local status="${3:-INFO}"
    local context="${4:-}"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local build_info=""
    
    if [[ -n "$JENKINS_BUILD_NUMBER" ]]; then
        build_info="Build #$JENKINS_BUILD_NUMBER"
    fi
    
    if [[ -n "$JENKINS_JOB_NAME" ]]; then
        build_info="${build_info} - $JENKINS_JOB_NAME"
    fi
    
    local formatted_message="<b>${title}</b>\n"
    formatted_message="${formatted_message}Статус: ${status}\n"
    formatted_message="${formatted_message}Время: ${timestamp}\n"
    
    if [[ -n "$build_info" ]]; then
        formatted_message="${formatted_message}${build_info}\n"
    fi
    
    if [[ -n "$context" ]]; then
        formatted_message="${formatted_message}Контекст: ${context}\n"
    fi
    
    formatted_message="${formatted_message}\n${message}"
    
    echo "$formatted_message"
}

# Отправка уведомления о начале pipeline
notify_pipeline_start() {
    local pipeline_name="$1"
    local context="${2:-}"
    
    local title="🚀 Pipeline запущен"
    local message="Pipeline ${pipeline_name} начал выполнение"
    
    local formatted_message=$(format_notification_message "$title" "$message" "START" "$context")
    
    send_telegram_notification "$formatted_message"
    send_slack_notification "$formatted_message"
}

# Отправка уведомления об успешном завершении pipeline
notify_pipeline_success() {
    local pipeline_name="$1"
    local duration="$2"
    local context="${3:-}"
    
    local title="✅ Pipeline завершен успешно"
    local message="Pipeline ${pipeline_name} завершен успешно за ${duration}с"
    
    local formatted_message=$(format_notification_message "$title" "$message" "SUCCESS" "$context")
    
    send_telegram_notification "$formatted_message"
    send_slack_notification "$formatted_message"
}

# Отправка уведомления об ошибке pipeline
notify_pipeline_error() {
    local pipeline_name="$1"
    local error_message="$2"
    local context="${3:-}"
    
    local title="❌ Pipeline завершен с ошибкой"
    local message="Pipeline ${pipeline_name} завершился с ошибкой:\n${error_message}"
    
    local formatted_message=$(format_notification_message "$title" "$message" "ERROR" "$context")
    
    send_telegram_notification "$formatted_message"
    send_slack_notification "$formatted_message"
}

# Отправка уведомления о начале этапа
notify_stage_start() {
    local stage_name="$1"
    local pipeline_name="${2:-}"
    local context="${3:-}"
    
    local title="🔄 Этап начат"
    local message="Этап ${stage_name}"
    
    if [[ -n "$pipeline_name" ]]; then
        message="${message} в pipeline ${pipeline_name}"
    fi
    
    local formatted_message=$(format_notification_message "$title" "$message" "INFO" "$context")
    
    # Для этапов отправляем только в Slack (меньше спама)
    send_slack_notification "$formatted_message"
}

# Отправка уведомления о завершении этапа
notify_stage_end() {
    local stage_name="$1"
    local success="$2"
    local duration="${3:-}"
    local context="${4:-}"
    
    local status_icon="✅"
    local status_text="SUCCESS"
    
    if [[ "$success" != "true" ]]; then
        status_icon="❌"
        status_text="ERROR"
    fi
    
    local title="${status_icon} Этап завершен"
    local message="Этап ${stage_name}"
    
    if [[ -n "$duration" ]]; then
        message="${message} выполнен за ${duration}с"
    fi
    
    local formatted_message=$(format_notification_message "$title" "$message" "$status_text" "$context")
    
    # Для этапов отправляем только в Slack (меньше спама)
    send_slack_notification "$formatted_message"
}

# Отправка уведомления о критической ошибке
notify_critical_error() {
    local error_message="$1"
    local context="${2:-}"
    
    local title="🚨 КРИТИЧЕСКАЯ ОШИБКА"
    local message="Обнаружена критическая ошибка:\n${error_message}"
    
    local formatted_message=$(format_notification_message "$title" "$message" "CRITICAL" "$context")
    
    # Критические ошибки отправляем везде
    send_telegram_notification "$formatted_message"
    send_slack_notification "$formatted_message"
    
    # И по email если настроено
    if [[ "$EMAIL_ENABLED" == "true" ]]; then
        send_email_notification "Критическая ошибка в Pipeline" "$message"
    fi
}

# Отправка уведомления о деплое
notify_deployment() {
    local environment="$1"
    local version="$2"
    local success="$3"
    local context="${4:-}"
    
    local status_icon="✅"
    local status_text="SUCCESS"
    local action="развернут"
    
    if [[ "$success" != "true" ]]; then
        status_icon="❌"
        status_text="ERROR"
        action="не удалось развернуть"
    fi
    
    local title="${status_icon} Деплой ${environment}"
    local message="Версия ${version} ${action} в ${environment}"
    
    local formatted_message=$(format_notification_message "$title" "$message" "$status_text" "$context")
    
    send_telegram_notification "$formatted_message"
    send_slack_notification "$formatted_message"
}

# Тестирование уведомлений
test_notifications() {
    log_info "Тестирование уведомлений"
    
    # Тест Telegram
    if [[ "$TELEGRAM_ENABLED" == "true" ]]; then
        send_telegram_notification "🧪 Тестовое уведомление от Jenkins Pipeline"
    fi
    
    # Тест Slack
    if [[ "$SLACK_ENABLED" == "true" ]]; then
        send_slack_notification "🧪 Тестовое уведомление от Jenkins Pipeline"
    fi
    
    # Тест Email
    if [[ "$EMAIL_ENABLED" == "true" ]]; then
        send_email_notification "Тест уведомлений" "Тестовое уведомление от Jenkins Pipeline"
    fi
    
    log_success "Тестирование уведомлений завершено"
}

# Основная функция
main() {
    local action="${1:-help}"
    
    case "$action" in
        "telegram")
            send_telegram_notification "${2:-}" "${3:-}" "${4:-}"
            ;;
        "slack")
            send_slack_notification "${2:-}" "${3:-}" "${4:-}"
            ;;
        "email")
            send_email_notification "${2:-}" "${3:-}" "${4:-}"
            ;;
        "pipeline-start")
            notify_pipeline_start "${2:-}" "${3:-}"
            ;;
        "pipeline-success")
            notify_pipeline_success "${2:-}" "${3:-}" "${4:-}"
            ;;
        "pipeline-error")
            notify_pipeline_error "${2:-}" "${3:-}" "${4:-}"
            ;;
        "stage-start")
            notify_stage_start "${2:-}" "${3:-}" "${4:-}"
            ;;
        "stage-end")
            notify_stage_end "${2:-}" "${3:-}" "${4:-}" "${5:-}"
            ;;
        "critical-error")
            notify_critical_error "${2:-}" "${3:-}"
            ;;
        "deployment")
            notify_deployment "${2:-}" "${3:-}" "${4:-}" "${5:-}"
            ;;
        "test")
            test_notifications
            ;;
        "help"|*)
            echo "Использование: $0 <действие> [параметры]"
            echo ""
            echo "Действия:"
            echo "  telegram <message> [chat_id] [token]  - Отправить в Telegram"
            echo "  slack <message> [channel] [webhook]   - Отправить в Slack"
            echo "  email <subject> <message> [recipient] - Отправить email"
            echo "  pipeline-start <name> [context]       - Уведомление о начале pipeline"
            echo "  pipeline-success <name> <duration> [context] - Успешное завершение"
            echo "  pipeline-error <name> <error> [context] - Ошибка pipeline"
            echo "  stage-start <name> [pipeline] [context] - Начало этапа"
            echo "  stage-end <name> <success> [duration] [context] - Конец этапа"
            echo "  critical-error <message> [context]    - Критическая ошибка"
            echo "  deployment <env> <version> <success> [context] - Деплой"
            echo "  test                                   - Тест уведомлений"
            echo "  help                                   - Показать эту справку"
            ;;
    esac
}

# Запуск основной функции
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 