module.exports = {
  environment: 'development',
  port: 3001,
  httpsPort: 3444,
  database: {
    host: 'localhost',
    port: 5432,
    name: 'delivery_miniapp_development',
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'your_password'
  },
  logging: {
    level: 'debug',
    file: './logs/development.log'
  },
  cors: {
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'https://localhost:3444'],
    credentials: true
  }
}; 