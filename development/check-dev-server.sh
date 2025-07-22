#!/bin/bash

# Скрипт мониторинга DEV сервера доставки
# Автор: Система мониторинга DEV
# Версия: 1.0

# Настройки DEV сервера
DEV_DIR="/home/enclude/delivery-app-dev"
LOG_FILE="/home/enclude/delivery-app-dev/dev-monitor.log"
PROCESS_NAME="node server.js"
HEALTH_URL="http://localhost:3001/health"
MAX_RESTARTS=5
RESTART_COUNT_FILE="/tmp/delivery-app-dev-restart-count"
DEV_PID_FILE="/tmp/delivery-app-dev-pid"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функция логирования с цветами
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $timestamp - $message" | tee -a "$LOG_FILE"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $timestamp - $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $timestamp - $message" | tee -a "$LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $timestamp - $message" | tee -a "$LOG_FILE"
            ;;
        *)
            echo "$timestamp - $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Функция проверки процесса DEV сервера
check_dev_process() {
    # Ищем все процессы node server.js
    local pids=$(pgrep -f "$PROCESS_NAME" 2>/dev/null)
    if [[ -n "$pids" ]]; then
        # Проверяем каждый PID на использование порта 3001
        for pid in $pids; do
            if netstat -tlnp 2>/dev/null | grep -q "$pid.*:3001"; then
                echo "$pid"
                return 0
            fi
        done
    fi
    return 1
}

# Функция проверки health endpoint DEV сервера
check_dev_health() {
    local response=$(curl -s -f "$HEALTH_URL" 2>/dev/null)
    if [[ $? -eq 0 && -n "$response" ]]; then
        # Парсим uptime из ответа
        local uptime=$(echo "$response" | grep -o '"uptime":"[^"]*"' | cut -d'"' -f4)
        log_message "INFO" "DEV Health check успешен (uptime: $uptime)"
        return 0
    else
        log_message "WARNING" "DEV Health check не проходит"
        return 1
    fi
}

# Функция перезапуска DEV сервера
restart_dev_server() {
    log_message "dev-ERROR" "dev-КРИТИЧНО: Перезапуск DEV сервера..."
    
    # Останавливаем старые процессы DEV сервера
    local dev_pid=$(check_dev_process)
    if [[ -n "$dev_pid" ]]; then
        log_message "dev-INFO" "dev-Останавливаю DEV процесс $dev_pid..."
        kill -TERM "$dev_pid" 2>/dev/null
        sleep 3
        
        # Принудительно убиваем если не остановился
        if kill -0 "$dev_pid" 2>/dev/null; then
            log_message "dev-WARNING" "dev-Принудительная остановка DEV процесса..."
            kill -KILL "$dev_pid" 2>/dev/null
            sleep 2
        fi
    fi
    
    # Убиваем зависшие процессы на dev-портах
    kill_dev_ports
    
    # Переходим в директорию приложения
    cd "$DEV_DIR" || {
        log_message "dev-ERROR" "dev-Не удается перейти в директорию $DEV_DIR"
        return 1
    }
    
    # Запускаем DEV сервер через systemd
    log_message "dev-INFO" "dev-Запускаю DEV сервер через systemd..."
    sudo systemctl restart delivery-app-dev
    
    # Ждем запуска
    sleep 5
    
    # Проверяем успешность запуска
    local new_pid=$(check_dev_process)
    if [[ -n "$new_pid" ]]; then
        echo "$new_pid" > "$DEV_PID_FILE"
        log_message "dev-SUCCESS" "dev-DEV сервер успешно перезапущен (PID: $new_pid)"
        
        # Проверяем health endpoint
        if check_dev_health; then
            log_message "dev-SUCCESS" "dev-DEV сервер полностью восстановлен"
            return 0
        else
            log_message "dev-WARNING" "dev-DEV сервер запущен, но health check не проходит"
            return 1
        fi
    else
        log_message "dev-ERROR" "dev-Не удалось перезапустить DEV сервер"
        return 1
    fi
}

# Функция управления счетчиком перезапусков
manage_restart_count() {
    local action=$1
    
    if [[ "$action" == "increment" ]]; then
        local count=0
        if [[ -f "$RESTART_COUNT_FILE" ]]; then
            count=$(cat "$RESTART_COUNT_FILE")
        fi
        count=$((count + 1))
        echo "$count" > "$RESTART_COUNT_FILE"
        echo "$count"
    elif [[ "$action" == "reset" ]]; then
        echo "0" > "$RESTART_COUNT_FILE"
    elif [[ "$action" == "get" ]]; then
        if [[ -f "$RESTART_COUNT_FILE" ]]; then
            cat "$RESTART_COUNT_FILE"
        else
            echo "0"
        fi
    fi
}

