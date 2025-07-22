const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * GET /api/backup/list
 * Получение списка всех бэкапов
 */
router.get('/list', async (req, res) => {
  try {
    const backupDir = '/home/enclude/delivery-app/backup';
    
    if (!fs.existsSync(backupDir)) {
      return res.json({
        success: true,
        backups: []
      });
    }
    
    const files = fs.readdirSync(backupDir);
    const backups = [];
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      backups.push({
        filename: file,
        path: filePath,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        type: getBackupType(file)
      });
    }
    
    // Сортируем по дате создания (новые сначала)
    backups.sort((a, b) => b.createdAt - a.createdAt);
    
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
 * DELETE /api/backup/:filename
 * Удаление бэкапа
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join('/home/enclude/delivery-app/backup', filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        error: 'Файл бэкапа не найден'
      });
    }
    
    fs.unlinkSync(backupPath);
    
    res.json({
      success: true,
      message: 'Бэкап удален'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/cleanup
 * Очистка старых бэкапов
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const backupDir = '/home/enclude/delivery-app/backup';
    
    if (!fs.existsSync(backupDir)) {
      return res.json({
        success: true,
        deleted: 0,
        message: 'Папка бэкапов не существует'
      });
    }
    
    const files = fs.readdirSync(backupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let deleted = 0;
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.birthtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }
    
    res.json({
      success: true,
      deleted,
      message: `Удалено ${deleted} старых бэкапов`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/backup/stats
 * Статистика бэкапов
 */
router.get('/stats', async (req, res) => {
  try {
    const backupDir = '/home/enclude/delivery-app/backup';
    
    if (!fs.existsSync(backupDir)) {
      return res.json({
        success: true,
        stats: {
          totalBackups: 0,
          totalSize: 0,
          totalSizeFormatted: '0 B',
          types: {}
        }
      });
    }
    
    const files = fs.readdirSync(backupDir);
    let totalSize = 0;
    const types = {};
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const type = getBackupType(file);
      
      totalSize += stats.size;
      types[type] = (types[type] || 0) + 1;
    }
    
    res.json({
      success: true,
      stats: {
        totalBackups: files.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        types
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/download
 * Скачивание бэкапа
 */
router.post('/download', async (req, res) => {
  try {
    const { filename } = req.body;
    const backupPath = path.join('/home/enclude/delivery-app/backup', filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        error: 'Файл бэкапа не найден'
      });
    }
    
    const stats = fs.statSync(backupPath);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    const fileStream = fs.createReadStream(backupPath);
    fileStream.pipe(res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Вспомогательные функции

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getBackupType(filename) {
  if (filename.includes('delivery_')) {
    return 'database';
  } else if (filename.includes('git_backup_')) {
    return 'git';
  } else if (filename.includes('server_config_')) {
    return 'server';
  } else {
    return 'unknown';
  }
}

module.exports = router; 