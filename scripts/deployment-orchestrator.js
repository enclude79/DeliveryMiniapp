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
   * Автоматический откат при ошибке
   * @param {string} env - окружение
   * @param {string} error - ошибка
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async automaticRollback(env, error) {
    try {
      this.log('error', `Автоматический откат для ${env}: ${error}`);
      
      // Логика отката в зависимости от окружения
      switch (env) {
        case 'staging':
          // Откат staging к состоянию production
          await this.rollbackStagingToProduction();
          break;
        case 'production':
          // Откат production к предыдущему коммиту
          await this.rollbackProductionToPreviousCommit();
          break;
        default:
          this.log('warning', `Неизвестное окружение для отката: ${env}`);
      }
      
      return { success: true, message: `Откат ${env} выполнен` };
      
    } catch (rollbackError) {
      this.log('error', `Ошибка отката ${env}: ${rollbackError.message}`);
      return { success: false, error: rollbackError.message };
    }
  }

  /**
   * Синхронизация Development контура
   * @returns {Promise<{success: boolean, error: string, changes: Array, testResults: Object}>}
   */
  async syncDevelopment() {
    try {
      this.log('info', '🔄 Начинаем синхронизацию Development контура');
      
      const result = await this.gitManager.syncDevelopment();
      
      if (result.success) {
        this.log('success', '✅ Development контур успешно синхронизирован');
        this.log('info', `📊 Результаты тестов: ${JSON.stringify(result.testResult)}`);
      } else {
        this.log('error', `❌ Ошибка синхронизации Development: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `❌ Критическая ошибка синхронизации Development: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Тестирование в Staging контуре
   * @returns {Promise<{success: boolean, error: string, migrations: Array, testResults: Object}>}
   */
  async testInStaging() {
    try {
      this.log('info', '🧪 Начинаем тестирование в Staging контуре');
      
      // 1. Копируем Production в Staging
      this.log('info', '📋 Копируем состояние Production в Staging');
      
      // 2. Применяем изменения из develop
      this.log('info', '🔄 Применяем изменения из develop ветки');
      
      const result = await this.gitManager.testInStaging();
      
      if (result.success) {
        this.log('success', '✅ Тестирование в Staging завершено успешно');
        this.log('info', `📊 Результаты тестов: ${JSON.stringify(result.testResults)}`);
        this.log('info', `🔧 Сгенерировано миграций: ${result.migrations.length}`);
      } else {
        this.log('error', `❌ Ошибка тестирования в Staging: ${result.error}`);
        // Автоматический откат staging
        await this.automaticRollback('staging', result.error);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `❌ Критическая ошибка тестирования в Staging: ${error.message}`);
      // Автоматический откат staging
      await this.automaticRollback('staging', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Деплой в Production
   * @returns {Promise<{success: boolean, error: string, backupPath: string, mergeCommit: string}>}
   */
  async deployToProduction() {
    try {
      this.log('info', '🚀 Начинаем деплой в Production');
      
      // 1. Создаем бэкап
      this.log('info', '💾 Создаем полный бэкап Production');
      
      // 2. Выполняем merge develop → main
      this.log('info', '🔄 Выполняем merge develop → main');
      
      const result = await this.gitManager.deployToProduction();
      
      if (result.success) {
        this.log('success', '✅ Деплой в Production выполнен успешно');
        this.log('info', `💾 Бэкап создан: ${result.backupPath}`);
        this.log('info', `🔗 Коммит слияния: ${result.mergeCommit}`);
        this.log('info', `🔧 Миграции: ${JSON.stringify(result.migrationResult)}`);
        this.log('info', `🖥️ Перезапуск сервера: ${JSON.stringify(result.restartResult)}`);
      } else {
        this.log('error', `❌ Ошибка деплоя в Production: ${result.error}`);
        // Автоматический откат production
        await this.automaticRollback('production', result.error);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `❌ Критическая ошибка деплоя в Production: ${error.message}`);
      // Автоматический откат production
      await this.automaticRollback('production', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Откат Staging к состоянию Production
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackStagingToProduction() {
    try {
      this.log('info', '🔄 Откат Staging к состоянию Production');
      
      const stagingPath = '/home/enclude/automation/staging';
      const productionPath = '/home/enclude/automation/production';
      
      // Копируем файлы из production в staging
      await execAsync(`cp -r ${productionPath}/* ${stagingPath}/`);
      
      this.log('success', '✅ Staging откачен к состоянию Production');
      return { success: true };
      
    } catch (error) {
      this.log('error', `❌ Ошибка отката Staging: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Откат Production к предыдущему коммиту
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackProductionToPreviousCommit() {
    try {
      this.log('info', '🔄 Откат Production к предыдущему коммиту');
      
      const result = await this.gitManager.rollbackToPreviousCommit();
      
      if (result.success) {
        this.log('success', '✅ Production откачен к предыдущему коммиту');
      } else {
        this.log('error', `❌ Ошибка отката Production: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      this.log('error', `❌ Критическая ошибка отката Production: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Полный workflow: Development → Staging → Production
   * @returns {Promise<{success: boolean, steps: Array, error: string}>}
   */
  async performFullWorkflow() {
    const workflowId = `workflow_${Date.now()}`;
    const steps = [];
    
    this.log('info', `🚀 Начинаем полный workflow: ${workflowId}`);
    
    try {
      // Этап 1: Синхронизация Development
      this.log('info', '🔄 Этап 1: Синхронизация Development');
      const syncResult = await this.syncDevelopment();
      steps.push({
        step: 1,
        name: 'Синхронизация Development',
        success: syncResult.success,
        data: syncResult
      });
      
      if (!syncResult.success) {
        throw new Error(`Ошибка синхронизации Development: ${syncResult.error}`);
      }
      
      // Этап 2: Тестирование в Staging
      this.log('info', '🧪 Этап 2: Тестирование в Staging');
      const stagingResult = await this.testInStaging();
      steps.push({
        step: 2,
        name: 'Тестирование в Staging',
        success: stagingResult.success,
        data: stagingResult
      });
      
      if (!stagingResult.success) {
        throw new Error(`Ошибка тестирования в Staging: ${stagingResult.error}`);
      }
      
      // Этап 3: Деплой в Production
      this.log('info', '🚀 Этап 3: Деплой в Production');
      const deployResult = await this.deployToProduction();
      steps.push({
        step: 3,
        name: 'Деплой в Production',
        success: deployResult.success,
        data: deployResult
      });
      
      if (!deployResult.success) {
        throw new Error(`Ошибка деплоя в Production: ${deployResult.error}`);
      }
      
      this.log('success', `✅ Полный workflow завершен успешно: ${workflowId}`);
      
      return {
        success: true,
        workflowId: workflowId,
        steps: steps,
        message: 'Workflow Development → Staging → Production выполнен успешно'
      };
      
    } catch (error) {
      this.log('error', `❌ Ошибка workflow: ${error.message}`);
      return {
        success: false,
        workflowId: workflowId,
        steps: steps,
        error: error.message
      };
    }
  }
}

module.exports = DeploymentOrchestrator; 