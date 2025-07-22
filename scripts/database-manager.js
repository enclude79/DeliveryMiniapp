const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class DatabaseManager {
  constructor() {
    // Обновленные пути к базам данных в новой структуре
    this.appPath = '/home/enclude/automation';
    this.dbMap = {
      production: path.join(this.appPath, 'production', 'delivery.db'),
      development: path.join(this.appPath, 'development', 'delivery-dev.db'),
      staging: path.join(this.appPath, 'staging', 'delivery-staging.db'),
    };
    this.backupDirMap = {
      production: path.join(this.appPath, 'production', 'backup'),
      development: path.join(this.appPath, 'development', 'backup-dev'),
      staging: path.join(this.appPath, 'staging', 'backup-staging'),
    };
    // Создаем папки для бэкапов если не существуют
    Object.values(this.backupDirMap).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Создание бэкапа выбранной базы данных
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
   */
  async createBackup(env = 'production') {
    try {
      const dbPath = this.dbMap[env] || this.dbMap['production'];
      const backupDir = this.backupDirMap[env] || this.backupDirMap['production'];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `delivery_${env}_${timestamp}.db`);
      
      if (!fs.existsSync(dbPath)) {
        throw new Error(`База данных не найдена: ${dbPath}`);
      }
      
      const { stdout, stderr } = await execAsync(
        `sqlite3 "${dbPath}" ".backup '${backupPath}'"`
      );
      
      if (stderr && !stderr.includes('backup')) {
        throw new Error(`Ошибка создания бэкапа: ${stderr}`);
      }
      
      const integrityCheck = await this.checkDatabaseIntegrity(backupPath);
      if (!integrityCheck.success) {
        throw new Error(`Бэкап поврежден: ${integrityCheck.error}`);
      }
      
      return {
        success: true,
        backupPath,
        timestamp,
        size: fs.statSync(backupPath).size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Проверка целостности базы данных
   * @param {string} dbPath - путь к БД
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async checkDatabaseIntegrity(dbPath) {
    return new Promise((resolve) => {
      const db = new sqlite3.Database(dbPath);
      
      db.get("PRAGMA integrity_check", (err, row) => {
        db.close();
        
        if (err) {
          resolve({ success: false, error: err.message });
        } else if (row && row.integrity_check === 'ok') {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Целостность БД нарушена' });
        }
      });
    });
  }

  /**
   * Синхронизация dev базы из prod
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async syncDevFromProd() {
    try {
      const prodDbPath = this.dbMap['production'];
      const devDbPath = this.dbMap['development'];
      
      if (!fs.existsSync(prodDbPath)) {
        throw new Error('Production база данных не найдена');
      }
      
      // Создаем бэкап dev базы перед синхронизацией
      await this.createBackup('development');
      
      // Копируем prod базу в dev
      fs.copyFileSync(prodDbPath, devDbPath);
      
      // Проверяем целостность после копирования
      const integrity = await this.checkDatabaseIntegrity(devDbPath);
      if (!integrity.success) {
        throw new Error(`Целостность dev базы нарушена после синхронизации: ${integrity.error}`);
      }
      
      return {
        success: true,
        message: 'Dev база успешно синхронизирована из prod',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Сброс dev базы данных
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async resetDevDatabase() {
    try {
      const devDbPath = this.dbMap['development'];
      
      // Создаем бэкап перед сбросом
      await this.createBackup('development');
      
      // Удаляем существующую dev базу
      if (fs.existsSync(devDbPath)) {
        fs.unlinkSync(devDbPath);
      }
      
      // Создаем новую пустую базу
      const db = new sqlite3.Database(devDbPath);
      await new Promise((resolve, reject) => {
        db.run("CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at DATETIME)", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      db.close();
      
      return {
        success: true,
        message: 'Dev база успешно сброшена',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Получение схемы базы данных
   * @param {string} dbPath - путь к БД
   * @returns {Promise<Object>}
   */
  async getDatabaseSchema(dbPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      const schema = {};
      
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        if (tables.length === 0) {
          db.close();
          return resolve(schema);
        }
        
        let completed = 0;
        
        tables.forEach(table => {
          const tableName = table.name;
          
          db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
              db.close();
              return reject(err);
            }
            
            schema[tableName] = {};
            columns.forEach(col => {
              schema[tableName][col.name] = col.type;
            });
            
            completed++;
            if (completed === tables.length) {
              db.close();
              resolve(schema);
            }
          });
        });
      });
    });
  }

  /**
   * Восстановление БД из последнего бэкапа
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackToLastBackup(env) {
    try {
      const backupDir = this.backupDirMap[env];
      if (!fs.existsSync(backupDir)) {
        throw new Error(`Папка бэкапов не найдена: ${backupDir}`);
      }
      
      // Находим последний бэкап
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (backupFiles.length === 0) {
        throw new Error('Бэкапы не найдены');
      }
      
      const latestBackup = backupFiles[0];
      const currentDbPath = this.dbMap[env];
      
      // Проверяем целостность бэкапа
      const integrityCheck = await this.checkDatabaseIntegrity(latestBackup.path);
      if (!integrityCheck.success) {
        throw new Error(`Бэкап поврежден: ${integrityCheck.error}`);
      }
      
      // Создаем бэкап текущего состояния
      await this.createBackup(env);
      
      // Восстанавливаем из бэкапа
      fs.copyFileSync(latestBackup.path, currentDbPath);
      
      // Проверяем целостность восстановленной БД
      const restoredIntegrity = await this.checkDatabaseIntegrity(currentDbPath);
      if (!restoredIntegrity.success) {
        throw new Error(`Восстановленная БД повреждена: ${restoredIntegrity.error}`);
      }
      
      return {
        success: true,
        message: `БД восстановлена из бэкапа: ${latestBackup.name}`,
        backupFile: latestBackup.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Сравнение структуры таблиц
   * @param {Object} prodTable - структура prod таблицы
   * @param {Object} devTable - структура dev таблицы
   * @returns {Array} массив различий
   */
  compareTableStructure(prodTable, devTable) {
    const differences = [];
    const prodColumns = new Map(prodTable.columns.map(col => [col.name, col]));
    const devColumns = new Map(devTable.columns.map(col => [col.name, col]));
    
    // Проверяем новые колонки в dev
    for (const [colName, devCol] of devColumns) {
      if (!prodColumns.has(colName)) {
        differences.push({
          type: 'NEW_COLUMN',
          column: colName,
          description: `Новая колонка: ${colName} (${devCol.type})`
        });
      }
    }
    
    // Проверяем удаленные колонки
    for (const [colName, prodCol] of prodColumns) {
      if (!devColumns.has(colName)) {
        differences.push({
          type: 'MISSING_COLUMN',
          column: colName,
          description: `Удаленная колонка: ${colName}`
        });
      }
    }
    
    // Проверяем изменения в существующих колонках
    for (const [colName, prodCol] of prodColumns) {
      const devCol = devColumns.get(colName);
      if (devCol) {
        if (prodCol.type !== devCol.type) {
          differences.push({
            type: 'COLUMN_TYPE_CHANGE',
            column: colName,
            oldType: prodCol.type,
            newType: devCol.type,
            description: `Изменен тип колонки ${colName}: ${prodCol.type} → ${devCol.type}`
          });
        }
        
        if (prodCol.notnull !== devCol.notnull) {
          differences.push({
            type: 'COLUMN_CONSTRAINT_CHANGE',
            column: colName,
            oldConstraint: prodCol.notnull ? 'NOT NULL' : 'NULL',
            newConstraint: devCol.notnull ? 'NOT NULL' : 'NULL',
            description: `Изменено ограничение колонки ${colName}`
          });
        }
      }
    }
    
    return differences;
  }

  /**
   * Применение миграций к продакшн базе
   * @param {Array} migrations - массив SQL команд
   * @returns {Promise<{success: boolean, applied: number, error: string}>}
   */
  async applyMigrations(migrations) {
    try {
      // Создаем бэкап перед применением миграций
      const backup = await this.createBackup();
      if (!backup.success) {
        throw new Error(`Не удалось создать бэкап: ${backup.error}`);
      }
      
      const db = new sqlite3.Database(this.dbMap['production']);
      let applied = 0;
      
      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          for (const migration of migrations) {
            db.run(migration, (err) => {
              if (err) {
                db.run('ROLLBACK');
                db.close();
                reject({
                  success: false,
                  error: `Ошибка применения миграции: ${err.message}`,
                  applied,
                  failedMigration: migration
                });
                return;
              }
              applied++;
            });
          }
          
          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              db.close();
              reject({
                success: false,
                error: `Ошибка коммита транзакции: ${err.message}`,
                applied
              });
              return;
            }
            
            // Проверяем целостность после миграций
            this.checkDatabaseIntegrity(this.dbMap['production']).then(integrity => {
              db.close();
              
              if (!integrity.success) {
                resolve({
                  success: false,
                  error: `Целостность БД нарушена после миграций: ${integrity.error}`,
                  applied,
                  backupPath: backup.backupPath
                });
              } else {
                resolve({
                  success: true,
                  applied,
                  backupPath: backup.backupPath
                });
              }
            });
          });
        });
      });
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        applied: 0
      };
    }
  }

  /**
   * Откат к предыдущей версии выбранной базы данных
   * @param {string} backupPath - путь к бэкапу
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackDatabase(backupPath, env = 'production') {
    try {
      const dbPath = this.dbMap[env] || this.dbMap['production'];
      if (!fs.existsSync(backupPath)) {
        throw new Error('Файл бэкапа не найден');
      }
      const integrity = await this.checkDatabaseIntegrity(backupPath);
      if (!integrity.success) {
        throw new Error(`Бэкап поврежден: ${integrity.error}`);
      }
      // Создаем бэкап текущего состояния
      await this.createBackup(env);
      // Восстанавливаем
      fs.copyFileSync(backupPath, dbPath);
      return {
        success: true,
        message: 'Откат выполнен успешно',
        restored: dbPath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение списка доступных бэкапов для среды
   * @param {string} env - production|development|staging
   * @returns {Promise<Array>}
   */
  async getBackupsList(env = 'production') {
    try {
      const backupDir = this.backupDirMap[env] || this.backupDirMap['production'];
      const files = fs.readdirSync(backupDir);
      const backups = [];
      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }
      return backups.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      return [];
    }
  }
}

module.exports = DatabaseManager; 