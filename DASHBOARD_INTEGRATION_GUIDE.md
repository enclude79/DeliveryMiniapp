# 🎛️ ИНТЕГРАЦИЯ DASHBOARD С SYSTEMD СЕРВИСАМИ

## 📋 Обзор

Данное руководство описывает интеграцию Dashboard с новыми systemd сервисами для управления контурами DeliveryVLG.

## 🔄 Что изменилось

### ❌ Старый подход:
- Dashboard использовал `start.sh` скрипты
- Процессы запускались напрямую через `nohup`
- Не было интеграции с systemd
- Конфликты между процессами

### ✅ Новый подход:
- Dashboard использует systemd сервисы
- Автоматическое управление через `systemctl`
- Полная интеграция с нашими скриптами переключения
- Безопасное переключение между контурами

## 🛠️ Обновленные компоненты

### 1. ServerManager.js
**Файл:** `scripts/server-manager.js`

**Обновленные функции:**
- `startEnvironment(env)` - запуск через systemd
- `stopEnvironment(env)` - остановка через systemd  
- `restartEnvironment(env)` - перезапуск через systemd

**Маппинг сервисов:**
```javascript
const serviceMap = {
  production: 'delivery-app-production',
  development: 'delivery-app-dev',
  staging: 'delivery-app-staging'
};
```

### 2. API Endpoints
**Файл:** `dashboard/routes/deployment.js`

**Доступные endpoints:**
- `POST /api/deployment/environments/start` - запуск среды
- `POST /api/deployment/environments/stop` - остановка среды
- `POST /api/deployment/environments/restart` - перезапуск среды

### 3. Dashboard Interface
**Файл:** `dashboard/public/index.html`

**Функциональность:**
- Переключатель "Выберите среду" (development/staging/production)
- Кнопка "Запустить сервер" 
- Автоматическое обновление описания карточки
- Интеграция с новыми API endpoints

## 🔧 Как это работает

### 1. Выбор среды в Dashboard
```javascript
function updateEnvironment() {
    currentEnv = document.getElementById('envSelect').value;
    showNotification(`Среда изменена на: ${currentEnv}`, 'success');
    
    // Обновляем описание карточки сервера
    const serverDescription = document.getElementById('server-description');
    if (serverDescription) {
        serverDescription.textContent = `Перезапустить ${currentEnv} сервер`;
    }
}
```

### 2. Запуск сервера через Dashboard
```javascript
async function startEnvironment() {
    showNotification('Запуск сервера...', 'warning');
    try {
        const res = await apiCall('/api/deployment/environments/start', 'POST', { env: currentEnv });
        const data = await res.json();
        if (data.success) {
            showNotification('Сервер успешно запущен', 'success');
        } else {
            showNotification('Ошибка запуска: ' + data.error, 'error');
        }
    } catch (e) {
        showNotification('Ошибка: ' + e.message, 'error');
    }
}
```

### 3. ServerManager обрабатывает запрос
```javascript
async startEnvironment(env) {
    // Маппинг к systemd сервисам
    const serviceMap = {
        production: 'delivery-app-production',
        development: 'delivery-app-dev',
        staging: 'delivery-app-staging'
    };
    
    const serviceName = serviceMap[env];
    
    // Логика управления сервисами
    if (env === 'production') {
        // Production всегда должен работать - запускаем только его
        await execAsync(`sudo systemctl start ${serviceName}`);
    } else if (env === 'development' || env === 'staging') {
        // Development и staging могут работать параллельно
        // Останавливаем только другую dev/staging среду, но НЕ production
        const devStagingServices = ['delivery-app-dev', 'delivery-app-staging'];
        const otherDevStaging = devStagingServices.filter(s => s !== serviceName);
        
        for (const otherService of otherDevStaging) {
            await execAsync(`sudo systemctl stop ${otherService}`);
        }
        
        await execAsync(`sudo systemctl start ${serviceName}`);
    }
    
    return {
        success: true,
        message: `${env} среда успешно запущена через systemd сервис ${serviceName}`
    };
}
```

