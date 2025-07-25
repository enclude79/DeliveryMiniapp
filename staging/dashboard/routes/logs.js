const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * GET /api/logs/deployment
 * Получение логов развертывания
 */
router.get('/deployment', async (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../logs/deployment.log');
    
    if (!fs.existsSync(logFile)) {
      return res.json({
        success: true,
        logs: []
      });
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    const logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line,
          data: {}
        };
      }
    });
    
    res.json({
      success: true,
      logs
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/logs/server
 * Получение логов сервера
 */
router.get('/server', async (req, res) => {
  try {
    const { lines = 100 } = req.query;
    const logFiles = [
      '/home/enclude/delivery-app/server.log',
      '/home/enclude/delivery-app/server-prod.log'
    ];
    
    let allLogs = [];
    
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const fileLogs = content.trim().split('\n').filter(line => line.length > 0);
        allLogs = allLogs.concat(fileLogs);
      }
    }
    
    // Сортируем по времени (если есть timestamp)
    allLogs.sort((a, b) => {
      const timeA = extractTimestamp(a);
      const timeB = extractTimestamp(b);
      return timeB - timeA;
    });
    
    // Ограничиваем количество строк
    allLogs = allLogs.slice(0, parseInt(lines));
    
    res.json({
      success: true,
      logs: allLogs
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/logs/system
 * Получение системных логов
 */
router.get('/system', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const { stdout } = await execAsync('journalctl -u delivery-app -n 100 --no-pager');
    
    const logs = stdout.trim().split('\n').filter(line => line.length > 0);
    
    res.json({
      success: true,
      logs
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/logs/clear
 * Очистка всех логов
 */
router.delete('/clear', async (req, res) => {
  try {
    const logFiles = [
      path.join(__dirname, '../../logs/deployment.log'),
      '/home/enclude/delivery-app/server.log',
      '/home/enclude/delivery-app/server-prod.log'
    ];
    
    let cleared = 0;
    
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '');
        cleared++;
      }
    }
    
    res.json({
      success: true,
      message: `Очищено ${cleared} файлов логов`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/logs/stats
 * Статистика логов
 */
router.get('/stats', async (req, res) => {
  try {
    const logFiles = [
      {
        name: 'deployment',
        path: path.join(__dirname, '../../logs/deployment.log')
      },
      {
        name: 'server',
        path: '/home/enclude/delivery-app/server.log'
      },
      {
        name: 'server-prod',
        path: '/home/eninclude/delivery-app/server-prod.log'
      }
    ];
    
    const stats = {};
    
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile.path)) {
        const content = fs.readFileSync(logFile.path, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        const size = fs.statSync(logFile.path).size;
        
        stats[logFile.name] = {
          lines: lines.length,
          size,
          sizeFormatted: formatBytes(size),
          lastModified: fs.statSync(logFile.path).mtime
        };
      } else {
        stats[logFile.name] = {
          lines: 0,
          size: 0,
          sizeFormatted: '0 B',
          lastModified: null
        };
      }
    }
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/logs/search
 * Поиск в логах
 */
router.get('/search', async (req, res) => {
  try {
    const { query, type = 'all', limit = 100 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать поисковый запрос'
      });
    }
    
    const logFiles = [];
    
    if (type === 'all' || type === 'deployment') {
      logFiles.push({
        name: 'deployment',
        path: path.join(__dirname, '../../logs/deployment.log')
      });
    }
    
    if (type === 'all' || type === 'server') {
      logFiles.push(
        {
          name: 'server',
          path: '/home/eninclude/delivery-app/server.log'
        },
        {
          name: 'server-prod',
          path: '/home/eninclude/delivery-app/server-prod.log'
        }
      );
    }
    
    const results = [];
    
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile.path)) {
        const content = fs.readFileSync(logFile.path, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        
        for (const line of lines) {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              file: logFile.name,
              line,
              timestamp: extractTimestamp(line)
            });
          }
        }
      }
    }
    
    // Сортируем по времени
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    // Ограничиваем количество результатов
    const limitedResults = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      results: limitedResults,
      total: results.length
    });
    
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

function extractTimestamp(line) {
  // Пытаемся извлечь timestamp из строки лога
  const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (timestampMatch) {
    return new Date(timestampMatch[1]).getTime();
  }
  
  // Если нет timestamp, возвращаем текущее время
  return Date.now();
}

module.exports = router; 