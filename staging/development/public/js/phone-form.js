/**
 * Модуль для работы с формой ввода номера телефона
 * и согласия на обработку персональных данных
 */

class PhoneFormManager {
    constructor() {
        this.isValidPhone = false;
        this.isValidDisplayName = false;
        this.isConsentGiven = false;
        this.phoneInput = null;
        this.displayNameInput = null;
        this.consentCheckbox = null;
        this.submitButton = null;
        this.errorElement = null;
    }

    /**
     * Создание HTML формы
     */
    createPhoneForm() {
        return `
            <div class="phone-form-modal" id="phoneFormModal">
                <div class="phone-form-overlay" onclick="hidePhoneForm()"></div>
                <div class="phone-form-content">
                    <div class="phone-form-header">
                        <h3>📱 Контактная информация</h3>
                        <p id="phoneFormDescription">Укажите номер телефона для связи по заказам</p>
                    </div>

                    <form id="phoneForm" class="phone-form">
                        <div class="phone-form-group">
                            <label for="displayNameInput">👤 Имя для обращения</label>
                            <input 
                                type="text" 
                                id="displayNameInput" 
                                class="display-name-input"
                                placeholder="Как к вам обращаться?"
                                maxlength="50"
                                autocomplete="name"
                                required
                            >
                            <div class="display-name-hint">Только буквы и пробелы, максимум 50 символов</div>
                        </div>

                        <div class="phone-form-group">
                            <label for="phoneInput">📞 Номер телефона</label>
                            <div class="phone-input-wrapper">
                                <input 
                                    type="tel" 
                                    id="phoneInput" 
                                    class="phone-input"
                                    placeholder="+7 (___) ___-__-__"
                                    value="+7 "
                                    maxlength="18"
                                    autocomplete="tel"
                                >
                                <div class="phone-validation-icon" id="phoneValidationIcon">
                                    <span class="validation-pending">⏳</span>
                                    <span class="validation-success hidden">✅</span>
                                    <span class="validation-error hidden">❌</span>
                                </div>
                            </div>
                            <div class="phone-hint">Введите российский мобильный номер</div>
                        </div>

                        <div class="consent-group">
                            <div class="consent-checkbox-wrapper">
                                <input 
                                    type="checkbox" 
                                    id="privacyConsent" 
                                    class="consent-checkbox"
                                    required
                                >
                                <label for="privacyConsent" class="consent-label">
                                    <div class="consent-text">
                                        <strong>✅ Согласие на обработку персональных данных</strong>
                                        <br><br>
                                        Я даю согласие на обработку моих персональных данных 
                                        (номер телефона) в соответствии с ФЗ-152 "О персональных данных" 
                                        для целей обработки заказов и связи по вопросам доставки.
                                        <br><br>
                                        🔒 Ваши данные защищены и не передаются третьим лицам.
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="form-error hidden" id="formError">
                            <span class="error-icon">⚠️</span>
                            <span class="error-text"></span>
                        </div>

                        <div class="phone-form-actions">
                            <button type="submit" class="btn-save" id="phoneSubmitBtn" disabled>
                                💾 Сохранить
                            </button>
                            <button type="button" class="btn-cancel" onclick="hidePhoneForm()">
                                ❌ Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    /**
     * Создание CSS стилей для формы
     */
    createPhoneFormStyles() {
        return `
            <style id="phoneFormStyles">
                .phone-form-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    animation: fadeIn 0.3s ease;
                }

                .phone-form-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                .phone-form-content {
                    background: var(--background-white);
                    border-radius: 16px;
                    padding: 24px;
                    max-width: 400px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: var(--card-shadow);
                    position: relative;
                    animation: slideUp 0.3s ease;
                }

                .phone-form-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .phone-form-header h3 {
                    color: var(--primary-color);
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 8px;
                }

                .phone-form-header p {
                    color: var(--text-secondary);
                    font-size: 14px;
                    margin: 0;
                }

                .phone-form-group {
                    margin-bottom: 20px;
                }

                .phone-form-group label {
                    display: block;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                    font-size: 14px;
                }

