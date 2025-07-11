require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { query } = require('../database');
const fs = require('fs');
const path = require('path');

// Создаем директорию для логов бота
const botLogsDir = path.join(__dirname, '..', 'logs', 'telegram');
if (!fs.existsSync(botLogsDir)) {
    fs.mkdirSync(botLogsDir, { recursive: true });
}

// Функция для логирования
function logBot(type, message, data = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type,
        message,
        data
    };

    const logFile = path.join(botLogsDir, 'bot.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    console.log(`[Telegram Bot] ${type}:`, message, data);
}

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

logBot('INFO', 'Бот инициализирован', { token: process.env.TELEGRAM_BOT_TOKEN.slice(0, 5) + '...' });

// Обработка ошибок polling
bot.on('polling_error', (error) => {
    logBot('ERROR', 'Ошибка polling', { error: error.message, stack: error.stack });
});

// Обработка ошибок webhook
bot.on('webhook_error', (error) => {
    logBot('ERROR', 'Ошибка webhook', { error: error.message, stack: error.stack });
});

// Хранилище корзин пользователей
const carts = new Map();
// Хранилище текущего состояния пользователя
const userStates = new Map();

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    logBot('INFO', 'Получена команда /start', { chatId });

    try {
        const message = `
🍽 *Добро пожаловать в сервис доставки еды!*

Выберите действие:
`;
        
        const keyboard = {
            reply_markup: {
                keyboard: [
                    ['🍔 Посмотреть меню'],
                    ['🛒 Корзина'],
                    ['📱 Мои заказы', '❓ Помощь']
                ],
                resize_keyboard: true
            },
            parse_mode: 'Markdown'
        };
        
        await bot.sendMessage(chatId, message, keyboard);
        logBot('INFO', 'Отправлено приветственное сообщение', { chatId });
    } catch (error) {
        logBot('ERROR', 'Ошибка при отправке приветственного сообщения', { chatId, error });
    }
});

// Обработка кнопки меню
bot.onText(/🍔 Посмотреть меню|\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    logBot('INFO', 'Запрошено меню', { chatId });

    try {
        const categories = await query('SELECT * FROM categories');
        logBot('DEBUG', 'Получены категории', { chatId, categories: categories.map(c => c.name) });

        const keyboard = {
            inline_keyboard: categories.map(cat => ([{
                text: `${getCategoryEmoji(cat.name)} ${cat.name}`,
                callback_data: `category_${cat.id}`
            }]))
        };

        await bot.sendMessage(
            chatId,
            '*Выберите категорию:*',
            {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        logBot('ERROR', 'Ошибка при получении категорий', { chatId, error });
        await bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке меню');
    }
});

// Функция получения эмодзи для категории
function getCategoryEmoji(categoryName) {
    const emojis = {
        'Бургеры': '🍔',
        'Пицца': '🍕',
        'Суши': '🍱',
        'Напитки': '🥤',
        'Десерты': '🍰',
        'Салаты': '🥗',
        'Мороженное': '🍦',
        'Пельмени': '🥟'
    };
    return emojis[categoryName] || '🍽';
}

// Обработка выбора категории
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    logBot('INFO', 'Получен callback_query', { chatId, data });

    try {
        if (data.startsWith('category_')) {
            const categoryId = data.split('_')[1];
            const products = await query(
                'SELECT * FROM products WHERE category_id = ?',
                [categoryId]
            );

            // Отправляем каждый товар отдельной карточкой
            for (const product of products) {
                const imageUrl = product.image ? 
                    `https://www.deliveryvlg.xyz${product.image}` : 
                    'https://via.placeholder.com/400x300?text=Нет+изображения';

                const message = `
*${product.name}*
💰 Цена: ${product.price} ₽

${product.description || 'Нет описания'}
`;

                const keyboard = {
                    inline_keyboard: [
                        [
                            {
                                text: `🛒 В корзину - ${product.price} ₽`,
                                callback_data: `add_to_cart_${product.id}`
                            }
                        ],
                        [
                            {
                                text: '👀 Подробнее',
                                callback_data: `product_details_${product.id}`
                            }
                        ]
                    ]
                };

                await bot.sendPhoto(chatId, imageUrl, {
                    caption: message,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } 
        else if (data.startsWith('add_to_cart_')) {
            const productId = data.split('_')[3];
            if (!carts.has(chatId)) {
                carts.set(chatId, new Map());
            }
            const cart = carts.get(chatId);
            const quantity = cart.get(productId) || 0;
            cart.set(productId, quantity + 1);

            const [product] = await query(
                'SELECT * FROM products WHERE id = ?',
                [productId]
            );

            await bot.answerCallbackQuery(callbackQuery.id, {
                text: `✅ ${product.name} добавлен в корзину`
            });
        }
        else if (data.startsWith('product_details_')) {
            const productId = data.split('_')[2];
            const [product] = await query(
                'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
                [productId]
            );

            const imageUrl = product.image ? 
                `https://www.deliveryvlg.xyz${product.image}` : 
                'https://via.placeholder.com/400x300?text=Нет+изображения';

            const message = `
*${product.name}*
📑 Категория: ${product.category_name}
💰 Цена: ${product.price} ₽

📝 *Описание:*
${product.description || 'Нет описания'}
`;

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: `🛒 В корзину - ${product.price} ₽`,
                            callback_data: `add_to_cart_${product.id}`
                        }
                    ],
                    [
                        {
                            text: '◀️ Назад к меню',
                            callback_data: `category_${product.category_id}`
                        }
                    ]
                ]
            };

            await bot.sendPhoto(chatId, imageUrl, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    } catch (error) {
        logBot('ERROR', 'Ошибка при обработке callback_query', { chatId, data, error });
        await bot.sendMessage(chatId, '❌ Произошла ошибка');
    }
});

