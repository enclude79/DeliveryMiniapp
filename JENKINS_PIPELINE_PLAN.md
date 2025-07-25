# 🚀 План разработки Jenkins Pipeline скриптов

## 📋 Анализ текущей инфраструктуры

### ✅ Что уже есть:
- **3 контура**: development, staging, production
- **Git workflow**: feature → develop → staging → main
- **SystemD сервисы**: для каждого контура
- **Базы данных**: отдельные для каждого контура
- **Существующие скрипты**: в папке `scripts/`
- **Jenkins**: базовая конфигурация в `jenkins/Jenkinsfile`

### 🎯 Требования к Jenkins Pipeline:

#### **1. Build Stage:**
- Клонирование репозитория
- Сборка приложения
- Запуск unit тестов

#### **2. Database Stage:**
- Применение миграций
- Проверка целостности БД

#### **3. Deploy Stage:**
- Остановка SystemD сервиса
- Обновление кода
- Запуск SystemD сервиса
- Health check

#### **4. Test Stage (для staging):**
- Интеграционные тесты
- Smoke тесты API

## 🗂️ Структура папки для скриптов

```
jenkins/
├── pipelines/
│   ├── development-pipeline.groovy
│   ├── staging-pipeline.groovy
│   ├── production-pipeline.groovy
│   └── shared-stages.groovy
├── scripts/
│   ├── build/
│   │   ├── build-app.sh
│   │   ├── run-tests.sh
│   │   └── install-dependencies.sh
│   ├── database/
│   │   ├── generate-migrations.sh
│   │   ├── apply-migrations.sh
│   │   ├── backup-database.sh
│   │   └── validate-schema.sh
│   ├── deployment/
│   │   ├── deploy-to-staging.sh
│   │   ├── deploy-to-production.sh
│   │   ├── blue-green-deploy.sh
│   │   └── rolling-deploy.sh
│   ├── systemd/
│   │   ├── manage-service.sh
│   │   ├── health-check.sh
│   │   └── service-monitor.sh
│   └── testing/
│       ├── integration-tests.sh
│       ├── smoke-tests.sh
│       └── api-tests.sh
├── config/
│   ├── environments.conf
│   ├── systemd-services.conf
│   └── database-config.conf
└── utils/
    ├── git-utils.sh
    ├── log-utils.sh
    └── notification-utils.sh
```

## 🔄 Workflow скриптов

### **1. Development Pipeline:**
```
feature/название → develop
├── Build Stage
├── Database Stage (создание миграций)
├── Deploy Stage (development)
└── Test Stage (unit тесты)
```

### **2. Staging Pipeline:**
```
develop → staging
├── Build Stage
├── Database Stage (копирование prod → staging + миграции)
├── Deploy Stage (staging)
└── Test Stage (интеграционные + smoke тесты)
```

### **3. Production Pipeline:**
```
staging → main
├── Build Stage
├── Database Stage (бэкап + миграции)
├── Deploy Stage (blue-green deployment)
└── Test Stage (health checks)
```

## 📝 Детальный план разработки

### **Этап 1: Создание структуры папок и базовых скриптов**

#### **1.1 Создать структуру папок:**
```bash
mkdir -p jenkins/pipelines
mkdir -p jenkins/scripts/{build,database,deployment,systemd,testing}
mkdir -p jenkins/config
mkdir -p jenkins/utils
```

#### **1.2 Базовые утилиты:**
- `jenkins/utils/git-utils.sh` - работа с Git
- `jenkins/utils/log-utils.sh` - логирование
- `jenkins/utils/notification-utils.sh` - уведомления

#### **1.3 Конфигурационные файлы:**
- `jenkins/config/environments.conf` - настройки окружений
- `jenkins/config/systemd-services.conf` - конфигурация сервисов
- `jenkins/config/database-config.conf` - настройки БД

### **Этап 2: Build Stage скрипты**

#### **2.1 jenkins/scripts/build/build-app.sh**
```bash
#!/bin/bash
# Сборка приложения
# - Установка зависимостей
# - Сборка (если нужно)
# - Проверка артефактов
```

#### **2.2 jenkins/scripts/build/run-tests.sh**
```bash
#!/bin/bash
# Запуск unit тестов
# - npm test
# - Проверка покрытия
# - Генерация отчетов
```

#### **2.3 jenkins/scripts/build/install-dependencies.sh**
```bash
#!/bin/bash
# Установка зависимостей
# - npm ci --production
# - Проверка версий
```

### **Этап 3: Database Stage скрипты**

#### **3.1 jenkins/scripts/database/generate-migrations.sh**
```bash
#!/bin/bash
# Генерация SQL миграций из development
# - Сравнение схем dev vs staging
# - Создание файлов миграций
# - Сохранение в /migrations/
```

