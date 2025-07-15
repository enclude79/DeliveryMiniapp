#!/bin/bash

# Скрипт проверки статуса обоих контуров (prod + dev)
# Автор: DevOps система DeliveryVLG
# Дата: 2025-01-15

echo "🔍 ПРОВЕРКА СОСТОЯНИЯ СЕРВЕРОВ"
echo "================================"

# Проверка systemd сервисов
echo ""
echo "📊 СИСТЕМНЫЕ СЕРВИСЫ:"

# Продакшн сервис
if systemctl is-active --quiet delivery-app; then
    echo "✅ delivery-app (PROD): active (running)"
else
    echo "❌ delivery-app (PROD): не работает"
fi

# Dev сервис
if systemctl is-active --quiet delivery-app-dev; then
    echo "✅ delivery-app-dev (DEV): active (running)"
else
    echo "❌ delivery-app-dev (DEV): не работает"
fi

echo ""
echo "🌐 HTTP ПОДКЛЮЧЕНИЯ:"

# Проверка HTTP портов
for port in 3000 3001; do
    env_name="PROD"
    if [ $port -eq 3001 ]; then
        env_name="DEV"
    fi
    
    if timeout 5 curl -s http://127.0.0.1:$port > /dev/null 2>&1; then
        response_time=$(curl -o /dev/null -s -w "%{time_total}" http://127.0.0.1:$port)
        ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
        echo "✅ $env_name ($port): 200 OK (${ms}ms)"
    else
        echo "❌ $env_name ($port): не отвечает"
    fi
done

echo ""
echo "🔒 HTTPS ПОДКЛЮЧЕНИЯ:"

# Проверка HTTPS портов
for port in 3443 3444; do
    env_name="PROD"
    if [ $port -eq 3444 ]; then
        env_name="DEV"
    fi
    
    if timeout 5 curl -k -s https://127.0.0.1:$port > /dev/null 2>&1; then
        response_time=$(curl -k -o /dev/null -s -w "%{time_total}" https://127.0.0.1:$port)
        ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
        echo "✅ $env_name ($port): 200 OK (${ms}ms)"
    else
        echo "❌ $env_name ($port): не отвечает"
    fi
done

echo ""
echo "💾 ИСПОЛЬЗОВАНИЕ ПАМЯТИ:"

# Проверка использования памяти процессов
for service in "delivery-app" "delivery-app-dev"; do
    env_name="PROD"
    if [[ $service == *"dev" ]]; then
        env_name="DEV"
    fi
    
    pid=$(systemctl show --property MainPID --value $service)
    if [ "$pid" != "0" ] && [ -n "$pid" ]; then
        mem_info=$(ps -p $pid -o pid,rss,pmem --no-headers 2>/dev/null)
        if [ $? -eq 0 ]; then
            mem_mb=$(echo $mem_info | awk '{printf "%.1f", $2/1024}')
            mem_percent=$(echo $mem_info | awk '{printf "%.1f", $3}')
            echo "📈 $env_name: ${mem_mb}MB (${mem_percent}%)"
        fi
    else
        echo "❌ $env_name: процесс не найден"
    fi
done

echo ""
echo "📊 СТАТИСТИКА ПРОЦЕССОВ:"

# Детальная статистика процессов
for service in "delivery-app" "delivery-app-dev"; do
    env_name="PROD"
    if [[ $service == *"dev" ]]; then
        env_name="DEV"
    fi
    
    pid=$(systemctl show --property MainPID --value $service)
    if [ "$pid" != "0" ] && [ -n "$pid" ]; then
        # CPU и время работы
        cpu_info=$(ps -p $pid -o pid,pcpu,etime --no-headers 2>/dev/null)
        if [ $? -eq 0 ]; then
            cpu_percent=$(echo $cpu_info | awk '{print $2}')
            uptime=$(echo $cpu_info | awk '{print $3}')
            echo "$env_name PID: $pid | CPU: ${cpu_percent}% | Uptime: $uptime"
        fi
    fi
done

echo ""
echo "🗃️ СОСТОЯНИЕ БАЗ ДАННЫХ:"

# Проверка файлов БД
for db in "delivery.db" "delivery-dev.db"; do
    env_name="PROD"
    if [[ $db == *"dev"* ]]; then
        env_name="DEV"
    fi
    
    if [ -f "$db" ]; then
        size=$(du -h "$db" | cut -f1)
        modified=$(stat -c %y "$db" | cut -d' ' -f1)
        echo "✅ $env_name DB: $db (${size}, modified: $modified)"
    else
        echo "❌ $env_name DB: файл $db не найден"
    fi
done

# Git статус
if [ -d ".git" ]; then
    echo ""
    echo "🌿 GIT СТАТУС:"
    current_branch=$(git symbolic-ref --short HEAD)
    echo "📍 Текущая ветка: $current_branch"
    
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️ Есть незакоммиченные изменения"
    else
        echo "✅ Working directory clean"
    fi
fi

echo ""
echo "🎯 ИТОГОВЫЙ СТАТУС:"

# Проверяем критические компоненты
errors=0

# Проверка сервисов
if ! systemctl is-active --quiet delivery-app; then
    echo "❌ Продакшн сервис не работает"
    errors=$((errors + 1))
fi

if ! systemctl is-active --quiet delivery-app-dev; then
    echo "❌ Dev сервис не работает"  
    errors=$((errors + 1))
fi

# Проверка HTTP портов
if ! timeout 3 curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "❌ Продакшн HTTP недоступен"
    errors=$((errors + 1))
fi

if ! timeout 3 curl -s http://127.0.0.1:3001 > /dev/null 2>&1; then
    echo "❌ Dev HTTP недоступен"
    errors=$((errors + 1))
fi

if [ $errors -eq 0 ]; then
    echo "✅ ВСЕ СИСТЕМЫ РАБОТАЮТ НОРМАЛЬНО"
    exit 0
else
    echo "⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ: $errors"
    echo "💡 Запустите: sudo journalctl -fu delivery-app"
    exit 1
fi 