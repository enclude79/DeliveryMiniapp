const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const path = require('path');

class ServerManager {
  constructor(orchestrator = null) {
    this.appPath = '/home/enclude/delivery-app';
    this.serviceName = 'delivery-app';
    this.ports = {
      main: 3000,
      ssl: 3443
    };
    this.orchestrator = orchestrator;
  }

  /**
   * Получение статуса сервиса
   * @returns {Promise<{success: boolean, status: Object, error: string}>}
   */
  async getServiceStatus() {
    try {
      const { stdout } = await execAsync(`systemctl status ${this.serviceName}`);
      
      const isActive = stdout.includes('Active: active (running)');
      const isEnabled = stdout.includes('Loaded: loaded');
      
      // Извлекаем PID если сервис запущен
      let pid = null;
      if (isActive) {
        const pidMatch = stdout.match(/Main PID: (\d+)/);
        if (pidMatch) {
          pid = parseInt(pidMatch[1]);
        }
      }
      
      // Извлекаем время работы
      let uptime = null;
      if (isActive) {
        const uptimeMatch = stdout.match(/Active: active \(running\) (.*)/);
        if (uptimeMatch) {
          uptime = uptimeMatch[1].trim();
        }
      }
      
      return {
        success: true,
        status: {
          isActive,
          isEnabled,
          pid,
          uptime,
          rawOutput: stdout
        }
      };

    } catch (error) {
      // Если сервис не найден или не запущен
      return {
        success: true,
        status: {
          isActive: false,
          isEnabled: false,
          pid: null,
          uptime: null,
          error: error.message
        }
      };
    }
  }