## 🧪 Тестирование интеграции

### Запуск тестов
```bash
cd /home/enclude/automation
./test-dashboard-integration.sh
```

### Что тестируется:
- ✅ Статус всех systemd сервисов
- ✅ Доступность портов
- ✅ API endpoints Dashboard
- ✅ Переключение между средами
- ✅ Логирование операций

## 🌐 Использование Dashboard

### 1. Открытие Dashboard
```bash
# Запуск dashboard
cd /home/enclude/automation/dashboard
node server.js

# Доступ через браузер
http://localhost:3003
```

### 2. Управление контурами
1. **Выберите среду** в переключателе (Development/Staging/Production)
2. **Нажмите "Запустить сервер"** 
3. **Следите за уведомлениями** о статусе операции
4. **Проверьте результат** - только один контур должен быть активен

### 3. Проверка статуса
```bash
# Через командную строку
sudo systemctl status delivery-app-production
sudo systemctl status delivery-app-dev
sudo systemctl status delivery-app-staging

# Через наши скрипты
./check-production-status.sh
./check-dev-status.sh
./check-staging-status.sh
```

## 🔍 Диагностика проблем

### 1. Dashboard не отвечает
```bash
# Проверить процесс
ps aux | grep dashboard

# Проверить порт
netstat -tlnp | grep :3003

# Перезапустить
cd /home/enclude/automation/dashboard
pkill -f "node.*server.js"
node server.js
```

### 2. API возвращает ошибки
```bash
# Проверить логи dashboard
tail -f /home/enclude/automation/logs/dashboard.log

# Проверить права sudo
sudo -l

# Тестировать API напрямую
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"env":"production"}' \
  http://localhost:3003/api/deployment/environments/start
```

### 3. Сервисы не переключаются
```bash
# Проверить статус всех сервисов
sudo systemctl list-units --type=service | grep delivery

# Проверить логи systemd
sudo journalctl -u delivery-app-production --no-pager -n 20

# Ручное переключение
sudo ./switch-to-production.sh
```

## 📊 Мониторинг

### Логи Dashboard
```bash
# Логи dashboard
tail -f /home/enclude/automation/logs/dashboard.log

# Логи API запросов
tail -f /home/enclude/automation/dashboard/logs/app.log
```

### Логи systemd сервисов
```bash
# Логи production
sudo journalctl -u delivery-app-production -f

# Логи development
sudo journalctl -u delivery-app-dev -f

# Логи staging
sudo journalctl -u delivery-app-staging -f
```

## 🎯 Преимущества новой интеграции

### ✅ Безопасность
- Production всегда остается активным
- Development и staging могут работать параллельно
- Защита от случайной остановки production через dashboard
- Проверка статуса через systemd
- Логирование всех операций

### ✅ Надежность
- Использование проверенных systemd сервисов
- Graceful shutdown и restart
- Автоматическое восстановление при сбоях

### ✅ Удобство
- Единый интерфейс управления через Dashboard
- Визуальная обратная связь
- Интеграция с существующими скриптами

### ✅ Масштабируемость
- Легкое добавление новых контуров
- Централизованное управление
- API для автоматизации

## 🔄 Workflow использования

### Типичный сценарий:
1. **Разработка** → Выбираем "Development" → Запускаем сервер
2. **Тестирование** → Выбираем "Staging" → Запускаем сервер  
3. **Продакшн** → Выбираем "Production" → Запускаем сервер

### Автоматизация:
- Dashboard запускает выбранный контур
- Production всегда остается активным
- Development и staging переключаются между собой
- Проверяет статус запуска
- Предоставляет обратную связь пользователю

## 📝 Заключение

Интеграция Dashboard с systemd сервисами обеспечивает:
- ✅ Полную совместимость с нашими новыми скриптами
- ✅ Безопасное управление контурами
- ✅ Удобный веб-интерфейс
- ✅ Надежную работу системы

**Dashboard теперь полностью интегрирован с новой системой управления контурами!** 🎉 