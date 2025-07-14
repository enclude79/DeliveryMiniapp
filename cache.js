/**
 * Модуль кэширования в памяти с поддержкой TTL
 * В будущем можно заменить на Redis
 */

class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }

    /**
     * Установить значение в кэш
     * @param {string} key - ключ
     * @param {any} value - значение
     * @param {number} ttl - время жизни в миллисекундах (по умолчанию 5 минут)
     */
    set(key, value, ttl = 5 * 60 * 1000) {
        // Очищаем предыдущий таймер если есть
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Сохраняем значение
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });

        // Устанавливаем таймер для автоочистки
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl);
        
        this.timers.set(key, timer);
        
        console.log(`[CACHE] Сохранено: ${key} (TTL: ${ttl}ms)`);
    }

    /**
     * Получить значение из кэша
     * @param {string} key - ключ
     * @returns {any|null} значение или null если не найдено/истекло
     */
    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }

        const item = this.cache.get(key);
        const now = Date.now();
        
        // Проверяем не истекло ли время жизни
        if (now - item.timestamp > item.ttl) {
            this.delete(key);
            return null;
        }

        console.log(`[CACHE] Получено: ${key}`);
        return item.value;
    }

    /**
     * Удалить значение из кэша
     * @param {string} key - ключ
     */
    delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        
        if (this.cache.has(key)) {
            this.cache.delete(key);
            console.log(`[CACHE] Удалено: ${key}`);
        }
    }

    /**
     * Проверить существует ли ключ
     * @param {string} key - ключ
     * @returns {boolean}
     */
    has(key) {
        if (!this.cache.has(key)) {
            return false;
        }

        const item = this.cache.get(key);
        const now = Date.now();
        
        // Если истекло время - удаляем и возвращаем false
        if (now - item.timestamp > item.ttl) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Очистить весь кэш
     */
    clear() {
        // Очищаем все таймеры
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        
        this.cache.clear();
        this.timers.clear();
        console.log('[CACHE] Кэш полностью очищен');
    }

    /**
     * Получить статистику кэша
     * @returns {object}
     */
    getStats() {
        const stats = {
            size: this.cache.size,
            keys: [],
            totalMemory: 0
        };

        for (const [key, item] of this.cache.entries()) {
            stats.keys.push({
                key,
                age: Date.now() - item.timestamp,
                ttl: item.ttl,
                expired: Date.now() - item.timestamp > item.ttl
            });
            
            // Приблизительный размер в байтах
            stats.totalMemory += JSON.stringify(item.value).length;
        }

        return stats;
    }

    /**
     * Функция-хелпер для кэширования результатов функций
     * @param {string} key - ключ кэша
     * @param {Function} fn - функция для выполнения если кэш пуст
     * @param {number} ttl - время жизни кэша
     * @returns {any}
     */
    async memoize(key, fn, ttl = 5 * 60 * 1000) {
        // Проверяем кэш
        let result = this.get(key);
        if (result !== null) {
            return result;
        }

        // Выполняем функцию и кэшируем результат
        result = await fn();
        this.set(key, result, ttl);
        return result;
    }
}

// Создаем глобальный экземпляр кэша
const cache = new MemoryCache();

module.exports = {
    cache,
    MemoryCache
}; 