# Функция детальной диагностики
detailed_diagnosis() {
    log_message "INFO" "=== ДЕТАЛЬНАЯ ДИАГНОСТИКА DEV СЕРВЕРА ==="
    
    # Проверка процесса
    local dev_pid=$(check_dev_process)
    if [[ -n "$dev_pid" ]]; then
        log_message "INFO" "DEV процесс найден (PID: $dev_pid)"
        
        # Информация о процессе
        local memory=$(ps -p "$dev_pid" -o rss= | tr -d ' ')
        local memory_mb=$((memory / 1024))
        local cpu=$(ps -p "$dev_pid" -o %cpu= | tr -d ' ')
        local etime=$(ps -p "$dev_pid" -o etime= | tr -d ' ')
        
        log_message "INFO" "Ресурсы DEV сервера:"
        log_message "INFO" "  Память: ${memory_mb}MB"
        log_message "INFO" "  CPU: ${cpu}%"
        log_message "INFO" "  Время работы: $etime"
    else
        log_message "ERROR" "DEV процесс не найден"
    fi
    
    # Проверка портов
    log_message "INFO" "Проверка портов DEV сервера:"
    if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
        log_message "SUCCESS" "  Порт 3001 (HTTP) открыт"
    else
        log_message "ERROR" "  Порт 3001 (HTTP) не открыт"
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":3444 "; then
        log_message "SUCCESS" "  Порт 3444 (HTTPS) открыт"
    else
        log_message "WARNING" "  Порт 3444 (HTTPS) не открыт"
    fi
    
    # Проверка systemd сервиса
    log_message "INFO" "Статус systemd сервиса:"
    local service_status=$(sudo systemctl is-active delivery-app-dev 2>/dev/null)
    if [[ "$service_status" == "active" ]]; then
        log_message "SUCCESS" "  delivery-app-dev: active"
    else
        log_message "ERROR" "  delivery-app-dev: $service_status"
    fi
    
    log_message "INFO" "=== КОНЕЦ ДИАГНОСТИКИ ==="
}

# Функция убийства зависших процессов на dev-портах
kill_dev_ports() {
    log_message "dev-INFO" "Проверяю dev-порты на зависшие процессы..."
    for port in 3001 3444; do
        local pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$' | sort -u)
        if [[ -n "$pid" ]]; then
            log_message "dev-WARNING" "Обнаружен процесс на dev-порту $port (PID: $pid). Убиваю..."
            kill -9 $pid 2>/dev/null
            sleep 1
        else
            log_message "dev-INFO" "dev-порт $port свободен."
        fi
    done
}

# Основная логика
main() {
    log_message "INFO" "🔍 Начинаю проверку DEV сервера..."
    
    # Детальная диагностика
    detailed_diagnosis
    
    # Проверяем процесс
    local dev_pid=$(check_dev_process)
    if [[ -n "$dev_pid" ]]; then
        log_message "SUCCESS" "DEV процесс запущен (PID: $dev_pid)"
        
        # Проверяем health endpoint
        if check_dev_health; then
            log_message "SUCCESS" "DEV сервер работает корректно"
            manage_restart_count "reset"
            return 0
        else
            log_message "WARNING" "DEV процесс запущен, но health check не проходит"
        fi
    else
        log_message "ERROR" "DEV процесс не найден"
    fi
    
    # Проверяем количество перезапусков
    local restart_count=$(manage_restart_count "get")
    if [[ "$restart_count" -ge "$MAX_RESTARTS" ]]; then
        log_message "ERROR" "КРИТИЧНО: Превышено максимальное количество перезапусков ($MAX_RESTARTS)"
        log_message "ERROR" "КРИТИЧНО: Требуется ручное вмешательство!"
        log_message "ERROR" "КРИТИЧНО: Проверьте логи: tail -f $LOG_FILE"
        return 1
    fi
    
    # Увеличиваем счетчик и перезапускаем
    restart_count=$(manage_restart_count "increment")
    log_message "WARNING" "Попытка перезапуска DEV сервера #$restart_count из $MAX_RESTARTS"
    
    if restart_dev_server; then
        log_message "SUCCESS" "DEV сервер успешно восстановлен"
        return 0
    else
        log_message "ERROR" "Не удалось восстановить DEV сервер"
        return 1
    fi
}

# Запуск основной логики
main "$@" 