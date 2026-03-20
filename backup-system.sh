#!/bin/bash

# =======================================================
# СИСТЕМА АВТОМАТИЧЕСКОГО РЕЗЕРВНОГО КОПИРОВАНИЯ
# DeliveryVLG - Полный backup БД и изображений товаров
# =======================================================

set -e

# Конфигурация
BACKUP_DIR="/home/enclude/delivery-app/backup"
DB_FILE="/home/enclude/delivery-app/delivery.db"
IMAGES_DIR="/home/enclude/delivery-app/public/uploads"
LOG_FILE="/var/log/delivery-app-backup.log"
RETENTION_DAYS=7

# Создаем timestamp для имени файла
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="delivery-backup-${TIMESTAMP}"

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Проверяем существование директорий
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    log "Создана директория backup: $BACKUP_DIR"
fi

log "🚀 Начинаем резервное копирование..."

# 1. Создаем временную директорию для backup
TEMP_DIR="/tmp/${BACKUP_NAME}"
mkdir -p "$TEMP_DIR"

# 2. Копируем базу данных SQLite
if [ -f "$DB_FILE" ]; then
    log "📊 Копируем базу данных: $DB_FILE"
    cp "$DB_FILE" "$TEMP_DIR/delivery.db"
    
    # Проверяем целостность скопированной БД
    if sqlite3 "$TEMP_DIR/delivery.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        log "✅ База данных скопирована и проверена"
    else
        log "❌ ОШИБКА: Повреждена скопированная база данных!"
        exit 1
    fi
else
    log "⚠️  ВНИМАНИЕ: База данных не найдена: $DB_FILE"
fi

# 3. Копируем изображения товаров
if [ -d "$IMAGES_DIR" ]; then
    log "🖼️  Копируем изображения товаров: $IMAGES_DIR"
    
    # Подсчитываем количество файлов
    IMAGE_COUNT=$(find "$IMAGES_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) | wc -l)
    log "📸 Найдено изображений: $IMAGE_COUNT"
    
    if [ "$IMAGE_COUNT" -gt 0 ]; then
        mkdir -p "$TEMP_DIR/uploads"
        cp -r "$IMAGES_DIR"/* "$TEMP_DIR/uploads/" 2>/dev/null || true
        
        # Проверяем количество скопированных файлов
        COPIED_COUNT=$(find "$TEMP_DIR/uploads" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) | wc -l)
        log "✅ Скопировано изображений: $COPIED_COUNT"
        
        if [ "$COPIED_COUNT" -ne "$IMAGE_COUNT" ]; then
            log "⚠️  ВНИМАНИЕ: Количество скопированных файлов не совпадает!"
        fi
    else
        log "📸 Изображения не найдены"
    fi
else
    log "⚠️  ВНИМАНИЕ: Директория изображений не найдена: $IMAGES_DIR"
fi

# 4. Добавляем метаданные backup
cat > "$TEMP_DIR/backup-info.txt" << EOF
DeliveryVLG Backup Information
==============================
Backup Date: $(date)
Backup Name: $BACKUP_NAME
Database: $([ -f "$TEMP_DIR/delivery.db" ] && echo "✅ Included" || echo "❌ Missing")
Images: $([ -d "$TEMP_DIR/uploads" ] && echo "✅ Included ($COPIED_COUNT files)" || echo "❌ Missing")
Server: $(hostname)
User: $(whoami)
Backup Script Version: 1.0
EOF

# 5. Создаем архив
log "📦 Создаем архив backup..."
cd /tmp
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

# Проверяем размер архива
ARCHIVE_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
log "✅ Архив создан: ${BACKUP_NAME}.tar.gz (размер: $ARCHIVE_SIZE)"

# 6. Очищаем временную директорию
rm -rf "$TEMP_DIR"

# 7. Удаляем старые backup (старше RETENTION_DAYS дней)
log "🧹 Очистка старых backup (старше $RETENTION_DAYS дней)..."
find "$BACKUP_DIR" -name "delivery-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Подсчитываем оставшиеся backup
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "delivery-backup-*.tar.gz" | wc -l)
log "📊 Всего backup файлов: $BACKUP_COUNT"

# 8. Проверяем свободное место на диске
DISK_USAGE=$(df -h "$BACKUP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    log "⚠️  ВНИМАНИЕ: Диск заполнен на ${DISK_USAGE}%!"
fi

log "✅ Резервное копирование завершено успешно!"
log "📁 Backup файл: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# 9. Отправляем уведомление (если настроен Telegram Bot)
if [ ! -z "$TELEGRAM_BOT_TOKEN" ] && [ ! -z "$ADMIN_CHAT_ID" ]; then
    MESSAGE="🔄 Backup завершен успешно!%0A📅 $(date)%0A📦 ${BACKUP_NAME}.tar.gz%0A📊 Размер: $ARCHIVE_SIZE%0A📸 Изображений: $COPIED_COUNT"
    curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage?chat_id=$ADMIN_CHAT_ID&text=$MESSAGE" > /dev/null || true
fi

exit 0