#### **3.2 jenkins/scripts/database/apply-migrations.sh**
```bash
#!/bin/bash
# Применение миграций
# - Бэкап перед миграцией
# - Применение SQL файлов
# - Проверка целостности
```

#### **3.3 jenkins/scripts/database/backup-database.sh**
```bash
#!/bin/bash
# Создание бэкапа БД
# - Полный бэкап production
# - Копирование в staging
# - Валидация бэкапа
```

#### **3.4 jenkins/scripts/database/validate-schema.sh**
```bash
#!/bin/bash
# Валидация схемы БД
# - Проверка целостности
# - Сравнение с эталоном
# - Отчет о проблемах
```

### **Этап 4: Deployment Stage скрипты**

#### **4.1 jenkins/scripts/deployment/deploy-to-staging.sh**
```bash
#!/bin/bash
# Деплой в staging
# - Копирование кода из develop
# - Применение миграций
# - Перезапуск сервиса
```

#### **4.2 jenkins/scripts/deployment/deploy-to-production.sh**
```bash
#!/bin/bash
# Деплой в production
# - Blue-Green deployment
# - Бэкап БД
# - Применение миграций
# - Переключение трафика
```

#### **4.3 jenkins/scripts/deployment/blue-green-deploy.sh**
```bash
#!/bin/bash
# Blue-Green deployment
# - Развертывание в новой среде
# - Тестирование
# - Переключение трафика
# - Очистка старой среды
```

### **Этап 5: SystemD Stage скрипты**

#### **5.1 jenkins/scripts/systemd/manage-service.sh**
```bash
#!/bin/bash
# Управление SystemD сервисами
# - Остановка сервиса
# - Обновление кода
# - Запуск сервиса
# - Проверка статуса
```

#### **5.2 jenkins/scripts/systemd/health-check.sh**
```bash
#!/bin/bash
# Health check сервисов
# - Проверка HTTP endpoints
# - Проверка БД соединения
# - Проверка логов
```

#### **5.3 jenkins/scripts/systemd/service-monitor.sh**
```bash
#!/bin/bash
# Мониторинг сервисов
# - Проверка статуса
# - Автоматический restart
# - Логирование через journald
```

### **Этап 6: Testing Stage скрипты**

#### **6.1 jenkins/scripts/testing/integration-tests.sh**
```bash
#!/bin/bash
# Интеграционные тесты
# - Тестирование API
# - Тестирование БД
# - Тестирование внешних сервисов
```

#### **6.2 jenkins/scripts/testing/smoke-tests.sh**
```bash
#!/bin/bash
# Smoke тесты
# - Базовые HTTP запросы
# - Проверка основных функций
# - Быстрая валидация
```

#### **6.3 jenkins/scripts/testing/api-tests.sh**
```bash
#!/bin/bash
# API тесты
# - Тестирование всех endpoints
# - Проверка ответов
# - Валидация данных
```

### **Этап 7: Pipeline файлы**

#### **7.1 jenkins/pipelines/development-pipeline.groovy**
```groovy
pipeline {
    agent any
    stages {
        stage('Build') { /* ... */ }
        stage('Database') { /* ... */ }
        stage('Deploy') { /* ... */ }
        stage('Test') { /* ... */ }
    }
}
```

#### **7.2 jenkins/pipelines/staging-pipeline.groovy**
```groovy
pipeline {
    agent any
    stages {
        stage('Build') { /* ... */ }
        stage('Database') { /* ... */ }
        stage('Deploy') { /* ... */ }
        stage('Test') { /* ... */ }
    }
}
```

#### **7.3 jenkins/pipelines/production-pipeline.groovy**
```groovy
pipeline {
    agent any
    stages {
        stage('Build') { /* ... */ }
        stage('Database') { /* ... */ }
        stage('Deploy') { /* ... */ }
        stage('Test') { /* ... */ }
    }
}
```

## 🎯 Следующие шаги

### **1. Создать структуру папок**
### **2. Разработать базовые утилиты**
### **3. Создать конфигурационные файлы**
### **4. Разработать скрипты по этапам**
### **5. Создать Pipeline файлы**
### **6. Тестирование и отладка**

## 📊 Ожидаемый результат

✅ **Полностью автоматизированный CI/CD pipeline**
✅ **Безопасные деплои с бэкапами**
✅ **Blue-Green deployment для production**
✅ **Автоматическое тестирование**
✅ **Мониторинг и логирование**
✅ **Готовность к интеграции с Dashboard**

---
**Статус**: План готов к реализации
**Приоритет**: Высокий
**Сложность**: Средняя 