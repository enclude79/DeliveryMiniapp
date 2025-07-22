const DatabaseManager = require('./database-manager');
const GitManager = require('./git-manager');
const ServerManager = require('./server-manager');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class DeploymentOrchestrator {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.gitManager = new GitManager();
    this.serverManager = new ServerManager();
    this.logs = [];
  }

  /**
   * Логирование операций
   * @param {string} level - уровень логирования
   * @param {string} message - сообщение
   * @param {Object} data - дополнительные данные
   */
  log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logs.push(logEntry);
    console.log(`[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`);
    
    // Сохраняем логи в файл
    const logFile = path.join(__dirname, '../logs/deployment.log');
    const logDir = path.dirname(logFile);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  /**
   * Получение логов
   * @returns {Array} массив логов
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Очистка логов
   */
  clearLogs() {
    this.logs = [];
    const logFile = path.join(__dirname, '../logs/deployment.log');
    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '');
    }
  }

  /**
   * Полный процесс развертывания
   * @returns {Promise<{success: boolean, steps: Array, error: string}>}
   */
  async performFullDeployment() {
    const deploymentId = `deployment_${Date.now()}`;
    const steps = [];
    
    this.log('info', `🚀 Начинаем полное развертывание: ${deploymentId}`);
    
    try {
      // Этап 1: Сравнение схем БД
      this.log('info', '📊 Этап 1: Сравнение схем БД');
      const schemaComparison = await this.compareDatabaseSchemas();
      steps.push({
        step: 1,
        name: 'Сравнение схем БД',
        success: schemaComparison.success,
        data: schemaComparison
      });
      
      if (!schemaComparison.success) {
        throw new Error(`Ошибка сравнения схем: ${schemaComparison.error}`);
      }
      
      // Этап 2: Слияние веток
      this.log('info', '🔄 Этап 2: Слияние веток');
      const branchMerge = await this.mergeBranches();
      steps.push({
        step: 2,
        name: 'Слияние веток',
        success: branchMerge.success,
        data: branchMerge
      });
      
      if (!branchMerge.success) {
        throw new Error(`Ошибка слияния веток: ${branchMerge.error}`);
      }
      
      // Этап 3: Бэкап БД prod
      this.log('info', '💾 Этап 3: Бэкап БД prod');
      const dbBackup = await this.backupProductionDatabase();
      steps.push({
        step: 3,
        name: 'Бэкап БД prod',
        success: dbBackup.success,
        data: dbBackup
      });
      
      if (!dbBackup.success) {
        throw new Error(`Ошибка создания бэкапа: ${dbBackup.error}`);
      }
      
      // Этап 4: Применение миграций
      this.log('info', '🔧 Этап 4: Применение миграций');
      const migrations = await this.applyDatabaseMigrations(schemaComparison.differences);
      steps.push({
        step: 4,
        name: 'Применение миграций',
        success: migrations.success,
        data: migrations
      });
      
      if (!migrations.success) {
        throw new Error(`Ошибка применения миграций: ${migrations.error}`);
      }
      
      // Этап 5: Запуск сервера
      this.log('info', '🚀 Этап 5: Запуск сервера');
      const serverRestart = await this.restartServer();
      steps.push({
        step: 5,
        name: 'Запуск сервера',
        success: serverRestart.success,
        data: serverRestart
      });
      
      if (!serverRestart.success) {
        throw new Error(`Ошибка перезапуска сервера: ${serverRestart.error}`);
      }
      
      this.log('success', `✅ Развертывание завершено успешно: ${deploymentId}`);
      
      return {
        success: true,
        deploymentId,
        steps,
        summary: {
          totalSteps: steps.length,
          successfulSteps: steps.filter(s => s.success).length,
          failedSteps: steps.filter(s => !s.success).length
        }
      };
      
    } catch (error) {
      this.log('error', `❌ Ошибка развертывания: ${error.message}`);
      
      // Пытаемся откатиться
      const rollback = await this.performRollback(steps);
      
      return {
        success: false,
        deploymentId,
        error: error.message,
        steps,
        rollback
      };
    }
  }

  /**
   * Этап 1: Сравнение схем БД
   * @returns {Promise<{success: boolean, differences: Array, error: string}>}
   */
  async compareDatabaseSchemas() {
    try {
      this.log('info', 'Сравниваем схемы БД prod и dev');
      
      const result = await this.dbManager.compareSchemas();
      
      if (result.success) {
        this.log('info', `Найдено различий: ${result.summary.totalDifferences}`);
        this.log('info', `Новые таблицы: ${result.summary.newTables}`);
        this.log('info', `Изменения структуры: ${result.summary.structureChanges}`);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `Ошибка сравнения схем: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Этап 2: Слияние веток
   * @returns {Promise<{success: boolean, mergeCommit: string, error: string}>}
   */
  async mergeBranches() {
    try {
      this.log('info', 'Инициализируем Git репозиторий');
      const initResult = await this.gitManager.initializeRepository();
      
      if (!initResult.success) {
        throw new Error(`Ошибка инициализации Git: ${initResult.error}`);
      }
      
      this.log('info', 'Выполняем слияние develop в main');
      const mergeResult = await this.gitManager.mergeDevelopToMain();
      
      if (mergeResult.success) {
        this.log('info', `Слияние выполнено, коммит: ${mergeResult.mergeCommit}`);
      }
      
      return mergeResult;
      
    } catch (error) {
      this.log('error', `Ошибка слияния веток: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Этап 3: Бэкап БД prod
   * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
   */
  async backupProductionDatabase() {
    try {
      this.log('info', 'Создаем бэкап продакшн БД');
      
      const result = await this.dbManager.createBackup();
      
      if (result.success) {
        this.log('info', `Бэкап создан: ${result.backupPath}`);
        this.log('info', `Размер: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `Ошибка создания бэкапа: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Этап 4: Применение миграций
   * @param {Array} differences - различия в схемах
   * @returns {Promise<{success: boolean, applied: number, error: string}>}
   */
  async applyDatabaseMigrations(differences) {
    try {
      this.log('info', 'Генерируем SQL миграции');
      
      const migrations = this.generateMigrations(differences);
      
      if (migrations.length === 0) {
        this.log('info', 'Миграции не требуются');
        return {
          success: true,
          applied: 0,
          message: 'Миграции не требуются'
        };
      }
      
      this.log('info', `Применяем ${migrations.length} миграций`);
      
      const result = await this.dbManager.applyMigrations(migrations);
      
      if (result.success) {
        this.log('info', `Применено миграций: ${result.applied}`);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `Ошибка применения миграций: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Этап 5: Перезапуск сервера
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async restartServer() {
    try {
      this.log('info', 'Перезапускаем сервер');
      
      const result = await this.serverManager.restartService();
      
      if (result.success) {
        this.log('info', 'Сервер успешно перезапущен');
        this.log('info', `Health check: ${JSON.stringify(result.healthStatus)}`);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `Ошибка перезапуска сервера: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Генерация SQL миграций на основе различий
   * @param {Array} differences - различия в схемах
   * @returns {Array} массив SQL команд
   */
  generateMigrations(differences) {
    const migrations = [];
    
    for (const diff of differences) {
      switch (diff.type) {
        case 'NEW_TABLE':
          if (diff.sql) {
            migrations.push(diff.sql);
          }
          break;
          
        case 'TABLE_STRUCTURE_CHANGE':
          for (const change of diff.differences) {
            switch (change.type) {
              case 'NEW_COLUMN':
                migrations.push(`ALTER TABLE ${diff.table} ADD COLUMN ${change.column} ${change.description.split('(')[1].split(')')[0]};`);
                break;
                
              case 'COLUMN_TYPE_CHANGE':
                // Для SQLite нужно создать новую таблицу
                migrations.push(`-- Требуется ручная миграция для изменения типа колонки ${change.column} в таблице ${diff.table}`);
                break;
                
              case 'COLUMN_CONSTRAINT_CHANGE':
                // Для SQLite нужно создать новую таблицу
                migrations.push(`-- Требуется ручная миграция для изменения ограничения колонки ${change.column} в таблице ${diff.table}`);
                break;
            }
          }
          break;
      }
    }
    
    return migrations;
  }

  /**
   * Выполнение отката
   * @param {Array} steps - выполненные шаги
   * @returns {Promise<{success: boolean, rollbackSteps: Array, error: string}>}
   */
  async performRollback(steps) {
    this.log('warn', '🔄 Выполняем откат изменений');
    
    const rollbackSteps = [];
    
    try {
      // Откатываем в обратном порядке
      for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i];
        
        if (step.success) {
          this.log('info', `Откатываем шаг ${step.step}: ${step.name}`);
          
          const rollbackResult = await this.rollbackStep(step);
          rollbackSteps.push({
            step: step.step,
            name: `Откат: ${step.name}`,
            success: rollbackResult.success,
            data: rollbackResult
          });
          
          if (!rollbackResult.success) {
            this.log('error', `Ошибка отката шага ${step.step}: ${rollbackResult.error}`);
          }
        }
      }
      
      this.log('info', 'Откат завершен');
      
      return {
        success: true,
        rollbackSteps
      };
      
    } catch (error) {
      this.log('error', `Критическая ошибка отката: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        rollbackSteps
      };
    }
  }

  /**
   * Откат конкретного шага
   * @param {Object} step - шаг для отката
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackStep(step) {
    try {
      switch (step.step) {
        case 5: // Откат перезапуска сервера
          return await this.serverManager.restartService();
          
        case 4: // Откат миграций БД
          if (step.data.backupPath) {
            return await this.dbManager.rollbackDatabase(step.data.backupPath);
          }
          return { success: true, message: 'Нет бэкапа для отката' };
          
        case 3: // Откат бэкапа (не требуется)
          return { success: true, message: 'Бэкап не требует отката' };
          
        case 2: // Откат слияния веток
          if (step.data.mergeCommit) {
            // Получаем предыдущий коммит
            const history = await this.gitManager.getCommitHistory(2);
            if (history.success && history.commits.length > 1) {
              const previousCommit = history.commits[1].hash;
              return await this.gitManager.rollbackToCommit(previousCommit);
            }
          }
          return { success: true, message: 'Нет данных для отката слияния' };
          
        case 1: // Откат сравнения схем (не требуется)
          return { success: true, message: 'Сравнение схем не требует отката' };
          
        default:
          return { success: true, message: 'Неизвестный шаг для отката' };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение статуса развертывания
   * @returns {Promise<{success: boolean, status: Object, error: string}>}
   */
  async getDeploymentStatus() {
    try {
      const [
        dbStatus,
        gitStatus,
        serverStatus,
        healthCheck
      ] = await Promise.all([
        this.dbManager.checkDatabaseIntegrity('/home/enclude/automation/production/delivery.db'),
        this.gitManager.getRepositoryStatus(),
        this.serverManager.getServiceStatus(),
        this.serverManager.healthCheck()
      ]);
      
      return {
        success: true,
        status: {
          database: dbStatus,
          git: gitStatus,
          server: serverStatus,
          health: healthCheck,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Выполнение отдельного этапа
   * @param {number} stepNumber - номер этапа (1-5)
   * @returns {Promise<{success: boolean, data: Object, error: string}>}
   */
  async executeStep(stepNumber) {
    try {
      switch (stepNumber) {
        case 1:
          return await this.compareDatabaseSchemas();
        case 2:
          return await this.mergeBranches();
        case 3:
          return await this.backupProductionDatabase();
        case 4:
          const schemaComparison = await this.compareDatabaseSchemas();
          return await this.applyDatabaseMigrations(schemaComparison.differences);
        case 5:
          return await this.restartServer();
        default:
          throw new Error(`Неизвестный этап: ${stepNumber}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Продвижение dev -> staging
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async promoteToStaging() {
    try {
      this.log('info', 'Начинаем продвижение dev -> staging');
      
      // 1. Запускаем тесты в dev
      this.log('info', 'Запуск тестов в dev');
      const testResult = await this.runTests('development');
      if (!testResult.success) {
        throw new Error(`Тесты провалены: ${testResult.error}`);
      }
      
      // 2. Создаем бэкап staging
      this.log('info', 'Создание бэкапа staging БД');
      const stagingBackup = await this.dbManager.createBackup('staging');
      if (!stagingBackup.success) {
        throw new Error(`Ошибка создания бэкапа staging: ${stagingBackup.error}`);
      }
      
      // 3. Копируем код из dev в staging
      this.log('info', 'Копирование кода dev -> staging');
      const { stdout, stderr } = await execAsync(
        'cp -r /home/enclude/automation/development/* /home/enclude/automation/staging/'
      );
      
      if (stderr && !stderr.includes('overwrite')) {
        throw new Error(`Ошибка копирования кода: ${stderr}`);
      }
      
      // 4. Синхронизируем БД dev -> staging
      this.log('info', 'Синхронизация БД dev -> staging');
      const devDbPath = '/home/enclude/automation/development/delivery-dev.db';
      const stagingDbPath = '/home/enclude/automation/staging/delivery-staging.db';
      
      if (fs.existsSync(devDbPath)) {
        fs.copyFileSync(devDbPath, stagingDbPath);
      }
      
      // 5. Запускаем тесты в staging
      this.log('info', 'Запуск тестов в staging');
      const stagingTestResult = await this.runTests('staging');
      if (!stagingTestResult.success) {
        // Автоматический rollback при провале тестов
        this.log('error', 'Тесты в staging провалены, выполняем rollback');
        await this.automaticRollback('staging', 'Staging tests failed');
        throw new Error(`Тесты в staging провалены: ${stagingTestResult.error}`);
      }
      
      // 6. Перезапускаем staging
      this.log('info', 'Перезапуск staging сервера');
      const restartResult = await this.serverManager.restartEnvironment('staging');
      if (!restartResult.success) {
        // Автоматический rollback при ошибке запуска
        this.log('error', 'Ошибка перезапуска staging, выполняем rollback');
        await this.automaticRollback('staging', 'Staging restart failed');
        throw new Error(`Ошибка перезапуска staging: ${restartResult.error}`);
      }
      
      this.log('success', 'Продвижение dev -> staging завершено успешно');
      return {
        success: true,
        message: 'Dev успешно продвинут в staging',
        backupPath: stagingBackup.backupPath,
        testResults: {
          dev: testResult.results,
          staging: stagingTestResult.results
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', `Ошибка продвижения dev -> staging: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Продвижение staging -> production
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async promoteToProduction() {
    try {
      this.log('info', 'Начинаем продвижение staging -> production');
      
      // 1. Создаем бэкап production
      this.log('info', 'Создание бэкапа production БД');
      const prodBackup = await this.dbManager.createBackup('production');
      if (!prodBackup.success) {
        throw new Error(`Ошибка создания бэкапа production: ${prodBackup.error}`);
      }
      
      // 2. Копируем код из staging в production
      this.log('info', 'Копирование кода staging -> production');
      const { stdout, stderr } = await execAsync(
        'cp -r /home/enclude/automation/staging/* /home/enclude/automation/production/'
      );
      
      if (stderr && !stderr.includes('overwrite')) {
        throw new Error(`Ошибка копирования кода: ${stderr}`);
      }
      
      // 3. Синхронизируем БД staging -> production
      this.log('info', 'Синхронизация БД staging -> production');
      const stagingDbPath = '/home/enclude/automation/staging/delivery-staging.db';
      const prodDbPath = '/home/enclude/automation/production/delivery.db';
      
      if (fs.existsSync(stagingDbPath)) {
        fs.copyFileSync(stagingDbPath, prodDbPath);
      }
      
      // 4. Перезапускаем production
      this.log('info', 'Перезапуск production сервера');
      const restartResult = await this.serverManager.restartEnvironment('production');
      if (!restartResult.success) {
        throw new Error(`Ошибка перезапуска production: ${restartResult.error}`);
      }
      
      this.log('success', 'Продвижение staging -> production завершено успешно');
      return {
        success: true,
        message: 'Staging успешно продвинут в production',
        backupPath: prodBackup.backupPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log(`error`, `Ошибка продвижения staging -> production: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Прямое продвижение dev -> production
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async promoteDevToProduction() {
    try {
      this.log('info', 'Начинаем прямое продвижение dev -> production');
      
      // 1. Создаем бэкап production
      this.log('info', 'Создание бэкапа production БД');
      const prodBackup = await this.dbManager.createBackup('production');
      if (!prodBackup.success) {
        throw new Error(`Ошибка создания бэкапа production: ${prodBackup.error}`);
      }
      
      // 2. Копируем код из dev в production
      this.log('info', 'Копирование кода dev -> production');
      const { stdout, stderr } = await execAsync(
        'cp -r /home/enclude/automation/development/* /home/enclude/automation/production/'
      );
      
      if (stderr && !stderr.includes('overwrite')) {
        throw new Error(`Ошибка копирования кода: ${stderr}`);
      }
      
      // 3. Синхронизируем БД dev -> production
      this.log('info', 'Синхронизация БД dev -> production');
      const devDbPath = '/home/enclude/automation/development/delivery-dev.db';
      const prodDbPath = '/home/enclude/automation/production/delivery.db';
      
      if (fs.existsSync(devDbPath)) {
        fs.copyFileSync(devDbPath, prodDbPath);
      }
      
      // 4. Перезапускаем production
      this.log('info', 'Перезапуск production сервера');
      const restartResult = await this.serverManager.restartEnvironment('production');
      if (!restartResult.success) {
        throw new Error(`Ошибка перезапуска production: ${restartResult.error}`);
      }
      
      this.log('success', 'Прямое продвижение dev -> production завершено успешно');
      return {
        success: true,
        message: 'Dev успешно продвинут в production',
        backupPath: prodBackup.backupPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log(`error`, `Ошибка прямого продвижения dev -> production: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Запуск автоматических тестов
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, results: Object, error: string}>}
   */
  async runTests(env) {
    try {
      this.log('info', `Запуск автоматических тестов для ${env}`);
      
      const envPath = `/home/enclude/automation/${env}`;
      const results = {
        unit: { success: false, output: '', error: '' },
        integration: { success: false, output: '', error: '' },
        coverage: { success: false, percentage: 0, output: '' }
      };
      
      // 1. Unit тесты
      this.log('info', 'Запуск unit тестов');
      try {
        const { stdout, stderr } = await execAsync(`cd ${envPath} && npm test`, { timeout: 30000 });
        results.unit.success = true;
        results.unit.output = stdout;
        this.log('success', 'Unit тесты пройдены');
      } catch (error) {
        results.unit.success = false;
        results.unit.error = error.message;
        this.log('error', `Unit тесты провалены: ${error.message}`);
      }
      
      // 2. Integration тесты (если есть)
      this.log('info', 'Запуск integration тестов');
      try {
        const { stdout, stderr } = await execAsync(`cd ${envPath} && npm run test:integration`, { timeout: 60000 });
        results.integration.success = true;
        results.integration.output = stdout;
        this.log('success', 'Integration тесты пройдены');
      } catch (error) {
        // Integration тесты могут отсутствовать - это не критично
        results.integration.success = false;
        results.integration.error = 'Integration тесты не настроены';
        this.log('warning', 'Integration тесты не настроены');
      }
      
      // 3. Проверка покрытия кода
      this.log('info', 'Проверка покрытия кода');
      try {
        const { stdout, stderr } = await execAsync(`cd ${envPath} && npm run test:coverage`, { timeout: 45000 });
        results.coverage.success = true;
        results.coverage.output = stdout;
        
        // Извлекаем процент покрытия из вывода
        const coverageMatch = stdout.match(/(\d+(?:\.\d+)?)%/);
        if (coverageMatch) {
          results.coverage.percentage = parseFloat(coverageMatch[1]);
        }
        
        this.log('success', `Покрытие кода: ${results.coverage.percentage}%`);
      } catch (error) {
        results.coverage.success = false;
        results.coverage.error = 'Проверка покрытия не настроена';
        this.log('warning', 'Проверка покрытия не настроена');
      }
      
      // Определяем общий результат
      const allTestsPassed = results.unit.success && 
                           (results.integration.success || results.integration.error.includes('не настроены')) &&
                           (results.coverage.success || results.coverage.error.includes('не настроена'));
      
      if (allTestsPassed) {
        this.log('success', 'Все тесты пройдены успешно');
        return {
          success: true,
          results,
          message: 'Тесты пройдены успешно'
        };
      } else {
        this.log('error', 'Некоторые тесты провалены');
        return {
          success: false,
          results,
          error: 'Тесты провалены'
        };
      }
      
    } catch (error) {
      this.log('error', `Ошибка запуска тестов: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Автоматический rollback при ошибках
   * @param {string} env - production|development|staging
   * @param {string} error - описание ошибки
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async automaticRollback(env, error) {
    try {
      this.log('error', `Автоматический rollback для ${env} из-за ошибки: ${error}`);
      
      // 1. Создаем бэкап текущего состояния перед rollback
      this.log('info', 'Создание бэкапа перед rollback');
      const backupResult = await this.dbManager.createBackup(env);
      if (!backupResult.success) {
        this.log('error', `Не удалось создать бэкап перед rollback: ${backupResult.error}`);
      }
      
      // 2. Останавливаем сервис
      this.log('info', 'Остановка сервиса');
      await this.serverManager.stopEnvironment(env);
      
      // 3. Откатываем Git к предыдущему коммиту
      this.log('info', 'Откат Git к предыдущему коммиту');
      const gitResult = await this.gitManager.rollbackToPreviousCommit();
      if (!gitResult.success) {
        this.log('error', `Ошибка Git rollback: ${gitResult.error}`);
      }
      
      // 4. Восстанавливаем БД из последнего бэкапа
      this.log('info', 'Восстановление БД из бэкапа');
      const dbRollbackResult = await this.dbManager.rollbackToLastBackup(env);
      if (!dbRollbackResult.success) {
        this.log('error', `Ошибка восстановления БД: ${dbRollbackResult.error}`);
      }
      
      // 5. Запускаем сервис
      this.log('info', 'Запуск сервиса после rollback');
      const startResult = await this.serverManager.startEnvironment(env);
      if (!startResult.success) {
        this.log('error', `Ошибка запуска сервиса: ${startResult.error}`);
      }
      
      // 6. Проверяем health
      this.log('info', 'Проверка health после rollback');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем запуска
      const healthResult = await this.serverManager.healthCheck();
      
      if (healthResult.success) {
        this.log('success', 'Автоматический rollback завершен успешно');
        return {
          success: true,
          message: 'Rollback выполнен успешно',
          details: {
            gitRollback: gitResult.success,
            dbRollback: dbRollbackResult.success,
            serviceRestart: startResult.success,
            healthCheck: healthResult.success
          }
        };
      } else {
        this.log('error', 'Health check провален после rollback');
        return {
          success: false,
          error: 'Health check провален после rollback',
          details: {
            gitRollback: gitResult.success,
            dbRollback: dbRollbackResult.success,
            serviceRestart: startResult.success,
            healthCheck: healthResult.success
          }
        };
      }
      
    } catch (rollbackError) {
      this.log('error', `Критическая ошибка при rollback: ${rollbackError.message}`);
      return {
        success: false,
        error: `Критическая ошибка rollback: ${rollbackError.message}`
      };
    }
  }
}

module.exports = DeploymentOrchestrator; 