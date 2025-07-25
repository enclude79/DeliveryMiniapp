# 🚀 Руководство по развертыванию DeliveryMiniapp

## Обзор системы

Система автоматизации развертывания DeliveryMiniapp предоставляет полный цикл управления развертыванием с высочайшим уровнем надежности и процедурами отката.

### Архитектура

```
/home/enclude/
├── delivery-app/                    # Основное приложение
│   ├── delivery.db                 # Продакшн БД
│   ├── delivery-dev.db             # Dev БД
│   └── backup/                     # Автоматические бэкапы
└── automation/                     # Система автоматизации
    ├── dashboard/                  # Веб-интерфейс
    ├── scripts/                    # Скрипты автоматизации
    ├── jenkins/                    # Jenkins конфигурация
    └── logs/                       # Логи операций
```

## Быстрый старт

### 1. Запуск системы

```bash
# Переходим в папку автоматизации
cd /home/enclude/automation

# Запускаем систему
./start-automation.sh start
```

### 2. Доступ к веб-интерфейсу

Откройте браузер и перейдите по адресу:
- **Dashboard**: http://localhost:3001
- **Основное приложение**: http://localhost:3000

### 3. Проверка статуса

```bash
./start-automation.sh status
```

## Этапы развертывания

### 1. Сравнить схемы БД
- Анализирует различия между `delivery.db` (prod) и `delivery-dev.db` (dev)
- Генерирует SQL миграции для синхронизации
- Проверяет целостность данных

### 2. Слияние веток
- Выполняет `git merge develop → main`
- Создает бэкап текущего состояния
- Обрабатывает конфликты слияния

### 3. Бэкап БД prod
- Создает резервную копию продакшн базы данных
- Проверяет целостность бэкапа
- Сохраняет с временной меткой

### 4. Применить миграции
- Выполняет SQL миграции к продакшн БД
- Проверяет целостность после миграций
- Создает бэкап перед изменениями

### 5. Запустить сервер
- Перезапускает сервис `delivery-app`
- Проверяет доступность приложения
- Выполняет health check

## Использование веб-интерфейса

### Основные функции

1. **Полное развертывание** - выполнение всех 5 этапов последовательно
2. **Отдельные этапы** - выполнение конкретного этапа
3. **Мониторинг логов** - просмотр операций в реальном времени
4. **Управление бэкапами** - просмотр и восстановление бэкапов

### Кнопки управления

- 🚀 **Выполнить полное развертывание** - запускает весь процесс
- **Выполнить** (на каждом этапе) - запускает отдельный этап
- **Очистить логи** - очищает журнал операций

## API Endpoints

### Развертывание

```bash
# Статус развертывания
GET /api/deployment/status

# Полное развертывание
POST /api/deployment/full

# Отдельный этап
POST /api/deployment/step/1

# Логи
GET /api/deployment/logs
DELETE /api/deployment/logs
```

### База данных

```bash
# Сравнение схем
GET /api/database/compare

# Создание бэкапа
POST /api/database/backup

# Список бэкапов
GET /api/database/backups

# Откат к бэкапу
POST /api/database/rollback
```

### Сервер

```bash
# Статус сервиса
GET /api/deployment/server/status

# Перезапуск сервиса
POST /api/deployment/server/restart

# Health check
GET /api/deployment/server/health

# Логи сервиса
GET /api/deployment/server/logs
```

## Процедуры отката

### Автоматический откат

При ошибке в любом этапе система автоматически:
1. Останавливает выполнение
2. Откатывает выполненные изменения
3. Восстанавливает предыдущее состояние
4. Логирует все операции

### Ручной откат

#### Откат базы данных

```bash
# Через API
curl -X POST http://localhost:3001/api/database/rollback \
  -H "Content-Type: application/json" \
  -d '{"backupPath": "/home/enclude/delivery-app/backup/delivery_20250117_143022.db"}'
```

#### Откат Git

```bash
# Через API
curl -X POST http://localhost:3001/api/deployment/rollback \
  -H "Content-Type: application/json" \
  -d '{"commitHash": "abc123..."}'
```

### Восстановление из бэкапа

1. Остановите сервис: `sudo systemctl stop delivery-app`
2. Восстановите БД: `cp backup/delivery_20250117_143022.db delivery.db`
3. Восстановите код: `git reset --hard <commit-hash>`
4. Запустите сервис: `sudo systemctl start delivery-app`

