#!/bin/bash
# Скрипт управления staging средой
case "$1" in
    start)
        echo "[staging] Запуск..."
        ;;
    stop)
        echo "[staging] Остановка..."
        ;;
    status)
        echo "[staging] Статус: (пример)"
        ;;
    *)
        echo "Использование: $0 {start|stop|status}"
        exit 1
        ;;
esac

