# 🚀 DeliveryVLG - Система двух контуров (Dev/Prod)

## 📋 Обзор системы

Система **DeliveryVLG** теперь работает с двумя изолированными контурами:
- **ПРОДАКШН** (порт 3000/3443) - рабочее приложение для пользователей
- **РАЗРАБОТКА** (порт 3001/3444) - тестовая среда для разработки

### 🏗️ Архитектура

```
┌─────────────────┐    ┌─────────────────┐
│   ПРОДАКШН      │    │   РАЗРАБОТКА    │
│   PORT: 3000    │    │   PORT: 3001    │
│   HTTPS: 3443   │    │   HTTPS: 3444   │
│   DB: delivery  │    │   DB: delivery-dev│
│   ENV: production│    │   ENV: development│
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌─────────────┐
              │  Git Repo   │
              │  main ←→ dev│
              └─────────────┘
```

## 🔄 Workflow разработки

### 1. **Ежедневная разработка**
```bash
# Переключиться на dev окружение
./scripts/switch-env.sh development

# Внести изменения в коде
# Тестировать на dev сервере (localhost:3001)

# Запустить автотесты
npm test

# Если все ОК - подготовить к деплою
./scripts/deploy-dev.sh
```

### 2. **Перенос в продакшн**
```bash
# Убедиться что dev тесты прошли
./scripts/check-both.sh

# Переключиться на main ветку
git checkout main
git merge develop

# Деплой в продакшн с тестами
./scripts/deploy-prod.sh
```

### 3. **Экстренный откат**
```bash
# Быстрый откат к предыдущей версии
git checkout main
git reset --hard HEAD~1
sudo systemctl restart delivery-app
```

## 📂 Структура файлов

```
delivery-app/
├── 🔧 Конфигурация
│   ├── .env              # Продакшн настройки
│   ├── .env.dev          # Dev настройки
│   └── package.json      # Зависимости и скрипты
├── 🚀 Основное приложение
│   ├── server.js         # Сервер с поддержкой окружений
│   ├── database.js       # БД логика (разные файлы)
│   └── public/           # Статические файлы
├── 🧪 Тестирование
│   ├── test/
│   │   ├── basic-tests.js    # API тесты
│   │   └── security-tests.js # Безопасность
├── 📜 Скрипты управления
│   └── scripts/
│       ├── check-both.sh     # Проверка серверов
│       ├── deploy-dev.sh     # Деплой dev
│       ├── deploy-prod.sh    # Деплой продакшн
│       └── switch-env.sh     # Переключение окружений
└── 📚 Документация
    ├── README-DevProd-Workflow.md  # Этот файл
    ├── scripts-reference.md        # Справка по скриптам
    └── troubleshooting.md          # Решение проблем
```

## 🎯 Основные команды

### Проверка статуса
```bash
# Статус обоих контуров
./scripts/check-both.sh

# Статус systemd сервисов
sudo systemctl status delivery-app        # Продакшн
sudo systemctl status delivery-app-dev    # Dev
```

### Управление сервисами
```bash
# Перезапуск сервисов
sudo systemctl restart delivery-app       # Продакшн
sudo systemctl restart delivery-app-dev   # Dev

# Просмотр логов
sudo journalctl -fu delivery-app          # Продакшн логи
sudo journalctl -fu delivery-app-dev      # Dev логи
```

### Тестирование
```bash
# Автотесты для dev
NODE_ENV=development npm test

# Автотесты для продакшн
NODE_ENV=production npm test

# Тесты безопасности
npm run test:security
```

## 🌿 Git стратегия

### Ветки
- **`main`** - продакшн версия (защищенная)
- **`develop`** - dev версия (активная разработка)

### Процесс
1. Разработка в `develop`
2. Тестирование на dev контуре
3. Merge в `main` только после тестов
4. Автоматический деплой в продакшн

### Примеры команд
```bash
# Создание feature
git checkout develop
git checkout -b feature/new-function
# ... разработка ...
git checkout develop
git merge feature/new-function

# Перенос в продакшн
git checkout main
git merge develop --no-ff
git push origin main
```

## 🔒 Безопасность

### Разделение окружений
- ✅ Разные базы данных
- ✅ Разные порты
- ✅ Разные конфигурации
- ✅ Изоляция процессов

### Права доступа
- **Продакшн**: только admin пользователи
- **Dev**: разработчики + тестировщики
- **Скрипты деплоя**: требуют подтверждения

### Резервное копирование
```bash
# Создание backup продакшна (автоматически)
./scripts/deploy-prod.sh  # создает backup перед деплоем

# Ручное создание backup
tar -czf "delivery-backup-$(date +%Y%m%d-%H%M).tar.gz" \
    --exclude="node_modules" \
    --exclude="*.log" \
    /home/enclude/delivery-app
```

## 📊 Мониторинг

### Ключевые метрики
- Uptime серверов
- Время ответа API
- Ошибки в логах
- Использование памяти

### Алерты
```bash
# Проверка health check
curl -s http://localhost:3000/health || echo "PROD DOWN!"
curl -s http://localhost:3001/health || echo "DEV DOWN!"
```

## 🆘 Быстрое решение проблем

### Проблема: Сервер не отвечает
```bash
./scripts/check-both.sh
sudo systemctl restart delivery-app
```

### Проблема: Конфликт портов
```bash
# Найти процесс на порту
sudo lsof -i :3000
# Убить процесс
sudo kill -9 PID
```

### Проблема: Ошибки в тестах
```bash
# Очистить кэш и переустановить
npm cache clean --force
rm -rf node_modules
npm install
```

### Проблема: БД не отвечает
```bash
# Проверить файлы БД
ls -la *.db
# Восстановить права
chmod 664 delivery*.db
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте статус командой `./scripts/check-both.sh`
2. Посмотрите логи: `sudo journalctl -fu delivery-app`
3. Запустите тесты: `npm test`
4. Обратитесь к документации в папке `docs/`

---
*Документация обновлена: $(date +"%Y-%m-%d %H:%M")*
*Версия системы: 2.0 (Dual Environment)* 