                .phone-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .phone-input {
                    width: 100%;
                    padding: 12px 40px 12px 16px;
                    border: 2px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 16px;
                    font-family: monospace;
                    letter-spacing: 1px;
                    transition: all 0.2s ease;
                    background: var(--background-white);
                }

                .phone-input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(46, 134, 171, 0.1);
                }

                .phone-input.valid {
                    border-color: var(--success-color);
                }

                .phone-input.invalid {
                    border-color: #ef4444;
                }

                .display-name-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 16px;
                    transition: all 0.2s ease;
                    background: var(--background-white);
                }

                .display-name-input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(46, 134, 171, 0.1);
                }

                .display-name-input.valid {
                    border-color: var(--success-color);
                }

                .display-name-input.invalid {
                    border-color: #ef4444;
                }

                .display-name-hint {
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin-top: 4px;
                }

                .phone-validation-icon {
                    position: absolute;
                    right: 12px;
                    font-size: 16px;
                }

                .phone-hint {
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin-top: 4px;
                }

                .consent-group {
                    margin-bottom: 20px;
                    padding: 16px;
                    background: rgba(46, 134, 171, 0.05);
                    border-radius: 12px;
                    border: 1px solid rgba(46, 134, 171, 0.1);
                }

                .consent-checkbox-wrapper {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }

                .consent-checkbox {
                    width: 20px;
                    height: 20px;
                    margin: 0;
                    flex-shrink: 0;
                    margin-top: 2px;
                    accent-color: var(--primary-color);
                }

                .consent-label {
                    cursor: pointer;
                    user-select: none;
                    margin: 0;
                    flex: 1;
                }

                .consent-text {
                    font-size: 13px;
                    line-height: 1.5;
                    color: var(--text-primary);
                    /* Динамическая высота с автоматическими переносами */
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    white-space: normal;
                    min-height: auto;
                    height: auto;
                }

                .consent-text strong {
                    color: var(--primary-color);
                    font-weight: 700;
                }

                .form-error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .error-icon {
                    font-size: 16px;
                    flex-shrink: 0;
                }

                .error-text {
                    color: #dc2626;
                    font-size: 14px;
                    font-weight: 500;
                }

                .phone-form-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }

                .btn-cancel,
                .btn-save {
                    flex: 1;
                    padding: 14px 20px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 2px solid;
                    text-align: center;
                    position: relative;
                }

                .btn-cancel {
                    background: transparent;
                    color: var(--text-secondary);
                    border-color: var(--border-color);
                }

                .btn-cancel:hover {
                    background: var(--background-light);
                    border-color: var(--text-secondary);
                    color: var(--text-primary);
                }

                .btn-save {
                    background: var(--success-color);
                    color: white;
                    border-color: var(--success-color);
                }

                .btn-save:hover:not(:disabled) {
                    background: #16a34a;
                    border-color: #16a34a;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }

                .btn-save:disabled {
                    background: var(--border-color);
                    border-color: var(--border-color);
                    color: var(--text-secondary);
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .hidden {
                    display: none !important;
                }

                /* Анимации */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(30px) scale(0.95);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                /* Адаптивность */
                @media (max-width: 480px) {
                    .phone-form-content {
                        margin: 10px;
                        padding: 20px;
                        max-height: 95vh;
                    }

                    .phone-form-actions {
                        flex-direction: column;
                    }

                    .btn-cancel,
                    .btn-save {
                        width: 100%;
                    }

                    .consent-text {
                        font-size: 12px;
                    }
                }
            </style>
        `;
    }

    /**
     * Валидация российского номера телефона
     */
    validatePhoneNumber(phone) {
        // Удаляем все символы кроме цифр
        const digits = phone.replace(/\D/g, '');
        
        // Проверяем российский номер: 8XXXXXXXXXX или 7XXXXXXXXXX
        if (digits.length === 11) {
            if (digits.startsWith('8') || digits.startsWith('7')) {
                // Проверяем код оператора (должен начинаться с 9)
                const operatorCode = digits.substring(1, 4);
                if (operatorCode.startsWith('9')) {
                    return {
                        isValid: true,
                        formatted: this.formatPhoneNumber(digits)
                    };
                }
            }
        }
        
        return {
            isValid: false,
            formatted: phone
        };
    }

    /**
     * Форматирование номера телефона
     */
    formatPhoneNumber(digits) {
        // Конвертируем 8 в 7 для единообразия
        if (digits.startsWith('8')) {
            digits = '7' + digits.substring(1);
        }
        
        // Форматируем: +7 (XXX) XXX-XX-XX
        return `+${digits.substring(0, 1)} (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 9)}-${digits.substring(9, 11)}`;
    }

    /**
     * Валидация имени для обращения
     */
    validateDisplayName(name) {
        if (!name || name.trim().length === 0) return false;
        if (name.length > 50) return false;
        
        // Проверяем, что имя содержит только буквы и пробелы
        const displayNameRegex = /^[а-яёa-zA-Z\s]+$/i;
        return displayNameRegex.test(name.trim());
    }

    /**
     * Обработка ввода в поле телефона
     */
    handlePhoneInput(event) {
        const input = event.target;
        let value = input.value;
        
        // Сохраняем позицию курсора
        const cursorPosition = input.selectionStart;
        
        // Удаляем все кроме цифр
        let digits = value.replace(/\D/g, '');
        
        // Если удалили +7, восстанавливаем
        if (!digits.startsWith('7') && digits.length > 0) {
            if (digits.startsWith('8')) {
                digits = '7' + digits.substring(1);
            } else {
                digits = '7' + digits;
            }
        }
        
        // Ограничиваем длину
        if (digits.length > 11) {
            digits = digits.substring(0, 11);
        }
        
        // Форматируем номер
        let formatted = '+7 ';
        if (digits.length > 1) {
            formatted += '(' + digits.substring(1, Math.min(4, digits.length));
            if (digits.length >= 4) {
                formatted += ') ' + digits.substring(4, Math.min(7, digits.length));
                if (digits.length >= 7) {
                    formatted += '-' + digits.substring(7, Math.min(9, digits.length));
                    if (digits.length >= 9) {
                        formatted += '-' + digits.substring(9, 11);
                    }
                }
            }
        }
        
        // Обновляем значение
        input.value = formatted;
        
        // Валидируем
        const validation = this.validatePhoneNumber(formatted);
        this.isValidPhone = validation.isValid;
        
        this.updateValidationIcon();
        this.updateSubmitButton();
        
        // Восстанавливаем позицию курсора (приблизительно)
        const newCursorPosition = Math.min(cursorPosition + (formatted.length - value.length), formatted.length);
        setTimeout(() => {
            input.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }

    /**
     * Обработка ввода в поле имени
     */
    handleDisplayNameInput(event) {
        const input = event.target;
        const value = input.value;
        
        // Валидируем
        this.isValidDisplayName = this.validateDisplayName(value);
        
        // Обновляем стили
        input.classList.remove('valid', 'invalid');
        if (value.length > 0) {
            if (this.isValidDisplayName) {
                input.classList.add('valid');
            } else {
                input.classList.add('invalid');
            }
        }
        
        this.updateSubmitButton();
    }

    /**
     * Обновление иконки валидации
     */
    updateValidationIcon() {
        const icon = document.getElementById('phoneValidationIcon');
        const pending = icon.querySelector('.validation-pending');
        const success = icon.querySelector('.validation-success');
        const error = icon.querySelector('.validation-error');
        
        pending.classList.add('hidden');
        success.classList.add('hidden');
        error.classList.add('hidden');
        
        const input = document.getElementById('phoneInput');
        
        if (this.isValidPhone) {
            success.classList.remove('hidden');
            input.classList.remove('invalid');
            input.classList.add('valid');
        } else if (input.value.length > 4) {
            error.classList.remove('hidden');
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            pending.classList.remove('hidden');
            input.classList.remove('valid', 'invalid');
        }
    }

    /**
     * Обработка чекбокса согласия
     */
    handleConsentChange(event) {
        this.isConsentGiven = event.target.checked;
        this.updateSubmitButton();
    }

    /**
     * Обновление состояния кнопки отправки
     */
    updateSubmitButton() {
        const button = document.getElementById('phoneSubmitBtn');
        const canSubmit = this.isValidPhone && this.isValidDisplayName && this.isConsentGiven;
        
        button.disabled = !canSubmit;
        
        if (canSubmit) {
            // Определяем, редактируем или добавляем
            const hasExistingData = currentUser && (currentUser.phone || currentUser.display_name);
            button.innerHTML = hasExistingData ? '💾 Обновить' : '💾 Сохранить';
        } else {
            button.innerHTML = '💾 Заполните все поля';
        }
    }

    /**
     * Показ ошибки
     */
    showError(message) {
        const errorElement = document.getElementById('formError');
        const errorText = errorElement.querySelector('.error-text');
        
        errorText.textContent = message;
        errorElement.classList.remove('hidden');
        
        // Автоматически скрыть через 5 секунд
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }

    /**
     * Инициализация формы
     */
    initializeForm() {
        // Добавляем стили
        if (!document.getElementById('phoneFormStyles')) {
            document.head.insertAdjacentHTML('beforeend', this.createPhoneFormStyles());
        }
        
        // Добавляем форму в DOM
        if (!document.getElementById('phoneFormModal')) {
            document.body.insertAdjacentHTML('beforeend', this.createPhoneForm());
        }
        
        // Получаем элементы
        this.phoneInput = document.getElementById('phoneInput');
        this.consentCheckbox = document.getElementById('privacyConsent');
        this.submitButton = document.getElementById('phoneSubmitBtn');
        this.errorElement = document.getElementById('formError');
        
        // Получаем элементы
        this.phoneInput = document.getElementById('phoneInput');
        this.displayNameInput = document.getElementById('displayNameInput');
        this.consentCheckbox = document.getElementById('privacyConsent');
        this.submitButton = document.getElementById('phoneSubmitBtn');
        this.errorElement = document.getElementById('formError');
        
        // Привязываем обработчики
        this.phoneInput.addEventListener('input', (e) => this.handlePhoneInput(e));
        this.phoneInput.addEventListener('focus', () => {
            if (this.phoneInput.value === '+7 ') {
                this.phoneInput.setSelectionRange(3, 3);
            }
        });
        
        this.displayNameInput.addEventListener('input', (e) => this.handleDisplayNameInput(e));
        
        this.consentCheckbox.addEventListener('change', (e) => this.handleConsentChange(e));
        
        document.getElementById('phoneForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Устанавливаем фокус на поле телефона
        setTimeout(() => {
            this.phoneInput.focus();
            this.phoneInput.setSelectionRange(3, 3);
        }, 100);
    }

    /**
     * Обработка отправки формы
     */
    async handleSubmit(event) {
        event.preventDefault();
        
        if (!this.isValidPhone || !this.isValidDisplayName || !this.isConsentGiven) {
            this.showError('Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const phone = this.phoneInput.value;
        const displayName = this.displayNameInput.value.trim();
        
        try {
            // Показываем индикатор загрузки
            this.submitButton.disabled = true;
            this.submitButton.innerHTML = '⏳ Сохранение...';
            
            // Проверяем наличие currentUser
            if (!currentUser || !currentUser.telegram_id) {
                console.warn('currentUser не найден, создаем тестового пользователя');
                // Для тестирования используем одного из существующих пользователей
                currentUser = {
                    telegram_id: '1717714804',
                    first_name: 'Alexey',
                    last_name: '',
                    username: ''
                };
            }
            
            console.log('Отправляем данные:', {
                telegram_id: currentUser.telegram_id,
                phone: phone,
                display_name: displayName,
                privacy_consent: true
            });
            
            // Отправляем данные на сервер
            const response = await fetch('/users/phone', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_id: currentUser.telegram_id,
                    phone: phone,
                    display_name: displayName,
                    privacy_consent: true
                })
            });
            
            console.log('Ответ сервера:', response.status, response.statusText);
            
            const result = await response.json();
            console.log('Результат:', result);
            
            if (response.ok) {
                // Успешно сохранено
                if (currentUser) {
                    currentUser.phone = phone;
                    currentUser.display_name = displayName;
                    currentUser.privacy_consent = true;
                }
                
                // Показываем успех и закрываем форму
                const hasExistingData = currentUser && (currentUser.phone || currentUser.display_name);
                this.submitButton.innerHTML = hasExistingData ? '✅ Обновлено!' : '✅ Сохранено!';
                setTimeout(() => {
                    hidePhoneForm();
                    // Можно показать уведомление об успехе
                    if (typeof tg !== 'undefined' && tg.showAlert) {
                        tg.showAlert('📱 Данные успешно сохранены!');
                    }
                    // Обновляем отображение профиля
                    if (typeof updatePhoneSection === 'function') {
                        updatePhoneSection();
                    }
                }, 1000);
                
            } else {
                // Детализированная обработка HTTP ошибок
                let errorMessage;
                switch (response.status) {
                    case 400:
                        errorMessage = result.error || 'Неверные данные';
                        break;
                    case 404:
                        errorMessage = 'Пользователь не найден';
                        break;
                    case 409:
                        errorMessage = 'Номер телефона уже используется';
                        break;
                    case 500:
                        errorMessage = 'Ошибка сервера';
                        break;
                    default:
                        errorMessage = result.error || `Ошибка HTTP ${response.status}`;
                }
                throw new Error(errorMessage);
            }
            
        } catch (error) {
            console.error('Ошибка при сохранении номера телефона:', error);
            
            let errorMessage = 'Ошибка при сохранении. Попробуйте еще раз.';
            
            // Пытаемся получить более детальную информацию об ошибке
            if (error.message) {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage);
            
            // Восстанавливаем кнопку
            this.submitButton.disabled = false;
            this.updateSubmitButton();
        }
    }
}

// Глобальные функции для управления формой
let phoneFormManager = null;

function showPhoneForm() {
    if (!phoneFormManager) {
        phoneFormManager = new PhoneFormManager();
    }
    
    phoneFormManager.initializeForm();
    
    // ЗАПОЛНЯЕМ ФОРМУ СУЩЕСТВУЮЩИМИ ДАННЫМИ
    if (currentUser) {
        const phoneInput = document.getElementById('phoneInput');
        const displayNameInput = document.getElementById('displayNameInput');
        const consentCheckbox = document.getElementById('privacyConsent');
        const descriptionElement = document.getElementById('phoneFormDescription');
        
        // Определяем, редактируем или добавляем
        const hasExistingData = currentUser.phone || currentUser.display_name;
        
        if (hasExistingData) {
            // Редактирование - обновляем описание и кнопку
            descriptionElement.textContent = 'Отредактируйте ваши контактные данные';
            const submitBtn = document.getElementById('phoneSubmitBtn');
            submitBtn.innerHTML = '💾 Обновить';
        } else {
            // Добавление - стандартное описание
            descriptionElement.textContent = 'Укажите номер телефона для связи по заказам';
            const submitBtn = document.getElementById('phoneSubmitBtn');
            submitBtn.innerHTML = '💾 Сохранить';
        }
        
        // Заполняем имя для обращения
        if (currentUser.display_name) {
            displayNameInput.value = currentUser.display_name;
            phoneFormManager.handleDisplayNameInput({ target: displayNameInput });
        }
        
        // Заполняем телефон
        if (currentUser.phone) {
            phoneInput.value = currentUser.phone;
            phoneFormManager.handlePhoneInput({ target: phoneInput });
        }
        
        // Устанавливаем согласие
        if (currentUser.privacy_consent) {
            consentCheckbox.checked = true;
            phoneFormManager.handleConsentChange({ target: consentCheckbox });
        }
    }
    
    document.getElementById('phoneFormModal').style.display = 'flex';
    
    // Предотвращаем скролл фона
    document.body.style.overflow = 'hidden';
}

function hidePhoneForm() {
    const modal = document.getElementById('phoneFormModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Восстанавливаем скролл
    document.body.style.overflow = '';
}

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhoneFormManager;
} 