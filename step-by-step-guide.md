# 👨‍💻 Пошаговое руководство разработчика

## 🎯 Ежедневный workflow: от идеи до продакшна

### 📋 Обзор процесса
```
💡 Идея → 🔧 Dev → 🧪 Тесты → 🔄 Git → 🏭 Продакшн
```

---

## 🌅 Начало рабочего дня

### 1️⃣ Проверка состояния системы
```bash
# Зайти в проект
cd /home/enclude/delivery-app

# Проверить статус обоих контуров
./scripts/check-both.sh
```

**Ожидаемый результат**: ✅ Оба сервера работают

### 2️⃣ Обновление кода
```bash
# Подтянуть последние изменения
git pull origin develop

# Переключиться на dev окружение
./scripts/switch-env.sh development
```

---

## 🔧 Разработка новой функции

### 3️⃣ Создание feature ветки
```bash
# Создать новую ветку для функции
git checkout develop
git checkout -b feature/название-функции

# Пример:
git checkout -b feature/add-payment-method
```

### 4️⃣ Внесение изменений
```bash
# Редактировать файлы
nano server.js
nano public/js/admin.js
# ... другие файлы

# Проверять изменения в браузере:
# http://localhost:3001 (dev сервер)
```

### 5️⃣ Тестирование изменений
```bash
# Запустить автотесты
npm test

# Если нужно перезапустить dev сервер
sudo systemctl restart delivery-app-dev

# Проверить работу вручную
curl http://localhost:3001/health
```

---

## 🧪 Подготовка к слиянию

### 6️⃣ Финальное тестирование
```bash
# Деплой на dev с полными тестами
./scripts/deploy-dev.sh

# Проверить что все работает
./scripts/check-both.sh
```

### 7️⃣ Коммит изменений
```bash
# Добавить файлы
git add .

# Сделать коммит с описанием
git commit -m "feat: добавил способ оплаты картой"

# Или более детально:
git commit -m "feat: интеграция с платежным API

- добавлен endpoint /api/payment
- обновлен интерфейс в admin.js
- добавлены тесты для payment API"
```

---

## 🔄 Слияние и деплой

### 8️⃣ Слияние в develop
```bash
# Переключиться на develop
git checkout develop

# Слить feature ветку
git merge feature/add-payment-method --no-ff

# Удалить feature ветку
git branch -d feature/add-payment-method

# Отправить в удаленный репозиторий
git push origin develop
```

### 9️⃣ Тестирование интеграции
```bash
# Деплой объединенных изменений на dev
./scripts/deploy-dev.sh

# Комплексное тестирование
npm test
npm run test:security

# Проверка производительности
./scripts/check-both.sh
```

---

## 🏭 Деплой в продакшн

### 🔟 Подготовка к продакшн деплою
```bash
# Переключиться на main ветку
git checkout main

# Слить проверенные изменения из develop
git merge develop --no-ff

# Создать тег версии (опционально)
git tag -a v1.2.3 -m "Версия 1.2.3: добавлена оплата картой"
```

### 1️⃣1️⃣ Деплой в продакшн
```bash
# Безопасный деплой с резервным копированием
./scripts/deploy-prod.sh

# Система запросит подтверждение:
# ⚠️  ВНИМАНИЕ: Деплой в ПРОДАКШН!
# Продолжить? (y/N): y
```

### 1️⃣2️⃣ Проверка продакшна
```bash
# Проверить что продакшн работает
./scripts/check-both.sh

# Проверить основные функции
curl https://your-domain.com/health
curl https://your-domain.com/api/orders

# Отправить в Git
git push origin main
git push origin --tags
```

---

## 🚨 Экстренные ситуации

### ⚡ Быстрый откат продакшна
```bash
# Если что-то пошло не так в продакшне
git checkout main
git reset --hard HEAD~1  # откат на 1 коммит назад
./scripts/deploy-prod.sh --force

# Или восстановление из backup
cd backups
tar -xzf delivery-backup-YYYYMMDD-HHMM.tar.gz
# ... восстановление файлов
```

### 🔧 Быстрое исправление (hotfix)
```bash
# Для критических исправлений
git checkout main
git checkout -b hotfix/critical-fix

# ... внести исправления
git commit -m "hotfix: исправлена критическая ошибка"

# Слить в main И develop
git checkout main
git merge hotfix/critical-fix
git checkout develop  
git merge hotfix/critical-fix

# Деплой
./scripts/deploy-prod.sh
```

