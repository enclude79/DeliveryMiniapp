module.exports = {
  environment: 'staging',
  port: 3002,
  httpsPort: 3445,
  database: {
    host: 'localhost',
    port: 5432,
    name: 'delivery_miniapp_staging',
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'your_password'
  },
  logging: {
    level: 'warn',
    file: './logs/staging.log'
  },
  cors: {
    origin: ['http://localhost:3002', 'http://127.0.0.1:3002', 'https://localhost:3445'],
    credentials: true
  }
}; 