const GitManager = require('./scripts/git-manager');

async function testSyncDevelopment() {
    console.log('🧪 Тестирование функции syncDevelopment...');
    
    try {
        const gitManager = new GitManager();
        
        console.log('📋 Выполняем syncDevelopment...');
        const result = await gitManager.syncDevelopment();
        
        console.log('📊 Результат:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ syncDevelopment выполнен успешно!');
        } else {
            console.log('❌ Ошибка в syncDevelopment:', result.error);
        }
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testSyncDevelopment(); 