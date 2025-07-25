#!/usr/bin/env node

const GitManager = require('./scripts/git-manager');

async function testStaging() {
    console.log('🧪 Тестирование функции testInStaging...');
    console.log('=' .repeat(60));
    
    try {
        const gitManager = new GitManager();
        
        console.log('📋 Выполняем testInStaging...');
        console.log('⏰ Время начала:', new Date().toISOString());
        
        const result = await gitManager.testInStaging();
        
        console.log('=' .repeat(60));
        console.log('📊 РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ В STAGING:');
        console.log('✅ Успех:', result.success);
        console.log('📝 Сообщение:', result.message);
        
        if (result.success) {
            console.log('🎉 testInStaging выполнен успешно!');
            
            if (result.migrations && result.migrations.length > 0) {
                console.log(`🔧 Сгенерировано миграций: ${result.migrations.length}`);
                console.log('\n📋 СПИСОК МИГРАЦИЙ:');
                result.migrations.forEach((migration, index) => {
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
            
            if (result.testResults) {
                console.log('\n🧪 РЕЗУЛЬТАТЫ ТЕСТОВ:');
                console.log(`• Статус: ${result.testResults.success ? '✅ Успешно' : '❌ Ошибка'}`);
                if (result.testResults.results) {
                    console.log(`• Пройдено: ${result.testResults.results.passed}`);
                    console.log(`• Провалено: ${result.testResults.results.failed}`);
                }
                console.log(`• Сообщение: ${result.testResults.message}`);
            }
        } else {
            console.log('❌ Ошибка в testInStaging:', result.error);
        }
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('=' .repeat(60));
    console.log('⏰ Время завершения:', new Date().toISOString());
}

// Запускаем тест
testStaging(); 