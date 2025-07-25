#!/bin/bash

# 🚀 Скрипт запуска системы автоматизации DeliveryMiniapp
# Автор: DeliveryMiniapp Team
# Версия: 1.0.0

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Пути
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_DIR="$SCRIPT_DIR"
DASHBOARD_DIR="$AUTOMATION_DIR/dashboard"
APP_DIR="/home/enclude/delivery-app"

# Функции логирования
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Проверка зависимостей
check_dependencies() {
    log_step "Проверяем зависимости..."
    
    # Проверяем Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js не установлен"
        exit 1
    fi
    
    # Проверяем npm
    if ! command -v npm &> /dev/null; then
        log_error "npm не установлен"
        exit 1
    fi
    
    # Проверяем Git
    if ! command -v git &> /dev/null; then
        log_error "Git не установлен"
        exit 1
    fi
    
    # Проверяем SQLite
    if ! command -v sqlite3 &> /dev/null; then
        log_error "SQLite3 не установлен"
        exit 1
    fi
    
    log_success "Все зависимости установлены"
}

# Проверка структуры папок
check_structure() {
    log_step "Проверяем структуру папок..."
    
    # Проверяем папку приложения
    if [ ! -d "$APP_DIR" ]; then
        log_error "Папка приложения не найдена: $APP_DIR"
        exit 1
    fi
    
    # Проверяем папку автоматизации
    if [ ! -d "$AUTOMATION_DIR" ]; then
        log_error "Папка автоматизации не найдена: $AUTOMATION_DIR"
        exit 1
    fi
    
    # Проверяем папку dashboard
    if [ ! -d "$DASHBOARD_DIR" ]; then
        log_error "Папка dashboard не найдена: $DASHBOARD_DIR"
        exit 1
    fi
    
    log_success "Структура папок корректна"
}

# Установка зависимостей dashboard
install_dashboard_dependencies() {
    log_step "Устанавливаем зависимости dashboard..."
    
    cd "$DASHBOARD_DIR"
    
    if [ ! -f "package.json" ]; then
        log_error "package.json не найден в dashboard"
        exit 1
    fi
    
    if [ ! -d "node_modules" ]; then
        log_info "Устанавливаем npm зависимости..."
        npm install
    else
        log_info "Зависимости уже установлены"
    fi
    
    log_success "Зависимости dashboard установлены"
}

# Создание необходимых папок
create_directories() {
    log_step "Создаем необходимые папки..."
    
    # Создаем папку для логов
    mkdir -p "$AUTOMATION_DIR/logs"
    
    # Создаем папку для бэкапов в приложении
    mkdir -p "$APP_DIR/backup"
    
    # Создаем папку для конфигурации
    mkdir -p "$AUTOMATION_DIR/config"
    
    log_success "Папки созданы"
}

# Проверка прав доступа
check_permissions() {
    log_step "Проверяем права доступа..."
    
    # Проверяем права на папку приложения
    if [ ! -w "$APP_DIR" ]; then
        log_error "Нет прав на запись в папку приложения: $APP_DIR"
        exit 1
    fi
    
    # Проверяем права на папку автоматизации
    if [ ! -w "$AUTOMATION_DIR" ]; then
        log_error "Нет прав на запись в папку автоматизации: $AUTOMATION_DIR"
        exit 1
    fi
    
    log_success "Права доступа корректны"
}

# Инициализация Git репозитория
init_git_repository() {
    log_step "Инициализируем Git репозиторий..."
    
    cd "$APP_DIR"
    
    # Проверяем, является ли папка Git репозиторием
    if [ ! -d ".git" ]; then
        log_info "Инициализируем Git репозиторий..."
        git init
        
        # Добавляем remote
        git remote add origin https://github.com/enclude79/DeliveryMiniapp.git
        
        # Настраиваем Git
        git config user.name "DeliveryMiniapp Automation"
        git config user.email "automation@deliveryvlg.xyz"
        
        log_success "Git репозиторий инициализирован"
    else
        log_info "Git репозиторий уже существует"
    fi
}

# Проверка состояния сервиса
check_service_status() {
    log_step "Проверяем состояние сервиса..."
    
    if systemctl is-active --quiet delivery-app; then
        log_success "Сервис delivery-app запущен"
    else
        log_warning "Сервис delivery-app не запущен"
    fi
}

# Запуск dashboard
start_dashboard() {
    log_step "Запускаем dashboard..."
    
    cd "$DASHBOARD_DIR"
    
    # Проверяем, не запущен ли уже dashboard
    if pgrep -f "node.*server.js" > /dev/null; then
        log_warning "Dashboard уже запущен"
        return
    fi
    
    # Запускаем dashboard в фоне
    nohup node server.js > "$AUTOMATION_DIR/logs/dashboard.log" 2>&1 &
    DASHBOARD_PID=$!
    
    # Сохраняем PID
    echo $DASHBOARD_PID > "$AUTOMATION_DIR/dashboard.pid"
    
    # Ждем немного для запуска
    sleep 3
    
    # Проверяем, запустился ли dashboard
    if kill -0 $DASHBOARD_PID 2>/dev/null; then
        log_success "Dashboard запущен (PID: $DASHBOARD_PID)"
        log_info "Dashboard доступен по адресу: http://localhost:3001"
    else
        log_error "Ошибка запуска dashboard"
        exit 1
    fi
}

