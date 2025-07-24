const https = require('https');

// Конфигурация Яндекс.Карт
const YANDEX_GEOCODER_API_KEY = process.env.YANDEX_GEOCODER_API_KEY || 'your_api_key_here';
const YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';

// Логирование для отладки
function logYandexMaps(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[YANDEX MAPS] ${type} - ${message} - ${timestamp}`, data);
}

/**
 * Геокодирование - получение адреса по координатам
 * @param {number} latitude - Широта
 * @param {number} longitude - Долгота
 * @returns {Promise<Object>} Объект с адресом
 */
async function reverseGeocode(latitude, longitude) {
    return new Promise((resolve, reject) => {
        try {
            logYandexMaps('INFO', `Обратное геокодирование для координат: ${latitude}, ${longitude}`);
            
            const coords = `${longitude},${latitude}`; // Яндекс использует долготу,широту
            const url = `${YANDEX_GEOCODER_URL}?apikey=${YANDEX_GEOCODER_API_KEY}&geocode=${coords}&format=json&results=1&lang=ru_RU`;
            
            logYandexMaps('DEBUG', `Запрос к Яндекс.Картам: ${url.replace(YANDEX_GEOCODER_API_KEY, 'hidden')}`);
            
            const request = https.get(url, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        
                        if (result.response && result.response.GeoObjectCollection && result.response.GeoObjectCollection.featureMember.length > 0) {
                            const geoObject = result.response.GeoObjectCollection.featureMember[0].GeoObject;
                            const address = {
                                full_address: geoObject.metaDataProperty.GeocoderMetaData.text,
                                formatted_address: geoObject.name,
                                latitude: parseFloat(latitude),
                                longitude: parseFloat(longitude),
                                components: {}
                            };
                            
                            // Парсим компоненты адреса
                            if (geoObject.metaDataProperty.GeocoderMetaData.Address && geoObject.metaDataProperty.GeocoderMetaData.Address.Components) {
                                const components = geoObject.metaDataProperty.GeocoderMetaData.Address.Components;
                                components.forEach(component => {
                                    address.components[component.kind] = component.name;
                                });
                            }
                            
                            logYandexMaps('SUCCESS', `Адрес найден: ${address.full_address}`);
                            resolve(address);
                        } else {
                            logYandexMaps('ERROR', 'Адрес не найден в ответе Яндекс.Карт');
                            reject(new Error('Адрес не найден'));
                        }
                    } catch (parseError) {
                        logYandexMaps('ERROR', 'Ошибка парсинга ответа Яндекс.Карт', { error: parseError.message });
                        reject(parseError);
                    }
                });
            });
            
            request.on('error', (error) => {
                logYandexMaps('ERROR', 'Ошибка запроса к Яндекс.Картам', { error: error.message });
                reject(error);
            });
            
            request.setTimeout(10000, () => {
                logYandexMaps('ERROR', 'Таймаут запроса к Яндекс.Картам');
                request.destroy();
                reject(new Error('Таймаут запроса'));
            });
            
        } catch (error) {
            logYandexMaps('ERROR', 'Общая ошибка геокодирования', { error: error.message });
            reject(error);
        }
    });
}

/**
 * Прямое геокодирование - получение координат по адресу
 * @param {string} address - Адрес для поиска
 * @returns {Promise<Object>} Объект с координатами
 */
async function geocode(address) {
    return new Promise((resolve, reject) => {
        try {
            logYandexMaps('INFO', `Прямое геокодирование для адреса: ${address}`);
            
            const encodedAddress = encodeURIComponent(address);
            const url = `${YANDEX_GEOCODER_URL}?apikey=${YANDEX_GEOCODER_API_KEY}&geocode=${encodedAddress}&format=json&results=1&lang=ru_RU`;
            
            logYandexMaps('DEBUG', `Запрос к Яндекс.Картам: ${url.replace(YANDEX_GEOCODER_API_KEY, 'hidden')}`);
            
            const request = https.get(url, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        
                        if (result.response && result.response.GeoObjectCollection && result.response.GeoObjectCollection.featureMember.length > 0) {
                            const geoObject = result.response.GeoObjectCollection.featureMember[0].GeoObject;
                            const coords = geoObject.Point.pos.split(' '); // долгота широта
                            
                            const location = {
                                latitude: parseFloat(coords[1]),
                                longitude: parseFloat(coords[0]),
                                full_address: geoObject.metaDataProperty.GeocoderMetaData.text,
                                formatted_address: geoObject.name
                            };
                            
                            logYandexMaps('SUCCESS', `Координаты найдены: ${location.latitude}, ${location.longitude}`);
                            resolve(location);
                        } else {
                            logYandexMaps('ERROR', 'Координаты не найдены в ответе Яндекс.Карт');
                            reject(new Error('Координаты не найдены'));
                        }
                    } catch (parseError) {
                        logYandexMaps('ERROR', 'Ошибка парсинга ответа Яндекс.Карт', { error: parseError.message });
                        reject(parseError);
                    }
                });
            });
            
            request.on('error', (error) => {
                logYandexMaps('ERROR', 'Ошибка запроса к Яндекс.Картам', { error: error.message });
                reject(error);
            });
            
            request.setTimeout(10000, () => {
                logYandexMaps('ERROR', 'Таймаут запроса к Яндекс.Картам');
                request.destroy();
                reject(new Error('Таймаут запроса'));
            });
            
        } catch (error) {
            logYandexMaps('ERROR', 'Общая ошибка геокодирования', { error: error.message });
            reject(error);
        }
    });
}

/**
 * Заглушка для геокодирования (если нет API ключа)
 */
function mockReverseGeocode(latitude, longitude) {
    logYandexMaps('INFO', 'Используется заглушка для геокодирования');
    return Promise.resolve({
        full_address: `Адрес по координатам ${latitude}, ${longitude}`,
        formatted_address: `Улица, дом`,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        components: {
            country: 'Россия',
            locality: 'Город',
            street: 'Улица',
            house: '1'
        }
    });
}

/**
 * Основная функция для обратного геокодирования с fallback
 */
async function getAddressByCoordinates(latitude, longitude) {
    try {
        if (!YANDEX_GEOCODER_API_KEY || YANDEX_GEOCODER_API_KEY === 'your_api_key_here') {
            logYandexMaps('WARNING', 'API ключ Яндекс.Карт не настроен, используется заглушка');
            return await mockReverseGeocode(latitude, longitude);
        }
        
        return await reverseGeocode(latitude, longitude);
    } catch (error) {
        logYandexMaps('ERROR', 'Ошибка геокодирования, используется заглушка', { error: error.message });
        return await mockReverseGeocode(latitude, longitude);
    }
}

/**
 * Основная функция для прямого геокодирования с fallback
 */
async function getCoordinatesByAddress(address) {
    try {
        if (!YANDEX_GEOCODER_API_KEY || YANDEX_GEOCODER_API_KEY === 'your_api_key_here') {
            logYandexMaps('WARNING', 'API ключ Яндекс.Карт не настроен, используется заглушка');
            return {
                latitude: 55.7558,
                longitude: 37.6173,
                full_address: address,
                formatted_address: address
            };
        }
        
        return await geocode(address);
    } catch (error) {
        logYandexMaps('ERROR', 'Ошибка геокодирования, используется заглушка', { error: error.message });
        return {
            latitude: 55.7558,
            longitude: 37.6173,
            full_address: address,
            formatted_address: address
        };
    }
}

module.exports = {
    reverseGeocode,
    geocode,
    getAddressByCoordinates,
    getCoordinatesByAddress
}; 