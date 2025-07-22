const express = require('express');
const router = express.Router();
const DeploymentOrchestrator = require('../../scripts/deployment-orchestrator');
const DatabaseManager = require('../../scripts/database-manager');
const GitManager = require('../../scripts/git-manager');
const ServerManager = require('../../scripts/server-manager');

const orchestrator = new DeploymentOrchestrator();
const dbManager = new DatabaseManager();
const gitManager = new GitManager();
const serverManager = new ServerManager();

/**
 * GET /api/deployment/status
 * Получение статуса развертывания
 */
router.get('/status', async (req, res) => {
  try {
    const status = await orchestrator.getDeploymentStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/full
 * Выполнение полного развертывания
 */
router.post('/full', async (req, res) => {
  try {
    const result = await orchestrator.performFullDeployment();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/step/:stepNumber
 * Выполнение отдельного этапа
 */
router.post('/step/:stepNumber', async (req, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    
    if (stepNumber < 1 || stepNumber > 5) {
      return res.status(400).json({
        success: false,
        error: 'Номер этапа должен быть от 1 до 5'
      });
    }
    
    const result = await orchestrator.executeStep(stepNumber);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/logs
 * Получение логов развертывания
 */
router.get('/logs', async (req, res) => {
  try {
    const logs = orchestrator.getLogs();
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
 * DELETE /api/deployment/logs
 * Очистка логов развертывания
 */
router.delete('/logs', async (req, res) => {
  try {
    orchestrator.clearLogs();
    res.json({
      success: true,
      message: 'Логи очищены'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/steps
 * Получение информации о этапах развертывания
 */
router.get('/steps', async (req, res) => {
  const steps = [
    {
      id: 1,
      name: 'Сравнить схемы БД',
      description: 'Сравнить структуру prod и dev, создать миграции',
      icon: 'database',
      color: 'blue'
    },
    {
      id: 2,
      name: 'Слияние веток',
      description: 'Выполнить merge из dev в main',
      icon: 'git-merge',
      color: 'green'
    },
    {
      id: 3,
      name: 'Бэкап БД prod',
      description: 'Создать резервную копию продакшн БД',
      icon: 'backup',
      color: 'orange'
    },
    {
      id: 4,
      name: 'Применить миграции',
      description: 'Выполнить миграции к prod БД',
      icon: 'migration',
      color: 'red'
    },
    {
      id: 5,
      name: 'Запустить сервер',
      description: 'Перезапустить prod сервер',
      icon: 'server',
      color: 'purple'
    }
  ];
  
  res.json({
    success: true,
    steps
  });
});

/**
 * POST /api/deployment/rollback
 * Выполнение отката
 */
router.post('/rollback', async (req, res) => {
  try {
    const { backupPath, commitHash } = req.body;
    
    if (backupPath) {
      // Откат базы данных
      const result = await dbManager.rollbackDatabase(backupPath);
      res.json(result);
    } else if (commitHash) {
      // Откат Git
      const result = await gitManager.rollbackToCommit(commitHash);
      res.json(result);
    } else {
      res.status(400).json({
        success: false,
        error: 'Необходимо указать backupPath или commitHash'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/backups
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
 * GET /api/deployment/git/status
 * Получение статуса Git репозитория
 */
router.get('/git/status', async (req, res) => {
  try {
    const status = await gitManager.getRepositoryStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/git/history
 * Получение истории коммитов
 */
router.get('/git/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await gitManager.getCommitHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/server/status
 * Получение статуса сервера
 */
router.get('/server/status', async (req, res) => {
  try {
    const status = await serverManager.getServiceStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/server/restart
 * Перезапуск сервера
 */
router.post('/server/restart', async (req, res) => {
  try {
    const result = await serverManager.restartService();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/server/health
 * Проверка здоровья сервера
 */
router.get('/server/health', async (req, res) => {
  try {
    const health = await serverManager.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/server/logs
 * Получение логов сервера
 */
router.get('/server/logs', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const logs = await serverManager.getServiceLogs(lines);
    res.json(logs);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/deployment/server/logs
 * Очистка логов сервера
 */
router.delete('/server/logs', async (req, res) => {
  try {
    const result = await serverManager.clearLogs();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 