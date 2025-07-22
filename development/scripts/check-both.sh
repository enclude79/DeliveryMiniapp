#!/bin/bash
echo "🔍 Проверка обоих серверов DeliveryVLG"
echo "========================================"

echo "📊 PROD сервер (порт 3000):"
curl -s http://127.0.0.1:3000/health | jq . || echo "❌ PROD недоступен"

echo -e "\n📊 DEV сервер (порт 3001):"  
curl -s http://127.0.0.1:3001/health | jq . || echo "❌ DEV недоступен"

echo -e "\n🔧 Статус сервисов:"
echo "PROD: $(sudo systemctl is-active delivery-app)"
echo "DEV:  $(sudo systemctl is-active delivery-app-dev)"

echo -e "\n🔌 Открытые порты:"
netstat -tlnp | grep -E ':3000|:3001' | awk '{print $4}' | sort
