#!/bin/bash

# Скрипт управления сервером Delivery App
# Использование: ./manage-server.sh [start|stop|restart|status|logs]

APP_DIR="/home/enclude/delivery-app"
PROCESS_NAME="node server.js"
LOG_FILE="$APP_DIR/server.log"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        *)
            echo -e "$message"
            ;;
    esac
}

# Проверка статуса сервера
check_status() {
    local pid=$(pgrep -f "$PROCESS_NAME")
    if [[ -n "$pid" ]]; then
        return 0
    else
        return 1
    fi
}

# Запуск сервера
start_server() {
    print_status "INFO" "Запуск сервера..."
    
    if check_status; then
        print_status "WARNING" "Сервер уже запущен (PID: $(pgrep -f "$PROCESS_NAME"))"
        return 0
    fi
    
    cd "$APP_DIR" || {
        print_status "ERROR" "Не удается перейти в директорию $APP_DIR"
        return 1
    }
    
    # Запускаем сервер
    nohup node server.js > server.log 2>&1 &
    
    # Ждем запуска
    sleep 3
    
    if check_status; then
        print_status "OK" "Сервер успешно запущен (PID: $(pgrep -f "$PROCESS_NAME"))"
        return 0
    else
        print_status "ERROR" "Не удалось запустить сервер"
        return 1
    fi
}

# Остановка сервера
stop_server() {
    print_status "INFO" "Остановка сервера..."
    
    if ! check_status; then
        print_status "WARNING" "Сервер не запущен"
        return 0
    fi
    
    local pid=$(pgrep -f "$PROCESS_NAME")
    print_status "INFO" "Отправка сигнала SIGTERM процессу $pid..."
    
    # Мягкая остановка
    kill -TERM "$pid" 2>/dev/null
    
    # Ждем остановки
    local count=0
    while check_status && [[ $count -lt 10 ]]; do
        sleep 1
        count=$((count + 1))
    done
    
    if check_status; then
        print_status "WARNING" "Принудительная остановка..."
        kill -KILL "$pid" 2>/dev/null
        sleep 2
    fi
    
    if ! check_status; then
        print_status "OK" "Сервер успешно остановлен"
        return 0
    else
        print_status "ERROR" "Не удалось остановить сервер"
        return 1
    fi
}

# Перезапуск сервера
restart_server() {
    print_status "INFO" "Перезапуск сервера..."
    stop_server
    sleep 2
    start_server
}

# Показать статус
show_status() {
    echo "============================================"
    echo "  СТАТУС СЕРВЕРА DELIVERY APP"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "============================================"
    
    if check_status; then
        local pid=$(pgrep -f "$PROCESS_NAME")
        print_status "OK" "Сервер запущен (PID: $pid)"
        
        # Дополнительная информация
        local memory=$(ps -p "$pid" -o rss= | tr -d ' ')
        local memory_mb=$((memory / 1024))
        local cpu=$(ps -p "$pid" -o %cpu= | tr -d ' ')
        local etime=$(ps -p "$pid" -o etime= | tr -d ' ')
        
        echo -e "\n📊 Ресурсы:"
        echo -e "   Память: ${memory_mb}MB"
        echo -e "   CPU: ${cpu}%"
        echo -e "   Время работы: $etime"
        
        # Проверка портов
        echo -e "\n🔌 Порты:"
        if netstat -tlnp | grep -q ":3000 "; then
            print_status "OK" "HTTP порт 3000 открыт"
        else
            print_status "ERROR" "HTTP порт 3000 не открыт"
        fi
        
        if netstat -tlnp | grep -q ":3443 "; then
            print_status "OK" "HTTPS порт 3443 открыт"
        else
            print_status "WARNING" "HTTPS порт 3443 не открыт"
        fi
        
        # Health check
        echo -e "\n🏥 Health Check:"
        if curl -s -f "http://localhost:3000/health" > /dev/null 2>&1; then
            print_status "OK" "Health endpoint отвечает"
        else
            print_status "ERROR" "Health endpoint не отвечает"
        fi
        
    else
        print_status "ERROR" "Сервер не запущен"
    fi
    
    echo "============================================"
}

# Показать логи
show_logs() {
    local lines=${2:-50}
    
    if [[ -f "$LOG_FILE" ]]; then
        print_status "INFO" "Последние $lines строк лога:"
        echo "============================================"
        tail -n "$lines" "$LOG_FILE"
        echo "============================================"
    else
        print_status "ERROR" "Лог файл не найден: $LOG_FILE"
    fi
}

# Основная функция
main() {
    local action=${1:-status}
    
    case $action in
        "start")
            start_server
            ;;
        "stop")
            stop_server
            ;;
        "restart")
            restart_server
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$@"
            ;;
        "health")
            ./health-check.sh
            ;;
        *)
            echo "Использование: $0 [start|stop|restart|status|logs|health]"
            echo ""
            echo "Команды:"
            echo "  start   - Запустить сервер"
            echo "  stop    - Остановить сервер"
            echo "  restart - Перезапустить сервер"
            echo "  status  - Показать статус сервера"
            echo "  logs    - Показать логи (по умолчанию 50 строк)"
            echo "  health  - Запустить полную проверку здоровья"
            echo ""
            echo "Примеры:"
            echo "  $0 start"
            echo "  $0 logs 100"
            echo "  $0 health"
            exit 1
            ;;
    esac
}

# Запуск
main "$@" 