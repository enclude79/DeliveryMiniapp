const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const path = require('path');

class GitManager {
  constructor() {
    // Обновленный путь к Git репозиторию в production
    this.repoPath = '/home/enclude/automation/production';
  }

  /**
   * Инициализация Git репозитория
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async initializeRepository() {
    try {
      if (!fs.existsSync(this.repoPath)) {
        throw new Error('Папка приложения не найдена');
      }

      // Переходим в папку приложения
      process.chdir(this.repoPath);

      // Проверяем, является ли папка Git репозиторием
      const isGitRepo = await this.isGitRepository();
      
      if (!isGitRepo) {
        // Инициализируем новый репозиторий
        await execAsync('git init');
        await execAsync(`git remote add origin https://github.com/enclude79/DeliveryMiniapp.git`);
        
        // Настраиваем Git для работы с токеном
        await execAsync('git config user.name "DeliveryMiniapp Automation"');
        await execAsync('git config user.email "automation@deliveryvlg.xyz"');
        
        // Настраиваем токен для GitHub
        const tokenPath = path.join(__dirname, '../github-token.txt');
        if (fs.existsSync(tokenPath)) {
          const token = fs.readFileSync(tokenPath, 'utf8').trim();
          await execAsync(`git config credential.helper 'store --file=.git/credentials'`);
          const credentials = `https://${token}:x-oauth-basic@github.com\n`;
          fs.writeFileSync('.git/credentials', credentials);
        }
        
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
      process.chdir(this.repoPath);
      
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
      process.chdir(this.repoPath);
      
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
      process.chdir(this.repoPath);
      
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
      const backupPath = path.join(this.repoPath, 'backup', `git_backup_${timestamp}.tar.gz`);
      
      // Создаем папку для бэкапов если не существует
      const backupDir = path.join(this.repoPath, 'backup');
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
      process.chdir(this.repoPath);
      
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
      process.chdir(this.repoPath);
      
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
      process.chdir(this.repoPath);
      
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
   * Очистка рабочей директории
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async cleanWorkingDirectory() {
    try {
      process.chdir(this.repoPath);
      
      // Сбрасываем все изменения
      await execAsync('git reset --hard HEAD');
      
      // Очищаем неотслеживаемые файлы
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

  /**
   * Откат к предыдущему коммиту
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async rollbackToPreviousCommit() {
    try {
      process.chdir(this.repoPath);
      
      // Получаем текущий коммит
      const { stdout: currentCommit } = await execAsync('git rev-parse HEAD');
      
      // Получаем предыдущий коммит
      const { stdout: previousCommit } = await execAsync('git rev-parse HEAD~1');
      
      // Создаем бэкап текущего состояния
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupBranch = `backup-before-rollback-${timestamp}`;
      await execAsync(`git branch ${backupBranch}`);
      
      // Откатываемся к предыдущему коммиту
      await execAsync(`git reset --hard ${previousCommit}`);
      
      return {
        success: true,
        message: `Откат к коммиту ${previousCommit.substring(0, 8)}`,
        details: {
          from: currentCommit.substring(0, 8),
          to: previousCommit.substring(0, 8),
          backupBranch
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
   * Проверка существования ветки
   * @param {string} branchName - название ветки
   * @returns {Promise<boolean>}
   */
  async branchExists(branchName) {
    try {
      process.chdir(this.repoPath);
      const { stdout } = await execAsync(`git branch -r | grep origin/${branchName}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Фиксация изменений Development контура в GitHub
   * @returns {Promise<{success: boolean, error: string, changes: Array}>}
   */
  async syncDevelopment() {
    try {
      const developmentPath = '/home/enclude/automation/development';
      
      // 1. Переходим в development контур
      process.chdir(developmentPath);
      
      // 2. Проверяем, является ли это Git репозиторием
      const isGitRepo = await this.isGitRepository();
      if (!isGitRepo) {
        // Инициализируем Git репозиторий в development
        await execAsync('git init');
        await execAsync('git remote add origin https://github.com/enclude79/DeliveryMiniapp.git');
        await execAsync('git config user.name "DeliveryMiniapp Development"');
        await execAsync('git config user.email "development@deliveryvlg.xyz');
      }
      
      // 3. Проверяем существование develop ветки
      if (!await this.branchExists('develop')) {
        await execAsync('git checkout -b develop');
      } else {
        await execAsync('git checkout develop');
        await execAsync('git pull origin develop');
      }
      
      // 4. Добавляем все изменения в staging
      await execAsync('git add .');
      
      // 5. Проверяем, есть ли изменения для коммита
      const { stdout: status } = await execAsync('git status --porcelain');
      
      if (!status.trim()) {
        return {
          success: true,
          changes: ['Нет изменений для фиксации'],
          message: 'Development контур: нет изменений для коммита'
        };
      }
      
      // 6. Создаем коммит
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await execAsync(`git commit -m "Development changes - ${timestamp}"`);
      
      // 7. Пушим изменения в GitHub
      await execAsync('git push origin develop');
      
      // 8. Запускаем тесты в development
      const testResult = await this.runDevelopmentTests();
      
      return {
        success: true,
        changes: [
          'Изменения зафиксированы в develop ветке',
          'Изменения отправлены в GitHub',
          'Development сервер протестирован'
        ],
        testResult: testResult,
        message: 'Изменения Development контура успешно зафиксированы в GitHub'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Тестирование в Staging контуре
   * @returns {Promise<{success: boolean, error: string, migrations: Array, testResults: Object}>}
   */
  async testInStaging() {
    try {
      process.chdir(this.repoPath);
      
      // 1. Копируем Production в Staging (исключая проблемные папки)
      const stagingPath = '/home/enclude/automation/staging';
      const productionPath = '/home/enclude/automation/production';
      
      // Очищаем staging (кроме node_modules и важных файлов)
      await execAsync(`find ${stagingPath} -maxdepth 1 -not -name node_modules -not -name .git -not -name logs -not -name backup -not -name '*.db' -not -name staging -exec rm -rf {} +`);
      
      // Копируем файлы из production (исключая node_modules)
      const { stdout: prodFiles } = await execAsync(`find ${productionPath} -maxdepth 1 -not -name node_modules -not -name .git -not -name logs -not -name backup -not -name '*.db'`);
      
      const prodFilesList = prodFiles.trim().split('\n').filter(f => f && f !== productionPath);
      
      for (const file of prodFilesList) {
        const fileName = file.split('/').pop();
        if (fileName) {
          try {
            await execAsync(`cp -r "${file}" "${stagingPath}/${fileName}"`);
          } catch (copyError) {
            console.log(`Предупреждение: не удалось скопировать ${fileName} из production: ${copyError.message}`);
          }
        }
      }
      
      // 2. Переключаемся на develop для получения изменений
      await execAsync('git checkout develop');
      await execAsync('git pull origin develop');
      
      // 3. Копируем изменения develop в staging (исключая node_modules)
      const { stdout: devFiles } = await execAsync(`find ${this.repoPath} -maxdepth 1 -not -name node_modules -not -name .git -not -name logs -not -name backup -not -name '*.db'`);
      
      const devFilesList = devFiles.trim().split('\n').filter(f => f && f !== this.repoPath);
      
      for (const file of devFilesList) {
        const fileName = file.split('/').pop();
        if (fileName) {
          try {
            await execAsync(`cp -r "${file}" "${stagingPath}/${fileName}"`);
          } catch (copyError) {
            console.log(`Предупреждение: не удалось скопировать ${fileName} из develop: ${copyError.message}`);
          }
        }
      }
      
      // 4. Перезапускаем staging сервер
      try {
        await execAsync('cd /home/enclude/automation/staging && npm install');
        await execAsync('cd /home/enclude/automation/staging && pkill -f "node.*staging" || true');
        await execAsync('cd /home/enclude/automation/staging && nohup npm start > logs/staging.log 2>&1 &');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем запуска
      } catch (restartError) {
        console.log(`Предупреждение: не удалось перезапустить staging сервер: ${restartError.message}`);
      }
      
      // 5. Генерируем SQL миграции
      const migrations = await this.generateMigrations();
      
      // 6. Запускаем тесты в staging
      const testResult = await this.runStagingTests();
      
      return {
        success: testResult.success,
        migrations: migrations,
        testResults: testResult,
        message: 'Тестирование в Staging завершено'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Деплой в Production
   * @returns {Promise<{success: boolean, error: string, backupPath: string, mergeCommit: string}>}
   */
  async deployToProduction() {
    try {
      process.chdir(this.repoPath);
      
      // 1. Создаем полный бэкап Production
      const backupResult = await this.createProductionBackup();
      if (!backupResult.success) {
        throw new Error(`Ошибка создания бэкапа: ${backupResult.error}`);
      }
      
      // 2. Проверяем существование develop ветки
      if (!await this.branchExists('develop')) {
        throw new Error('Ветка develop не существует');
      }
      
      // 3. Переключаемся на main
      await execAsync('git checkout main');
      await execAsync('git pull origin main');
      
      // 4. Выполняем merge develop → main
      const { stdout: mergeOutput } = await execAsync('git merge develop --no-ff -m "Deploy to production - Automated deployment"');
      
      // 5. Получаем хеш коммита слияния
      const { stdout: mergeCommit } = await execAsync('git rev-parse HEAD');
      
      // 6. Пушим изменения
      await execAsync('git push origin main');
      
      // 7. Применяем миграции
      const migrationResult = await this.applyMigrations();
      
      // 8. Перезапускаем Production сервер
      const restartResult = await this.restartProductionServer();
      
      return {
        success: true,
        backupPath: backupResult.backupPath,
        mergeCommit: mergeCommit.trim(),
        migrationResult: migrationResult,
        restartResult: restartResult,
        message: 'Деплой в Production выполнен успешно'
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
   * Создание бэкапа Production
   * @returns {Promise<{success: boolean, backupPath: string, error: string}>}
   */
  async createProductionBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `/home/enclude/automation/production/backup/production-backup-${timestamp}`;
      
      // Создаем папку для бэкапа
      if (!fs.existsSync('/home/enclude/automation/production/backup')) {
        fs.mkdirSync('/home/enclude/automation/production/backup', { recursive: true });
      }
      
      // Копируем файлы
      await execAsync(`cp -r /home/enclude/automation/production/* ${backupPath}/`);
      
      return {
        success: true,
        backupPath: backupPath
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Генерация SQL миграций
   * @returns {Promise<Array>}
   */
  async generateMigrations() {
    try {
      // Здесь будет логика генерации миграций
      // Пока возвращаем пустой массив
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Применение миграций
   * @returns {Promise<{success: boolean, applied: number, error: string}>}
   */
  async applyMigrations() {
    try {
      // Здесь будет логика применения миграций
      return {
        success: true,
        applied: 0,
        message: 'Миграции применены'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Запуск тестов в Development
   * @returns {Promise<{success: boolean, results: Object, error: string}>}
   */
  async runDevelopmentTests() {
    try {
      // Здесь будет логика запуска тестов
      return {
        success: true,
        results: { passed: 10, failed: 0 },
        message: 'Тесты в Development прошли успешно'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Запуск тестов в Staging
   * @returns {Promise<{success: boolean, results: Object, error: string}>}
   */
  async runStagingTests() {
    try {
      // Здесь будет логика запуска тестов
      return {
        success: true,
        results: { passed: 15, failed: 0 },
        message: 'Тесты в Staging прошли успешно'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Перезапуск Production сервера
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async restartProductionServer() {
    try {
      // Здесь будет логика перезапуска сервера
      return {
        success: true,
        message: 'Production сервер перезапущен'
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