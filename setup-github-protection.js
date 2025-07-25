#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

class GitHubProtectionSetup {
    constructor() {
        this.token = this.getGitHubToken();
        this.owner = 'enclude79';
        this.repo = 'DeliveryMiniapp';
        this.baseUrl = 'api.github.com';
    }

    getGitHubToken() {
        try {
            const tokenPath = path.join(__dirname, 'github-token.txt');
            if (fs.existsSync(tokenPath)) {
                return fs.readFileSync(tokenPath, 'utf8').trim();
            }
        } catch (error) {
            console.log('⚠️  Не удалось прочитать токен из файла');
        }
        
        // Используем токен из .git/config если есть
        try {
            const gitConfig = fs.readFileSync('.git/config', 'utf8');
            const match = gitConfig.match(/url = https:\/\/[^@]+@github\.com/);
            if (match) {
                const url = match[0].replace('url = https://', '');
                const token = url.split('@')[0];
                return token;
            }
        } catch (error) {
            console.log('⚠️  Не удалось получить токен из git config');
        }
        
        return null;
    }

    async makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: `/repos/${this.owner}/${this.repo}${endpoint}`,
                method: method,
                headers: {
                    'User-Agent': 'GitHub-Protection-Setup',
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                }
            };

            if (this.token) {
                options.headers['Authorization'] = `token ${this.token}`;
            }

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve({ status: res.statusCode, data: response });
                    } catch (error) {
                        resolve({ status: res.statusCode, data: body });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async setupBranchProtection(branchName) {
        console.log(`🔒 Настройка защиты для ветки: ${branchName}`);
        
        const protectionData = {
            required_status_checks: null,
            enforce_admins: false,
            required_pull_request_reviews: {
                required_approving_review_count: 1,
                dismiss_stale_reviews: true,
                require_code_owner_reviews: false,
                require_last_push_approval: false
            },
            restrictions: null,
            required_linear_history: false,
            allow_force_pushes: false,
            allow_deletions: false,
            block_creations: false,
            required_conversation_resolution: false
        };

        try {
            const response = await this.makeRequest(
                'PUT',
                `/branches/${branchName}/protection`,
                protectionData
            );

            if (response.status === 200) {
                console.log(`✅ Защита для ветки ${branchName} настроена успешно`);
                return true;
            } else {
                console.log(`❌ Ошибка настройки защиты для ${branchName}: ${response.status}`);
                console.log(`   Ответ: ${JSON.stringify(response.data, null, 2)}`);
                return false;
            }
        } catch (error) {
            console.log(`❌ Ошибка при настройке защиты для ${branchName}: ${error.message}`);
            return false;
        }
    }

    async checkBranchExists(branchName) {
        try {
            const response = await this.makeRequest('GET', `/branches/${branchName}`);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async setupAllProtections() {
        console.log('🚀 Настройка защиты веток в GitHub');
        console.log('=====================================');
        
        if (!this.token) {
            console.log('❌ GitHub токен не найден');
            console.log('📋 Создайте файл github-token.txt с вашим токеном или');
            console.log('   убедитесь, что токен указан в .git/config');
            return false;
        }

        const branches = ['main', 'staging', 'develop'];
        let successCount = 0;

        for (const branch of branches) {
            console.log(`\n📋 Проверка ветки: ${branch}`);
            
            const exists = await this.checkBranchExists(branch);
            if (!exists) {
                console.log(`⚠️  Ветка ${branch} не существует в GitHub`);
                continue;
            }

            const success = await this.setupBranchProtection(branch);
            if (success) {
                successCount++;
            }
        }

        console.log(`\n📊 Результат: ${successCount}/${branches.length} веток защищены`);
        
        if (successCount === branches.length) {
            console.log('✅ Все ветки успешно защищены!');
            return true;
        } else {
            console.log('⚠️  Некоторые ветки не удалось защитить');
            return false;
        }
    }

    async createInstructions() {
        const instructions = `# 🔒 Настройка защиты веток в GitHub

## ✅ Автоматическая настройка выполнена

Если автоматическая настройка не сработала, выполните вручную:

### 1. Откройте GitHub репозиторий:
https://github.com/enclude79/DeliveryMiniapp

### 2. Перейдите в Settings → Branches

### 3. Для каждой ветки (main, staging, develop):
1. Нажмите "Add rule"
2. Введите название ветки: \`main\` (или \`staging\`, \`develop\`)
3. Включите опции:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1
   - ✅ Dismiss stale PR approvals when new commits are pushed
   - ✅ Require status checks to pass before merging

### 4. Нажмите "Create" для каждой ветки

## 🎯 Результат:
- \`main\` - только через Pull Request с одобрением
- \`staging\` - только через Pull Request
- \`develop\` - только через Pull Request

## 🔗 Полезные ссылки:
- Dashboard: http://89.169.182.9:3003/git-workflow
- GitHub репозиторий: https://github.com/enclude79/DeliveryMiniapp
`;

        fs.writeFileSync('GITHUB_PROTECTION_INSTRUCTIONS.md', instructions);
        console.log('📖 Инструкции сохранены в GITHUB_PROTECTION_INSTRUCTIONS.md');
    }
}

// Запуск настройки
async function main() {
    const setup = new GitHubProtectionSetup();
    
    try {
        const success = await setup.setupAllProtections();
        await setup.createInstructions();
        
        if (success) {
            console.log('\n🎉 Защита веток настроена успешно!');
        } else {
            console.log('\n⚠️  Выполните настройку вручную по инструкциям');
        }
    } catch (error) {
        console.error('❌ Ошибка настройки:', error.message);
        await setup.createInstructions();
    }
}

main(); 