# ⚡ БЫСТРАЯ СПРАВКА - УПРАВЛЕНИЕ КОНТУРАМИ DeliveryVLG

## 🎯 Текущее состояние

| Контур | Статус | Порт | Команда статуса |
|--------|--------|------|-----------------|
| **Development** | ✅ АКТИВЕН | 3001 | `sudo systemctl status delivery-app-dev` |
| **Staging** | ❌ ОСТАНОВЛЕН | 3002 | `sudo systemctl status delivery-app-staging` |
| **Production** | ✅ АКТИВЕН | 3000 | `sudo systemctl status delivery-app-production` |

## 🔄 Быстрое переключение

```bash
# Development
cd /home/enclude/automation/development && sudo ./switch-to-dev.sh

# Staging  
cd /home/enclude/automation/staging && sudo ./switch-to-staging.sh

# Production
cd /home/enclude/automation/production && sudo ./switch-to-production.sh
```

## 🔍 Быстрая диагностика

```bash
# Development
cd /home/enclude/automation/development && ./check-dev-status.sh

# Staging
cd /home/enclude/automation/staging && ./check-staging-status.sh

# Production
cd /home/enclude/automation/production && ./check-production-status.sh
```

## 🛠️ Управление сервисами

```bash
# Development
sudo systemctl start/stop/restart delivery-app-dev

# Staging
sudo systemctl start/stop/restart delivery-app-staging

# Production
sudo systemctl start/stop/restart delivery-app-production
```

## 🌐 Доступ к сервисам

- **Development:** http://localhost:3001
- **Staging:** http://localhost:3002  
- **Production:** http://localhost:3000

## 📋 Базы данных

- **Development:** `/home/enclude/automation/development/delivery-dev.db`
- **Staging:** `/home/enclude/automation/staging/delivery-staging.db`
- **Production:** `/home/enclude/automation/production/delivery.db`

## 🚨 Экстренные команды

```bash
# Остановить все сервисы
sudo systemctl stop delivery-app-dev delivery-app-staging delivery-app-production

# Проверить все процессы Node.js
ps aux | grep node | grep -v grep

# Проверить все порты
sudo netstat -tlnp | grep :300

# Проверить логи
sudo journalctl -u delivery-app-production --no-pager -n 20
```

---
**📖 Полная документация:** `ENVIRONMENT_ISOLATION_GUIDE.md` 