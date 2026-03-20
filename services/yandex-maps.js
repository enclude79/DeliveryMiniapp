const https = require('https');
const http = require('http');

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
            const url = `${YANDEX_GEOCODER_URL}?apikey=${YANDEX_GEOCODER_API_KEY}&geocode=${coords}&format=json&results=5&lang=ru_RU&ll=${coords}&spn=0.01,0.01`;
            
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
                            const featureMembers = result.response.GeoObjectCollection.featureMember;
                            
                            // Ищем наиболее точный адрес (с номером дома)
                            let bestAddress = null;
                            let bestPrecision = 0;
                            
                            for (const member of featureMembers) {
                                const geoObject = member.GeoObject;
                                const precision = geoObject.metaDataProperty.GeocoderMetaData.precision || 'exact';
                                
                                // Проверяем наличие номера дома
                                const hasHouseNumber = geoObject.metaDataProperty.GeocoderMetaData.Address && 
                                    geoObject.metaDataProperty.GeocoderMetaData.Address.Components &&
                                    geoObject.metaDataProperty.GeocoderMetaData.Address.Components.some(c => c.kind === 'house');
                                
                                // Приоритет: точность + наличие номера дома
                                const precisionScore = precision === 'exact' ? 2 : precision === 'number' ? 1 : 0;
                                const houseScore = hasHouseNumber ? 1 : 0;
                                const totalScore = precisionScore + houseScore;
                                
                                if (totalScore > bestPrecision) {
                                    bestPrecision = totalScore;
                                    bestAddress = geoObject;
                                }
                            }
                            
                            // Если не нашли точный адрес, берем первый
                            if (!bestAddress) {
                                bestAddress = featureMembers[0].GeoObject;
                            }
                            
                            const yandexText = bestAddress.metaDataProperty.GeocoderMetaData.text;
                            logYandexMaps('PROVIDER', 'YANDEX ответ получен', {
                                precision: bestAddress.metaDataProperty.GeocoderMetaData.precision,
                                text: yandexText,
                                address: bestAddress.metaDataProperty.GeocoderMetaData.Address
                            });
                            const address = {
                                full_address: yandexText,
                                formatted_address: bestAddress.name,
                                latitude: parseFloat(latitude),
                                longitude: parseFloat(longitude),
                                precision: bestAddress.metaDataProperty.GeocoderMetaData.precision || 'unknown',
                                components: {},
                                alternatives: featureMembers.slice(0, 3).map(member => ({
                                    full_address: member.GeoObject.metaDataProperty.GeocoderMetaData.text,
                                    precision: member.GeoObject.metaDataProperty.GeocoderMetaData.precision || 'unknown'
                                }))
                            };
                            
                            // Парсим компоненты адреса
                            if (bestAddress.metaDataProperty.GeocoderMetaData.Address && bestAddress.metaDataProperty.GeocoderMetaData.Address.Components) {
                                const components = bestAddress.metaDataProperty.GeocoderMetaData.Address.Components;
                                components.forEach(component => {
                                    address.components[component.kind] = component.name;
                                });
                                // Индекс (если есть)
                                if (bestAddress.metaDataProperty.GeocoderMetaData.Address.postal_code) {
                                    address.components.postal_code = bestAddress.metaDataProperty.GeocoderMetaData.Address.postal_code;
                                }
                            }

                            // Нормализованный вид: «улица, дом, город, регион, индекс» (только если есть ключевые поля)
                            const street = address.components.street || '';
                            const house = address.components.house || '';
                            const city = address.components.locality || address.components.dependent_locality || '';
                            const region = address.components.province || address.components.area || '';
                            const postal = address.components.postal_code || '';
                            const normalized = [
                                street,
                                house,
                                city,
                                region,
                                postal
                            ].filter(Boolean).join(', ');
                            // Если есть улица и дом и город — используем нормализованный, иначе оставляем как у Яндекса (как работало раньше)
                            if (street && house && city) {
                                address.full_address = normalized;
                            } else {
                                address.full_address = yandexText || normalized || address.full_address;
                            }
                            
                            logYandexMaps('SUCCESS', `Адрес найден: ${address.full_address} (точность: ${address.precision})`);
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

// Вторичный фолбэк: OpenStreetMap Nominatim (публичный, без ключа, с rate-limit)
async function reverseGeocodeOSM(latitude, longitude) {
    return new Promise((resolve, reject) => {
        try {
            logYandexMaps('INFO', `OSM reverse геокодирование: ${latitude}, ${longitude}`);
            const url = `http://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&addressdetails=1&accept-language=ru`;
            const req = http.get(url, { headers: { 'User-Agent': 'delivery-app/1.0 (contact: admin@local)' } }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (!json || !json.address) {
                            return reject(new Error('OSM: адрес не найден'));
                        }
                        const addr = json.address;
                        const components = {
                            country: addr.country || '',
                            locality: addr.city || addr.town || addr.village || addr.hamlet || '',
                            street: addr.road || addr.pedestrian || addr.footway || addr.path || '',
                            house: addr.house_number || '',
                            postal_code: addr.postcode || ''
                        };
                        logYandexMaps('PROVIDER', 'OSM ответ получен', {
                            display_name: json.display_name,
                            address: addr
                        });
                        const parts = [];
                        if (components.locality) parts.push(components.locality);
                        if (components.street) parts.push(components.street);
                        if (components.house) parts.push(components.house);
                        // Нормализованный порядок как и для Яндекса
                        const normalized = [
                            components.street,
                            components.house,
                            components.locality,
                            addr.state || addr.region || '',
                            components.postal_code
                        ].filter(Boolean).join(', ');
                        const full = normalized || parts.join(', ');
                        resolve({
                            full_address: full || json.display_name || `Адрес по координатам ${latitude}, ${longitude}`,
                            formatted_address: full || json.display_name || '',
                            latitude: parseFloat(latitude),
                            longitude: parseFloat(longitude),
                            precision: 'approximate',
                            components,
                            alternatives: []
                        });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', (err) => reject(err));
            req.setTimeout(8000, () => { req.destroy(); reject(new Error('OSM timeout')); });
        } catch (error) {
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
            logYandexMaps('WARNING', 'API ключ Яндекс.Карт не настроен, пробуем OSM');
            try {
                return await reverseGeocodeOSM(latitude, longitude);
            } catch (e) {
                if (process.env.NODE_ENV === 'production') {
                    throw new Error('Геокодер недоступен в production');
                }
                logYandexMaps('WARNING', 'OSM фолбэк не сработал, используется заглушка (не production)', { error: e.message });
                return await mockReverseGeocode(latitude, longitude);
            }
        }
        // Сначала пробуем Яндекс
        try {
            return await reverseGeocode(latitude, longitude);
        } catch (yErr) {
            logYandexMaps('WARNING', 'Ошибка Яндекс геокодирования, пробуем OSM', { error: yErr.message });
            try {
                return await reverseGeocodeOSM(latitude, longitude);
            } catch (e) {
                if (process.env.NODE_ENV === 'production') {
                    throw new Error('Геокодер недоступен в production');
                }
                logYandexMaps('ERROR', 'Ошибка OSM, используем заглушку (не production)', { error: e.message });
                return await mockReverseGeocode(latitude, longitude);
            }
        }
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
    reverseGeocodeOSM,
    getCoordinatesByAddress
}; 