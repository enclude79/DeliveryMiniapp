#!/bin/bash

# =======================================================
# СКРИПТ ВОССТАНОВЛЕНИЯ ИЗ РЕЗЕРВНОЙ КОПИИ
# DeliveryVLG - Восстановление БД и изображений товаров
# =======================================================

set -e

# Конфигурация
BACKUP_DIR="/home/enclude/delivery-app/backup"
DB_FILE="/home/enclude/delivery-app/delivery.db"
IMAGES_DIR="/home/enclude/delivery-app/public/uploads"
LOG_FILE="/var/log/delivery-app-restore.log"

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Проверяем аргументы
if [ $# -eq 0 ]; then
    echo "Использование: $0 <backup-file.tar.gz>"
    echo ""
    echo "Доступные backup файлы:"
    ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "Backup файлы не найдены"
    exit 1
fi

BACKUP_FILE="$1"

# Проверяем существование backup файла
if [ ! -f "$BACKUP_FILE" ]; then
    # Пробуем найти в директории backup
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        log "❌ ОШИБКА: Backup файл не найден: $BACKUP_FILE"
        exit 1
    fi
fi

log "🔄 Начинаем восстановление из: $BACKUP_FILE"

# Подтверждение от пользователя
echo ""
echo "⚠️  ВНИМАНИЕ: Это действие перезапишет текущие данные!"
echo "📊 База данных: $DB_FILE"
echo "🖼️  Изображения: $IMAGES_DIR"
echo ""
read -p "Продолжить восстановление? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "❌ Восстановление отменено пользователем"
    exit 1
fi

# Создаем резервную копию текущих данных
CURRENT_BACKUP="current-backup-$(date +%Y%m%d_%H%M%S)"
log "💾 Создаем backup текущих данных: $CURRENT_BACKUP"

mkdir -p "/tmp/$CURRENT_BACKUP"
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "/tmp/$CURRENT_BACKUP/"
fi
if [ -d "$IMAGES_DIR" ]; then
    cp -r "$IMAGES_DIR" "/tmp/$CURRENT_BACKUP/"
fi

# Останавливаем сервис (если запущен)
log "🔄 Останавливаем сервис delivery-app..."
sudo systemctl stop delivery-app 2>/dev/null || true

# Извлекаем backup
TEMP_DIR="/tmp/restore-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$TEMP_DIR"
log "📦 Извлекаем backup архив..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Находим директорию с данными
BACKUP_DATA_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "delivery-backup-*" | head -1)
if [ -z "$BACKUP_DATA_DIR" ]; then
    log "❌ ОШИБКА: Не найдена директория с данными в backup"
    exit 1
fi

log "📁 Найдена директория с данными: $BACKUP_DATA_DIR"

# Восстанавливаем базу данных
if [ -f "$BACKUP_DATA_DIR/delivery.db" ]; then
    log "📊 Восстанавливаем базу данных..."
    
    # Проверяем целостность БД из backup
    if sqlite3 "$BACKUP_DATA_DIR/delivery.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        cp "$BACKUP_DATA_DIR/delivery.db" "$DB_FILE"
        log "✅ База данных восстановлена"
    else
        log "❌ ОШИБКА: Повреждена база данных в backup!"
        exit 1
    fi
else
    log "⚠️  ВНИМАНИЕ: База данных не найдена в backup"
fi

# Восстанавливаем изображения
if [ -d "$BACKUP_DATA_DIR/uploads" ]; then
    log "🖼️  Восстанавливаем изображения товаров..."
    
    # Очищаем текущую директорию изображений
    if [ -d "$IMAGES_DIR" ]; then
        rm -rf "$IMAGES_DIR"/*
    else
        mkdir -p "$IMAGES_DIR"
    fi
    
    # Копируем изображения из backup
    cp -r "$BACKUP_DATA_DIR/uploads"/* "$IMAGES_DIR/"
    
    # Подсчитываем восстановленные файлы
    RESTORED_COUNT=$(find "$IMAGES_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) | wc -l)
    log "✅ Восстановлено изображений: $RESTORED_COUNT"
else
    log "⚠️  ВНИМАНИЕ: Изображения не найдены в backup"
fi

# Показываем информацию о backup
if [ -f "$BACKUP_DATA_DIR/backup-info.txt" ]; then
    log "📋 Информация о backup:"
    cat "$BACKUP_DATA_DIR/backup-info.txt" | tee -a "$LOG_FILE"
fi

# Очищаем временные файлы
rm -rf "$TEMP_DIR"

# Запускаем сервис обратно
log "🚀 Запускаем сервис delivery-app..."
sudo systemctl start delivery-app 2>/dev/null || true

# Проверяем статус сервиса
sleep 3
if sudo systemctl is-active --quiet delivery-app; then
    log "✅ Сервис запущен успешно"
else
    log "⚠️  ВНИМАНИЕ: Проблемы с запуском сервиса"
fi

log "✅ Восстановление завершено успешно!"
log "💾 Backup текущих данных сохранен в: /tmp/$CURRENT_BACKUP"

echo ""
echo "🎉 Восстановление завершено!"
echo "📊 Проверьте работу приложения: http://localhost:3000"
echo "💾 Backup старых данных: /tmp/$CURRENT_BACKUP"

exit 0

