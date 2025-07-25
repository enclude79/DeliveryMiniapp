# 🏗️ Руководство по управлению средами DeliveryMiniapp

## 📁 Новая структура проекта

```
automation/
├── production/          # Продакшн среда (порт 3003)
├── development/         # Среда разработки (порт 3004)
├── staging/            # Staging среда (порт 3005)
├── jenkins/            # Jenkins конфигурации
├── logs/               # Общие логи
└── manage-environments.sh  # Главный скрипт управления
```

## 🗄️ Базы данных

Каждая среда имеет свою отдельную базу данных:

- **production**: `delivery_miniapp_production`
- **development**: `delivery_miniapp_development`
- **staging**: `delivery_miniapp_staging`

## 🚀 Управление средами

### Основные команды

```bash
# Запуск продакшн
./manage-environments.sh production start

# Запуск разработки
./manage-environments.sh development start

# Запуск staging
./manage-environments.sh staging start

# Проверка статуса
./manage-environments.sh production status

# Остановка среды
./manage-environments.sh production stop
```

### Прямой запуск

```bash
# Продакшн
cd production && ./start.sh

# Разработка
cd development && ./start.sh

# Staging
cd staging && ./start.sh
```

## 🌐 Доступ к приложениям

- **Продакшн**: http://89.169.182.9:3003
- **Разработка**: http://localhost:3004
- **Staging**: http://localhost:3005

## ⚙️ Конфигурация

Каждая среда имеет свой файл `config.js` с настройками:

- **Порт**: Уникальный для каждой среды
- **База данных**: Отдельная БД для каждой среды
- **Логирование**: Разные уровни логирования
- **CORS**: Настроен для соответствующих доменов

## 🔄 Рабочий процесс

### Разработка
1. Работайте в папке `development/`
2. Тестируйте изменения локально на порту 3004
3. Используйте отдельную БД для разработки

### Тестирование
1. Скопируйте код в `staging/`
2. Протестируйте на порту 3005
3. Проверьте интеграцию с staging БД

### Развертывание
1. Скопируйте протестированный код в `production/`
2. Запустите продакшн на порту 3003
3. Используйте продакшн БД

## 📝 Логи

Логи каждой среды сохраняются в соответствующих папках:
- `production/logs/production.log`
- `development/logs/development.log`
- `staging/logs/staging.log`

## 🔧 Устранение неполадок

### Проверка статуса всех сред
```bash
./manage-environments.sh production status
./manage-environments.sh development status
./manage-environments.sh staging status
```

### Остановка всех сред
```bash
./manage-environments.sh production stop
./manage-environments.sh development stop
./manage-environments.sh staging stop
```

### Проверка портов
```bash
netstat -tlnp | grep :300
```

## 🎯 Преимущества новой структуры

✅ **Изоляция**: Каждая среда работает независимо
✅ **Безопасность**: Отдельные БД предотвращают потерю данных
✅ **Гибкость**: Можно тестировать изменения без влияния на продакшн
✅ **Масштабируемость**: Легко добавлять новые среды
✅ **Отладка**: Четкое разделение логов и конфигураций 