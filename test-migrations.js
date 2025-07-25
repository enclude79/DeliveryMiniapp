#!/usr/bin/env node

const GitManager = require('./scripts/git-manager');

async function testMigrations() {
    console.log('🧪 Тестирование генерации миграций...');
    console.log('=' .repeat(60));
    
    try {
        const gitManager = new GitManager();
        
        console.log('📋 Генерируем миграции...');
        console.log('⏰ Время начала:', new Date().toISOString());
        
        const migrations = await gitManager.generateMigrations();
        
        console.log('=' .repeat(60));
        console.log('📊 РЕЗУЛЬТАТ ГЕНЕРАЦИИ МИГРАЦИЙ:');
        console.log('✅ Количество миграций:', migrations.length);
        
        if (migrations.length > 0) {
            console.log('\n📋 СПИСОК МИГРАЦИЙ:');
            migrations.forEach((migration, index) => {
                console.log(`\n${index + 1}. ${migration.type.toUpperCase()}`);
                console.log(`   Таблица: ${migration.table}`);
                if (migration.column) {
                    console.log(`   Колонка: ${migration.column}`);
                }
                console.log(`   Описание: ${migration.description}`);
                console.log(`   SQL: ${migration.sql}`);
            });
        } else {
            console.log('ℹ️ Миграции не требуются');
        }
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('=' .repeat(60));
    console.log('⏰ Время завершения:', new Date().toISOString());
}

// Запускаем тест
testMigrations(); 