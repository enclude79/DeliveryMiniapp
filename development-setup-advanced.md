# 🚀 СХЕМА РАЗДЕЛЕНИЯ КОНТУРОВ - ВАРИАНТ 2 (ПРОДВИНУТЫЙ)

## 📊 Архитектура с контейнеризацией

```
┌─────────────────────────────────────────────────────────────┐
│                    ПРОДАКШН КОНТУР                         │
│  🐳 Docker контейнер                                       │
│  🔒 Изолированная среда                                    │
│  📊 Мониторинг + логи                                     │
│  🌐 https://www.deliveryvlg.xyz                           │
└─────────────────────────────────────────────────────────────┘
                              ⬆️
                    Автоматический деплой
                              
┌─────────────────────────────────────────────────────────────┐
│                 РАЗРАБОТКА КОНТУР                          │
│  🐳 Docker контейнер                                       │
│  🧪 Автотесты при каждом push                             │
│  🚀 GitHub Actions CI/CD                                   │
│  🌐 https://dev.deliveryvlg.xyz                           │
└─────────────────────────────────────────────────────────────┘
```

## 🐳 Docker конфигурация

### Dockerfile для приложения

```dockerfile
FROM node:18-alpine
LABEL maintainer="DeliveryVLG Team"

# Рабочая директория
WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем исходный код
COPY . .

# Создаем пользователя без root прав
RUN addgroup -g 1001 -S nodejs && \
    adduser -S delivery -u 1001

# Создаем необходимые директории
RUN mkdir -p logs ssl && \
    chown -R delivery:nodejs /app

USER delivery

# Открываем порты
EXPOSE 3000 3443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Запуск приложения
CMD ["node", "server.js"]
```

### Docker Compose для разработки

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  delivery-app-dev:
    build: .
    container_name: delivery-dev
    ports:
      - "3001:3000"
      - "3444:3443"
    environment:
      - NODE_ENV=development
      - PORT=3000
      - HTTPS_PORT=3443
    volumes:
      - ./logs:/app/logs
      - ./ssl:/app/ssl:ro
      - delivery-dev-db:/app/data
    networks:
      - delivery-network
    restart: unless-stopped

  nginx-dev:
    image: nginx:alpine
    container_name: nginx-dev
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/dev.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - delivery-app-dev
    networks:
      - delivery-network

volumes:
  delivery-dev-db:

networks:
  delivery-network:
    driver: bridge
```

### Docker Compose для продакшна

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  delivery-app:
    build: .
    container_name: delivery-prod
    ports:
      - "3000:3000"
      - "3443:3443"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HTTPS_PORT=3443
    volumes:
      - ./logs:/app/logs
      - ./ssl:/app/ssl:ro
      - delivery-prod-db:/app/data
    networks:
      - delivery-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

volumes:
  delivery-prod-db:

networks:
  delivery-network:
    driver: bridge
```

## 🚀 GitHub Actions CI/CD

### Workflow файл (.github/workflows/deploy.yml)

```yaml
name: Deploy Delivery App

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run security audit
      run: npm audit --audit-level moderate

  deploy-dev:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to development
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.DEV_HOST }}
        username: ${{ secrets.DEV_USER }}
        key: ${{ secrets.DEV_SSH_KEY }}
        script: |
          cd /home/enclude/delivery-app-dev
          git pull origin develop
          docker-compose -f docker-compose.dev.yml down
          docker-compose -f docker-compose.dev.yml build
          docker-compose -f docker-compose.dev.yml up -d
          
  deploy-prod:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.PROD_HOST }}
        username: ${{ secrets.PROD_USER }}
        key: ${{ secrets.PROD_SSH_KEY }}
        script: |
          cd /home/enclude/delivery-app
          git pull origin main
          docker-compose -f docker-compose.prod.yml down
          docker-compose -f docker-compose.prod.yml build
          docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Расширенная система тестирования

### Jest конфигурация

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    'database.js',
    '!**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Примеры тестов

```javascript
// test/api/products.test.js
const request = require('supertest');
const app = require('../../server');

describe('Products API', () => {
  test('GET /products should return products list', async () => {
    const response = await request(app)
      .get('/products')
      .expect(200);
    
    expect(response.body).toHaveProperty('products');
    expect(Array.isArray(response.body.products)).toBe(true);
  });
  
  test('GET /products/categories should return categories', async () => {
    const response = await request(app)
      .get('/products/categories')
      .expect(200);
    
    expect(response.body).toHaveProperty('categories');
  });
});
```

### E2E тесты с Playwright

```javascript
// test/e2e/telegram-miniapp.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Telegram Mini App', () => {
  test('should load main page', async ({ page }) => {
    await page.goto('https://dev.deliveryvlg.xyz:3444/app');
    
    await expect(page.locator('h1')).toContainText('DeliveryVLG');
    await expect(page.locator('[data-testid="products-grid"]')).toBeVisible();
  });
  
  test('should add product to cart', async ({ page }) => {
    await page.goto('https://dev.deliveryvlg.xyz:3444/app');
    
    await page.click('[data-testid="product-1"] .add-to-cart');
    await expect(page.locator('.cart-badge')).toContainText('1');
  });
});
```

## 🔄 Workflow разработки

### 1. Feature Development

```bash
# Создание новой фичи
git checkout develop
git pull origin develop
git checkout -b feature/advanced-search

# Разработка с hot reload
docker-compose -f docker-compose.dev.yml up

# Тесты во время разработки
npm test -- --watch
```

### 2. Testing & Review

```bash
# Автоматические тесты при push
git add .
git commit -m "feat: добавлен расширенный поиск"
git push origin feature/advanced-search

# GitHub Actions запустят:
# ✅ Unit тесты
# ✅ Integration тесты  
# ✅ Security audit
# ✅ Code coverage
```

### 3. Staging & Production

```bash
# Merge в develop -> автодеплой на dev сервер
git checkout develop
git merge feature/advanced-search
git push origin develop

# Тестирование на dev.deliveryvlg.xyz

# Merge в main -> автодеплой на prod сервер  
git checkout main
git merge develop
git push origin main
```

## 📊 Monitoring & Alerting

### Prometheus метрики

```javascript
// metrics.js
const promClient = require('prom-client');

const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const dbQueries = new promClient.Counter({
  name: 'database_queries_total',
  help: 'Total database queries',
  labelNames: ['operation', 'table']
});

module.exports = { httpDuration, dbQueries };
```

### Grafana Dashboard

- 📈 Время ответа API
- 📊 Количество запросов  
- 💾 Использование памяти
- 🗄️ Операции с БД
- 👥 Активные пользователи

## ✅ Преимущества варианта 2

- ✅ **Автоматизация**: Полный CI/CD pipeline
- ✅ **Изоляция**: Docker контейнеры
- ✅ **Тестирование**: Автотесты на каждый commit
- ✅ **Мониторинг**: Prometheus + Grafana
- ✅ **Безопасность**: Автоматический security audit
- ✅ **Масштабируемость**: Готов к росту команды

## ⚠️ Требования варианта 2

- ⚠️ Docker на сервере
- ⚠️ GitHub Actions настройка
- ⚠️ Больше времени на внедрение
- ⚠️ Требует изучения Docker

---

**⏱️ Время внедрения: 2-4 часа**  
**🎯 Подходит для: Команда 2-5 разработчиков** 