## Jenkins Integration

### Настройка Pipeline

1. Создайте новый Pipeline в Jenkins
2. Укажите репозиторий: `https://github.com/enclude79/DeliveryMiniapp.git`
3. Используйте Jenkinsfile из папки `jenkins/`

### Автоматические триггеры

- **Push в develop** - автоматический запуск тестов
- **Merge в main** - автоматическое развертывание в prod
- **Ручной запуск** - для экстренных развертываний

### Этапы Pipeline

1. **Checkout** - клонирование репозитория
2. **Install Dependencies** - установка npm пакетов
3. **Database Schema Check** - проверка схемы БД
4. **Run Tests** - выполнение тестов
5. **Security Scan** - проверка безопасности
6. **Build** - сборка приложения
7. **Deploy to Production** - развертывание
8. **Health Check** - проверка здоровья
9. **Post-Deployment Tests** - финальные тесты

## Мониторинг и логирование

### Логи системы

- **Dashboard**: `/home/enclude/automation/logs/dashboard.log`
- **Развертывание**: `/home/enclude/automation/logs/deployment.log`
- **Приложение**: `/home/enclude/delivery-app/server.log`
- **Системные**: `journalctl -u delivery-app`

### Мониторинг

```bash
# Статус системы
./start-automation.sh status

# Проверка здоровья
./start-automation.sh health

# Просмотр логов
./start-automation.sh logs
```

### Алерты

Система отправляет уведомления:
- ✅ Успешное развертывание
- ❌ Ошибки развертывания
- ⚠️ Предупреждения

## Безопасность

### Бэкапы

- Автоматические бэкапы перед каждым изменением
- Проверка целостности бэкапов
- Хранение истории бэкапов
- Возможность восстановления из любого бэкапа

### Доступ

- Веб-интерфейс доступен только локально
- API защищен CORS политиками
- Логирование всех операций
- Аудит изменений

### Git токен

Используется GitHub токен для аутентификации:
- Токен: `YOUR_GITHUB_TOKEN_HERE`
- Права: чтение/запись в репозиторий
- Автоматическое обновление при смене токена

## Устранение неполадок

### Частые проблемы

#### 1. Dashboard не запускается

```bash
# Проверьте зависимости
cd dashboard && npm install

# Проверьте порт
netstat -tlnp | grep :3001

# Проверьте логи
tail -f logs/dashboard.log
```

#### 2. Ошибки Git

```bash
# Проверьте токен
git remote -v

# Очистите кэш
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=3600'
```

#### 3. Проблемы с БД

```bash
# Проверьте целостность
sqlite3 delivery.db "PRAGMA integrity_check;"

# Восстановите из бэкапа
cp backup/delivery_*.db delivery.db
```

#### 4. Сервис не запускается

```bash
# Проверьте статус
sudo systemctl status delivery-app

# Перезапустите сервис
sudo systemctl restart delivery-app

# Проверьте логи
sudo journalctl -u delivery-app -f
```

### Диагностика

```bash
# Полная диагностика
./start-automation.sh health

# Проверка портов
netstat -tlnp | grep -E ':(3000|3001|3443)'

# Проверка процессов
ps aux | grep -E '(node|delivery-app)'

# Проверка диска
df -h /home/enclude/
```

## Обновление системы

### Обновление кода

```bash
# Остановите систему
./start-automation.sh stop

# Обновите код
cd /home/enclude/automation
git pull origin main

# Перезапустите систему
./start-automation.sh start
```

### Обновление зависимостей

```bash
cd dashboard
npm update
./start-automation.sh restart
```

### Обновление конфигурации

1. Отредактируйте файлы в папке `config/`
2. Перезапустите систему: `./start-automation.sh restart`

## Поддержка

### Логи и отчеты

- Все операции логируются в JSON формате
- Автоматическое создание отчетов
- Сохранение артефактов в Jenkins

### Контакты

- **Email**: automation@deliveryvlg.xyz
- **Telegram**: @DeliveryVLG_Support
- **GitHub**: https://github.com/enclude79/DeliveryMiniapp

### Документация

- **API Docs**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/health
- **Logs**: http://localhost:3001/api/logs

---

**⭐ Система автоматизации DeliveryMiniapp - надежное развертывание с высочайшим уровнем безопасности!** 