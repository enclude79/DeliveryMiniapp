#!/bin/bash

# Скрипт мониторинга сервера доставки
# Автор: Система мониторинга
# Версия: 1.0

# Настройки
SERVER_DIR="/home/enclude/delivery-app"
LOG_FILE="/var/log/delivery-app-monitor.log"
PROCESS_NAME="node server.js"
HEALTH_URL="http://localhost:3000/health"
MAX_RESTARTS=5
RESTART_COUNT_FILE="/tmp/delivery-app-restart-count"

# Функция логирования
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Функция проверки процесса
check_process() {
    pgrep -f "$PROCESS_NAME" > /dev/null
    return $?
}

# Функция проверки health endpoint
check_health() {
    curl -s -f "$HEALTH_URL" > /dev/null 2>&1
    return $?
}

# Функция перезапуска сервера
restart_server() {
    log_message "КРИТИЧНО: Перезапуск сервера..."
    
    # Останавливаем старые процессы
    pkill -f "$PROCESS_NAME" 2>/dev/null
    sleep 3
    
    # Принудительно убиваем если не остановился
    pkill -9 -f "$PROCESS_NAME" 2>/dev/null
    sleep 2
    
    # Переходим в директорию приложения
    cd "$SERVER_DIR" || {
        log_message "ОШИБКА: Не удается перейти в директорию $SERVER_DIR"
        return 1
    }
    
    # Запускаем сервер
    nohup node server.js > server.log 2>&1 &
    
    # Ждем запуска
    sleep 5
    
    # Проверяем успешность запуска
    if check_process; then
        log_message "УСПЕХ: Сервер успешно перезапущен (PID: $(pgrep -f "$PROCESS_NAME"))"
        return 0
    else
        log_message "ОШИБКА: Не удалось перезапустить сервер"
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

# Основная логика
main() {
    log_message "INFO: Начинаю проверку сервера..."
    
    # Проверяем процесс
    if check_process; then
        log_message "INFO: Процесс сервера запущен (PID: $(pgrep -f "$PROCESS_NAME"))"
        
        # Проверяем health endpoint
        if check_health; then
            log_message "INFO: Health check успешен - сервер отвечает"
            manage_restart_count "reset"
            return 0
        else
            log_message "ПРЕДУПРЕЖДЕНИЕ: Процесс запущен, но health check не проходит"
        fi
    else
        log_message "КРИТИЧНО: Процесс сервера не найден"
    fi
    
    # Проверяем количество перезапусков
    local restart_count=$(manage_restart_count "get")
    if [[ "$restart_count" -ge "$MAX_RESTARTS" ]]; then
        log_message "КРИТИЧНО: Превышено максимальное количество перезапусков ($MAX_RESTARTS)"
        log_message "КРИТИЧНО: Требуется ручное вмешательство!"
        return 1
    fi
    
    # Увеличиваем счетчик и перезапускаем
    restart_count=$(manage_restart_count "increment")
    log_message "INFO: Попытка перезапуска #$restart_count из $MAX_RESTARTS"
    
    if restart_server; then
        log_message "INFO: Сервер успешно восстановлен"
        return 0
    else
        log_message "ОШИБКА: Не удалось восстановить сервер"
        return 1
    fi
}

# Запуск основной логики
main "$@" 