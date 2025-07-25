# 📚 Документация DeliveryVLG

## 🏗️ Система двух контуров (Dev/Prod)

### 📖 Основная документация
- **[README-DevProd-Workflow.md](dev-prod-system/README-DevProd-Workflow.md)** - Полное описание системы двух контуров
- **[scripts-reference.md](dev-prod-system/scripts-reference.md)** - Подробная документация всех скриптов
- **[step-by-step-guide.md](dev-prod-system/step-by-step-guide.md)** - Пошаговое руководство разработчика
- **[QUICK-REFERENCE.md](dev-prod-system/QUICK-REFERENCE.md)** - Быстрая справка команд

### 🛠️ Руководства по настройке
- **[development-setup.md](setup-guides/development-setup.md)** - Основное руководство по настройке
- **[development-setup-simple.md](setup-guides/development-setup-simple.md)** - Упрощенная настройка
- **[development-setup-advanced.md](setup-guides/development-setup-advanced.md)** - Продвинутая настройка
- **[environments-comparison.md](setup-guides/environments-comparison.md)** - Сравнение вариантов
- **[implementation-guide.md](setup-guides/implementation-guide.md)** - Руководство по внедрению

## 🚀 Быстрый старт

### Для разработчиков
```bash
# Проверка системы
./scripts/check-both.sh

# Начало работы
git checkout develop
./scripts/switch-env.sh development

# Деплой в dev
./scripts/deploy-dev.sh
```

### Для администраторов
```bash
# Деплой в продакшн
git checkout main
./scripts/deploy-prod.sh

# Мониторинг
sudo journalctl -fu delivery-app
```

## 📂 Структура проекта

```
delivery-app/
├── 📚 docs/                          # Документация
│   ├── dev-prod-system/               # Система контуров
│   └── setup-guides/                  # Руководства настройки
├── 📜 scripts/                        # Скрипты управления
│   ├── check-both.sh                  # Проверка статуса
│   ├── deploy-dev.sh                  # Деплой dev
│   ├── deploy-prod.sh                 # Деплой продакшн
│   └── switch-env.sh                  # Переключение окружений
├── 🧪 test/                           # Автотесты
├── 🌐 public/                         # Статические файлы
├── 🔧 server.js                       # Основной сервер
├── 🗃️ database.js                     # База данных
├── ⚙️ .env                            # Продакшн конфиг
├── ⚙️ .env.dev                        # Dev конфиг
├── 🗄️ delivery.db                     # Продакшн БД
└── 🗄️ delivery-dev.db                 # Dev БД
```

## 🎯 Контуры системы

### 🏭 ПРОДАКШН
- **Порт**: 3000 (HTTP), 3443 (HTTPS)
- **База данных**: `delivery.db`
- **Сервис**: `delivery-app`
- **URL**: http://localhost:3000

### 🔧 РАЗРАБОТКА  
- **Порт**: 3001 (HTTP), 3444 (HTTPS)
- **База данных**: `delivery-dev.db`
- **Сервис**: `delivery-app-dev`
- **URL**: http://localhost:3001

## 🌿 Git Workflow

```
main (продакшн) ←── merge ←── develop (разработка)
                                ↑
                          feature/название
```

### Процесс разработки:
1. `feature/новая-функция` → `develop` → тестирование
2. `develop` → `main` → продакшн деплой
3. Автотесты на каждом этапе

## 🆘 Поддержка

### Проблемы с системой
1. Запустите диагностику: `./scripts/check-both.sh`
2. Проверьте логи: `sudo journalctl -fu delivery-app`
3. Обратитесь к [troubleshooting разделу](dev-prod-system/README-DevProd-Workflow.md#быстрое-решение-проблем)

### Вопросы по процессам
- **Ежедневная работа**: [step-by-step-guide.md](dev-prod-system/step-by-step-guide.md)
- **Команды**: [QUICK-REFERENCE.md](dev-prod-system/QUICK-REFERENCE.md)
- **Скрипты**: [scripts-reference.md](dev-prod-system/scripts-reference.md)

---
*Обновлено: $(date +"%Y-%m-%d %H:%M")*  
*Система: DeliveryVLG v2.0 (Dual Environment)* 