#!/bin/bash
# Скрипт управления development средой
case "$1" in
    start)
        echo "[development] Запуск..."
        ;;
    stop)
        echo "[development] Остановка..."
        ;;
    status)
        echo "[development] Статус: (пример)"
        ;;
    *)
        echo "Использование: $0 {start|stop|status}"
        exit 1
        ;;
esac

