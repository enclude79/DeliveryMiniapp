#!/bin/bash

# Jenkins Pipeline - Git утилиты
# ==============================

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Загрузка конфигурации
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/environments.conf"

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Логирование
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Проверка наличия Git
check_git() {
    if ! command -v git &> /dev/null; then
        log_error "Git не установлен"
        exit 1
    fi
}

# Проверка Git репозитория
check_git_repo() {
    local repo_path="${1:-.}"
    
    if [[ ! -d "${repo_path}/.git" ]]; then
        log_error "Директория ${repo_path} не является Git репозиторием"
        return 1
    fi
    
    log_info "Git репозиторий найден в ${repo_path}"
    return 0
}

# Получение текущей ветки
get_current_branch() {
    local repo_path="${1:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    git branch --show-current
}

# Проверка существования ветки
branch_exists() {
    local branch_name="$1"
    local repo_path="${2:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    git show-ref --verify --quiet "refs/heads/${branch_name}"
}

# Создание новой ветки
create_branch() {
    local branch_name="$1"
    local base_branch="${2:-develop}"
    local repo_path="${3:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    if branch_exists "$branch_name" "$repo_path"; then
        log_warning "Ветка ${branch_name} уже существует"
        return 0
    fi
    
    log_info "Создание ветки ${branch_name} от ${base_branch}"
    git checkout "$base_branch"
    git pull origin "$base_branch"
    git checkout -b "$branch_name"
    
    log_success "Ветка ${branch_name} создана"
}

# Переключение на ветку
switch_branch() {
    local branch_name="$1"
    local repo_path="${2:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    if ! branch_exists "$branch_name" "$repo_path"; then
        log_error "Ветка ${branch_name} не существует"
        return 1
    fi
    
    log_info "Переключение на ветку ${branch_name}"
    git checkout "$branch_name"
    git pull origin "$branch_name"
    
    log_success "Переключение на ветку ${branch_name} выполнено"
}

# Получение последних изменений
pull_latest() {
    local branch_name="${1:-$(get_current_branch)}"
    local repo_path="${2:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    log_info "Получение последних изменений для ветки ${branch_name}"
    git fetch origin
    git checkout "$branch_name"
    git pull origin "$branch_name"
    
    log_success "Последние изменения получены"
}

# Создание коммита
create_commit() {
    local commit_message="$1"
    local repo_path="${2:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    if [[ -z "$(git status --porcelain)" ]]; then
        log_warning "Нет изменений для коммита"
        return 0
    fi
    
    log_info "Создание коммита: ${commit_message}"
    git add .
    git commit -m "$commit_message"
    
    log_success "Коммит создан"
}

# Отправка изменений
push_changes() {
    local branch_name="${1:-$(get_current_branch)}"
    local repo_path="${2:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    log_info "Отправка изменений в ветку ${branch_name}"
    git push origin "$branch_name"
    
    log_success "Изменения отправлены"
}

# Слияние веток
merge_branches() {
    local source_branch="$1"
    local target_branch="$2"
    local repo_path="${3:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    if ! branch_exists "$source_branch" "$repo_path"; then
        log_error "Исходная ветка ${source_branch} не существует"
        return 1
    fi
    
    if ! branch_exists "$target_branch" "$repo_path"; then
        log_error "Целевая ветка ${target_branch} не существует"
        return 1
    fi
    
    log_info "Слияние ветки ${source_branch} в ${target_branch}"
    
    git checkout "$target_branch"
    git pull origin "$target_branch"
    git merge "$source_branch" --no-ff -m "Merge ${source_branch} into ${target_branch}"
    git push origin "$target_branch"
    
    log_success "Слияние выполнено"
}

# Получение списка измененных файлов
get_changed_files() {
    local base_branch="${1:-main}"
    local current_branch="${2:-$(get_current_branch)}"
    local repo_path="${3:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    git diff --name-only "${base_branch}..${current_branch}"
}

# Получение информации о последнем коммите
get_last_commit_info() {
    local repo_path="${1:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    echo "Hash: $(git rev-parse HEAD)"
    echo "Author: $(git log -1 --pretty=format:'%an <%ae>')"
    echo "Date: $(git log -1 --pretty=format:'%cd')"
    echo "Message: $(git log -1 --pretty=format:'%s')"
}

# Очистка локальных веток
cleanup_local_branches() {
    local repo_path="${1:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    log_info "Очистка локальных веток"
    
    # Удаление локальных веток, которые уже слиты в main
    git branch --merged main | grep -v "main" | grep -v "develop" | grep -v "staging" | xargs -r git branch -d
    
    log_success "Очистка завершена"
}

# Проверка статуса репозитория
check_repo_status() {
    local repo_path="${1:-.}"
    
    if ! check_git_repo "$repo_path"; then
        return 1
    fi
    
    cd "$repo_path"
    
    echo "=== Статус Git репозитория ==="
    echo "Текущая ветка: $(get_current_branch)"
    echo "Последний коммит:"
    get_last_commit_info
    echo ""
    echo "Статус файлов:"
    git status --short
    echo ""
    echo "Неотправленные коммиты:"
    git log --oneline origin/$(get_current_branch)..HEAD 2>/dev/null || echo "Нет неотправленных коммитов"
}

# Основная функция
main() {
    local action="${1:-help}"
    
    case "$action" in
        "check")
            check_git
            check_git_repo
            ;;
        "current-branch")
            get_current_branch
            ;;
        "create-branch")
            create_branch "${2:-}" "${3:-develop}" "${4:-.}"
            ;;
        "switch-branch")
            switch_branch "${2:-}" "${3:-.}"
            ;;
        "pull")
            pull_latest "${2:-}" "${3:-.}"
            ;;
        "commit")
            create_commit "${2:-}" "${3:-.}"
            ;;
        "push")
            push_changes "${2:-}" "${3:-.}"
            ;;
        "merge")
            merge_branches "${2:-}" "${3:-}" "${4:-.}"
            ;;
        "changed-files")
            get_changed_files "${2:-main}" "${3:-}" "${4:-.}"
            ;;
        "last-commit")
            get_last_commit_info "${2:-.}"
            ;;
        "cleanup")
            cleanup_local_branches "${2:-.}"
            ;;
        "status")
            check_repo_status "${2:-.}"
            ;;
        "help"|*)
            echo "Использование: $0 <действие> [параметры]"
            echo ""
            echo "Действия:"
            echo "  check                    - Проверка Git и репозитория"
            echo "  current-branch           - Получить текущую ветку"
            echo "  create-branch <name>     - Создать новую ветку"
            echo "  switch-branch <name>     - Переключиться на ветку"
            echo "  pull [branch]            - Получить последние изменения"
            echo "  commit <message>         - Создать коммит"
            echo "  push [branch]            - Отправить изменения"
            echo "  merge <from> <to>        - Слить ветки"
            echo "  changed-files [base]     - Получить измененные файлы"
            echo "  last-commit              - Информация о последнем коммите"
            echo "  cleanup                  - Очистить локальные ветки"
            echo "  status                   - Статус репозитория"
            echo "  help                     - Показать эту справку"
            ;;
    esac
}

# Запуск основной функции
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 