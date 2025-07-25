const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const path = require('path');

class GitManager {
  constructor() {
    this.appPath = '/home/enclude/delivery-app';
            this.gitToken = 'YOUR_GITHUB_TOKEN_HERE';
    this.remoteUrl = 'https://github.com/enclude79/DeliveryMiniapp.git';
  }

  /**
   * Инициализация Git репозитория
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async initializeRepository() {
    try {
      // Проверяем существование папки
      if (!fs.existsSync(this.appPath)) {
        throw new Error('Папка приложения не найдена');
      }

      // Переходим в папку приложения
      process.chdir(this.appPath);

      // Проверяем, является ли папка Git репозиторием
      const isGitRepo = await this.isGitRepository();
      
      if (!isGitRepo) {
        // Инициализируем новый репозиторий
        await execAsync('git init');
        await execAsync(`git remote add origin ${this.remoteUrl}`);
        
        // Настраиваем Git для работы с токеном
        await execAsync('git config user.name "DeliveryMiniapp Automation"');
        await execAsync('git config user.email "automation@deliveryvlg.xyz"');
        
        // Создаем .gitignore если не существует
        if (!fs.existsSync('.gitignore')) {
          const gitignoreContent = `
# Logs
logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed

# Coverage directory used by tools like istanbul
coverage

# Dependency directories
node_modules/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# Database files
*.db
backup/

# SSL certificates
*.pem
*.key
*.crt

# IDE files
.vscode/
.idea/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
          `.trim();
          
          fs.writeFileSync('.gitignore', gitignoreContent);
        }
      }

      // Получаем последние изменения с удаленного репозитория
      await this.fetchLatestChanges();

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка, является ли папка Git репозиторием
   * @returns {Promise<boolean>}
   */
  async isGitRepository() {
    try {
      await execAsync('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получение последних изменений с удаленного репозитория
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async fetchLatestChanges() {
    try {
      process.chdir(this.appPath);
      
      // Настраиваем аутентификацию с токеном
      const remoteUrlWithToken = this.remoteUrl.replace('https://', `https://${this.gitToken}@`);
      
      // Обновляем remote URL с токеном
      await execAsync(`git remote set-url origin ${remoteUrlWithToken}`);
      
      // Получаем изменения
      await execAsync('git fetch origin');
      
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение текущего статуса репозитория
   * @returns {Promise<{success: boolean, status: Object, error: string}>}
   */
  async getRepositoryStatus() {
    try {
      process.chdir(this.appPath);
      
      // Получаем текущую ветку
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      
      // Получаем статус
      const { stdout: status } = await execAsync('git status --porcelain');
      
      // Получаем последний коммит
      const { stdout: lastCommit } = await execAsync('git log -1 --format="%H|%an|%ae|%ad|%s" --date=iso');
      
      // Получаем список веток
      const { stdout: branches } = await execAsync('git branch -a');
      
      const [commitHash, author, email, date, message] = lastCommit.trim().split('|');
      
      return {
        success: true,
        status: {
          currentBranch: currentBranch.trim(),
          hasChanges: status.trim().length > 0,
          changes: status.trim().split('\n').filter(line => line.length > 0),
          lastCommit: {
            hash: commitHash,
            author,
            email,
            date,
            message
          },
          branches: branches.trim().split('\n').map(branch => branch.trim())
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
   * Слияние ветки develop в main
   * @returns {Promise<{success: boolean, error: string, mergeCommit: string}>}
   */
  async mergeDevelopToMain() {
    try {
      process.chdir(this.appPath);
      
      // Создаем бэкап текущего состояния
      const backupResult = await this.createBackup();
      if (!backupResult.success) {
        throw new Error(`Не удалось создать бэкап: ${backupResult.error}`);
      }
      
      // Получаем последние изменения
      await this.fetchLatestChanges();
      
      // Переключаемся на main ветку
      await execAsync('git checkout main');
      
      // Получаем последние изменения main
      await execAsync('git pull origin main');
      
      // Переключаемся на develop ветку
      await execAsync('git checkout develop');
      
      // Получаем последние изменения develop
      await execAsync('git pull origin develop');
      
      // Переключаемся обратно на main
      await execAsync('git checkout main');
      
      // Выполняем слияние
      const { stdout: mergeOutput } = await execAsync('git merge develop --no-ff -m "Merge develop into main - Automated deployment"');
      
      // Получаем хеш коммита слияния
      const { stdout: mergeCommit } = await execAsync('git rev-parse HEAD');
      
      // Пушим изменения
      await execAsync('git push origin main');
      
      return {
        success: true,
        mergeCommit: mergeCommit.trim(),
        backupPath: backupResult.backupPath,
        message: 'Слияние develop в main выполнено успешно'
      };

    } catch (error) {
      // В случае ошибки пытаемся откатиться
      try {
        await execAsync('git merge --abort');
      } catch (abortError) {
        // Игнорируем ошибки отката
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Создание бэкапа текущего состояния Git
   * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.appPath, 'backup', `git_backup_${timestamp}.tar.gz`);
      
      // Создаем папку для бэкапов если не существует
      const backupDir = path.join(this.appPath, 'backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Создаем архив текущего состояния (исключая node_modules и .git)
      await execAsync(`tar -czf "${backupPath}" --exclude=node_modules --exclude=.git --exclude=backup .`);
      
      return {
        success: true,
        backupPath,
        timestamp
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Откат к предыдущему состоянию Git
   * @param {string} commitHash - хеш коммита для отката
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackToCommit(commitHash) {
    try {
      process.chdir(this.appPath);
      
      // Создаем бэкап текущего состояния
      const backupResult = await this.createBackup();
      
      // Выполняем hard reset к указанному коммиту
      await execAsync(`git reset --hard ${commitHash}`);
      
      // Принудительно пушим изменения (опасно!)
      await execAsync('git push origin main --force');
      
      return {
        success: true,
        message: `Откат к коммиту ${commitHash} выполнен успешно`,
        backupPath: backupResult.backupPath
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение истории коммитов
   * @param {number} limit - количество коммитов
   * @returns {Promise<{success: boolean, commits: Array, error: string}>}
   */
  async getCommitHistory(limit = 10) {
    try {
      process.chdir(this.appPath);
      
      const { stdout } = await execAsync(`git log --oneline --max-count=${limit}`);
      
      const commits = stdout.trim().split('\n').map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      });
      
      return {
        success: true,
        commits
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка конфликтов при слиянии
   * @returns {Promise<{success: boolean, hasConflicts: boolean, conflicts: Array, error: string}>}
   */
  async checkMergeConflicts() {
    try {
      process.chdir(this.appPath);
      
      // Получаем статус
      const { stdout: status } = await execAsync('git status --porcelain');
      
      const conflicts = status.trim().split('\n')
        .filter(line => line.includes('UU') || line.includes('AA') || line.includes('DD'))
        .map(line => line.trim());
      
      return {
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Очистка локальных изменений
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async cleanWorkingDirectory() {
    try {
      process.chdir(this.appPath);
      
      // Сбрасываем все изменения
      await execAsync('git reset --hard HEAD');
      
      // Удаляем неотслеживаемые файлы
      await execAsync('git clean -fd');
      
      return {
        success: true,
        message: 'Рабочая директория очищена'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GitManager; 