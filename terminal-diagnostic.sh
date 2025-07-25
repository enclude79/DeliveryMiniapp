#!/bin/bash

echo "🔍 Диагностика проблем с терминалом"
echo "==================================="

# 1. Проверка базовой информации
echo "📋 1. Базовая информация:"
echo "   Текущая директория: $(pwd)"
echo "   Пользователь: $(whoami)"
echo "   Shell: $SHELL"
echo "   PATH: $PATH"

# 2. Проверка доступности команд
echo ""
echo "📋 2. Проверка команд:"
echo "   which bash: $(which bash 2>/dev/null || echo 'НЕ НАЙДЕН')"
echo "   which git: $(which git 2>/dev/null || echo 'НЕ НАЙДЕН')"
echo "   which ls: $(which ls 2>/dev/null || echo 'НЕ НАЙДЕН')"

# 3. Проверка прав доступа
echo ""
echo "📋 3. Проверка прав доступа:"
echo "   Права на текущую директорию:"
ls -ld . 2>/dev/null || echo "   НЕ МОЖЕМ ПРОВЕРИТЬ"

# 4. Проверка переменных окружения
echo ""
echo "📋 4. Переменные окружения:"
echo "   HOME: $HOME"
echo "   TERM: $TERM"
echo "   LANG: $LANG"
echo "   USER: $USER"

# 5. Попытка выполнения простых команд
echo ""
echo "📋 5. Тест команд:"
echo "   echo test: $(echo 'test' 2>/dev/null || echo 'ОШИБКА')"
echo "   ls: $(ls 2>/dev/null | head -3 | tr '\n' ' ' || echo 'ОШИБКА')"

# 6. Проверка Git
echo ""
echo "📋 6. Проверка Git:"
echo "   git --version: $(git --version 2>/dev/null || echo 'ОШИБКА')"
echo "   git status: $(git status --porcelain 2>/dev/null | head -1 || echo 'ОШИБКА')"

# 7. Попытка исправления
echo ""
echo "📋 7. Попытка исправления:"

# Установка shell если не установлен
if [ -z "$SHELL" ]; then
    echo "   Устанавливаем SHELL=/bin/bash"
    export SHELL=/bin/bash
fi

# Проверка и установка прав
echo "   Устанавливаем права на скрипты..."
chmod +x setup-git-workflow.sh 2>/dev/null && echo "   ✅ setup-git-workflow.sh"
chmod +x fix-terminal.sh 2>/dev/null && echo "   ✅ fix-terminal.sh"

echo ""
echo "✅ Диагностика завершена"
echo ""
echo "📋 Рекомендации:"
echo "1. Если команды не найдены - проблема с PATH"
echo "2. Если нет прав - проблема с правами доступа"
echo "3. Если Git не работает - проблема с конфигурацией"
echo "4. Если все команды возвращают ошибку - системная проблема" 