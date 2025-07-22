#!/bin/bash

case "$1" in
    "dev"|"development")
        echo "🔄 Переключение на DEV окружение"
        cd /home/enclude/delivery-app-dev
        export NODE_ENV=development
        echo "✅ Теперь в DEV режиме"
        echo "📁 Директория: $(pwd)"
        echo "🔌 Порт: 3001"
        echo "💡 Используйте: npm run dev"
        ;;
    "prod"|"production")
        echo "🔄 Переключение на PROD окружение"
        cd /home/enclude/delivery-app
        export NODE_ENV=production
        echo "✅ Теперь в PROD режиме"
        echo "📁 Директория: $(pwd)"
        echo "🔌 Порт: 3000"
        echo "💡 Используйте: npm start"
        ;;
    *)
        echo "❌ Использование: $0 [dev|prod]"
        echo "Примеры:"
        echo "  $0 dev   - переключиться на разработку"
        echo "  $0 prod  - переключиться на продакшн"
        exit 1
        ;;
esac
