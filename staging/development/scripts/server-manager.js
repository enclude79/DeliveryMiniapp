const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const path = require('path');

class ServerManager {
  constructor() {
    this.appPath = '/home/enclude/delivery-app';
    this.serviceName = 'delivery-app';
    this.ports = {
      main: 3000,
      ssl: 3443
    };
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
   * Проверка здоровья приложения
   * @returns {Promise<{success: boolean, status: Object, error: string}>}
   */
  async healthCheck() {
    try {
      const axios = require('axios');
      
      // Проверяем основной порт
      const mainResponse = await axios.get(`http://localhost:${this.ports.main}/health`, {
        timeout: 5000
      });
      
      // Проверяем SSL порт
      const sslResponse = await axios.get(`https://localhost:${this.ports.ssl}/health`, {
        timeout: 5000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });
      
      return {
        success: true,
        status: {
          main: {
            port: this.ports.main,
            status: mainResponse.status,
            responseTime: mainResponse.headers['x-response-time'] || 'N/A'
          },
          ssl: {
            port: this.ports.ssl,
            status: sslResponse.status,
            responseTime: sslResponse.headers['x-response-time'] || 'N/A'
          },
          timestamp: new Date().toISOString()
        }
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

  /**
   * Установка зависимостей
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async installDependencies() {
    try {
      process.chdir(this.appPath);
      
      // Проверяем существование package.json
      if (!fs.existsSync('package.json')) {
        throw new Error('package.json не найден');
      }
      
      // Устанавливаем зависимости
      await execAsync('npm install --production');
      
      return {
        success: true,
        message: 'Зависимости установлены'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
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
}

module.exports = ServerManager; 