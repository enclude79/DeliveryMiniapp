# ⚡ Быстрая справка - DeliveryVLG Dev/Prod

## 🚀 Ежедневные команды

```bash
# Проверка статуса
./scripts/check-both.sh

# Деплой в dev
./scripts/deploy-dev.sh

# Деплой в продакшн
./scripts/deploy-prod.sh

# Переключение окружений
./scripts/switch-env.sh development
./scripts/switch-env.sh production
```

## 🌿 Git workflow

```bash
# Начало работы
git checkout develop
git pull origin develop

# Новая функция
git checkout -b feature/название
# ... разработка ...
git add .
git commit -m "feat: описание"

# Слияние в develop
git checkout develop
git merge feature/название --no-ff
git push origin develop

# Деплой в продакшн
git checkout main
git merge develop --no-ff
./scripts/deploy-prod.sh
git push origin main
```

## 🔧 Управление сервисами

```bash
# Статус
sudo systemctl status delivery-app      # prod
sudo systemctl status delivery-app-dev  # dev

# Перезапуск
sudo systemctl restart delivery-app     # prod
sudo systemctl restart delivery-app-dev # dev

# Логи
sudo journalctl -fu delivery-app        # prod
sudo journalctl -fu delivery-app-dev    # dev
```

## 🧪 Тестирование

```bash
# Автотесты
NODE_ENV=development npm test  # dev
NODE_ENV=production npm test   # prod

# Безопасность
npm run test:security
```

## 🌐 URLs и порты

- **PROD**: http://localhost:3000 / https://localhost:3443
- **DEV**: http://localhost:3001 / https://localhost:3444

## 🆘 Экстренные команды

```bash
# Быстрый откат продакшна
git checkout main
git reset --hard HEAD~1
./scripts/deploy-prod.sh --force

# Перезапуск всего
sudo systemctl restart delivery-app*

# Проверка портов
sudo lsof -i :3000
sudo lsof -i :3001
```

## 📂 Важные файлы

- `.env` - продакшн конфиг
- `.env.dev` - dev конфиг  
- `delivery.db` - продакшн БД
- `delivery-dev.db` - dev БД

## 📞 Помощь

- **Полная документация**: `README-DevProd-Workflow.md`
- **Скрипты**: `scripts-reference.md`
- **Пошаговое руководство**: `step-by-step-guide.md` 