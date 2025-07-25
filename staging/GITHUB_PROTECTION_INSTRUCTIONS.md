# 🔒 Настройка защиты веток в GitHub

## ✅ Автоматическая настройка выполнена

Если автоматическая настройка не сработала, выполните вручную:

### 1. Откройте GitHub репозиторий:
https://github.com/enclude79/DeliveryMiniapp

### 2. Перейдите в Settings → Branches

### 3. Для каждой ветки (main, staging, develop):
1. Нажмите "Add rule"
2. Введите название ветки: `main` (или `staging`, `develop`)
3. Включите опции:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1
   - ✅ Dismiss stale PR approvals when new commits are pushed
   - ✅ Require status checks to pass before merging

### 4. Нажмите "Create" для каждой ветки

## 🎯 Результат:
- `main` - только через Pull Request с одобрением
- `staging` - только через Pull Request
- `develop` - только через Pull Request

## 🔗 Полезные ссылки:
- Dashboard: http://89.169.182.9:3003/git-workflow
- GitHub репозиторий: https://github.com/enclude79/DeliveryMiniapp
