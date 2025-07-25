const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class DatabaseManager {
  constructor() {
    this.appPath = '/home/enclude/delivery-app';
    this.prodDb = path.join(this.appPath, 'delivery.db');
    this.devDb = path.join(this.appPath, 'delivery-dev.db');
    this.backupDir = path.join(this.appPath, 'backup');
    
    // Создаем папку для бэкапов если не существует
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Создание бэкапа продакшн базы данных
   * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `delivery_${timestamp}.db`);
      
      // Проверяем существование продакшн БД
      if (!fs.existsSync(this.prodDb)) {
        throw new Error('Продакшн база данных не найдена');
      }

      // Создаем бэкап используя SQLite команды
      const { stdout, stderr } = await execAsync(
        `sqlite3 "${this.prodDb}" ".backup '${backupPath}'"`
      );

      if (stderr && !stderr.includes('backup')) {
        throw new Error(`Ошибка создания бэкапа: ${stderr}`);
      }

      // Проверяем целостность бэкапа
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
   * Сравнение схем между prod и dev базами
   * @returns {Promise<{success: boolean, differences: Array, error: string}>}
   */
  async compareSchemas() {
    try {
      const differences = [];
      
      // Получаем схемы обеих баз
      const prodSchema = await this.getDatabaseSchema(this.prodDb);
      const devSchema = await this.getDatabaseSchema(this.devDb);
      
      // Сравниваем таблицы
      const allTables = new Set([...Object.keys(prodSchema), ...Object.keys(devSchema)]);
      
      for (const tableName of allTables) {
        const prodTable = prodSchema[tableName] || null;
        const devTable = devSchema[tableName] || null;
        
        if (!prodTable) {
          differences.push({
            type: 'NEW_TABLE',
            table: tableName,
            description: `Новая таблица в dev: ${tableName}`,
            sql: devTable.createStatement
          });
          continue;
        }
        
        if (!devTable) {
          differences.push({
            type: 'MISSING_TABLE',
            table: tableName,
            description: `Таблица отсутствует в dev: ${tableName}`
          });
          continue;
        }
        
        // Сравниваем структуру таблиц
        const tableDiff = this.compareTableStructure(prodTable, devTable);
        if (tableDiff.length > 0) {
          differences.push({
            type: 'TABLE_STRUCTURE_CHANGE',
            table: tableName,
            differences: tableDiff
          });
        }
      }
      
      return {
        success: true,
        differences,
        summary: {
          totalDifferences: differences.length,
          newTables: differences.filter(d => d.type === 'NEW_TABLE').length,
          missingTables: differences.filter(d => d.type === 'MISSING_TABLE').length,
          structureChanges: differences.filter(d => d.type === 'TABLE_STRUCTURE_CHANGE').length
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
   * Получение схемы базы данных
   * @param {string} dbPath - путь к БД
   * @returns {Promise<Object>}
   */
  async getDatabaseSchema(dbPath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(dbPath)) {
        reject(new Error(`База данных не найдена: ${dbPath}`));
        return;
      }

      const db = new sqlite3.Database(dbPath);
      const schema = {};
      
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        let completed = 0;
        const total = tables.length;
        
        if (total === 0) {
          db.close();
          resolve(schema);
          return;
        }
        
        tables.forEach(table => {
          db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
            if (err) {
              db.close();
              reject(err);
              return;
            }
            
            // Получаем CREATE TABLE statement
            db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table.name], (err, row) => {
              schema[table.name] = {
                columns: columns,
                createStatement: row ? row.sql : null
              };
              
              completed++;
              if (completed === total) {
                db.close();
                resolve(schema);
              }
            });
          });
        });
      });
    });
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
      
      const db = new sqlite3.Database(this.prodDb);
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
            this.checkDatabaseIntegrity(this.prodDb).then(integrity => {
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
   * Откат к предыдущей версии базы данных
   * @param {string} backupPath - путь к бэкапу
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackDatabase(backupPath) {
    try {
      // Проверяем существование бэкапа
      if (!fs.existsSync(backupPath)) {
        throw new Error('Файл бэкапа не найден');
      }
      
      // Проверяем целостность бэкапа
      const integrity = await this.checkDatabaseIntegrity(backupPath);
      if (!integrity.success) {
        throw new Error(`Бэкап поврежден: ${integrity.error}`);
      }
      
      // Создаем бэкап текущего состояния
      const currentBackup = await this.createBackup();
      
      // Заменяем продакшн БД на бэкап
      fs.copyFileSync(backupPath, this.prodDb);
      
      return {
        success: true,
        message: 'Откат выполнен успешно',
        currentBackup: currentBackup.backupPath
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение списка доступных бэкапов
   * @returns {Promise<Array>}
   */
  async getBackupsList() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(this.backupDir, file);
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
      
      // Сортируем по дате создания (новые сначала)
      return backups.sort((a, b) => b.createdAt - a.createdAt);
      
    } catch (error) {
      return [];
    }
  }
}

module.exports = DatabaseManager; 