#!/bin/bash

echo "🔧 Исправление прав доступа..."
echo "=============================="

# 1. Проверяем текущего пользователя
echo "📋 1. Текущий пользователь:"
id
whoami

# 2. Проверяем права на Git
echo ""
echo "📋 2. Проверка Git:"
echo "   Поиск Git в системе..."
find /usr -name "git" 2>/dev/null | head -5
find /usr/local -name "git" 2>/dev/null | head -5

# 3. Устанавливаем права на Git
echo ""
echo "📋 3. Установка прав на Git:"
if [ -f /usr/bin/git ]; then
    echo "   Устанавливаем права на /usr/bin/git..."
    chmod +x /usr/bin/git 2>/dev/null && echo "   ✅ Права установлены" || echo "   ❌ Не удалось установить права"
elif [ -f /usr/local/bin/git ]; then
    echo "   Устанавливаем права на /usr/local/bin/git..."
    chmod +x /usr/local/bin/git 2>/dev/null && echo "   ✅ Права установлены" || echo "   ❌ Не удалось установить права"
else
    echo "   ❌ Git не найден в стандартных местах"
fi

# 4. Устанавливаем права на базовые команды
echo ""
echo "📋 4. Установка прав на базовые команды:"
for cmd in ls pwd whoami echo; do
    if [ -f "/bin/$cmd" ]; then
        chmod +x "/bin/$cmd" 2>/dev/null && echo "   ✅ $cmd" || echo "   ❌ $cmd"
    elif [ -f "/usr/bin/$cmd" ]; then
        chmod +x "/usr/bin/$cmd" 2>/dev/null && echo "   ✅ $cmd" || echo "   ❌ $cmd"
    else
        echo "   ❌ $cmd не найден"
    fi
done

# 5. Устанавливаем права на текущую директорию
echo ""
echo "📋 5. Установка прав на текущую директорию:"
chmod 755 . 2>/dev/null && echo "   ✅ Права на директорию установлены" || echo "   ❌ Не удалось установить права"

# 6. Устанавливаем права на скрипты
echo ""
echo "📋 6. Установка прав на скрипты:"
chmod +x setup-git-workflow.sh 2>/dev/null && echo "   ✅ setup-git-workflow.sh" || echo "   ❌ setup-git-workflow.sh"
chmod +x fix-terminal.sh 2>/dev/null && echo "   ✅ fix-terminal.sh" || echo "   ❌ fix-terminal.sh"
chmod +x terminal-diagnostic.sh 2>/dev/null && echo "   ✅ terminal-diagnostic.sh" || echo "   ❌ terminal-diagnostic.sh"

# 7. Проверяем переменные окружения
echo ""
echo "📋 7. Переменные окружения:"
echo "   PATH: $PATH"
echo "   SHELL: $SHELL"
echo "   HOME: $HOME"

# 8. Устанавливаем правильный PATH
echo ""
echo "📋 8. Установка PATH:"
export PATH="/usr/bin:/usr/local/bin:/bin:/sbin:$PATH"
echo "   Новый PATH: $PATH"

# 9. Тестируем команды
echo ""
echo "📋 9. Тест команд:"
echo "   echo test: $(echo 'test' 2>/dev/null || echo 'ОШИБКА')"
echo "   pwd: $(pwd 2>/dev/null || echo 'ОШИБКА')"
echo "   whoami: $(whoami 2>/dev/null || echo 'ОШИБКА')"
echo "   git --version: $(git --version 2>/dev/null || echo 'ОШИБКА')"

echo ""
echo "✅ Исправление прав доступа завершено"
echo ""
echo "📋 Если проблемы остались, попробуйте:"
echo "1. Перезапустить терминал"
echo "2. Выполнить: source ~/.bashrc"
echo "3. Проверить права пользователя: sudo usermod -aG sudo $USER" 