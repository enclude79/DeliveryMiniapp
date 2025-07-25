const DatabaseManager = require('./database-manager');
const GitManager = require('./git-manager');
const ServerManager = require('./server-manager');
const fs = require('fs');
const path = require('path');

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
        this.dbManager.checkDatabaseIntegrity('/home/enclude/delivery-app/delivery.db'),
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
}

module.exports = DeploymentOrchestrator; 