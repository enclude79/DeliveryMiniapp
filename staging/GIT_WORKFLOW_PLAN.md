# 🚀 ПЛАН РЕАЛИЗАЦИИ GIT WORKFLOW
# Трансляция фичей: Development → Staging → Production

## 📋 ТЕКУЩЕЕ СОСТОЯНИЕ

### ✅ Что работает:
- 3 контура: Development, Staging, Production
- Отдельные БД для каждого контура
- Dashboard для управления
- Система бэкапов

### ❌ Что нужно исправить:
- Отсутствует ветка `develop`
- Неправильная логика слияния
- Нет промежуточного тестирования в staging
- Несогласованность путей в коде

## 🎯 ЦЕЛЕВОЙ WORKFLOW

```
💡 Feature → 🔧 Development → 🧪 Staging → 🏭 Production
    ↓              ↓              ↓            ↓
feature/*      develop        staging      main
```

### **Этап 1: Настройка Git веток**

```bash
# 1. Создание ветки develop
git checkout -b develop
git push origin develop

# 2. Создание ветки staging (опционально)
git checkout -b staging
git push origin staging

# 3. Настройка защиты веток в GitHub
# main - только через Pull Request
# develop - только через Pull Request  
# staging - только через Pull Request
```

### **Этап 2: Обновление Dashboard**

#### **Новые кнопки в Dashboard:**

1. **🔄 "Синхронизировать Development"**
   - Получает изменения из `develop` ветки
   - Обновляет контур Development
   - Запускает тесты

2. **🧪 "Тестировать в Staging"**
   - Копирует состояние из Production в Staging
   - Применяет изменения из `develop`
   - Генерирует SQL миграции
   - Запускает интеграционные тесты

3. **🚀 "Деплой в Production"**
   - Создает полный бэкап Production
   - Выполняет merge `develop → main`
   - Применяет миграции
   - Перезапускает сервер

### **Этап 3: Обновление кода**

#### **1. Git Manager (scripts/git-manager.js)**
```javascript
class GitManager {
  // Проверка существования веток
  async branchExists(branchName) {
    try {
      const { stdout } = await execAsync(`git branch -r | grep origin/${branchName}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  // Синхронизация Development
  async syncDevelopment() {
    // 1. Проверяем существование develop
    if (!await this.branchExists('develop')) {
      throw new Error('Ветка develop не существует');
    }
    
    // 2. Переключаемся на develop
    await execAsync('git checkout develop');
    await execAsync('git pull origin develop');
    
    // 3. Обновляем контур Development
    // ... копирование файлов в development/
  }

  // Тестирование в Staging
  async testInStaging() {
    // 1. Копируем Production в Staging
    await this.copyProductionToStaging();
    
    // 2. Применяем изменения из develop
    await execAsync('git checkout develop');
    
    // 3. Генерируем миграции
    const migrations = await this.generateMigrations();
    
    // 4. Запускаем тесты
    const testResult = await this.runStagingTests();
    
    return { success: testResult.success, migrations };
  }

  // Деплой в Production
  async deployToProduction() {
    // 1. Создаем бэкап
    const backup = await this.createProductionBackup();
    
    // 2. Merge develop → main
    await execAsync('git checkout main');
    await execAsync('git merge develop --no-ff -m "Deploy to production"');
    await execAsync('git push origin main');
    
    // 3. Применяем миграции
    await this.applyMigrations();
    
    // 4. Перезапускаем сервер
    await this.restartProductionServer();
    
    return { success: true, backupPath: backup.path };
  }
}
```

#### **2. Dashboard Routes (dashboard/routes/deployment.js)**
```javascript
// Новые endpoints
router.post('/sync-development', async (req, res) => {
  const result = await orchestrator.syncDevelopment();
  res.json(result);
});

router.post('/test-staging', async (req, res) => {
  const result = await orchestrator.testInStaging();
  res.json(result);
});

router.post('/deploy-production', async (req, res) => {
  const result = await orchestrator.deployToProduction();
  res.json(result);
});
```

#### **3. Dashboard UI (dashboard/public/index.html)**
```html
<!-- Новые карточки -->
<div class="card" data-type="sync-dev">
  <div class="card-icon">🔄</div>
  <div class="card-title">Синхронизировать Development</div>
  <div class="card-description">Получить изменения из develop ветки</div>
  <div class="card-actions">
    <button class="btn-execute" onclick="syncDevelopment()">Выполнить</button>
  </div>
</div>

<div class="card" data-type="test-staging">
  <div class="card-icon">🧪</div>
  <div class="card-title">Тестировать в Staging</div>
  <div class="card-description">Применить изменения в staging и протестировать</div>
  <div class="card-actions">
    <button class="btn-execute" onclick="testInStaging()">Выполнить</button>
  </div>
</div>

<div class="card" data-type="deploy-prod">
  <div class="card-icon">🚀</div>
  <div class="card-title">Деплой в Production</div>
  <div class="card-description">Безопасный деплой в продакшн</div>
  <div class="card-actions">
    <button class="btn-execute" onclick="deployToProduction()">Выполнить</button>
  </div>
</div>
```

## 🔄 ПОЛНЫЙ WORKFLOW РАЗРАБОТКИ

### **1. Разработка новой функции**
```bash
# Создание feature ветки
git checkout develop
git checkout -b feature/new-function

# Разработка и тестирование
# ... работа над функцией ...

# Коммит и пуш
git add .
git commit -m "feat: новая функция"
git push origin feature/new-function

# Merge в develop через Pull Request
git checkout develop
git merge feature/new-function
git push origin develop
```

### **2. Синхронизация Development**
```bash
# Через Dashboard или CLI
./scripts/sync-development.sh
# Или кнопка "Синхронизировать Development"
```

### **3. Тестирование в Staging**
```bash
# Через Dashboard или CLI  
./scripts/test-staging.sh
# Или кнопка "Тестировать в Staging"
```

### **4. Деплой в Production**
```bash
# Через Dashboard или CLI
./scripts/deploy-production.sh
# Или кнопка "Деплой в Production"
```

## 🛡️ БЕЗОПАСНОСТЬ И ОТКАТ

### **Автоматические проверки:**
- ✅ Существование веток
- ✅ Успешность тестов
- ✅ Целостность БД
- ✅ Health check серверов

### **Процедуры отката:**
- 🔄 Откат к предыдущему коммиту
- 💾 Восстановление из бэкапа
- 🗄️ Откат миграций БД
- 🔧 Перезапуск серверов

## 📊 МОНИТОРИНГ И ЛОГИРОВАНИЕ

### **Логирование каждого этапа:**
- Git операции
- Тесты и их результаты
- Миграции БД
- Перезапуски серверов
- Ошибки и откаты

### **Уведомления:**
- Успешные операции
- Ошибки и предупреждения
- Требуемые действия
- Статус каждого контура

## 🎯 ПРЕИМУЩЕСТВА НОВОГО WORKFLOW

✅ **Безопасность**: Поэтапное тестирование
✅ **Надежность**: Автоматические бэкапы и откаты
✅ **Прозрачность**: Полное логирование операций
✅ **Гибкость**: Возможность отката на любом этапе
✅ **Автоматизация**: Минимум ручных операций
✅ **Мониторинг**: Контроль каждого этапа

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. **Создать ветку develop**
2. **Обновить Git Manager**
3. **Добавить новые кнопки в Dashboard**
4. **Протестировать workflow**
5. **Документировать процесс** 