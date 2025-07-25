# 🚀 Настройка Git Workflow

## 📋 Целевая схема

```
main (production) ← merge после успешного staging
  ↑
staging ← merge из develop после готовности фичи  
  ↑
develop ← ежедневная разработка
  ↑
feature/название-фичи ← разработка конкретных фич
```

## 🎯 Что нужно сделать

### 1. Создать staging ветку

Выполните скрипт для настройки:
```bash
chmod +x setup-git-workflow.sh
./setup-git-workflow.sh
```

Или вручную:
```bash
# Переключаемся на develop
git checkout develop

# Создаем staging ветку
git checkout -b staging

# Пушим staging ветку
git push origin staging
```

### 2. Настроить защиту веток в GitHub

В настройках репозитория GitHub:

1. **Settings → Branches → Add rule**
2. **Branch name pattern**: `main`
3. **Protect matching branches**:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1
   - ✅ Dismiss stale PR approvals when new commits are pushed
   - ✅ Require status checks to pass before merging

4. **Повторить для веток**:
   - `staging`
   - `develop`

### 3. Обновить Dashboard

Добавить новые маршруты в `server.js`:

```javascript
// Git Workflow routes
const gitWorkflowRoutes = require('./dashboard/routes/git-workflow');
app.use('/api/git-workflow', gitWorkflowRoutes);

// Git Workflow page
app.get('/git-workflow', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard/public/git-workflow.html'));
});
```

## 🔄 Полный Workflow разработки

### Шаг 1: Создание Feature ветки
```bash
# Переключаемся на develop
git checkout develop
git pull origin develop

# Создаем feature ветку
git checkout -b feature/название-фичи

# Разрабатываем и коммитим
git add .
git commit -m "feat: описание фичи"
git push origin feature/название-фичи
```

### Шаг 2: Merge Feature → Develop
```bash
# Создаем Pull Request в GitHub
# feature/название-фичи → develop

# После одобрения и merge
git checkout develop
git pull origin develop
```

### Шаг 3: Merge Develop → Staging
```bash
# Переключаемся на staging
git checkout staging
git pull origin staging

# Merge develop в staging
git merge develop --no-ff -m "Merge develop into staging for testing"

# Пушим изменения
git push origin staging
```

### Шаг 4: Тестирование в Staging
- Проверяем работу в staging окружении
- Запускаем тесты
- Проверяем интеграцию

### Шаг 5: Merge Staging → Main (Production)
```bash
# Переключаемся на main
git checkout main
git pull origin main

# Merge staging в main
git merge staging --no-ff -m "Deploy to production"

# Пушим в production
git push origin main
```

## 🛠️ Использование Dashboard

### Доступ к Git Workflow Dashboard
```
http://your-server:3000/git-workflow
```

### Доступные операции:

1. **🎯 Создать Feature Ветку**
   - Введите название фичи
   - Нажмите "Создать Feature Ветку"

2. **🔄 Merge Feature → Develop**
   - Введите название фичи
   - Нажмите "Merge в Develop"

3. **🧪 Тестировать в Staging**
   - Нажмите "Merge Develop → Staging"

4. **🚀 Деплой в Production**
   - Нажмите "Merge Staging → Production"

5. **⚙️ Настройка Staging**
   - Создает staging ветку если не существует

## 📊 Мониторинг статуса

Dashboard показывает:
- **Текущая ветка**: на какой ветке находитесь
- **Staging ветка**: существует ли staging ветка
- **Feature ветки**: количество активных feature веток
- **Статус**: готов ли workflow к использованию

## 🔧 Автоматизация

### Скрипты для автоматизации:

1. **`setup-git-workflow.sh`** - Настройка workflow
2. **`scripts/git-workflow-manager.js`** - JavaScript API для управления
3. **`dashboard/routes/git-workflow.js`** - API маршруты
4. **`dashboard/public/git-workflow.html`** - Web интерфейс

### Интеграция с CI/CD:

Можно добавить автоматические проверки:
- Тесты при merge в develop
- Автоматический деплой в staging
- Уведомления о статусе

## 🛡️ Безопасность

### Защита веток:
- `main` - только через Pull Request с одобрением
- `staging` - только через Pull Request
- `develop` - только через Pull Request

### Проверки перед merge:
- Успешность тестов
- Code review
- Проверка конфликтов

## 📝 Лучшие практики

1. **Названия feature веток**: `feature/краткое-описание`
2. **Коммиты**: используйте conventional commits
3. **Pull Requests**: подробное описание изменений
4. **Тестирование**: всегда тестируйте в staging перед production
5. **Откат**: будьте готовы к быстрому откату изменений

## 🚨 Troubleshooting

### Проблема: Не удается создать staging ветку
```bash
# Проверьте права доступа
git status
git remote -v

# Попробуйте создать локально
git checkout develop
git checkout -b staging
git push origin staging
```

### Проблема: Конфликты при merge
```bash
# Разрешите конфликты
git status
# Отредактируйте конфликтующие файлы
git add .
git commit -m "Resolve merge conflicts"
```

### Проблема: Dashboard не отвечает
```bash
# Проверьте логи сервера
tail -f logs/app.log

# Перезапустите сервер
./start-dashboard.sh
```

## ✅ Чек-лист настройки

- [ ] Создана staging ветка
- [ ] Настроена защита веток в GitHub
- [ ] Обновлен Dashboard с новыми маршрутами
- [ ] Протестирован workflow
- [ ] Документирован процесс для команды
- [ ] Настроены уведомления

## 🎉 Результат

После настройки у вас будет:
- ✅ Правильная структура веток
- ✅ Безопасный процесс разработки
- ✅ Автоматизированное управление через Dashboard
- ✅ Промежуточное тестирование в staging
- ✅ Контролируемый деплой в production 