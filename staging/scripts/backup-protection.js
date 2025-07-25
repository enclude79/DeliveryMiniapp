#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class BackupProtection {
  constructor() {
    this.appPath = '/home/enclude/automation';
    this.backupDirs = {
      production: path.join(this.appPath, 'production', 'backup'),
      development: path.join(this.appPath, 'development', 'backup-dev'),
      staging: path.join(this.appPath, 'staging', 'backup-staging')
    };
    
    // Создаем папки для бэкапов
    Object.values(this.backupDirs).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Создание защитного бэкапа перед операцией
   */
  async createProtectionBackup(environment, operation) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `protection_${operation}_${environment}_${timestamp}`;
      
      const dbPaths = {
        production: path.join(this.appPath, 'production', 'delivery.db'),
        development: path.join(this.appPath, 'development', 'delivery-dev.db'),
        staging: path.join(this.appPath, 'staging', 'delivery-staging.db')
      };
      
      const dbPath = dbPaths[environment];
      const backupDir = this.backupDirs[environment];
      const backupPath = path.join(backupDir, `${backupName}.db`);
      
      if (!fs.existsSync(dbPath)) {
        throw new Error(`База данных не найдена: ${dbPath}`);
      }
      
      console.log(`🛡️ Создание защитного бэкапа: ${backupName}`);
      
      // Создаем бэкап БД
      const { stdout, stderr } = await execAsync(
        `sqlite3 "${dbPath}" ".backup '${backupPath}'"`
      );
      
      if (stderr && !stderr.includes('backup')) {
        throw new Error(`Ошибка создания бэкапа: ${stderr}`);
      }
      
      // Проверяем целостность бэкапа
      const integrityCheck = await this.checkDatabaseIntegrity(backupPath);
      if (!integrityCheck.success) {
        throw new Error(`Бэкап поврежден: ${integrityCheck.error}`);
      }
      
      // Создаем бэкап кода (если это development)
      let codeBackupPath = null;
      if (environment === 'development') {
        const codeBackupPath = path.join(backupDir, `${backupName}_code.tar.gz`);
        const devPath = path.join(this.appPath, 'development');
        
        await execAsync(`tar -czf "${codeBackupPath}" -C "${devPath}" . --exclude=node_modules --exclude=*.db --exclude=logs --exclude=backup*`);
        console.log(`📦 Бэкап кода создан: ${codeBackupPath}`);
      }
      
      // Создаем метаданные бэкапа
      const metadata = {
        timestamp: new Date().toISOString(),
        environment,
        operation,
        backupName,
        dbBackupPath: backupPath,
        codeBackupPath,
        originalDbPath: dbPath,
        size: fs.statSync(backupPath).size,
        description: `Защитный бэкап перед операцией: ${operation}`
      };
      
      const metadataPath = path.join(backupDir, `${backupName}_metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`✅ Защитный бэкап создан: ${backupName}`);
      console.log(`📁 Путь: ${backupPath}`);
      console.log(`📊 Размер: ${(metadata.size / 1024).toFixed(2)} KB`);
      
      return {
        success: true,
        backupName,
        backupPath,
        codeBackupPath,
        metadataPath,
        timestamp: metadata.timestamp
      };
      
    } catch (error) {
      console.error(`❌ Ошибка создания защитного бэкапа: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка целостности базы данных
   */
  async checkDatabaseIntegrity(dbPath) {
    return new Promise((resolve) => {
      const sqlite3 = require('sqlite3').verbose();
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
   * Восстановление из защитного бэкапа
   */
  async restoreFromProtectionBackup(backupName, environment) {
    try {
      const backupDir = this.backupDirs[environment];
      const metadataPath = path.join(backupDir, `${backupName}_metadata.json`);
      
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Метаданные бэкапа не найдены: ${metadataPath}`);
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const dbBackupPath = metadata.dbBackupPath;
      
      if (!fs.existsSync(dbBackupPath)) {
        throw new Error(`Файл бэкапа не найден: ${dbBackupPath}`);
      }
      
      console.log(`🔄 Восстановление из защитного бэкапа: ${backupName}`);
      
      // Проверяем целостность бэкапа
      const integrityCheck = await this.checkDatabaseIntegrity(dbBackupPath);
      if (!integrityCheck.success) {
        throw new Error(`Бэкап поврежден: ${integrityCheck.error}`);
      }
      
      // Восстанавливаем БД
      const dbPaths = {
        production: path.join(this.appPath, 'production', 'delivery.db'),
        development: path.join(this.appPath, 'development', 'delivery-dev.db'),
        staging: path.join(this.appPath, 'staging', 'delivery-staging.db')
      };
      
      const targetDbPath = dbPaths[environment];
      
      // Создаем бэкап текущего состояния перед восстановлением
      const currentBackupPath = path.join(backupDir, `before_restore_${Date.now()}.db`);
      fs.copyFileSync(targetDbPath, currentBackupPath);
      
      // Восстанавливаем из бэкапа
      fs.copyFileSync(dbBackupPath, targetDbPath);
      
      // Проверяем целостность восстановленной БД
      const restoredIntegrity = await this.checkDatabaseIntegrity(targetDbPath);
      if (!restoredIntegrity.success) {
        // Восстанавливаем из текущего бэкапа
        fs.copyFileSync(currentBackupPath, targetDbPath);
        throw new Error(`Восстановленная БД повреждена, откат к предыдущему состоянию`);
      }
      
      console.log(`✅ Восстановление завершено: ${backupName}`);
      
      return {
        success: true,
        backupName,
        restoredDbPath: targetDbPath,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Ошибка восстановления: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение списка защитных бэкапов
   */
  getProtectionBackups(environment) {
    try {
      const backupDir = this.backupDirs[environment];
      const backups = [];
      
      if (!fs.existsSync(backupDir)) {
        return backups;
      }
      
      const files = fs.readdirSync(backupDir);
      
      files.forEach(file => {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(backupDir, file);
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          
          backups.push({
            name: metadata.backupName,
            timestamp: metadata.timestamp,
            operation: metadata.operation,
            environment: metadata.environment,
            size: metadata.size,
            description: metadata.description,
            metadataPath,
            dbBackupPath: metadata.dbBackupPath,
            codeBackupPath: metadata.codeBackupPath
          });
        }
      });
      
      // Сортируем по времени (новые сначала)
      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
    } catch (error) {
      console.error(`❌ Ошибка получения списка бэкапов: ${error.message}`);
      return [];
    }
  }

  /**
   * Очистка старых бэкапов (оставляем последние 10)
   */
  async cleanupOldBackups(environment, keepCount = 10) {
    try {
      const backups = this.getProtectionBackups(environment);
      
      if (backups.length <= keepCount) {
        console.log(`✅ Количество бэкапов в норме: ${backups.length}`);
        return { success: true, cleaned: 0 };
      }
      
      const toDelete = backups.slice(keepCount);
      let deletedCount = 0;
      
      for (const backup of toDelete) {
        try {
          // Удаляем файлы бэкапа
          if (fs.existsSync(backup.dbBackupPath)) {
            fs.unlinkSync(backup.dbBackupPath);
          }
          if (backup.codeBackupPath && fs.existsSync(backup.codeBackupPath)) {
            fs.unlinkSync(backup.codeBackupPath);
          }
          if (fs.existsSync(backup.metadataPath)) {
            fs.unlinkSync(backup.metadataPath);
          }
          deletedCount++;
        } catch (error) {
          console.warn(`⚠️ Не удалось удалить бэкап ${backup.name}: ${error.message}`);
        }
      }
      
      console.log(`🧹 Удалено старых бэкапов: ${deletedCount}`);
      
      return {
        success: true,
        cleaned: deletedCount,
        remaining: backups.length - deletedCount
      };
      
    } catch (error) {
      console.error(`❌ Ошибка очистки бэкапов: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Экспорт для использования в других модулях
module.exports = BackupProtection;

// Если запущен напрямую, показываем справку
if (require.main === module) {
  console.log('🛡️ СИСТЕМА ЗАЩИТЫ ОТ ПОТЕРИ ИЗМЕНЕНИЙ');
  console.log('========================================\n');
  
  const protection = new BackupProtection();
  
  console.log('📋 Доступные методы:');
  console.log('• createProtectionBackup(environment, operation) - создание защитного бэкапа');
  console.log('• restoreFromProtectionBackup(backupName, environment) - восстановление из бэкапа');
  console.log('• getProtectionBackups(environment) - список бэкапов');
  console.log('• cleanupOldBackups(environment, keepCount) - очистка старых бэкапов');
  
  console.log('\n🎯 Примеры использования:');
  console.log('• Создать бэкап перед копированием: protection.createProtectionBackup("development", "copy_prod_to_staging")');
  console.log('• Создать бэкап перед деплоем: protection.createProtectionBackup("production", "deploy_to_production")');
  console.log('• Восстановить из бэкапа: protection.restoreFromProtectionBackup("protection_copy_prod_to_staging_2024-01-15T10-30-00-000Z", "development")');
} 