// Просмотр корзины
bot.onText(/🛒 Корзина|\/cart/, async (msg) => {
    const chatId = msg.chat.id;
    const cart = carts.get(chatId);

    if (!cart || cart.size === 0) {
        await bot.sendMessage(chatId, '🛒 Ваша корзина пуста');
        return;
    }

    try {
        let total = 0;
        let message = '*🛒 Ваша корзина:*\n\n';

        for (const [productId, quantity] of cart.entries()) {
            const [product] = await query(
                'SELECT * FROM products WHERE id = ?',
                [productId]
            );
            const subtotal = product.price * quantity;
            total += subtotal;
            message += `• ${product.name}\n  ${quantity} шт × ${product.price} ₽ = ${subtotal} ₽\n\n`;
        }

        message += `\n💰 *Итого: ${total} ₽*`;

        const keyboard = {
            inline_keyboard: [
                [
                    { 
                        text: '✅ Оформить заказ',
                        callback_data: 'checkout_start'
                    }
                ],
                [
                    {
                        text: '🗑 Очистить корзину',
                        callback_data: 'clear_cart'
                    }
                ]
            ]
        };

        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (error) {
        logBot('ERROR', 'Ошибка при просмотре корзины', { chatId, error });
        await bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке корзины');
    }
});

// Начало оформления заказа
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'checkout_start') {
        userStates.set(chatId, { state: 'waiting_name' });
        await bot.sendMessage(chatId, 
            '*📝 Оформление заказа*\n\nВведите ваше имя:', 
            { parse_mode: 'Markdown' }
        );
    } else if (data === 'clear_cart') {
        carts.delete(chatId);
        await bot.sendMessage(chatId, '🗑 Корзина очищена');
    }
});

// Обработка ввода данных для заказа
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = userStates.get(chatId);

    if (!state) return;

    try {
        switch (state.state) {
            case 'waiting_name':
                state.name = text;
                state.state = 'waiting_phone';
                await bot.sendMessage(chatId, 
                    '📱 Введите ваш номер телефона:',
                    { parse_mode: 'Markdown' }
                );
                break;

            case 'waiting_phone':
                state.phone = text;
                state.state = 'waiting_address';
                await bot.sendMessage(chatId,
                    '📍 Введите адрес доставки:',
                    { parse_mode: 'Markdown' }
                );
                break;

            case 'waiting_address':
                state.address = text;
                const cart = carts.get(chatId);
                
                // Создаем заказ
                const orderResult = await query(
                    'INSERT INTO orders (user_id, status, created_at, customer_name, phone, address) VALUES (?, ?, NOW(), ?, ?, ?)',
                    [chatId, 'new', state.name, state.phone, state.address]
                );
                const orderId = orderResult.lastID;

                // Добавляем товары заказа
                let total = 0;
                for (const [productId, quantity] of cart.entries()) {
                    const [product] = await query(
                        'SELECT * FROM products WHERE id = ?',
                        [productId]
                    );
                    await query(
                        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                        [orderId, productId, quantity, product.price]
                    );
                    total += product.price * quantity;
                }

                // Очищаем корзину и состояние
                carts.delete(chatId);
                userStates.delete(chatId);

                // Отправляем подтверждение
                const confirmMessage = `
*✅ Заказ #${orderId} успешно оформлен!*

📝 *Данные заказа:*
• Имя: ${state.name}
• Телефон: ${state.phone}
• Адрес: ${state.address}
• Сумма заказа: ${total} ₽

Мы свяжемся с вами в ближайшее время для подтверждения заказа.
Спасибо за заказ! 🙏
`;
                await bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
                break;
        }
    } catch (error) {
        logBot('ERROR', 'Ошибка при оформлении заказа', { chatId, error });
        await bot.sendMessage(chatId, '❌ Произошла ошибка при оформлении заказа');
        userStates.delete(chatId);
    }
});

// Помощь
bot.onText(/❓ Помощь|\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
*🍽 Помощь по использованию бота*

Доступные команды:
• /menu - Посмотреть меню
• /cart - Посмотреть корзину
• /help - Показать это сообщение

*Как сделать заказ:*
1. Нажмите "🍔 Посмотреть меню"
2. Выберите категорию блюд
3. Добавьте товары в корзину
4. Перейдите в корзину
5. Нажмите "Оформить заказ"
6. Следуйте инструкциям бота

*Контакты службы поддержки:*
📱 Телефон: +7 (XXX) XXX-XX-XX
✉️ Email: support@delivery.ru
`;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

logBot('INFO', 'Бот успешно запущен');

module.exports = bot; 