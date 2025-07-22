#!/bin/bash

# Расширенный health check для Delivery App
# Проверяет все компоненты системы

# Настройки
APP_DIR="/home/enclude/delivery-app"
LOG_FILE="/var/log/delivery-app-health.log"
HEALTH_URL="http://localhost:3000/health"
ADMIN_URL="http://localhost:3000/admin"
APP_URL="http://localhost:3000/app"
HTTPS_URL="https://localhost:3443/health"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция логирования
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Функция цветного вывода
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
        *)
            echo -e "$message"
            ;;
    esac
}

# Проверка процесса Node.js
check_process() {
    local pid=$(pgrep -f "node server.js")
    if [[ -n "$pid" ]]; then
        print_status "OK" "Процесс сервера запущен (PID: $pid)"
        return 0
    else
        print_status "ERROR" "Процесс сервера не найден"
        return 1
    fi
}

# Проверка портов
check_ports() {
    local errors=0
    
    # Проверка порта 3000
    if netstat -tlnp | grep -q ":3000 "; then
        print_status "OK" "Порт 3000 (HTTP) открыт"
    else
        print_status "ERROR" "Порт 3000 (HTTP) не открыт"
        errors=$((errors + 1))
    fi
    
    # Проверка порта 3443
    if netstat -tlnp | grep -q ":3443 "; then
        print_status "OK" "Порт 3443 (HTTPS) открыт"
    else
        print_status "WARNING" "Порт 3443 (HTTPS) не открыт"
    fi
    
    return $errors
}

# Проверка HTTP endpoints
check_endpoints() {
    local errors=0
    
    # Health endpoint
    if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
        print_status "OK" "Health endpoint отвечает"
    else
        print_status "ERROR" "Health endpoint не отвечает"
        errors=$((errors + 1))
    fi
    
    # Admin panel
    if curl -s -I "$ADMIN_URL" | grep -q "200 OK"; then
        print_status "OK" "Админ панель доступна"
    else
        print_status "ERROR" "Админ панель недоступна"
        errors=$((errors + 1))
    fi
    
    # Mini App
    if curl -s -I "$APP_URL" | grep -q "200 OK"; then
        print_status "OK" "Mini App доступно"
    else
        print_status "ERROR" "Mini App недоступно"
        errors=$((errors + 1))
    fi
    
    return $errors
}

# Проверка базы данных
check_database() {
    local db_file="$APP_DIR/delivery.db"
    
    if [[ -f "$db_file" ]]; then
        if [[ -r "$db_file" && -w "$db_file" ]]; then
            print_status "OK" "База данных доступна для чтения/записи"
            
            # Проверка размера базы
            local size=$(stat -c%s "$db_file")
            print_status "OK" "Размер базы данных: $((size / 1024)) KB"
            return 0
        else
            print_status "ERROR" "База данных недоступна для чтения/записи"
            return 1
        fi
    else
        print_status "ERROR" "Файл базы данных не найден"
        return 1
    fi
}

# Проверка логов
check_logs() {
    local errors=0
    local logs_dir="$APP_DIR/logs"
    
    if [[ -d "$logs_dir" ]]; then
        print_status "OK" "Директория логов существует"
        
        # Проверка основных логов
        for log in "app.log" "error.log" "access.log"; do
            if [[ -f "$logs_dir/$log" ]]; then
                local size=$(stat -c%s "$logs_dir/$log")
                print_status "OK" "$log: $((size / 1024)) KB"
            else
                print_status "WARNING" "$log не найден"
            fi
        done
    else
        print_status "ERROR" "Директория логов не найдена"
        errors=$((errors + 1))
    fi
    
    return $errors
}

# Проверка использования ресурсов
check_resources() {
    local pid=$(pgrep -f "node server.js")
    
    if [[ -n "$pid" ]]; then
        # Память
        local memory=$(ps -p "$pid" -o rss= | tr -d ' ')
        local memory_mb=$((memory / 1024))
        
        if [[ $memory_mb -lt 500 ]]; then
            print_status "OK" "Использование памяти: ${memory_mb}MB"
        elif [[ $memory_mb -lt 1000 ]]; then
            print_status "WARNING" "Использование памяти: ${memory_mb}MB (высокое)"
        else
            print_status "ERROR" "Использование памяти: ${memory_mb}MB (критическое)"
        fi
        
        # CPU
        local cpu=$(ps -p "$pid" -o %cpu= | tr -d ' ')
        print_status "OK" "Использование CPU: ${cpu}%"
        
        # Время работы
        local etime=$(ps -p "$pid" -o etime= | tr -d ' ')
        print_status "OK" "Время работы: $etime"
    else
        print_status "ERROR" "Не удается получить информацию о ресурсах"
        return 1
    fi
}

# Проверка SSL сертификатов
check_ssl() {
    local ssl_dir="$APP_DIR/ssl"
    
    if [[ -d "$ssl_dir" ]]; then
        print_status "OK" "Директория SSL существует"
        
        # Проверка файлов сертификатов
        for cert_file in "certificate.crt" "private.key" "ca_bundle.crt"; do
            if [[ -f "$ssl_dir/$cert_file" ]]; then
                print_status "OK" "SSL файл $cert_file найден"
            else
                print_status "WARNING" "SSL файл $cert_file не найден"
            fi
        done
    else
        print_status "WARNING" "Директория SSL не найдена"
    fi
}

# Основная функция проверки
main() {
    echo "============================================"
    echo "  HEALTH CHECK - DELIVERY APP"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "============================================"
    
    local total_errors=0
    
    echo -e "\n🔍 Проверка процесса..."
    check_process
    total_errors=$((total_errors + $?))
    
    echo -e "\n🔍 Проверка портов..."
    check_ports
    total_errors=$((total_errors + $?))
    
    echo -e "\n🔍 Проверка endpoints..."
    check_endpoints
    total_errors=$((total_errors + $?))
    
    echo -e "\n🔍 Проверка базы данных..."
    check_database
    total_errors=$((total_errors + $?))
    
    echo -e "\n🔍 Проверка логов..."
    check_logs
    total_errors=$((total_errors + $?))
    
    echo -e "\n🔍 Проверка ресурсов..."
    check_resources
    total_errors=$((total_errors + $?))
    
    echo -e "\n🔍 Проверка SSL..."
    check_ssl
    
    echo -e "\n============================================"
    if [[ $total_errors -eq 0 ]]; then
        print_status "OK" "ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО"
        log_message "INFO: Health check успешен - все системы работают"
    else
        print_status "ERROR" "ОБНАРУЖЕНО $total_errors ОШИБОК"
        log_message "ERROR: Health check обнаружил $total_errors ошибок"
    fi
    echo "============================================"
    
    return $total_errors
}

# Запуск проверки
main "$@" 