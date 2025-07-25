#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

class GitWorkflowSetup {
    constructor() {
        this.repoPath = process.cwd();
    }

    async runCommand(command, description) {
        try {
            console.log(`🔄 ${description}...`);
            const { stdout, stderr } = await execAsync(command, { 
                cwd: this.repoPath,
                maxBuffer: 1024 * 1024 // 1MB
            });
            
            if (stderr) {
                console.log(`⚠️  Предупреждение: ${stderr}`);
            }
            
            if (stdout) {
                console.log(`✅ ${description} завершено`);
                return stdout.trim();
            }
            
            return '';
        } catch (error) {
            console.error(`❌ Ошибка при ${description}: ${error.message}`);
            throw error;
        }
    }

    async checkBranchExists(branchName) {
        try {
            const { stdout } = await execAsync(`git branch -r | grep origin/${branchName}`, { 
                cwd: this.repoPath 
            });
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    async getCurrentBranch() {
        try {
            const { stdout } = await execAsync('git branch --show-current', { 
                cwd: this.repoPath 
            });
            return stdout.trim();
        } catch (error) {
            console.error(`❌ Ошибка получения текущей ветки: ${error.message}`);
            return null;
        }
    }

    async getAllBranches() {
        try {
            const { stdout } = await execAsync('git branch -a', { 
                cwd: this.repoPath 
            });
            return stdout.split('\n').filter(line => line.trim());
        } catch (error) {
            console.error(`❌ Ошибка получения веток: ${error.message}`);
            return [];
        }
    }

    async setupWorkflow() {
        console.log('🚀 Настройка Git Workflow');
        console.log('========================');
        
        try {
            // 1. Проверяем текущее состояние
            console.log('\n📋 Шаг 1: Проверка текущего состояния...');
            const currentBranch = await this.getCurrentBranch();
            console.log(`   Текущая ветка: ${currentBranch}`);
            
            const branches = await this.getAllBranches();
            console.log(`   Всего веток: ${branches.length}`);
            
            // 2. Создаем staging ветку
            console.log('\n📋 Шаг 2: Создание staging ветки...');
            const stagingExists = await this.checkBranchExists('staging');
            
            if (!stagingExists) {
                console.log('   Staging ветка не существует, создаем...');
                
                // Переключаемся на develop
                await this.runCommand('git checkout develop', 'Переключение на develop');
                await this.runCommand('git pull origin develop', 'Обновление develop');
                
                // Создаем staging ветку
                await this.runCommand('git checkout -b staging', 'Создание staging ветки');
                await this.runCommand('git push origin staging', 'Отправка staging в origin');
                
                console.log('✅ Staging ветка создана');
            } else {
                console.log('✅ Staging ветка уже существует');
            }
            
            // 3. Переключаемся на develop
            console.log('\n📋 Шаг 3: Переключение на develop...');
            await this.runCommand('git checkout develop', 'Переключение на develop');
            
            // 4. Создаем пример feature ветки
            console.log('\n📋 Шаг 4: Создание примера feature ветки...');
            await this.runCommand('git checkout -b feature/example-feature', 'Создание feature ветки');
            await this.runCommand('git push origin feature/example-feature', 'Отправка feature ветки');
            
            // 5. Возвращаемся на develop
            await this.runCommand('git checkout develop', 'Возврат на develop');
            
            // 6. Показываем финальную структуру
            console.log('\n📋 Шаг 5: Финальная структура веток...');
            const finalBranches = await this.getAllBranches();
            console.log('   Доступные ветки:');
            finalBranches.forEach(branch => {
                console.log(`   - ${branch.trim()}`);
            });
            
            // 7. Создаем файл с инструкциями
            console.log('\n📋 Шаг 6: Создание инструкций...');
            const instructions = this.createInstructions();
            fs.writeFileSync('GIT_WORKFLOW_INSTRUCTIONS.md', instructions);
            
            console.log('\n🎉 Git Workflow успешно настроен!');
            console.log('\n📋 Следующие шаги:');
            console.log('1. Настройте защиту веток в GitHub');
            console.log('2. Обновите Dashboard с новыми маршрутами');
            console.log('3. Протестируйте workflow');
            console.log('\n📖 Подробные инструкции: GIT_WORKFLOW_INSTRUCTIONS.md');
            
        } catch (error) {
            console.error('\n❌ Ошибка настройки workflow:', error.message);
            console.log('\n🔧 Попробуйте выполнить команды вручную:');
            console.log('git checkout develop');
            console.log('git checkout -b staging');
            console.log('git push origin staging');
        }
    }

    createInstructions() {
        return `# 🚀 Git Workflow - Инструкции по настройке

## ✅ Что уже сделано:
- Создана staging ветка
- Создан пример feature ветки
- Настроена базовая структура

## 🔧 Что нужно сделать вручную:

### 1. Настройка защиты веток в GitHub:
1. Откройте репозиторий в GitHub
2. Settings → Branches → Add rule
3. Для каждой ветки (main, staging, develop):
   - Branch name pattern: \`main\` (или \`staging\`, \`develop\`)
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1

### 2. Обновление Dashboard:
Добавьте в \`server.js\`:
\`\`\`javascript
const gitWorkflowRoutes = require('./dashboard/routes/git-workflow');
app.use('/api/git-workflow', gitWorkflowRoutes);

app.get('/git-workflow', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard/public/git-workflow.html'));
});
\`\`\`

### 3. Тестирование workflow:
1. Создайте feature ветку: \`git checkout -b feature/test\`
2. Внесите изменения и commit
3. Создайте Pull Request feature → develop
4. После merge, создайте Pull Request develop → staging
5. Протестируйте в staging
6. Создайте Pull Request staging → main

## 🎯 Целевая схема:
\`\`\`
main (production) ← merge после успешного staging
  ↑
staging ← merge из develop после готовности фичи  
  ↑
develop ← ежедневная разработка
  ↑
feature/название-фичи ← разработка конкретных фич
\`\`\`

## 🔗 Полезные ссылки:
- Dashboard: http://your-server:3000/git-workflow
- Документация: GIT_WORKFLOW_SETUP.md
- Краткий план: GIT_WORKFLOW_SUMMARY.md
`;
    }
}

// Запуск настройки
async function main() {
    const setup = new GitWorkflowSetup();
    await setup.setupWorkflow();
}

main().catch(console.error); 