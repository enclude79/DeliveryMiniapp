# 🔒 Безопасная настройка Git Credentials

## ⚠️ ВАЖНО: Безопасность токенов

**НИКОГДА не передавайте токены в URL!** Это серьезная уязвимость безопасности.

## ✅ Правильные способы настройки Git

### 1. Git Credential Store (рекомендуется)

```bash
# Настройка credential helper
git config --global credential.helper store

# При первом push Git запросит токен
git push origin main
# Username: include79
# Password: [введите ваш токен]
```

### 2. Git Credential Cache (временное хранение)

```bash
# Токен хранится в памяти на 15 минут
git config --global credential.helper 'cache --timeout=900'
```

### 3. Переменные окружения

```bash
# Установка переменных окружения
export GITHUB_TOKEN="ваш_токен_здесь"
export GITHUB_USERNAME="include79"

# Или добавьте в ~/.bashrc
echo 'export GITHUB_TOKEN="ваш_токен_здесь"' >> ~/.bashrc
echo 'export GITHUB_USERNAME="include79"' >> ~/.bashrc
source ~/.bashrc
```

### 4. SSH ключи (самый безопасный)

```bash
# Генерация SSH ключа
ssh-keygen -t ed25519 -C "include79@gmail.com"

# Добавление в GitHub
cat ~/.ssh/id_ed25519.pub
# Скопируйте в GitHub Settings → SSH and GPG keys

# Настройка репозитория для SSH
git remote set-url origin git@github.com:include79/DeliveryMiniapp.git
```

## 🚨 Что НЕ делать

❌ **НЕ используйте токен в URL:**
```bash
# НЕПРАВИЛЬНО!
git remote set-url origin https://ghp_токен@github.com/enclude79/DeliveryMiniapp.git
```

❌ **НЕ сохраняйте токены в файлах проекта**

❌ **НЕ передавайте токены в командах**

## 🔐 Текущие учетные данные Dashboard

- **URL**: `http://89.169.182.9:3003`
- **Логин**: `dev_admin`
- **Пароль**: [СКРЫТО - обратитесь к администратору]

## 📝 Следующие шаги

1. Настройте Git credentials безопасным способом
2. Выполните push в репозиторий
3. Убедитесь, что токены не попадают в историю команд

## 🛡️ Дополнительная безопасность

- Регулярно обновляйте токены
- Используйте минимальные права доступа
- Включите двухфакторную аутентификацию
- Мониторьте активность аккаунта 