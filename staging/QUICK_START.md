# ⚡ Быстрый старт - DeliveryMiniapp Automation

## 🚀 Запуск за 3 шага

### Шаг 1: Проверка зависимостей
```bash
# Убедитесь, что установлены:
node --version    # Должен быть 14+
npm --version     # Должен быть 6+
git --version     # Любая версия
sqlite3 --version # Любая версия
```

### Шаг 2: Запуск системы
```bash
cd /home/enclude/automation
chmod +x start-automation.sh
./start-automation.sh start
```

### Шаг 3: Открытие веб-интерфейса
Откройте браузер: **http://localhost:3001**

## 🎯 Основные команды

```bash
# Запуск
./start-automation.sh start

# Остановка
./start-automation.sh stop

# Перезапуск
./start-automation.sh restart

# Статус
./start-automation.sh status

# Логи
./start-automation.sh logs
```

## 🔧 Первое развертывание

1. **Откройте dashboard**: http://localhost:3001
2. **Нажмите**: 🚀 "Выполнить полное развертывание"
3. **Следите за логами** в реальном времени
4. **Проверьте результат**: http://localhost:3000

## 🆘 Если что-то не работает

### Dashboard не открывается
```bash
./start-automation.sh stop
cd dashboard && npm install
./start-automation.sh start
```

### Ошибки Git
```bash
cd /home/enclude/delivery-app
git config user.name "Your Name"
git config user.email "your@email.com"
```

### Проблемы с БД
```bash
# Проверьте существование файлов
ls -la /home/enclude/delivery-app/*.db

# Создайте пустые БД если нужно
touch /home/enclude/delivery-app/delivery.db
touch /home/enclude/delivery-app/delivery-dev.db
```

## 📞 Поддержка

- **Документация**: `DEPLOYMENT_GUIDE.md`
- **Логи**: `./start-automation.sh logs`
- **Статус**: `./start-automation.sh status`

---

**✅ Готово! Система автоматизации запущена и готова к работе!** 