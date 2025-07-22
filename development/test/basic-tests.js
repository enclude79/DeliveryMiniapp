const fetch = require('node-fetch');

class DeliveryAppTester {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    async test(name, testFn) {
        try {
            console.log(`🧪 ${name}...`);
            await testFn();
            console.log(`✅ ${name} - ПРОЙДЕН`);
            this.results.push({ name, status: 'PASS' });
        } catch (error) {
            console.log(`❌ ${name} - ОШИБКА: ${error.message}`);
            this.results.push({ name, status: 'FAIL', error: error.message });
        }
    }

    async runAllTests() {
        console.log(`\n🚀 ЗАПУСК ТЕСТОВ ДЛЯ ${this.baseUrl}\n`);

        await this.test('Health Endpoint', async () => {
            const response = await fetch(`${this.baseUrl}/health`);
            if (response.status !== 200) throw new Error(`Status: ${response.status}`);
            
            const data = await response.json();
            if (!data.status || data.status !== 'ok') {
                throw new Error('Health check failed');
            }
        });

        await this.test('Products API', async () => {
            const response = await fetch(`${this.baseUrl}/products`);
            if (response.status !== 200) throw new Error(`Status: ${response.status}`);
        });

        await this.test('Categories API', async () => {
            const response = await fetch(`${this.baseUrl}/products/categories`);
            if (response.status !== 200) throw new Error(`Status: ${response.status}`);
        });

        await this.test('Admin Panel Access', async () => {
            const response = await fetch(`${this.baseUrl}/admin`);
            if (response.status !== 200) throw new Error(`Status: ${response.status}`);
        });

        await this.test('Mini App Access', async () => {
            const response = await fetch(`${this.baseUrl}/app`);
            if (response.status !== 200) throw new Error(`Status: ${response.status}`);
        });

        this.printResults();
        return this.results.filter(r => r.status === 'FAIL').length === 0;
    }

    printResults() {
        console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТОВ:');
        console.log('='.repeat(50));
        
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        
        console.log(`✅ Пройдено: ${passed}`);
        console.log(`❌ Провалено: ${failed}`);
        console.log(`📈 Процент успеха: ${Math.round(passed / this.results.length * 100)}%`);
        
        if (failed > 0) {
            console.log('\n❌ ПРОВАЛИВШИЕСЯ ТЕСТЫ:');
            this.results
                .filter(r => r.status === 'FAIL')
                .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
        }
    }
}

// Запуск тестов
async function runTests() {
    const env = process.env.NODE_ENV || 'production';
    const port = env === 'development' ? 3001 : 3000;
    const baseUrl = `http://127.0.0.1:${port}`;
    
    const tester = new DeliveryAppTester(baseUrl);
    const success = await tester.runAllTests();
    
    process.exit(success ? 0 : 1);
}

runTests();