# Остановка dashboard
stop_dashboard() {
    log_step "Останавливаем dashboard..."
    
    PID_FILE="$AUTOMATION_DIR/dashboard.pid"
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            log_success "Dashboard остановлен (PID: $PID)"
        else
            log_warning "Dashboard уже остановлен"
        fi
        
        rm -f "$PID_FILE"
    else
        log_warning "PID файл не найден"
    fi
}

# Проверка здоровья системы
health_check() {
    log_step "Выполняем проверку здоровья системы..."
    
    # Проверяем dashboard
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Dashboard работает"
    else
        log_error "Dashboard недоступен"
        return 1
    fi
    
    # Проверяем основное приложение
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Основное приложение работает"
    else
        log_warning "Основное приложение недоступно"
    fi
    
    log_success "Проверка здоровья завершена"
}

# Показ статуса
show_status() {
    log_step "Статус системы:"
    
    echo
    echo "📊 Dashboard:"
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Работает${NC} (http://localhost:3001)"
    else
        echo -e "  ${RED}❌ Недоступен${NC}"
    fi
    
    echo
    echo "🚀 Основное приложение:"
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Работает${NC} (http://localhost:3000)"
    else
        echo -e "  ${RED}❌ Недоступно${NC}"
    fi
    
    if curl -f -k https://localhost:3443/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ HTTPS работает${NC} (https://localhost:3443)"
    else
        echo -e "  ${YELLOW}⚠️ HTTPS недоступно${NC}"
    fi
    
    echo
    echo "🗄️ База данных:"
    if [ -f "$APP_DIR/delivery.db" ]; then
        echo -e "  ${GREEN}✅ Prod БД существует${NC}"
    else
        echo -e "  ${YELLOW}⚠️ Prod БД не найдена${NC}"
    fi
    
    if [ -f "$APP_DIR/delivery-dev.db" ]; then
        echo -e "  ${GREEN}✅ Dev БД существует${NC}"
    else
        echo -e "  ${YELLOW}⚠️ Dev БД не найдена${NC}"
    fi
    
    echo
    echo "💾 Бэкапы:"
    BACKUP_COUNT=$(find "$APP_DIR/backup" -name "*.db" 2>/dev/null | wc -l)
    echo -e "  ${CYAN}📁 Количество бэкапов: $BACKUP_COUNT${NC}"
    
    echo
    echo "📝 Логи:"
    if [ -f "$AUTOMATION_DIR/logs/deployment.log" ]; then
        LOG_SIZE=$(du -h "$AUTOMATION_DIR/logs/deployment.log" | cut -f1)
        echo -e "  ${CYAN}📄 Лог развертывания: $LOG_SIZE${NC}"
    fi
}

# Основная функция
main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                🚀 DeliveryMiniapp Automation                 ║"
    echo "║                    Система автоматизации                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    case "${1:-start}" in
        "start")
            log_info "Запускаем систему автоматизации..."
            check_dependencies
            check_structure
            check_permissions
            create_directories
            install_dashboard_dependencies
            init_git_repository
            check_service_status
            start_dashboard
            sleep 2
            health_check
            show_status
            log_success "Система автоматизации запущена!"
            ;;
        "stop")
            log_info "Останавливаем систему автоматизации..."
            stop_dashboard
            log_success "Система автоматизации остановлена!"
            ;;
        "restart")
            log_info "Перезапускаем систему автоматизации..."
            stop_dashboard
            sleep 2
            start_dashboard
            sleep 2
            health_check
            show_status
            log_success "Система автоматизации перезапущена!"
            ;;
        "status")
            show_status
            ;;
        "health")
            health_check
            ;;
        "logs")
            log_info "Показываем логи dashboard:"
            if [ -f "$AUTOMATION_DIR/logs/dashboard.log" ]; then
                tail -f "$AUTOMATION_DIR/logs/dashboard.log"
            else
                log_warning "Лог файл не найден"
            fi
            ;;
        "help"|"-h"|"--help")
            echo "Использование: $0 [команда]"
            echo
            echo "Команды:"
            echo "  start   - Запустить систему автоматизации"
            echo "  stop    - Остановить систему автоматизации"
            echo "  restart - Перезапустить систему автоматизации"
            echo "  status  - Показать статус системы"
            echo "  health  - Проверить здоровье системы"
            echo "  logs    - Показать логи dashboard"
            echo "  help    - Показать эту справку"
            ;;
        *)
            log_error "Неизвестная команда: $1"
            echo "Используйте '$0 help' для получения справки"
            exit 1
            ;;
    esac
}

# Обработка сигналов
trap 'log_info "Получен сигнал завершения, останавливаем dashboard..."; stop_dashboard; exit 0' SIGINT SIGTERM

# Запуск основной функции
main "$@" 