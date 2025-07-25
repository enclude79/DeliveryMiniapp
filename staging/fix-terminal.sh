#!/bin/bash

echo "🔧 Диагностика проблем с терминалом..."
echo "======================================"

# Проверка базовых команд
echo "1. Проверка базовых команд:"
echo "   PWD: $(pwd)"
echo "   USER: $(whoami)"
echo "   SHELL: $SHELL"
echo "   PATH: $PATH"

# Проверка прав доступа
echo ""
echo "2. Проверка прав доступа:"
ls -la /home/enclude/automation/development/ | head -5

# Проверка shell
echo ""
echo "3. Проверка shell:"
which bash
which sh

# Проверка переменных окружения
echo ""
echo "4. Проверка переменных окружения:"
echo "   HOME: $HOME"
echo "   TERM: $TERM"
echo "   LANG: $LANG"

# Попытка исправления
echo ""
echo "5. Попытка исправления:"

# Установка правильного shell
if [ -z "$SHELL" ]; then
    echo "   Устанавливаем SHELL..."
    export SHELL=/bin/bash
fi

# Проверка прав на выполнение
echo "   Проверяем права на выполнение..."
chmod +x /home/enclude/automation/development/switch-to-dev.sh 2>/dev/null || echo "   Не удалось установить права"
chmod +x /home/enclude/automation/development/check-dev-status.sh 2>/dev/null || echo "   Не удалось установить права"

echo ""
echo "✅ Диагностика завершена" 