#!/usr/bin/env node

const GitManager = require('./scripts/git-manager');

async function testSyncDevelopment() {
    console.log('🧪 Тестирование исправленной функции syncDevelopment...');
    console.log('=' .repeat(60));
    
    try {
        const gitManager = new GitManager();
        
        console.log('📋 Выполняем syncDevelopment...');
        console.log('⏰ Время начала:', new Date().toISOString());
        
        const result = await gitManager.syncDevelopment();
        
        console.log('=' .repeat(60));
        console.log('📊 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:');
        console.log('✅ Успех:', result.success);
        console.log('📝 Сообщение:', result.message);
        
        if (result.success) {
            console.log('🎉 syncDevelopment выполнен успешно!');
            if (result.changes) {
                console.log('📋 Выполненные изменения:');
                result.changes.forEach((change, index) => {
                    console.log(`  ${index + 1}. ${change}`);
                });
            }
            if (result.testResult) {
                console.log('🧪 Результаты тестов:', JSON.stringify(result.testResult, null, 2));
            }
        } else {
            console.log('❌ Ошибка в syncDevelopment:', result.error);
        }
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('=' .repeat(60));
    console.log('⏰ Время завершения:', new Date().toISOString());
}

// Запускаем тест
testSyncDevelopment(); 