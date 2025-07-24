module.exports = {
  environment: 'development',
  port: 3001,  // HTTP порт для Development
  httpsPort: 3444,  // HTTPS порт для Development
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
    origin: [
      'http://localhost:3001', 
      'http://127.0.0.1:3001', 
      'https://localhost:3444',
      'https://www.deliveryvlg.xyz:3444'
    ],
    credentials: true
  },
  // Добавляем четкое разделение сред
  environments: {
    development: {
      port: 3001,
      httpsPort: 3444,
      database: 'delivery-dev.db'
    },
    staging: {
      port: 3002,
      httpsPort: 3445,
      database: 'delivery-staging.db'
    },
    production: {
      port: 3000,
      httpsPort: 3443,
      database: 'delivery.db'
    }
  }
}; 