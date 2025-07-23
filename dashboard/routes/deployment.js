const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const DeploymentOrchestrator = require('../../scripts/deployment-orchestrator');
const DatabaseManager = require('../../scripts/database-manager');
const GitManager = require('../../scripts/git-manager');
const ServerManager = require('../../scripts/server-manager');

const orchestrator = global.orchestrator || new DeploymentOrchestrator();
const dbManager = DatabaseManager;
const gitManager = GitManager;
const serverManager = new ServerManager(global.orchestrator);

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
    // Сначала пытаемся получить логи из памяти
    let logs = orchestrator.getLogs();
    
    // Если логи в памяти пустые, читаем из файла
    if (!logs || logs.length === 0) {
      const logFile = path.join(__dirname, '../../logs/deployment.log');
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        
        logs = lines.map(line => {
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
      }
    }
    
    res.json({
      success: true,
      logs: logs || []
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
 * POST /api/deployment/run-tests
 * Запуск автоматических тестов для среды
 */
router.post('/run-tests', async (req, res) => {
  try {
    const { env } = req.body;
    if (!env) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать среду (production, development, staging)'
      });
    }

    const result = await orchestrator.runTests(env);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/rollback
 * Откат изменений для среды
 */
router.post('/rollback', async (req, res) => {
  try {
    const { env, reason } = req.body;
    if (!env) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать среду (production, development, staging)'
      });
    }

    // Для production требуется дополнительное подтверждение
    if (env === 'production') {
      const { confirmed } = req.body;
      if (!confirmed) {
        return res.status(403).json({
          success: false,
          error: 'Подтверждение требуется для rollback production',
          requiresConfirmation: true
        });
      }
    }

    const result = await orchestrator.automaticRollback(env, reason || 'Manual rollback');
    res.json(result);
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

/**
 * POST /api/deployment/install-deps
 * Установка зависимостей (npm install/yarn install) для выбранной среды
 */
router.post('/install-deps', async (req, res) => {
  try {
    const env = req.body.env || req.query.env || 'production';
    // Здесь вызываем скрипт установки зависимостей для нужной среды
    // Например: scripts/server-manager.js или shell-скрипт
    const result = await serverManager.installDependencies(env);
    res.json({ success: true, output: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/deployment/update-deps
 * Обновление зависимостей (npm update/yarn upgrade) для выбранной среды
 */
router.post('/update-deps', async (req, res) => {
  try {
    const env = req.body.env || req.query.env || 'production';
    // Здесь вызываем скрипт обновления зависимостей для нужной среды
    const result = await serverManager.updateDependencies(env);
    res.json({ success: true, output: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/deployment/promote-to-staging
 * Продвижение dev -> staging
 */
router.post('/promote-to-staging', async (req, res) => {
  try {
    const result = await orchestrator.promoteToStaging();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/promote-to-production
 * Продвижение staging -> production (с approval)
 */
router.post('/promote-to-production', async (req, res) => {
  try {
    const { approved, reason } = req.body;
    
    // Проверяем approval для production
    if (!approved) {
      return res.status(403).json({
        success: false,
        error: 'Approval required for production deployment',
        requiresApproval: true,
        message: 'Для развертывания в production требуется подтверждение'
      });
    }
    
    // Логируем approval
    console.log(`Production deployment approved by: ${req.ip}, reason: ${reason || 'No reason provided'}`);
    
    const result = await orchestrator.promoteToProduction();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/promote-dev-to-prod
 * Прямое продвижение dev -> production (с approval)
 */
router.post('/promote-dev-to-prod', async (req, res) => {
  try {
    const { approved, reason } = req.body;
    
    // Проверяем approval для production
    if (!approved) {
      return res.status(403).json({
        success: false,
        error: 'Approval required for production deployment',
        requiresApproval: true,
        message: 'Для развертывания в production требуется подтверждение'
      });
    }
    
    // Логируем approval
    console.log(`Direct production deployment approved by: ${req.ip}, reason: ${reason || 'No reason provided'}`);
    
    const result = await orchestrator.promoteDevToProduction();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/environments/status
 * Получение статуса всех сред
 */
router.get('/environments/status', async (req, res) => {
  try {
    const status = await serverManager.getAllEnvironmentsStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/environments/start
 * Запуск среды
 */
router.post('/environments/start', async (req, res) => {
  try {
    const { env } = req.body;
    if (!env) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать среду (production, development, staging)'
      });
    }
    
    console.log(`[${new Date().toISOString()}] [INFO] Запуск среды: ${env}`);
    const result = await serverManager.startEnvironment(env);
    console.log(`[${new Date().toISOString()}] [INFO] Результат запуска ${env}:`, result);
    res.json(result);
  } catch (error) {
    console.log(`[${new Date().toISOString()}] [ERROR] Ошибка запуска ${env}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/environments/stop
 * Остановка среды
 */
router.post('/environments/stop', async (req, res) => {
  try {
    const { env } = req.body;
    if (!env) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать среду (production, development, staging)'
      });
    }
    
    const result = await serverManager.stopEnvironment(env);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/environments/restart
 * Перезапуск среды
 */
router.post('/environments/restart', async (req, res) => {
  try {
    const { env } = req.body;
    if (!env) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать среду (production, development, staging)'
      });
    }
    
    const result = await serverManager.restartEnvironment(env);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/environments/logs
 * Получение логов среды
 */
router.get('/environments/logs', async (req, res) => {
  try {
    const { env, lines } = req.query;
    if (!env) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать среду (production, development, staging)'
      });
    }
    
    const logLines = parseInt(lines) || 100;
    const logs = await serverManager.getEnvironmentLogs(env, logLines);
    res.json(logs);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/workflow/full
 * Выполнение полного workflow: Development → Staging → Production
 */
router.post('/workflow/full', async (req, res) => {
  try {
    const result = await orchestrator.performFullWorkflow();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/workflow/sync-development
 * Синхронизация Development контура
 */
router.post('/workflow/sync-development', async (req, res) => {
  try {
    const result = await orchestrator.syncDevelopment();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/workflow/test-staging
 * Тестирование в Staging контуре
 */
router.post('/workflow/test-staging', async (req, res) => {
  try {
    const result = await orchestrator.testInStaging();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/workflow/deploy-production
 * Деплой в Production
 */
router.post('/workflow/deploy-production', async (req, res) => {
  try {
    const result = await orchestrator.deployToProduction();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/workflow/rollback-staging
 * Откат Staging к состоянию Production
 */
router.post('/workflow/rollback-staging', async (req, res) => {
  try {
    const result = await orchestrator.rollbackStagingToProduction();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/deployment/workflow/rollback-production
 * Откат Production к предыдущему коммиту
 */
router.post('/workflow/rollback-production', async (req, res) => {
  try {
    const result = await orchestrator.rollbackProductionToPreviousCommit();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/deployment/workflow/status
 * Получение статуса workflow
 */
router.get('/workflow/status', async (req, res) => {
  try {
    const logs = orchestrator.getLogs();
    const workflowLogs = logs.filter(log => 
      log.message.includes('workflow') || 
      log.message.includes('Development') || 
      log.message.includes('Staging') || 
      log.message.includes('Production')
    );
    
    res.json({
      success: true,
      logs: workflowLogs.slice(-20), // Последние 20 записей
      totalLogs: workflowLogs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 