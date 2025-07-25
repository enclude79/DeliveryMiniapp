const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');

class GitWorkflowManager {
    constructor() {
        this.repoPath = process.cwd();
    }

    // Проверка существования ветки
    async branchExists(branchName) {
        try {
            const { stdout } = await execAsync(`git branch -r | grep origin/${branchName}`, { cwd: this.repoPath });
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    // Получение текущей ветки
    async getCurrentBranch() {
        try {
            const { stdout } = await execAsync('git branch --show-current', { cwd: this.repoPath });
            return stdout.trim();
        } catch (error) {
            throw new Error(`Ошибка получения текущей ветки: ${error.message}`);
        }
    }

    // Получение списка всех веток
    async getAllBranches() {
        try {
            const { stdout } = await execAsync('git branch -a', { cwd: this.repoPath });
            return stdout.split('\n').filter(line => line.trim());
        } catch (error) {
            throw new Error(`Ошибка получения веток: ${error.message}`);
        }
    }

    // Создание feature ветки
    async createFeatureBranch(featureName) {
        try {
            const branchName = `feature/${featureName}`;
            
            // Проверяем, что мы на develop
            const currentBranch = await this.getCurrentBranch();
            if (currentBranch !== 'develop') {
                await execAsync('git checkout develop', { cwd: this.repoPath });
            }
            
            // Создаем feature ветку
            await execAsync(`git checkout -b ${branchName}`, { cwd: this.repoPath });
            await execAsync(`git push origin ${branchName}`, { cwd: this.repoPath });
            
            return { success: true, branch: branchName };
        } catch (error) {
            throw new Error(`Ошибка создания feature ветки: ${error.message}`);
        }
    }

    // Merge feature → develop
    async mergeFeatureToDevelop(featureName) {
        try {
            const branchName = `feature/${featureName}`;
            
            // Переключаемся на develop
            await execAsync('git checkout develop', { cwd: this.repoPath });
            await execAsync('git pull origin develop', { cwd: this.repoPath });
            
            // Merge feature ветки
            await execAsync(`git merge origin/${branchName} --no-ff -m "Merge feature/${featureName} into develop"`, { cwd: this.repoPath });
            await execAsync('git push origin develop', { cwd: this.repoPath });
            
            // Удаляем feature ветку
            await execAsync(`git push origin --delete ${branchName}`, { cwd: this.repoPath });
            
            return { success: true, message: `Feature ${featureName} merged to develop` };
        } catch (error) {
            throw new Error(`Ошибка merge feature в develop: ${error.message}`);
        }
    }

    // Merge develop → staging
    async mergeDevelopToStaging() {
        try {
            // Проверяем существование staging ветки
            if (!await this.branchExists('staging')) {
                await execAsync('git checkout develop', { cwd: this.repoPath });
                await execAsync('git checkout -b staging', { cwd: this.repoPath });
                await execAsync('git push origin staging', { cwd: this.repoPath });
            }
            
            // Переключаемся на staging
            await execAsync('git checkout staging', { cwd: this.repoPath });
            await execAsync('git pull origin staging', { cwd: this.repoPath });
            
            // Merge develop в staging
            await execAsync('git merge origin/develop --no-ff -m "Merge develop into staging for testing"', { cwd: this.repoPath });
            await execAsync('git push origin staging', { cwd: this.repoPath });
            
            return { success: true, message: 'Develop merged to staging for testing' };
        } catch (error) {
            throw new Error(`Ошибка merge develop в staging: ${error.message}`);
        }
    }

    // Merge staging → main (production)
    async mergeStagingToMain() {
        try {
            // Переключаемся на main
            await execAsync('git checkout main', { cwd: this.repoPath });
            await execAsync('git pull origin main', { cwd: this.repoPath });
            
            // Merge staging в main
            await execAsync('git merge origin/staging --no-ff -m "Deploy to production"', { cwd: this.repoPath });
            await execAsync('git push origin main', { cwd: this.repoPath });
            
            return { success: true, message: 'Staging merged to main - deployed to production' };
        } catch (error) {
            throw new Error(`Ошибка merge staging в main: ${error.message}`);
        }
    }

    // Получение статуса workflow
    async getWorkflowStatus() {
        try {
            const currentBranch = await this.getCurrentBranch();
            const branches = await this.getAllBranches();
            
            const hasStaging = branches.some(branch => branch.includes('staging'));
            const featureBranches = branches.filter(branch => branch.includes('feature/'));
            
            return {
                currentBranch,
                hasStaging,
                featureBranches: featureBranches.map(branch => branch.replace('remotes/origin/', '').trim()),
                workflowReady: hasStaging
            };
        } catch (error) {
            throw new Error(`Ошибка получения статуса workflow: ${error.message}`);
        }
    }

    // Создание staging ветки (если не существует)
    async ensureStagingBranch() {
        try {
            if (!await this.branchExists('staging')) {
                await execAsync('git checkout develop', { cwd: this.repoPath });
                await execAsync('git checkout -b staging', { cwd: this.repoPath });
                await execAsync('git push origin staging', { cwd: this.repoPath });
                return { success: true, message: 'Staging branch created' };
            }
            return { success: true, message: 'Staging branch already exists' };
        } catch (error) {
            throw new Error(`Ошибка создания staging ветки: ${error.message}`);
        }
    }
}

module.exports = GitWorkflowManager; 