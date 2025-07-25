#!/usr/bin/env node

/**
 * DeliveryVLG Migration Manager
 * Система управления SQL миграциями
 * 
 * Использование:
 *   node scripts/migrate.js run [environment]    - Выполнить все новые миграции
 *   node scripts/migrate.js status              - Показать статус миграций
 *   node scripts/migrate.js create <name>       - Создать новую миграцию
 *   node scripts/migrate.js rollback [count]    - Откатить миграции (НЕ РЕАЛИЗОВАНО)
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const { promisify } = require('util');

// Константы
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DEFAULT_ENV = process.env.NODE_ENV || 'production';

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class MigrationManager {
    constructor(environment = DEFAULT_ENV) {
        this.environment = environment;
        this.dbFile = environment === 'development' ? 'delivery-dev.db' : 'delivery.db';
        this.dbPath = path.join(__dirname, '..', this.dbFile);
        this.db = null;
    }

    // Подключение к базе данных
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`${colors.green}✅ Подключен к БД: ${this.dbFile}${colors.reset}`);
                    resolve();
                }
            });
        });
    }

    // Закрытие соединения
    async disconnect() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close(() => {
                    console.log(`${colors.blue}📡 Соединение с БД закрыто${colors.reset}`);
                    resolve();
                });
            });
        }
    }

    // Выполнение SQL запроса
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Выполнение SQL без возврата результата
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // Создание таблицы миграций
    async ensureMigrationsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                execution_time_ms INTEGER,
                checksum TEXT,
                description TEXT
            )
        `;
        await this.run(sql);
        
        // Создание индекса
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_migrations_filename 
            ON migrations(filename)
        `);
        
        console.log(`${colors.green}✅ Таблица migrations готова${colors.reset}`);
    }

    // Получение списка файлов миграций
    getMigrationFiles() {
        if (!fs.existsSync(MIGRATIONS_DIR)) {
            fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
            console.log(`${colors.yellow}📁 Создана директория migrations${colors.reset}`);
        }

        return fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort();
    }

    // Получение выполненных миграций
    async getExecutedMigrations() {
        try {
            const rows = await this.query('SELECT filename FROM migrations ORDER BY filename');
            return rows.map(row => row.filename);
        } catch (err) {
            // Если таблица не существует, возвращаем пустой массив
            return [];
        }
    }

    // Вычисление чексуммы файла
    calculateChecksum(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    // Извлечение описания из файла миграции
    extractDescription(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.includes('-- Описание:') || line.includes('-- Description:')) {
                return line.replace(/^--\s*(Описание|Description):\s*/, '').trim();
            }
        }
        return 'Описание отсутствует';
    }

    // Выполнение одной миграции
    async executeMigration(filename) {
        const filePath = path.join(MIGRATIONS_DIR, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        const checksum = this.calculateChecksum(content);
        const description = this.extractDescription(content);

        console.log(`${colors.cyan}🔄 Выполняется: ${filename}${colors.reset}`);
        
        const startTime = Date.now();
        
        let currentStatement = '';
        try {
            // Разделяем на отдельные SQL команды
            const statements = content
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt && !stmt.startsWith('--'));

            // Выполняем в транзакции
            await this.run('BEGIN TRANSACTION');
            
            for (const statement of statements) {
                if (statement) {
                    currentStatement = statement;
                    await this.run(statement);
                }
            }
            
            const executionTime = Date.now() - startTime;
            
            // Записываем в таблицу миграций
            await this.run(`
                INSERT INTO migrations (filename, execution_time_ms, checksum, description)
                VALUES (?, ?, ?, ?)
            `, [filename, executionTime, checksum, description]);
            
            await this.run('COMMIT');
            
            console.log(`${colors.green}✅ Выполнено: ${filename} (${executionTime}ms)${colors.reset}`);
            return true;
            
        } catch (err) {
            await this.run('ROLLBACK');
            console.error(`${colors.red}❌ Ошибка в миграции ${filename}:${colors.reset}`);
            
            // Улучшенное логирование: показываем, на каком именно запросе произошла ошибка
            if (currentStatement) {
                 console.error(`${colors.yellow}   ↳ Проблемный SQL: ${currentStatement}${colors.reset}`);
            }
            console.error(`${colors.red}   ↳ ${err.message}${colors.reset}`);
            throw err;
        }
    }

    // Выполнение всех новых миграций
    async runMigrations() {
        console.log(`${colors.bright}🚀 Запуск миграций для окружения: ${this.environment}${colors.reset}`);
        
        await this.ensureMigrationsTable();
        
        const allMigrations = this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();
        const pendingMigrations = allMigrations.filter(file => !executedMigrations.includes(file));
        
        if (pendingMigrations.length === 0) {
            console.log(`${colors.green}✅ Все миграции уже выполнены${colors.reset}`);
            return;
        }
        
        console.log(`${colors.yellow}📝 Найдено ${pendingMigrations.length} новых миграций:${colors.reset}`);
        pendingMigrations.forEach(file => {
            console.log(`   • ${file}`);
        });
        
        let executed = 0;
        for (const migration of pendingMigrations) {
            try {
                await this.executeMigration(migration);
                executed++;
            } catch (err) {
                console.error(`${colors.red}💥 Выполнение миграций остановлено из-за ошибки.${colors.reset}`);
                // Перехватываем ошибку, чтобы не продолжать, но и не падать с некрасивым стеком
                process.exit(1);
            }
        }
        
        console.log(`${colors.green}🎉 Успешно выполнено ${executed} из ${pendingMigrations.length} ожидающих миграций.${colors.reset}`);
    }

    // Показать статус миграций
    async showStatus() {
        console.log(`${colors.bright}📊 Статус миграций (${this.environment}):${colors.reset}`);
        console.log(`📁 База данных: ${this.dbFile}`);
        console.log(`📁 Директория миграций: ${MIGRATIONS_DIR}`);
        console.log('');
        
        await this.ensureMigrationsTable();
        
        const allMigrations = this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();
        
        if (allMigrations.length === 0) {
            console.log(`${colors.yellow}⚠️  Файлы миграций не найдены${colors.reset}`);
            return;
        }
        
        console.log('Список миграций:');
        console.log('');
        
        for (const migration of allMigrations) {
            const isExecuted = executedMigrations.includes(migration);
            const status = isExecuted ? 
                `${colors.green}✅ Выполнено${colors.reset}` : 
                `${colors.yellow}⏳ Ожидает${colors.reset}`;
            
            console.log(`  ${status} ${migration}`);
            
            if (isExecuted) {
                try {
                    const info = await this.query(
                        'SELECT executed_at, execution_time_ms, description FROM migrations WHERE filename = ?',
                        [migration]
                    );
                    if (info.length > 0) {
                        const { executed_at, execution_time_ms, description } = info[0];
                        console.log(`           📅 ${executed_at} (${execution_time_ms}ms)`);
                        if (description !== 'Описание отсутствует') {
                            console.log(`           📝 ${description}`);
                        }
                    }
                } catch (err) {
                    // Игнорируем ошибки получения информации
                }
            }
        }
        
        const pending = allMigrations.length - executedMigrations.length;
        console.log('');
        console.log(`📈 Всего миграций: ${allMigrations.length}`);
        console.log(`✅ Выполнено: ${executedMigrations.length}`);
        console.log(`⏳ Ожидает: ${pending}`);
    }

    // Создание новой миграции
    async createMigration(name) {
        if (!name) {
            throw new Error('Необходимо указать имя миграции');
        }
        
        // Генерируем timestamp
        const timestamp = new Date().toISOString()
            .replace(/[-:]/g, '')
            .replace('T', '_')
            .slice(0, 15); // YYYYMMDD_HHMMSS
        
        // Нормализуем имя
        const normalizedName = name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_');
        
        const filename = `${timestamp}_${normalizedName}.sql`;
        const filePath = path.join(MIGRATIONS_DIR, filename);
        
        // Шаблон миграции
        const template = `-- Миграция: ${normalizedName}
-- Файл: ${filename}  
-- Автор: DeliveryVLG Migration System
-- Дата: ${new Date().toISOString().split('T')[0]}
-- Описание: ${name}

-- ========================================
-- МИГРАЦИЯ ВПЕРЕД (UP)
-- ========================================

-- Пример: Создание новой таблицы
-- CREATE TABLE example_table (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     name TEXT NOT NULL,
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- Пример: Добавление колонки
-- ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Пример: Создание индекса
-- CREATE INDEX idx_users_avatar ON users(avatar_url);

-- ========================================
-- ВАЖНО: ОТКАТ НЕ ПОДДЕРЖИВАЕТСЯ!
-- ========================================
-- Все изменения должны быть совместимы с предыдущими версиями.
-- Следуйте принципам zero-downtime deployments:
-- 1. Новые колонки должны быть nullable или иметь default значения
-- 2. Не удаляйте колонки сразу - сначала перестаньте их использовать
-- 3. Переименование - делайте в 2 шага (добавить -> скопировать -> удалить)

-- ВАШ КОД МИГРАЦИИ ЗДЕСЬ:

`;

        fs.writeFileSync(filePath, template);
        
        console.log(`${colors.green}✅ Создана новая миграция:${colors.reset}`);
        console.log(`📁 ${filePath}`);
        console.log('');
        console.log(`${colors.yellow}💡 Следующие шаги:${colors.reset}`);
        console.log(`1. Отредактируйте файл миграции`);
        console.log(`2. Выполните: npm run migrate:run`);
        console.log(`3. Проверьте результат: npm run migrate:status`);
    }
}