  /**
   * Запуск сервиса
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async startService() {
    try {
      await execAsync(`sudo systemctl start ${this.serviceName}`);
      
      // Ждем немного и проверяем статус
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = await this.getServiceStatus();
      if (!status.success || !status.status.isActive) {
        throw new Error('Сервис не запустился');
      }
      
      return {
        success: true,
        message: 'Сервис успешно запущен'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Остановка сервиса
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async stopService() {
    try {
      await execAsync(`sudo systemctl stop ${this.serviceName}`);
      
      // Ждем немного и проверяем статус
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = await this.getServiceStatus();
      if (status.success && status.status.isActive) {
        throw new Error('Сервис не остановился');
      }
      
      return {
        success: true,
        message: 'Сервис успешно остановлен'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Перезапуск сервиса
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async restartService() {
    try {
      // Создаем бэкап перед перезапуском
      const backupResult = await this.createBackup();
      
      await execAsync(`sudo systemctl restart ${this.serviceName}`);
      
      // Ждем немного и проверяем статус
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const status = await this.getServiceStatus();
      if (!status.success || !status.status.isActive) {
        throw new Error('Сервис не перезапустился');
      }
      
      // Проверяем доступность приложения
      const healthCheck = await this.healthCheck();
      if (!healthCheck.success) {
        throw new Error(`Приложение недоступно после перезапуска: ${healthCheck.error}`);
      }
      
      return {
        success: true,
        message: 'Сервис успешно перезапущен',
        backupPath: backupResult.backupPath,
        healthStatus: healthCheck.status
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка здоровья сервера
   * @returns {Promise<{success: boolean, status: string, error: string}>}
   */
  async healthCheck() {
    try {
      const axios = require('axios');
      
      // Проверяем production HTTP сервер (порт 3000) - используем IPv4
      const httpResponse = await axios.get('http://127.0.0.1:3000/health', {
        timeout: 5000
      });
      
      // Проверяем production HTTPS сервер (порт 3443) - используем IPv4
      const httpsResponse = await axios.get('https://127.0.0.1:3443/health', {
        timeout: 5000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });
      
      if (httpResponse.status === 200 && httpsResponse.status === 200) {
        return {
          success: true,
          status: 'healthy',
          http: {
            port: 3000,
            status: httpResponse.status,
            response: httpResponse.data
          },
          https: {
            port: 3443,
            status: httpsResponse.status,
            response: httpsResponse.data
          }
        };
      } else {
        return {
          success: false,
          status: 'unhealthy',
          error: `HTTP: ${httpResponse.status}, HTTPS: ${httpsResponse.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Создание бэкапа конфигурации сервера
   * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.appPath, 'backup', `server_config_${timestamp}.tar.gz`);
      
      // Создаем папку для бэкапов если не существует
      const backupDir = path.join(this.appPath, 'backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Бэкапим важные конфигурационные файлы
      const configFiles = [
        '.env',
        'package.json',
        'server.js',
        'database.js',
        'delivery-app.service'
      ];
      
      const existingFiles = configFiles.filter(file => 
        fs.existsSync(path.join(this.appPath, file))
      );
      
      if (existingFiles.length > 0) {
        const filesList = existingFiles.map(file => path.join(this.appPath, file)).join(' ');
        await execAsync(`tar -czf "${backupPath}" -C "${this.appPath}" ${existingFiles.join(' ')}`);
      }
      
      return {
        success: true,
        backupPath,
        timestamp,
        filesBackedUp: existingFiles
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение информации о системе
   * @returns {Promise<{success: boolean, systemInfo: Object, error: string}>}
   */
  async getSystemInfo() {
    try {
      // Получаем информацию о памяти
      const { stdout: memoryInfo } = await execAsync('free -h');
      
      // Получаем информацию о диске
      const { stdout: diskInfo } = await execAsync('df -h');
      
      // Получаем информацию о CPU
      const { stdout: cpuInfo } = await execAsync('top -bn1 | grep "Cpu(s)"');
      
      // Получаем информацию о загрузке
      const { stdout: loadInfo } = await execAsync('uptime');
      
      // Получаем информацию о процессах
      const { stdout: processInfo } = await execAsync('ps aux | grep node | grep -v grep');
      
      return {
        success: true,
        systemInfo: {
          memory: memoryInfo,
          disk: diskInfo,
          cpu: cpuInfo,
          load: loadInfo,
          processes: processInfo,
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
   * Проверка портов
   * @returns {Promise<{success: boolean, ports: Object, error: string}>}
   */
  async checkPorts() {
    try {
      const ports = {};
      
      for (const [name, port] of Object.entries(this.ports)) {
        try {
          const { stdout } = await execAsync(`netstat -tlnp | grep :${port}`);
          ports[name] = {
            port,
            isOpen: true,
            process: stdout.trim()
          };
        } catch {
          ports[name] = {
            port,
            isOpen: false,
            process: null
          };
        }
      }
      
      return {
        success: true,
        ports
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение логов сервиса
   * @param {number} lines - количество строк
   * @returns {Promise<{success: boolean, logs: string, error: string}>}
   */
  async getServiceLogs(lines = 100) {
    try {
      const { stdout } = await execAsync(`sudo journalctl -u ${this.serviceName} -n ${lines} --no-pager`);
      
      return {
        success: true,
        logs: stdout
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Очистка логов
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async clearLogs() {
    try {
      // Очищаем логи сервиса
      await execAsync(`sudo journalctl -u ${this.serviceName} --vacuum-time=1d`);
      
      // Очищаем логи приложения
      const logFiles = [
        path.join(this.appPath, 'logs'),
        path.join(this.appPath, 'server.log'),
        path.join(this.appPath, 'server-prod.log')
      ];
      
      for (const logPath of logFiles) {
        if (fs.existsSync(logPath)) {
          if (fs.statSync(logPath).isDirectory()) {
            await execAsync(`find "${logPath}" -name "*.log" -delete`);
          } else {
            fs.writeFileSync(logPath, '');
          }
        }
      }
      
      return {
        success: true,
        message: 'Логи очищены'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getAppPath(env) {
    switch (env) {
      case 'production':
        return '/home/enclude/automation/production';
      case 'development':
        return '/home/enclude/automation/development';
      case 'staging':
        return '/home/enclude/automation/staging';
      default:
        return '/home/enclude/automation/production';
    }
  }

  installDependencies(env = 'production') {
    return new Promise((resolve, reject) => {
      const appPath = this.getAppPath(env);
      exec('npm install', { cwd: appPath }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        resolve(stdout || 'npm install выполнен');
      });
    });
  }

  updateDependencies(env = 'production') {
    return new Promise((resolve, reject) => {
      const appPath = this.getAppPath(env);
      exec('npm update', { cwd: appPath }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        resolve(stdout || 'npm update выполнен');
      });
    });
  }

  /**
   * Обновление приложения
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async updateApplication() {
    try {
      // Создаем бэкап
      const backupResult = await this.createBackup();
      
      // Останавливаем сервис
      await this.stopService();
      
      // Устанавливаем зависимости
      await this.installDependencies();
      
      // Запускаем сервис
      await this.startService();
      
      // Проверяем здоровье
      const healthCheck = await this.healthCheck();
      
      return {
        success: true,
        message: 'Приложение обновлено',
        backupPath: backupResult.backupPath,
        healthStatus: healthCheck.status
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение статуса всех сред
   * @returns {Promise<{success: boolean, environments: Object}>}
   */
  async getAllEnvironmentsStatus() {
    try {
      const environments = {};
      const envs = ['production', 'development', 'staging'];
      
      for (const env of envs) {
        const status = await this.getEnvironmentStatus(env);
        environments[env] = status;
      }
      
      return {
        success: true,
        environments,
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
   * Запуск среды через systemd сервисы
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async startEnvironment(env) {
    try {
      // Логируем в orchestrator
      const orchestrator = global.orchestrator || this.orchestrator;
      if (orchestrator) {
        orchestrator.log('info', `Запуск среды через systemd: ${env}`);
      }
      
      // Маппинг сред к systemd сервисам
      const serviceMap = {
        production: 'delivery-app-production',
        development: 'delivery-app-dev',
        staging: 'delivery-app-staging'
      };
      
      const serviceName = serviceMap[env];
      if (!serviceName) {
        const error = `Неизвестная среда: ${env}`;
        if (orchestrator) {
          orchestrator.log('error', error);
        }
        throw new Error(error);
      }
      
      if (orchestrator) {
        orchestrator.log('info', `Запуск systemd сервиса: ${serviceName}`);
      }
      
      // Логика управления сервисами в зависимости от среды
      if (env === 'production') {
        // Production всегда должен работать - запускаем только его
        if (orchestrator) {
          orchestrator.log('info', 'Запуск production - основной сервис');
        }
      } else if (env === 'development' || env === 'staging') {
        // Development и staging могут работать параллельно
        // Останавливаем только другую dev/staging среду, но НЕ production
        const devStagingServices = ['delivery-app-dev', 'delivery-app-staging'];
        const otherDevStaging = devStagingServices.filter(s => s !== serviceName);
        
        for (const otherService of otherDevStaging) {
          try {
            await execAsync(`sudo systemctl stop ${otherService}`);
            if (orchestrator) {
              orchestrator.log('info', `Остановлен dev/staging сервис: ${otherService}`);
            }
          } catch (e) {
            if (orchestrator) {
              orchestrator.log('warning', `Не удалось остановить ${otherService}: ${e.message}`);
            }
          }
        }
        
        if (orchestrator) {
          orchestrator.log('info', 'Production остается активным');
        }
      }
      
      // Запускаем нужный сервис
      const { stdout, stderr } = await execAsync(`sudo systemctl start ${serviceName}`);
      
      if (orchestrator) {
        orchestrator.log('info', `stdout: ${stdout}`);
        if (stderr) {
          orchestrator.log('warning', `stderr: ${stderr}`);
        }
      }
      
      // Ждем немного, чтобы сервер успел запуститься
      if (orchestrator) {
        orchestrator.log('info', 'Ожидание запуска сервера...');
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Проверяем статус сервиса
      try {
        const { stdout: statusOutput } = await execAsync(`sudo systemctl is-active ${serviceName}`);
        if (orchestrator) {
          orchestrator.log('info', `Статус сервиса ${serviceName}: ${statusOutput}`);
        }
      } catch (e) {
        if (orchestrator) {
          orchestrator.log('warning', `Сервис ${serviceName} не активен: ${e.message}`);
        }
      }
      
      // Проверяем, что сервер запустился на порту
      const portMap = {
        production: 3000,
        development: 3001,
        staging: 3002
      };
      
      const port = portMap[env];
      if (port) {
        try {
          const { stdout: netstatOutput } = await execAsync(`netstat -tlnp | grep :${port}`);
          if (orchestrator) {
            orchestrator.log('info', `Сервер запущен на порту ${port}: ${netstatOutput}`);
          }
        } catch (e) {
          if (orchestrator) {
            orchestrator.log('warning', `Сервер не найден на порту ${port}`);
          }
        }
      }
      
      const result = {
        success: true,
        message: `${env} среда успешно запущена через systemd сервис ${serviceName}`,
        output: stdout,
        timestamp: new Date().toISOString()
      };
      
      if (orchestrator) {
        orchestrator.log('success', result.message);
      }
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      if (orchestrator) {
        orchestrator.log('error', `Ошибка запуска ${env}: ${error.message}`);
      }
      return result;
    }
  }

  /**
   * Остановка среды через systemd сервисы
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async stopEnvironment(env) {
    try {
      // Логируем в orchestrator
      const orchestrator = global.orchestrator || this.orchestrator;
      if (orchestrator) {
        orchestrator.log('info', `Остановка среды через systemd: ${env}`);
      }
      
      // Маппинг сред к systemd сервисам
      const serviceMap = {
        production: 'delivery-app-production',
        development: 'delivery-app-dev',
        staging: 'delivery-app-staging'
      };
      
      const serviceName = serviceMap[env];
      if (!serviceName) {
        const error = `Неизвестная среда: ${env}`;
        if (orchestrator) {
          orchestrator.log('error', error);
        }
        throw new Error(error);
      }
      
      // Защита: Production нельзя останавливать через dashboard
      if (env === 'production') {
        const error = 'Production нельзя останавливать через dashboard. Используйте командную строку для экстренной остановки.';
        if (orchestrator) {
          orchestrator.log('error', error);
        }
        throw new Error(error);
      }
      
      if (orchestrator) {
        orchestrator.log('info', `Остановка systemd сервиса: ${serviceName}`);
      }
      
      // Останавливаем сервис (только dev/staging)
      const { stdout, stderr } = await execAsync(`sudo systemctl stop ${serviceName}`);
      
      if (orchestrator) {
        orchestrator.log('info', `stdout: ${stdout}`);
        if (stderr) {
          orchestrator.log('warning', `stderr: ${stderr}`);
        }
      }
      
      // Проверяем статус сервиса
      try {
        const { stdout: statusOutput } = await execAsync(`sudo systemctl is-active ${serviceName}`);
        if (orchestrator) {
          orchestrator.log('warning', `Сервис ${serviceName} все еще активен: ${statusOutput}`);
        }
      } catch (e) {
        if (orchestrator) {
          orchestrator.log('info', `Сервис ${serviceName} успешно остановлен`);
        }
      }
      
      return {
        success: true,
        message: `${env} среда остановлена через systemd сервис ${serviceName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      const orchestrator = global.orchestrator || this.orchestrator;
      if (orchestrator) {
        orchestrator.log('error', `Ошибка остановки ${env}: ${error.message}`);
      }
      return result;
    }
  }

  /**
   * Перезапуск среды через systemd сервисы
   * @param {string} env - production|development|staging
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async restartEnvironment(env) {
    try {
      // Логируем в orchestrator
      const orchestrator = global.orchestrator || this.orchestrator;
      if (orchestrator) {
        orchestrator.log('info', `Перезапуск среды через systemd: ${env}`);
      }
      
      // Маппинг сред к systemd сервисам
      const serviceMap = {
        production: 'delivery-app-production',
        development: 'delivery-app-dev',
        staging: 'delivery-app-staging'
      };
      
      const serviceName = serviceMap[env];
      if (!serviceName) {
        const error = `Неизвестная среда: ${env}`;
        if (orchestrator) {
          orchestrator.log('error', error);
        }
        throw new Error(error);
      }
      
      if (orchestrator) {
        orchestrator.log('info', `Перезапуск systemd сервиса: ${serviceName}`);
      }
      
      // Перезапускаем сервис
      const { stdout, stderr } = await execAsync(`sudo systemctl restart ${serviceName}`);
      
      if (orchestrator) {
        orchestrator.log('info', `stdout: ${stdout}`);
        if (stderr) {
          orchestrator.log('warning', `stderr: ${stderr}`);
        }
      }
      
      // Ждем немного, чтобы сервер успел перезапуститься
      if (orchestrator) {
        orchestrator.log('info', 'Ожидание перезапуска сервера...');
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Проверяем статус сервиса
      try {
        const { stdout: statusOutput } = await execAsync(`sudo systemctl is-active ${serviceName}`);
        if (orchestrator) {
          orchestrator.log('info', `Статус сервиса ${serviceName}: ${statusOutput}`);
        }
      } catch (e) {
        if (orchestrator) {
          orchestrator.log('warning', `Сервис ${serviceName} не активен: ${e.message}`);
        }
      }
      
      return {
        success: true,
        message: `${env} среда перезапущена через systemd сервис ${serviceName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      const orchestrator = global.orchestrator || this.orchestrator;
      if (orchestrator) {
        orchestrator.log('error', `Ошибка перезапуска ${env}: ${error.message}`);
      }
      return result;
    }
  }

  /**
   * Получение логов среды
   * @param {string} env - production|development|staging
   * @param {number} lines - количество строк
   * @returns {Promise<{success: boolean, logs: string}>}
   */
  async getEnvironmentLogs(env, lines = 100) {
    try {
      const logPaths = {
        production: '/home/enclude/automation/production/logs/app.log',
        development: '/home/enclude/automation/development/dev.log',
        staging: '/home/enclude/automation/staging/staging.log'
      };
      
      const logPath = logPaths[env];
      if (!logPath || !fs.existsSync(logPath)) {
        return {
          success: true,
          logs: `Логи для ${env} не найдены`,
          timestamp: new Date().toISOString()
        };
      }
      
      const { stdout } = await execAsync(`tail -n ${lines} "${logPath}"`);
      
      return {
        success: true,
        logs: stdout,
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
   * Получение статуса конкретной среды
   * @param {string} env - production|development|staging
   * @returns {Promise<string>}
   */
  async getEnvironmentStatus(env) {
    try {
      const portMap = {
        production: 3000,
        development: 3001,
        staging: 3002
      };
      
      const port = portMap[env];
      if (!port) {
        return 'Неизвестная среда';
      }
      
      const { stdout } = await execAsync(`netstat -tlnp | grep :${port} || echo "not running"`);
      
      if (stdout.includes('not running')) {
        return 'Остановлен';
      } else {
        return 'Работает';
      }
    } catch (error) {
      return 'Ошибка проверки';
    }
  }
}

module.exports = ServerManager; 