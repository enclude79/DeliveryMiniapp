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
    const result = await dbManager.createBackup();
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
    const backups = await dbManager.getBackupsList();
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
    const { backupPath } = req.body;
    
    if (!backupPath) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать backupPath'
      });
    }
    
    const result = await dbManager.rollbackDatabase(backupPath);
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

module.exports = router; 