// Главная функция
async function main() {
    const [,, command, ...args] = process.argv;
    
    if (!command) {
        console.log(`${colors.bright}🗄️  DeliveryVLG Migration Manager${colors.reset}`);
        console.log('');
        console.log('Использование:');
        console.log('  npm run migrate:run [env]     - Выполнить миграции');
        console.log('  npm run migrate:status        - Показать статус');
        console.log('  npm run migrate:create <name> - Создать миграцию');
        console.log('');
        console.log('Окружения: production (по умолчанию), development');
        process.exit(0);
    }
    
    try {
        let environment = DEFAULT_ENV;
        
        // Определяем окружение для команды run
        if (command === 'run' && args[0]) {
            environment = args[0];
        }
        
        const manager = new MigrationManager(environment);
        await manager.connect();
        
        switch (command) {
            case 'run':
                await manager.runMigrations();
                break;
                
            case 'status':
                await manager.showStatus();
                break;
                
            case 'create':
                await manager.createMigration(args[0]);
                break;
                
            default:
                console.error(`${colors.red}❌ Неизвестная команда: ${command}${colors.reset}`);
                process.exit(1);
        }
        
        await manager.disconnect();
        console.log(`${colors.green}🏁 Готово!${colors.reset}`);
        
    } catch (err) {
        console.error(`${colors.red}💥 Ошибка: ${err.message}${colors.reset}`);
        process.exit(1);
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    main();
}

module.exports = { MigrationManager }; 