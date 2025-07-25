#!/bin/bash

# Jenkins Pipeline - Создание SystemD сервисов
# ============================================

set -euo pipefail

# Загрузка конфигурации и утилит
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../../config/environments.conf"
SERVICES_CONFIG="${SCRIPT_DIR}/../../config/systemd-services.conf"
UTILS_DIR="${SCRIPT_DIR}/../../utils"

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Загрузка конфигурации сервисов (INI формат не поддерживается в bash)
# Используем переменные из environments.conf

# Загрузка утилит
source "${UTILS_DIR}/log-utils.sh"

# Параметры
ENVIRONMENT="${1:-staging}"
SERVICE_NAME="${2:-}"
VERBOSE="${3:-false}"

# Определение параметров по окружению
case "$ENVIRONMENT" in
    "dev"|"development")
        SERVICE_NAME="${SERVICE_NAME:-$DEV_SERVICE}"
        APP_PATH="$DEV_PATH"
        SERVICE_PORT="$DEV_PORT"
        SERVICE_USER="$SERVICE_USER"
        SERVICE_GROUP="$SERVICE_GROUP"
        ;;
    "staging")
        SERVICE_NAME="${SERVICE_NAME:-$STAGING_SERVICE}"
        APP_PATH="$STAGING_PATH"
        SERVICE_PORT="$STAGING_PORT"
        SERVICE_USER="$SERVICE_USER"
        SERVICE_GROUP="$SERVICE_GROUP"
        ;;
    "prod"|"production")
        SERVICE_NAME="${SERVICE_NAME:-$PROD_SERVICE}"
        APP_PATH="$PROD_PATH"
        SERVICE_PORT="$PROD_PORT"
        SERVICE_USER="$SERVICE_USER"
        SERVICE_GROUP="$SERVICE_GROUP"
        ;;
    "dashboard")
        SERVICE_NAME="${SERVICE_NAME:-$DASHBOARD_SERVICE}"
        APP_PATH="$DASHBOARD_PATH"
        SERVICE_PORT="$DASHBOARD_PORT"
        SERVICE_USER="$SERVICE_USER"
        SERVICE_GROUP="$SERVICE_GROUP"
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

if [[ ! -d "$APP_PATH" ]]; then
    log_error "Директория приложения не найдена: $APP_PATH"
    exit 1
fi

# Настройка логирования
if [[ "$VERBOSE" == "true" ]]; then
    LOG_LEVEL="DEBUG"
fi

setup_log_file "$LOG_PATH" "create-service"

log_stage_start "Create Service" "create-service"

log_info "Создание SystemD сервиса"
log_info "Окружение: $ENVIRONMENT"
log_info "Сервис: $SERVICE_NAME"
log_info "Путь: $APP_PATH"
log_info "Порт: $SERVICE_PORT"
log_info "Пользователь: $SERVICE_USER"

# Проверка существования сервиса
if systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"; then
    log_warning "Сервис $SERVICE_NAME уже существует"
    read -p "Перезаписать существующий сервис? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Создание сервиса отменено"
        log_stage_end "Create Service" "false" "" "create-service"
        exit 0
    fi
    
    # Остановка и отключение существующего сервиса
    log_info "Остановка существующего сервиса"
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
fi

# Создание файла сервиса
service_file="/etc/systemd/system/${SERVICE_NAME}.service"
log_info "Создание файла сервиса: $service_file"

# Определение команды запуска
if [[ -f "$APP_PATH/server.js" ]]; then
    exec_start="node server.js"
elif [[ -f "$APP_PATH/app.js" ]]; then
    exec_start="node app.js"
elif [[ -f "$APP_PATH/index.js" ]]; then
    exec_start="node index.js"
else
    log_error "Основной файл приложения не найден"
    log_stage_end "Create Service" "false" "" "create-service"
    exit 1
fi

# Создание содержимого сервиса
cat > "$service_file" << EOF
[Unit]
Description=Delivery App $ENVIRONMENT Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$APP_PATH
ExecStart=/usr/bin/node $exec_start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Переменные окружения
Environment=NODE_ENV=$ENVIRONMENT
Environment=PORT=$SERVICE_PORT

# Ограничения ресурсов
LimitNOFILE=65536
LimitNPROC=4096

# Безопасность
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_PATH

[Install]
WantedBy=multi-user.target
EOF

log_success "Файл сервиса создан"

# Установка правильных прав доступа
log_info "Установка прав доступа"
chmod 644 "$service_file"
chown root:root "$service_file"

# Перезагрузка systemd
log_info "Перезагрузка systemd"
log_command "systemctl daemon-reload"
systemctl daemon-reload

if [[ $? -eq 0 ]]; then
    log_success "systemd перезагружен"
else
    log_error "Ошибка перезагрузки systemd"
    log_stage_end "Create Service" "false" "" "create-service"
    exit 1
fi

# Включение автозапуска
log_info "Включение автозапуска сервиса"
log_command "systemctl enable $SERVICE_NAME"
systemctl enable "$SERVICE_NAME"

if [[ $? -eq 0 ]]; then
    log_success "Автозапуск включен"
else
    log_warning "Ошибка включения автозапуска"
fi

# Проверка синтаксиса сервиса
log_info "Проверка синтаксиса сервиса"
log_command "systemctl cat $SERVICE_NAME"
if systemctl cat "$SERVICE_NAME" > /dev/null 2>&1; then
    log_success "Синтаксис сервиса корректен"
else
    log_error "Ошибка синтаксиса сервиса"
    log_stage_end "Create Service" "false" "" "create-service"
    exit 1
fi

# Создание отчета
log_info "Создание отчета о создании сервиса"
service_report="${LOG_PATH}/service-creation-$(date +%Y%m%d_%H%M%S).json"

cat > "$service_report" << EOF
{
  "service_creation": {
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "service_name": "$SERVICE_NAME",
    "service_file": "$service_file",
    "app_path": "$APP_PATH",
    "port": "$SERVICE_PORT",
    "user": "$SERVICE_USER",
    "group": "$SERVICE_GROUP"
  },
  "service_config": {
    "exec_start": "$exec_start",
    "restart_policy": "always",
    "restart_sec": "10",
    "auto_start": "enabled"
  },
  "status": "created"
}
EOF

log_success "Отчет о создании сервиса создан: $service_report"

# Итоговая статистика
total_duration=$(($(date +%s) - $(date -d "$(date '+%Y-%m-%d %H:%M:%S')" +%s)))
log_performance "Create Service" "$total_duration" "create-service"

log_stage_end "Create Service" "true" "$total_duration" "create-service"

log_success "SystemD сервис создан успешно"
echo "$service_report" 