#!/bin/bash

# 🚀 Настройка Git Workflow
# Схема: feature → develop → staging → main

echo "🔄 Настройка Git Workflow..."

# Проверяем текущее состояние
echo "📋 Текущие ветки:"
git branch -a

echo ""
echo "📋 Текущая ветка:"
git branch --show-current

# 1. Создаем ветку staging (если не существует)
echo ""
echo "📋 Шаг 1: Создание ветки staging..."
if ! git branch | grep -q "staging"; then
    echo "Создаем ветку staging..."
    git checkout develop
    git checkout -b staging
    git push origin staging
    echo "✅ Ветка staging создана"
else
    echo "✅ Ветка staging уже существует"
fi

# 2. Переключаемся на develop для дальнейшей работы
echo ""
echo "📋 Шаг 2: Переключение на develop..."
git checkout develop
echo "✅ Текущая ветка: develop"

# 3. Создаем пример feature ветки
echo ""
echo "📋 Шаг 3: Создание примера feature ветки..."
git checkout -b feature/example-feature
echo "✅ Создана ветка feature/example-feature"

# 4. Показываем финальную структуру
echo ""
echo "📋 Шаг 4: Финальная структура веток:"
git branch -a

echo ""
echo "🎯 Целевая схема workflow:"
echo "main (production) ← merge после успешного staging"
echo "  ↑"
echo "staging ← merge из develop после готовности фичи"
echo "  ↑"
echo "develop ← ежедневная разработка"
echo "  ↑"
echo "feature/название-фичи ← разработка конкретных фич"

echo ""
echo "📋 Следующие шаги:"
echo "1. Разрабатывайте в feature ветках"
echo "2. Merge feature → develop через Pull Request"
echo "3. Merge develop → staging для тестирования"
echo "4. Merge staging → main для production"

echo ""
echo "✅ Git Workflow настроен!" 