---

## 📊 Мониторинг и отладка

### 🔍 Проверка логов
```bash
# Логи продакшн сервиса
sudo journalctl -fu delivery-app

# Логи dev сервиса  
sudo journalctl -fu delivery-app-dev

# Логи деплоев
tail -f logs/deploy-prod.log
tail -f logs/deploy-dev.log
```

### 📈 Мониторинг производительности
```bash
# Использование ресурсов
htop
df -h  # дисковое пространство

# Сетевые подключения
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :3001
```

### 🐛 Отладка проблем
```bash
# Перезапуск если зависли
sudo systemctl restart delivery-app
sudo systemctl restart delivery-app-dev

# Проверка конфигурации
cat .env
cat .env.dev

# Проверка БД
ls -la *.db
sqlite3 delivery.db ".tables"
```

---

## 📋 Checklists

### ✅ Checklist: Начало дня
- [ ] `git pull origin develop`
- [ ] `./scripts/check-both.sh`
- [ ] `./scripts/switch-env.sh development`
- [ ] Проверить браузер: http://localhost:3001

### ✅ Checklist: Перед деплоем в dev
- [ ] Код откомментирован
- [ ] `npm test` проходит
- [ ] Ручное тестирование на dev
- [ ] Git коммит с понятным сообщением

### ✅ Checklist: Перед деплоем в продакшн
- [ ] `./scripts/deploy-dev.sh` успешен
- [ ] `npm test` и `npm run test:security` проходят
- [ ] `./scripts/check-both.sh` показывает ОК
- [ ] `git merge develop` в main
- [ ] Резервная копия создана автоматически

### ✅ Checklist: После деплоя продакшн
- [ ] `./scripts/check-both.sh` 
- [ ] Проверка ключевых функций вручную
- [ ] `git push origin main`
- [ ] Уведомление команды (если есть)

---

## 🎨 Примеры Git сообщений

### Хорошие примеры коммитов
```bash
# Новая функция
git commit -m "feat: добавлена система уведомлений
- новый endpoint /api/notifications
- интеграция с Telegram API
- добавлены настройки в админке"

# Исправление
git commit -m "fix: исправлена ошибка расчета доставки
- корректный расчет для удаленных районов
- добавлена валидация расстояния"

# Обновление документации
git commit -m "docs: обновлено руководство пользователя"

# Рефакторинг
git commit -m "refactor: оптимизация запросов к БД
- использование индексов
- сокращение количества запросов"
```

### Плохие примеры (избегать)
```bash
git commit -m "фикс"
git commit -m "работает"
git commit -m "пробую еще раз"
git commit -m "."
```

---

## 🔗 Полезные команды

### Быстрые команды
```bash
# Алиасы для ~/.bashrc
alias check='cd /home/enclude/delivery-app && ./scripts/check-both.sh'
alias dev-deploy='cd /home/enclude/delivery-app && ./scripts/deploy-dev.sh'
alias prod-deploy='cd /home/enclude/delivery-app && ./scripts/deploy-prod.sh'
alias switch-dev='cd /home/enclude/delivery-app && ./scripts/switch-env.sh development'
alias switch-prod='cd /home/enclude/delivery-app && ./scripts/switch-env.sh production'
```

### Git алиасы
```bash
# Добавить в ~/.gitconfig
[alias]
    st = status
    co = checkout
    br = branch
    cm = commit -m
    pl = pull
    ps = push
    mg = merge --no-ff
```

---

## 📞 Контакты и поддержка

### При проблемах обращаться:
1. **Техническая поддержка**: проверить документацию в `scripts-reference.md`
2. **Критические ошибки**: немедленный откат через hotfix процедуру
3. **Вопросы по процессам**: этот файл + `README-DevProd-Workflow.md`

### Важные файлы документации:
- `README-DevProd-Workflow.md` - общий обзор системы
- `scripts-reference.md` - подробно о всех скриптах
- `step-by-step-guide.md` - этот файл
- `troubleshooting.md` - решение проблем

---
*Обновлено: $(date +"%Y-%m-%d %H:%M")*
*Версия руководства: 1.0* 