const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../scripts/database-manager');

const dbManager = new DatabaseManager();

/**
 * GET /api/database/compare
 * Сравнение схем БД
 */
router.get('/compare', async (req, res) => {
  try {
    const result = await dbManager.compareSchemas();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database/backup
 * Создание бэкапа БД
 */
router.post('/backup', async (req, res) => {
  try {
    const env = req.body.env || req.query.env || 'production';
    const result = await dbManager.createBackup(env);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database/backups
 * Получение списка бэкапов
 */
router.get('/backups', async (req, res) => {
  try {
    const env = req.query.env || 'production';
    const backups = await dbManager.getBackupsList(env);
    res.json({
      success: true,
      backups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database/rollback
 * Откат к бэкапу
 */
router.post('/rollback', async (req, res) => {
  try {
    const { backupPath, env } = req.body;
    
    if (!backupPath) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать backupPath'
      });
    }
    
    const result = await dbManager.rollbackDatabase(backupPath, env || 'production');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database/sync-dev-from-prod
 * Синхронизация dev базы из prod
 */
router.post('/sync-dev-from-prod', async (req, res) => {
  try {
    const result = await dbManager.syncDevFromProd();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database/reset-dev
 * Сброс dev базы (с подтверждением)
 */
router.post('/reset-dev', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Необходимо подтверждение для сброса dev базы'
      });
    }
    
    const result = await dbManager.resetDevDatabase();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database/integrity
 * Проверка целостности БД
 */
router.get('/integrity', async (req, res) => {
  try {
    const { dbPath } = req.query;
    const path = dbPath || '/home/enclude/delivery-app/delivery.db';
    
    const result = await dbManager.checkDatabaseIntegrity(path);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database/schema
 * Получение схемы БД
 */
router.get('/schema', async (req, res) => {
  try {
    const { dbPath } = req.query;
    const path = dbPath || '/home/enclude/delivery-app/delivery.db';
    
    const schema = await dbManager.getDatabaseSchema(path);
    res.json({
      success: true,
      schema
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database/compare-schemas
 * Сравнение схем БД production и development
 */
router.get('/compare-schemas', async (req, res) => {
  try {
    const prodSchema = await dbManager.getDatabaseSchema('/home/enclude/automation/production/delivery.db');
    const devSchema = await dbManager.getDatabaseSchema('/home/enclude/automation/development/delivery-dev.db');
    
    // Сравниваем схемы
    const differences = {
      tables: {
        added: [],
        removed: [],
        modified: []
      },
      columns: {
        added: [],
        removed: [],
        modified: []
      }
    };
    
    // Сравниваем таблицы
    const prodTables = Object.keys(prodSchema);
    const devTables = Object.keys(devSchema);
    
    // Находим добавленные таблицы
    differences.tables.added = devTables.filter(table => !prodTables.includes(table));
    
    // Находим удаленные таблицы
    differences.tables.removed = prodTables.filter(table => !devTables.includes(table));
    
    // Сравниваем общие таблицы
    const commonTables = prodTables.filter(table => devTables.includes(table));
    
    for (const table of commonTables) {
      const prodColumns = prodSchema[table];
      const devColumns = devSchema[table];
      
      // Сравниваем колонки
      const prodColumnNames = Object.keys(prodColumns);
      const devColumnNames = Object.keys(devColumns);
      
      // Находим добавленные колонки
      const addedColumns = devColumnNames.filter(col => !prodColumnNames.includes(col));
      if (addedColumns.length > 0) {
        differences.columns.added.push({
          table,
          columns: addedColumns
        });
      }
      
      // Находим удаленные колонки
      const removedColumns = prodColumnNames.filter(col => !devColumnNames.includes(col));
      if (removedColumns.length > 0) {
        differences.columns.removed.push({
          table,
          columns: removedColumns
        });
      }
      
      // Сравниваем общие колонки
      const commonColumns = prodColumnNames.filter(col => devColumnNames.includes(col));
      for (const col of commonColumns) {
        if (prodColumns[col] !== devColumns[col]) {
          differences.columns.modified.push({
            table,
            column: col,
            production: prodColumns[col],
            development: devColumns[col]
          });
        }
      }
    }
    
    res.json({
      success: true,
      production: {
        tables: prodTables.length,
        schema: prodSchema
      },
      development: {
        tables: devTables.length,
        schema: devSchema
      },
      differences,
      hasDifferences: differences.tables.added.length > 0 || 
                     differences.tables.removed.length > 0 || 
                     differences.columns.added.length > 0 || 
                     differences.columns.removed.length > 0 || 
                     differences.columns.modified.length > 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 