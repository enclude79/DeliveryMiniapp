// Глобальные переменные
let token = localStorage.getItem('adminToken');
let currentOrders = [];
let currentCustomers = [];
let customerListParams = { search: '', page: 1, limit: 20 };
let orderListParams = { page: 1, limit: 50 };
let productListParams = { page: 1, limit: 50, category_id: '' };
let lastOrdersPageCount = 0;
let lastProductsPageCount = 0;
let lastViewedCustomer = null;
let filters = {
    dateFrom: '',
    dateTo: '',
    status: '',
    customerId: ''
};

// Переменная для автообновления
let autoRefreshInterval = null;

// Функция для запуска автообновления
function startAutoRefresh() {
    // Останавливаем предыдущий интервал если есть
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Запускаем автообновление каждые 30 секунд
    autoRefreshInterval = setInterval(() => {
        console.log('Автообновление админки...');
        const currentPage = document.querySelector('#mainContent > div[style*="display: block"]');
        if (currentPage) {
            const pageId = currentPage.id.replace('Page', '');
            // Обновляем текущую страницу
            switch(pageId) {
                case 'orders':
                    loadOrders();
                    break;
                case 'customers':
                    loadCustomers();
                    break;
                case 'settings':
                    loadSettings();
                    break;
                case 'order-statuses':
                    loadOrderStatuses();
                    break;
            }
        }
    }, 30000); // 30 секунд
}

// Функция для остановки автообновления
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Функция для сброса кэша
function clearCache() {
    console.log('Сброс кэша администратора');
    cachedOrderStatuses = null;
    cachedOrderStatusesTime = 0;
}

// Функции для работы с API
async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = {
        'Authorization': `Bearer ${token}`
    };
    
    if (data && !(data instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    console.log(`Отправка ${method} запроса на ${endpoint}`, data);
    const response = await fetch(endpoint, {
        method,
        headers,
        body: data instanceof FormData ? data : (data ? JSON.stringify(data) : null)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin panel loading...', { token: !!token });
    
    if (token) {
        console.log('Token found, showing main content');
        showMainContent();
        loadOrders();
    } else {
        console.log('No token found, showing login form');
    }

    // Обработчики событий
    document.getElementById('login').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Навигация
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            console.log('Navigation to:', page);
            showPage(page);
        });
    });

    // Обработчики фильтров
    setupFilters();
    
    // Формы
    document.getElementById('addProductForm')?.addEventListener('submit', handleAddProduct);
    document.getElementById('editProductForm')?.addEventListener('submit', handleEditProduct);
    document.getElementById('addCategoryForm')?.addEventListener('submit', handleAddCategory);
    document.getElementById('editCategoryForm')?.addEventListener('submit', handleEditCategory);
    document.getElementById('addStatusForm')?.addEventListener('submit', handleAddStatus);
    document.getElementById('editStatusForm')?.addEventListener('submit', handleEditStatus);
    
    // Обработчики модальных окон
    const addProductModal = document.getElementById('addProductModal');
    if (addProductModal) {
        addProductModal.addEventListener('show.bs.modal', async () => {
            await loadCategories(true);
        });
    }
});

// Настройка фильтров
function setupFilters() {
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const statusSelect = document.getElementById('statusFilter');
    const customerInput = document.getElementById('customerFilter');
    // Кнопка очистки фильтров обрабатывается через onclick в HTML

    // Устанавливаем значения по умолчанию для дат
    if (dateFromInput && dateToInput) {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        dateFromInput.value = weekAgo.toISOString().split('T')[0];
        dateToInput.value = today.toISOString().split('T')[0];
        
        filters.dateFrom = dateFromInput.value;
        filters.dateTo = dateToInput.value;
    }

    // Обработчики событий фильтров
    dateFromInput?.addEventListener('change', (e) => {
        filters.dateFrom = e.target.value;
        loadOrders();
    });

    dateToInput?.addEventListener('change', (e) => {
        filters.dateTo = e.target.value;
        loadOrders();
    });

    statusSelect?.addEventListener('change', (e) => {
        filters.status = e.target.value;
        loadOrders();
    });

    customerInput?.addEventListener('input', debounce((e) => {
        filters.customerId = e.target.value;
        loadOrders();
    }, 500));

    // Функция очистки фильтров будет глобальной
}

// Функция debounce для оптимизации поиска
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Функции авторизации
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await apiCall('/api/admin/login', 'POST', { username, password });
        token = response.token;
        localStorage.setItem('adminToken', token);
        showMainContent();
        loadOrders();
    } catch (error) {
        showAlert('Ошибка входа: ' + error.message, 'danger');
    }
}

function handleLogout() {
    // Останавливаем автообновление при выходе
    stopAutoRefresh();
    localStorage.removeItem('adminToken');
    location.reload();
}

// Управление интерфейсом
function showMainContent() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Запускаем автообновление при входе в админку
    startAutoRefresh();
}

function showPage(pageId) {
    document.querySelectorAll('#mainContent > div[id$="Page"]').forEach(page => {
        page.style.display = 'none';
    });
    
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // Загрузка данных для страницы
    switch(pageId) {
        case 'orders':
            loadOrders();
            loadStatusesForFilter();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'products':
            loadProducts();
            loadCategories(true);
            break;
        case 'categories':
            loadCategories();
            break;
        case 'security':
            loadSecurityStats();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'order-statuses':
            loadOrderStatuses();
            break;
    }
}

// Показ уведомлений
function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alertsContainer') || createAlertsContainer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertsContainer.appendChild(alert);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function createAlertsContainer() {
    const container = document.createElement('div');
    container.id = 'alertsContainer';
    container.className = 'position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1050';
    document.body.appendChild(container);
    return container;
}

// Работа с заказами
async function loadOrders() {
    console.log('Loading orders...', { filters, token: !!token });
    
    try {
        showLoading('ordersTableBody');
        
        // Построение query параметров
        const params = new URLSearchParams();
        if (filters.dateFrom) params.append('date_from', filters.dateFrom);
        if (filters.dateTo) params.append('date_to', filters.dateTo);
        if (filters.status) params.append('status', filters.status);
        if (filters.customerId) params.append('telegram_id', filters.customerId);
        
        // Пагинация заказов
        if (orderListParams.page) params.append('page', orderListParams.page);
        if (orderListParams.limit) params.append('limit', orderListParams.limit);
        const endpoint = `/api/admin/orders${params.toString() ? '?' + params.toString() : ''}`;
        console.log('API endpoint:', endpoint);
        
        const response = await apiCall(endpoint);
        const orders = response.orders || response;
        console.log('Orders received:', orders);
        currentOrders = orders;
        lastOrdersPageCount = Array.isArray(orders) ? orders.length : 0;
        
        renderOrdersTable(orders);
        const pagination = response.pagination || {
            page: orderListParams.page,
            // если элементов меньше лимита — это последняя страница
            totalPages: lastOrdersPageCount < orderListParams.limit ? orderListParams.page : orderListParams.page + 1
        };
        renderOrdersPagination(pagination);
    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('Ошибка загрузки заказов: ' + error.message, 'danger');
        document.getElementById('ordersTableBody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
    }
}
function renderOrdersPagination(pagination) {
    const container = document.getElementById('ordersPagination');
    if (!container) return;
    const { page, totalPages } = pagination;
    if (!totalPages || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    const items = [];
    const make = (p, label = null, disabled = false, active = false) => {
        const text = label || p;
        return `<li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}"><a class="page-link" href="#" data-page="${p}">${text}</a></li>`;
    };
    items.push(make(Math.max(1, page - 1), '«', page === 1));
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const realStart = Math.max(1, end - windowSize + 1);
    for (let p = realStart; p <= end; p++) items.push(make(p, null, false, p === page));
    const disableNext = page === totalPages || lastOrdersPageCount < orderListParams.limit;
    items.push(make(Math.min(totalPages, page + 1), '»', disableNext));
    container.innerHTML = `<ul class="pagination">${items.join('')}</ul>`;
    container.querySelectorAll('a.page-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const p = parseInt(e.currentTarget.getAttribute('data-page'));
            if (!Number.isNaN(p) && p !== orderListParams.page) {
                orderListParams.page = p;
                loadOrders();
            }
        });
    });
}


function renderOrdersTable(orders) {
    console.log('Rendering orders table:', { ordersCount: orders.length, orders });
    const ordersTableBody = document.getElementById('ordersTableBody');
    
    if (!ordersTableBody) {
        console.error('ordersTableBody element not found!');
        return;
    }
    
    if (!orders.length) {
        ordersTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Заказы не найдены</td></tr>';
        return;
    }
    
    ordersTableBody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>#${order.id}</strong></td>
            <td>${formatDate(order.created_at)}</td>
            <td>
                <a href="#" onclick="showCustomer('${order.telegram_id}')" class="text-decoration-none">
                    ${order.customer_name || 'Без имени'}
                </a>
                <small class="text-muted d-block">ID: ${order.telegram_id}</small>
            </td>
            <td>
                <small class="text-muted">${truncateText(order.address || 'Адрес не указан', 50)}</small>
            </td>
            <td><strong>${order.total_amount} ₽</strong></td>
            <td>
                <span class="badge bg-${getStatusColor(order.status)}">${getStatusText(order.status)}</span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showOrderDetails(${order.id})" title="Показать детали">
                    👁️ Детали
                </button>
            </td>
        </tr>
    `).join('');
}

function renderCustomersTable(customers) {
    console.log('🔍 [ADMIN DEBUG] Rendering customers table:', { customersCount: customers.length, customers });
    const customersTableBody = document.getElementById('customersTableBody');
    
    if (!customersTableBody) {
        console.error('❌ [ADMIN DEBUG] customersTableBody element not found!');
        return;
    }
    
    if (!customers.length) {
        console.log('⚠️ [ADMIN DEBUG] Нет клиентов для отображения');
        customersTableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Клиенты не найдены</td></tr>';
        return;
    }
    
    customersTableBody.innerHTML = customers.map(customer => {
        console.log('🔍 [ADMIN DEBUG] Обработка клиента:', {
            telegram_id: customer.telegram_id,
            full_name: customer.full_name,
            phone_number: customer.phone_number,
            privacy_consent: customer.privacy_consent
        });
        
        return `
        <tr>
            <td>
                <strong>${customer.name || [customer.first_name || '', customer.last_name || ''].filter(Boolean).join(' ') || 'Без имени'}</strong>
                ${customer.username ? `<br><small class="text-muted">@${customer.username}</small>` : ''}
            </td>
            <td><code>${customer.telegram_id}</code></td>
            <td>${customer.full_name || 'Не указано'}</td>
            <td>${customer.phone_number || customer.phone || 'Не указан'}</td>
            <td>${customer.date_of_birth ? formatDate(customer.date_of_birth) : 'Не указана'}</td>
            <td>${customer.gender || 'Не указан'}</td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="form-check form-switch m-0">
                        <input class="form-check-input" type="checkbox" 
                               id="consent-${customer.telegram_id}"
                               ${customer.privacy_consent ? 'checked' : ''}
                               onchange="debouncedToggleConsent('${customer.telegram_id}', this.checked)">
                    </div>
                    <small class="text-muted" id="consent-status-${customer.telegram_id}">${customer.privacy_consent ? '✅ Да' : '❌ Нет'}</small>
                </div>
            </td>
            <td><strong>${customer.total_orders || 0}</strong></td>
            <td><strong>${customer.total_spent || 0} ₽</strong></td>
            <td>
                ${customer.last_order_date ? 
                    `<small>${formatDate(customer.last_order_date)}</small>` : 
                    '<small class="text-muted">Нет заказов</small>'
                }
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showCustomer('${customer.telegram_id}')" title="Показать карточку клиента">
                    👤 Карточка
                </button>
            </td>
        </tr>
    `}).join('');
}
// Сохранение согласия ПД из карточки клиента
async function updateCustomerConsent(telegramId) {
    try {
        const btn = document.getElementById('saveConsentBtn');
        const toggle = document.getElementById('privacyConsentToggle');
        if (!toggle || !btn) return;
        const newValue = !!toggle.checked;

        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Сохранение...';

        // Используем публичный users API
        await apiCall(`/users/${telegramId}`, 'PUT', { privacy_consent: newValue });

        // Обновляем подпись и локальное состояние
        const label = toggle.nextElementSibling;
        if (label) {
            label.textContent = newValue ? 'Да' : 'Нет';
        }
        // Обновить строку в таблице если уже загружена
        const consentCellText = document.getElementById(`consent-status-${telegramId}`);
        if (consentCellText) {
            consentCellText.textContent = newValue ? '✅ Да' : '❌ Нет';
        }
        // Синхронизируем currentCustomers
        currentCustomers = (currentCustomers || []).map(c => 
            c.telegram_id == telegramId ? { ...c, privacy_consent: newValue } : c
        );

        showAlert('✅ Согласие на обработку ПД обновлено', 'success');
    } catch (error) {
        showAlert('Ошибка сохранения согласия: ' + error.message, 'danger');
        // Откатить переключатель
        const toggle = document.getElementById('privacyConsentToggle');
        if (toggle) toggle.checked = !toggle.checked;
    } finally {
        const btn = document.getElementById('saveConsentBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '💾 Сохранить';
        }
    }
}

// Сохранение всех полей из карточки клиента
async function updateCustomerAllFields(telegramId) {
    try {
        const dateOfBirthInput = document.getElementById('dateOfBirthInput');
        const genderSelect = document.getElementById('genderSelect');
        const consentToggle = document.getElementById('privacyConsentToggle');
        
        if (!dateOfBirthInput || !genderSelect || !consentToggle) {
            showAlert('❌ Ошибка: не удалось найти поля для сохранения', 'danger');
            return;
        }
        
        const dateOfBirth = dateOfBirthInput.value || null;
        const gender = genderSelect.value || null;
        const privacyConsent = !!consentToggle.checked;
        
        // Используем публичный users API для сохранения всех полей
        await apiCall(`/users/${telegramId}`, 'PUT', { 
            date_of_birth: dateOfBirth,
            gender: gender,
            privacy_consent: privacyConsent
        });
        
        // Синхронизируем currentCustomers
        currentCustomers = (currentCustomers || []).map(c => 
            c.telegram_id == telegramId ? { 
                ...c, 
                date_of_birth: dateOfBirth, 
                gender: gender, 
                privacy_consent: privacyConsent 
            } : c
        );
        
        showAlert('✅ Все изменения сохранены успешно', 'success');
        
        // Обновляем статус согласия в таблице если есть
        const consentStatusEl = document.getElementById(`consent-status-${telegramId}`);
        if (consentStatusEl) {
            consentStatusEl.textContent = privacyConsent ? '✅ Да' : '❌ Нет';
        }
        
        // Обновляем чекбокс в таблице если есть
        const consentCheckbox = document.getElementById(`consent-${telegramId}`);
        if (consentCheckbox) {
            consentCheckbox.checked = privacyConsent;
        }
        
    } catch (error) {
        showAlert('Ошибка сохранения данных: ' + error.message, 'danger');
    }
}

// Debounce для переключателя в таблице
const debouncedToggleConsent = debounce(async (telegramId, checked) => {
    try {
        const statusEl = document.getElementById(`consent-status-${telegramId}`);
        if (statusEl) {
            statusEl.textContent = '⏳ Сохранение...';
        }
        await apiCall(`/users/${telegramId}`, 'PUT', { privacy_consent: !!checked });
        if (statusEl) {
            statusEl.textContent = checked ? '✅ Да' : '❌ Нет';
        }
        // Обновляем локальное состояние
        currentCustomers = (currentCustomers || []).map(c => 
            c.telegram_id == telegramId ? { ...c, privacy_consent: !!checked } : c
        );
        showAlert('✅ Согласие на обработку ПД обновлено', 'success');
    } catch (error) {
        showAlert('Ошибка сохранения согласия: ' + error.message, 'danger');
        // Откат чекбокса
        const cb = document.getElementById(`consent-${telegramId}`);
        if (cb) cb.checked = !checked;
        const statusEl = document.getElementById(`consent-status-${telegramId}`);
        if (statusEl) statusEl.textContent = !checked ? '✅ Да' : '❌ Нет';
    }
}, 600);

// Работа с клиентами
async function loadCustomers() {
    try {
        console.log('🔍 [ADMIN DEBUG] Начало загрузки клиентов');
        showLoading('customersTableBody');
        // Формируем параметры запроса: поиск + пагинация
        const params = new URLSearchParams();
        if (customerListParams.search) params.append('search', customerListParams.search);
        if (customerListParams.page) params.append('page', customerListParams.page);
        if (customerListParams.limit) params.append('limit', customerListParams.limit);
        const endpoint = `/api/admin/customers${params.toString() ? '?' + params.toString() : ''}`;
        const response = await apiCall(endpoint);
        console.log('🔍 [ADMIN DEBUG] Ответ API клиентов:', response);
        
        // API возвращает объект с customers массивом
        const customers = response.customers || response;
        console.log('🔍 [ADMIN DEBUG] Обработанные данные клиентов:', customers);
        
        currentCustomers = customers;
        renderCustomersTable(customers);
        // Рендер пагинации если есть
        if (response.pagination) {
            renderCustomersPagination(response.pagination);
        }
    } catch (error) {
        console.error('❌ [ADMIN DEBUG] Ошибка загрузки клиентов:', error);
        showAlert('Ошибка загрузки клиентов: ' + error.message, 'danger');
        document.getElementById('customersTableBody').innerHTML = '<tr><td colspan="11" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
    }
}

// Удаляем дублирующуюся функцию renderCustomersTable - она уже определена выше

// Показ деталей заказа
async function showOrderDetails(orderId) {
    try {
        const order = await apiCall(`/api/admin/orders/${orderId}`);
        
        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        const modalBody = document.querySelector('#orderDetailsModal .modal-body');
        
        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Информация о заказе</h6>
                    <table class="table table-sm">
                        <tr><td><strong>ID заказа:</strong></td><td>#${order.id}</td></tr>
                        <tr><td><strong>Дата:</strong></td><td>${formatDateTime(order.created_at)}</td></tr>
                        <tr><td><strong>Статус:</strong></td><td><span class="badge bg-${getStatusColor(order.status)}">${getStatusText(order.status)}</span></td></tr>
                        <tr><td><strong>Сумма:</strong></td><td><strong>${order.total_amount} ₽</strong></td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>Информация о клиенте</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Имя:</strong></td><td>${order.customer_name || 'Не указано'}</td></tr>
                        <tr><td><strong>Telegram ID:</strong></td><td><code>${order.telegram_id}</code></td></tr>
                        <tr><td><strong>Username:</strong></td><td>${order.username ? '@' + order.username : 'Не указан'}</td></tr>
                        <tr><td><strong>Телефон:</strong></td><td>${order.phone || 'Не указан'}</td></tr>
                    </table>
                </div>
            </div>
            
            <div class="mt-4">
                <h6>Адрес доставки</h6>
                <div class="alert alert-light">
                    ${order.address || 'Адрес не указан'}
                </div>
            </div>
            
            <div class="mt-4">
                <h6>Состав заказа</h6>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th>Расчет</th>
                                <th>Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items ? order.items.map(item => {
                                const unitPrice = item.price; // item.price уже цена за единицу
                                const totalPrice = item.quantity * item.price;
                                return `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.quantity} шт. × ${unitPrice} ₽</td>
                                    <td><strong>${totalPrice} ₽</strong></td>
                                </tr>
                                `}).join('') : '<tr><td colspan="3">Товары не найдены</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="mt-4">
                <h6>📝 Информация от оператора</h6>
                <div class="mb-3">
                    <textarea 
                        class="form-control" 
                        id="operatorMessage" 
                        rows="2" 
                        placeholder="Введите сообщение для клиента..."
                        style="resize: vertical;"
                    >${order.operator_message || ''}</textarea>
                </div>
                <button 
                    class="btn btn-primary btn-sm" 
                    onclick="saveOperatorMessage(${order.id})"
                    id="saveOperatorMessageBtn"
                >
                    💾 Сохранить сообщение
                </button>
            </div>
            
            <div class="mt-4">
                <h6>Управление статусом</h6>
                <div class="btn-group" role="group" id="statusButtons">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Загрузка...</span>
                    </div>
                </div>
            </div>
        `;
        
        // Асинхронно загружаем кнопки статусов
        const statusButtons = await getStatusButtons(order);
        document.getElementById('statusButtons').innerHTML = statusButtons;
        
        // Добавляем обработчики кнопок статуса
        modalBody.querySelectorAll('.status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const status = e.target.dataset.status;
                const statusText = getStatusText(status);
                const currentStatus = getStatusText(order.status);
                
                // Подтверждение для критических изменений статуса
                const criticalStatuses = ['отменен', 'доставлен'];
                const needConfirmation = criticalStatuses.includes(status) || 
                                       (order.status === 'доставлен' && status !== 'доставлен') ||
                                       (order.status === 'отменен' && status !== 'отменен');
                
                if (needConfirmation) {
                    const confirmMessage = `Вы уверены, что хотите изменить статус заказа #${orderId}?\n\n` +
                                         `С "${currentStatus}" на "${statusText}"\n\n` +
                                         `Это действие может повлиять на уведомления клиента.`;
                    
                    if (!confirm(confirmMessage)) {
                        return;
                    }
                }
                
                try {
                    // Показываем индикатор загрузки на кнопке
                    const originalText = e.target.innerHTML;
                    e.target.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Обновление...';
                    e.target.disabled = true;
                    
                    await apiCall(`/api/admin/orders/${orderId}/status`, 'PUT', { status });
                    clearCache(); // Сбрасываем кэш после изменения статуса
                    showAlert(`✅ Статус заказа #${orderId} обновлен на "${statusText}"`, 'success');
                    modal.hide();
                    loadOrders();
                } catch (error) {
                    // Восстанавливаем кнопку при ошибке
                    e.target.innerHTML = originalText;
                    e.target.disabled = false;
                    showAlert('Ошибка обновления статуса: ' + error.message, 'danger');
                }
            });
        });
        
        modal.show();
    } catch (error) {
        showAlert('Ошибка загрузки деталей заказа: ' + error.message, 'danger');
    }
}

// Показ карточки клиента
async function showCustomer(telegramId) {
    try {
        const customer = await apiCall(`/api/admin/customers/${telegramId}`);
        lastViewedCustomer = customer;
        
        const modal = new bootstrap.Modal(document.getElementById('customerModal'));
        const modalBody = document.querySelector('#customerModal .modal-body');
        
        modalBody.innerHTML = `
            <ul class="nav nav-tabs" id="customerTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="info-tab" data-bs-toggle="tab" data-bs-target="#info" type="button">Информация</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="addresses-tab" data-bs-toggle="tab" data-bs-target="#addresses" type="button">Адреса</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="orders-tab" data-bs-toggle="tab" data-bs-target="#orders" type="button">Заказы</button>
                </li>
            </ul>
            
            <div class="tab-content mt-3" id="customerTabContent">
                <div class="tab-pane fade show active" id="info" role="tabpanel">
                    <table class="table">
                        <tr><td><strong>Telegram ID:</strong></td><td><code>${customer.telegram_id}</code></td></tr>
                        <tr><td><strong>Имя:</strong></td><td>${customer.first_name || 'Не указано'}</td></tr>
                        <tr><td><strong>Фамилия:</strong></td><td>${customer.last_name || 'Не указано'}</td></tr>
                        <tr><td><strong>Username:</strong></td><td>${customer.username ? '@' + customer.username : 'Не указан'}</td></tr>
                        <tr><td><strong>Телефон:</strong></td><td>${customer.phone || 'Не указан'}</td></tr>
                        <tr><td><strong>Полное имя:</strong></td><td>${customer.full_name || 'Не указано'}</td></tr>
                        <tr><td><strong>Номер телефона для связи:</strong></td><td>${customer.phone_number || 'Не указан'}</td></tr>
                        <tr><td><strong>Дата рождения:</strong></td><td>
                            <input type="date" class="form-control form-control-sm" id="dateOfBirthInput" value="${customer.date_of_birth || ''}" style="width: 200px;">
                        </td></tr>
                        <tr><td><strong>Пол:</strong></td><td>
                            <select class="form-select form-select-sm" id="genderSelect" style="width: 200px;">
                                <option value="">Не указан</option>
                                <option value="Мужской" ${customer.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
                                <option value="Женский" ${customer.gender === 'Женский' ? 'selected' : ''}>Женский</option>
                            </select>
                        </td></tr>
                        <tr><td><strong>Согласие на обработку ПД:</strong></td><td>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="privacyConsentToggle" ${customer.privacy_consent ? 'checked' : ''}>
                                <label class="form-check-label" for="privacyConsentToggle">
                                    ${customer.privacy_consent ? 'Да' : 'Нет'}
                                </label>
                            </div>
                        </td></tr>
                        <tr><td><strong>Дата регистрации:</strong></td><td>${formatDateTime(customer.created_at)}</td></tr>
                        <tr><td><strong>Последнее обновление:</strong></td><td>${formatDateTime(customer.updated_at)}</td></tr>
                    </table>
                </div>
                
                <div class="tab-pane fade" id="addresses" role="tabpanel">
                    ${customer.addresses && customer.addresses.length ? `
                        <div class="list-group">
                            ${customer.addresses.map(addr => `
                                <div class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${addr.name || 'Без названия'}</h6>
                                        ${addr.is_default ? '<span class="badge bg-primary">По умолчанию</span>' : ''}
                                    </div>
                                    <p class="mb-1">📍 ${addr.full_address}</p>
                                    
                                    <!-- Дополнительные поля адреса -->
                                    <div class="row g-2 mb-2">
                                        <div class="col-auto"><small class="text-muted">🏠 Подъезд: ${addr.entrance || 'не указан'}</small></div>
                                        <div class="col-auto"><small class="text-muted">🏢 Этаж: ${addr.floor || 'не указан'}</small></div>
                                        <div class="col-auto"><small class="text-muted">🚪 Кв.: ${addr.apartment || 'не указана'}</small></div>
                                        <div class="col-auto"><small class="text-muted">📞 Домофон: ${addr.intercom || 'не указан'}</small></div>
                                    </div>
                                    <div class="mb-2"><small class="text-muted">💬 Комментарий: ${addr.comment || 'не указан'}</small></div>
                                    
                                    <!-- Координаты от Яндекс Карт -->
                                    <div class="card mt-2">
                                        <div class="card-body p-2">
                                            <h6 class="card-title mb-1">🗺️ Координаты (Яндекс Карты) 🔒</h6>
                                            <div class="row g-2">
                                                <div class="col-6">
                                                    <small class="text-muted">Широта:</small>
                                                    <div class="font-monospace">${addr.latitude || 'не указана'}</div>
                                                </div>
                                                <div class="col-6">
                                                    <small class="text-muted">Долгота:</small>
                                                    <div class="font-monospace">${addr.longitude || 'не указана'}</div>
                                                </div>
                                            </div>
                                            ${addr.latitude && addr.longitude ? `
                                                <div class="mt-2">
                                                    <a href="https://yandex.ru/maps/?ll=${addr.longitude},${addr.latitude}&z=16&pt=${addr.longitude},${addr.latitude}" 
                                                       target="_blank" class="btn btn-sm btn-outline-primary">
                                                        🗺️ Открыть на Яндекс Картах
                                                    </a>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                    
                                    <!-- Админские координаты -->
                                    <div class="card mt-2">
                                        <div class="card-body p-2">
                                            <h6 class="card-title mb-1">⚙️ Админские координаты</h6>
                                            <div class="row g-2">
                                                <div class="col-6">
                                                    <input type="number" class="form-control form-control-sm" 
                                                           placeholder="Широта" step="any"
                                                           value="${addr.admin_latitude || ''}"
                                                           onchange="updateAdminCoordinates(${addr.id}, 'admin_latitude', this.value)">
                                                </div>
                                                <div class="col-6">
                                                    <input type="number" class="form-control form-control-sm" 
                                                           placeholder="Долгота" step="any"
                                                           value="${addr.admin_longitude || ''}"
                                                           onchange="updateAdminCoordinates(${addr.id}, 'admin_longitude', this.value)">
                                                </div>
                                            </div>
                                            <div class="mt-2">
                                                <textarea class="form-control form-control-sm" 
                                                          placeholder="Комментарий к координатам" rows="2"
                                                          onchange="updateAdminCoordinates(${addr.id}, 'admin_coordinate_comment', this.value)">${addr.admin_coordinate_comment || ''}</textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted">Адреса не найдены</p>'}
                </div>
                
                <div class="tab-pane fade" id="orders" role="tabpanel">
                    ${customer.recent_orders && customer.recent_orders.length ? `
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Дата</th>
                                        <th>Сумма</th>
                                        <th>Статус</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${customer.recent_orders.map(order => `
                                        <tr>
                                            <td>#${order.id}</td>
                                            <td>${formatDate(order.created_at)}</td>
                                            <td>${order.total_amount} ₽</td>
                                            <td><span class="badge bg-${getStatusColor(order.status)}">${getStatusText(order.status)}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-outline-primary" onclick="showOrderDetails(${order.id})">
                                                    Детали
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted">Заказы не найдены</p>'}
                </div>
            </div>
        `;
        
        // Добавляем кнопку "Сохранить" в футер модального окна
        const modalFooter = document.querySelector('#customerModal .modal-footer');
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                <button type="button" class="btn btn-primary" onclick="updateCustomerAllFields('${customer.telegram_id}')">
                    💾 Сохранить изменения
                </button>
            `;
        }
        
        modal.show();
    } catch (error) {
        showAlert('Ошибка загрузки данных клиента: ' + error.message, 'danger');
    }
}

// Вспомогательные функции
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        if (elementId === 'ordersTableBody' || elementId === 'customersTableBody') {
            element.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Загрузка...</span></div></td></tr>';
        } else if (elementId === 'productsTableBody') {
            element.innerHTML = '<tr><td colspan="8" class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Загрузка...</span></div></td></tr>';
        } else {
            element.innerHTML = '<div class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Загрузка...</span></div></div>';
        }
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ru-RU');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU');
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function getStatusColor(status) {
    const colors = {
        'получен': 'primary',
        'в_обработке': 'warning',
        'собирается': 'info',
        'в_доставке': 'secondary',
        'доставлен': 'success',
        'отменен': 'danger'
    };
    return colors[status] || 'secondary';
}

function getStatusText(status) {
    const texts = {
        'получен': 'Получен',
        'в_обработке': 'В обработке',
        'собирается': 'Собирается',
        'в_доставке': 'В доставке',
        'доставлен': 'Доставлен',
        'отменен': 'Отменен'
    };
    return texts[status] || status;
}

// Кеш для статусов заказов
let cachedOrderStatuses = null;
let cachedOrderStatusesTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

// Получить статусы заказов из API
async function getOrderStatuses() {
    const now = Date.now();
    
    // Проверяем если кэш актуален
    if (cachedOrderStatuses && (now - cachedOrderStatusesTime < CACHE_DURATION)) {
        console.log('Используем кэшированные статусы заказов');
        return cachedOrderStatuses;
    }
    
    try {
        console.log('Загружаем статусы заказов с сервера');
        cachedOrderStatuses = await apiCall('/api/admin/order-statuses');
        cachedOrderStatusesTime = now;
        return cachedOrderStatuses;
    } catch (error) {
        console.error('Ошибка загрузки статусов заказов:', error);
        // Fallback к старым статусам
        return [
            { key: 'получен', name: 'Получен', order_priority: 1, is_final: false },
            { key: 'в_обработке', name: 'В обработке', order_priority: 2, is_final: false },
            { key: 'собирается', name: 'Собирается', order_priority: 3, is_final: false },
            { key: 'в_доставке', name: 'В доставке', order_priority: 4, is_final: false },
            { key: 'доставлен', name: 'Доставлен', order_priority: 5, is_final: true },
            { key: 'отменен', name: 'Отменить', order_priority: 6, is_final: true }
        ];
    }
}

async function getStatusButtons(order) {
    const statuses = await getOrderStatuses();
    
    return statuses.map(status => {
        const isCurrentStatus = order.status === status.key;
        
        // Администратор может установить любой статус, кроме текущего
        const isDisabled = isCurrentStatus;
        
        // Визуально выделяем текущий статус
        const buttonClass = isCurrentStatus ? 
            `btn btn-sm btn-${getStatusColor(status.key)} status-btn` : 
            `btn btn-sm btn-outline-${getStatusColor(status.key)} status-btn`;
        
        return `<button class="${buttonClass}" 
                data-status="${status.key}" 
                ${isDisabled ? 'disabled' : ''}
                title="${isCurrentStatus ? 'Текущий статус' : 'Изменить статус на: ' + status.name}">
            ${isCurrentStatus ? '✓ ' : ''}${status.name}
        </button>`;
    }).join('');
}

// Остальные функции для товаров и категорий
async function loadCategories(forProducts = false) {
    try {
        const categories = await apiCall('/api/admin/categories');
        if (forProducts) {
            document.querySelectorAll('#addProductForm select[name="category_id"], #editProductForm select[name="category_id"]')
                .forEach(select => {
                    select.innerHTML = categories.map(cat => 
                        `<option value="${cat.id}">${cat.name}</option>`
                    ).join('');
                });
        } else {
            renderCategoriesTable(categories);
        }
    } catch (error) {
        showAlert('Ошибка загрузки категорий: ' + error.message, 'danger');
        if (!forProducts) {
            document.getElementById('categoriesTableBody').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
        }
    }
}

function renderCategoriesTable(categories) {
    const categoriesTableBody = document.getElementById('categoriesTableBody');
    
    if (!categoriesTableBody) {
        console.error('categoriesTableBody element not found!');
        return;
    }
    
    if (!categories.length) {
        categoriesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Категории не найдены</td></tr>';
        return;
    }
    
    categoriesTableBody.innerHTML = categories.map(category => `
        <tr>
            <td>
                <div class="category-emoji-display">
                    ${category.emoji || '🍽️'}
                </div>
            </td>
            <td>
                <strong>${category.name}</strong>
                <br><small class="text-muted">ID: ${category.id}</small>
            </td>
            <td>
                <span class="badge bg-secondary">${category.order_priority || 0}</span>
            </td>
            <td>
                <small class="text-muted">${formatDate(category.created_at)}</small>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editCategory(${category.id})" title="Редактировать">
                    ✏️ Редактировать
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${category.id})" title="Удалить">
                    🗑️ Удалить
                </button>
            </td>
        </tr>
    `).join('');
}

// Функции для работы с категориями
async function handleAddCategory(e) {
    e.preventDefault();
    const form = e.target;
    const formData = {
        name: form.querySelector('input[name="name"]').value,
        order_priority: form.querySelector('input[name="order_priority"]').value,
        emoji: form.querySelector('input[name="emoji"]').value
    };
    
    try {
        await apiCall('/api/admin/categories', 'POST', formData);
        showAlert('Категория успешно добавлена', 'success');
        form.reset();
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
        if (modal) {
            modal.hide();
        }
        
        loadCategories();
    } catch (error) {
        console.error('Ошибка добавления категории:', error);
        showAlert('Ошибка добавления категории: ' + error.message, 'danger');
    }
}

async function handleEditCategory(e) {
    e.preventDefault();
    const form = e.target;
    const categoryId = form.querySelector('input[name="id"]').value;
    
    if (!categoryId) {
        showAlert('ID категории не найден', 'danger');
        return;
    }
    
    const formData = {
        name: form.querySelector('input[name="name"]').value,
        order_priority: form.querySelector('input[name="order_priority"]').value,
        emoji: form.querySelector('input[name="emoji"]').value
    };
    
    try {
        await apiCall(`/api/admin/categories/${categoryId}`, 'PUT', formData);
        showAlert('Категория успешно обновлена', 'success');
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
        if (modal) {
            modal.hide();
        }
        
        // Перезагружаем список категорий
        loadCategories();
    } catch (error) {
        console.error('Ошибка обновления категории:', error);
        showAlert('Ошибка обновления категории: ' + error.message, 'danger');
    }
}

async function editCategory(categoryId) {
    try {
        const categories = await apiCall('/api/admin/categories');
        const category = categories.find(c => c.id == categoryId);
        
        if (!category) {
            showAlert('Категория не найдена', 'danger');
            return;
        }
        
        // Заполняем форму редактирования данными категории
        const form = document.getElementById('editCategoryForm');
        if (!form) {
            showAlert('Форма редактирования не найдена', 'danger');
            return;
        }
        
        // Заполняем поля формы
        form.querySelector('input[name="id"]').value = category.id;
        form.querySelector('input[name="name"]').value = category.name || '';
        form.querySelector('input[name="order_priority"]').value = category.order_priority || 0;
        form.querySelector('input[name="emoji"]').value = category.emoji || '';
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка загрузки категории:', error);
        showAlert('Ошибка загрузки категории: ' + error.message, 'danger');
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
        return;
    }
    
    try {
        await apiCall(`/api/admin/categories/${categoryId}`, 'DELETE');
        showAlert('Категория успешно удалена', 'success');
        loadCategories();
    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        showAlert('Ошибка удаления категории: ' + error.message, 'danger');
    }
}

// Функции для работы с эмодзи
function selectEmoji(formId, emoji) {
    const form = document.getElementById(formId);
    if (form) {
        const emojiInput = form.querySelector('input[name="emoji"]');
        if (emojiInput) {
            emojiInput.value = emoji;
        }
    }
}

function showEmojiPicker(formId) {
    const form = document.getElementById(formId);
    if (form) {
        const emojiInput = form.querySelector('input[name="emoji"]');
        if (emojiInput) {
            // Показываем расширенный список эмодзи
            const extendedEmojis = [
                '🍔', '🍕', '🍦', '🥟', '🍱', '🥤', '🍰', '🥗', '🍲', '🥨', '🥞', '🍖', '🍣', '🍝', '🥖', '🍽️',
                '🌮', '🌯', '🥙', '🧆', '🥪', '🍞', '🥐', '🥯', '🧀', '🥚', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭',
                '🍟', '🥔', '🍠', '🥕', '🌽', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍅', '🥝', '🍇',
                '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥥', '🥨',
                '🍩', '🍪', '🎂', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🍵', '🧃', '🥤',
                '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍴', '🥄', '🔪', '🍽️', '🥢'
            ];
            
            const currentValue = emojiInput.value;
            const selectedEmoji = prompt('Выберите эмодзи или вставьте свой:', currentValue);
            
            if (selectedEmoji !== null) {
                emojiInput.value = selectedEmoji;
            }
        }
    }
}

let currentProducts = [];
let productFilters = {
    category: ''
};

async function loadProducts() {
    try {
        showLoading('productsTableBody');
        const params = new URLSearchParams();
        if (productListParams.category_id) params.append('category_id', productListParams.category_id);
        if (productListParams.page) params.append('page', productListParams.page);
        if (productListParams.limit) params.append('limit', productListParams.limit);
        const endpoint = `/api/admin/products${params.toString() ? '?' + params.toString() : ''}`;
        const response = await apiCall(endpoint);
        const products = response.products || response;
        currentProducts = products;
        lastProductsPageCount = Array.isArray(products) ? products.length : 0;
        renderProductsTable(products);
        const pagination = response.pagination || {
            page: productListParams.page,
            totalPages: lastProductsPageCount < productListParams.limit ? productListParams.page : productListParams.page + 1
        };
        renderProductsPagination(pagination);
        // Загружаем категории для фильтра
        loadCategoriesForFilter();
    } catch (error) {
        showAlert('Ошибка загрузки товаров: ' + error.message, 'danger');
        document.getElementById('productsTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
    }
}

function renderProductsTable(products) {
    console.log('Rendering products table:', { productsCount: products.length, products });
    const productsTableBody = document.getElementById('productsTableBody');
    
    if (!productsTableBody) {
        console.error('productsTableBody element not found!');
        return;
    }
    
    if (!products.length) {
        productsTableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Товары не найдены</td></tr>';
        return;
    }
    
    productsTableBody.innerHTML = products.map(product => `
        <tr>
            <td>
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 
                    '<div style="width: 50px; height: 50px; background: #f8f9fa; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 18px;">🖼️</div>'
                }
            </td>
            <td>
                <strong>${product.name}</strong>
                <br><small class="text-muted">ID: ${product.id}</small>
            </td>
            <td>
                <small class="text-muted">${truncateText(product.description || 'Без описания', 50)}</small>
            </td>
            <td><strong>${product.price} ₽</strong></td>
            <td>${product.network_price ? `<span class="text-muted">${product.network_price} ₽</span>` : '<span class="text-muted">Не указана</span>'}</td>
            <td>${product.weight ? product.weight + ' г' : 'Не указан'}</td>
            <td>
                <span class="badge bg-secondary">${product.category_name || 'Без категории'}</span>
            </td>
            <td>
                <span class="badge bg-info">${product.order_priority || 0}</span>
            </td>
            <td>
                <span class="badge bg-${product.active ? 'success' : 'danger'}">
                    ${product.active ? 'Активен' : 'Неактивен'}
                </span>
            </td>
            <td>
                <div class="d-flex flex-column gap-1">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="available-${product.id}" 
                               ${product.available !== 0 ? 'checked' : ''} 
                               onchange="toggleProductAvailability(${product.id}, this.checked)">
                        <label class="form-check-label" for="available-${product.id}">
                            <small>Доступен</small>
                        </label>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="discontinued-${product.id}" 
                               ${product.discontinued ? 'checked' : ''} 
                               onchange="toggleProductDiscontinued(${product.id}, this.checked)">
                        <label class="form-check-label" for="discontinued-${product.id}">
                            <small>Выведен</small>
                        </label>
                    </div>
                </div>
            </td>
            <td>
                <div class="btn-group-vertical btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm" onclick="showProductCard(${product.id})" title="Показать карточку">
                        👁️ Карточка
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="editProduct(${product.id})" title="Редактировать">
                        ✏️ Редактировать
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteProduct(${product.id})" title="Удалить">
                        🗑️ Удалить
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function handleAddProduct(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Преобразуем чекбокс active в булевое значение
    const activeCheckbox = e.target.querySelector('input[name="active"]');
    if (activeCheckbox) {
        formData.set('active', activeCheckbox.checked ? 'true' : 'false');
    }
    
    try {
        await apiCall('/api/admin/products', 'POST', formData);
        showAlert('Товар успешно добавлен', 'success');
        e.target.reset();
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
        if (modal) {
            modal.hide();
        }
        
        loadProducts();
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        showAlert('Ошибка добавления товара: ' + error.message, 'danger');
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    const form = e.target;
    const productId = form.dataset.productId;
    
    if (!productId) {
        showAlert('ID товара не найден', 'danger');
        return;
    }
    
    const formData = new FormData(form);
    
    // Преобразуем чекбокс active в булевое значение
    const activeCheckbox = form.querySelector('input[name="active"]');
    if (activeCheckbox) {
        formData.set('active', activeCheckbox.checked ? 'true' : 'false');
    }
    
    try {
        await apiCall(`/api/admin/products/${productId}`, 'PUT', formData);
        showAlert('Товар успешно обновлен', 'success');
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
        if (modal) {
            modal.hide();
        }
        
        // Перезагружаем список товаров
        loadProducts();
    } catch (error) {
        console.error('Ошибка обновления товара:', error);
        showAlert('Ошибка обновления товара: ' + error.message, 'danger');
    }
}

// Глобальные функции для HTML
function applyOrderFilters() {
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const statusSelect = document.getElementById('statusFilter');
    const customerInput = document.getElementById('customerFilter');
    
    filters.dateFrom = dateFromInput?.value || '';
    filters.dateTo = dateToInput?.value || '';
    filters.status = statusSelect?.value || '';
    filters.customerId = customerInput?.value || '';
    
    loadOrders();
}

function clearOrderFilters() {
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const statusSelect = document.getElementById('statusFilter');
    const customerInput = document.getElementById('customerFilter');
    
    filters = { dateFrom: '', dateTo: '', status: '', customerId: '' };
    
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (customerInput) customerInput.value = '';
    
    loadOrders();
}

function applyCustomerFilters() {
    const searchInput = document.getElementById('customerSearch');
    customerListParams.search = (searchInput?.value || '').trim();
    customerListParams.page = 1;
    loadCustomers();
}

function clearCustomerFilters() {
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) searchInput.value = '';
    customerListParams = { search: '', page: 1, limit: 20 };
    loadCustomers();
}

function renderCustomersPagination(pagination) {
    const container = document.getElementById('customersPagination');
    if (!container) return;
    const { page, totalPages } = pagination;
    if (!totalPages || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const makePageItem = (p, label = null, disabled = false, active = false) => {
        const text = label || p;
        const disabledClass = disabled ? ' disabled' : '';
        const activeClass = active ? ' active' : '';
        return `<li class="page-item${disabledClass}${activeClass}">
            <a class="page-link" href="#" data-page="${p}">${text}</a>
        </li>`;
    };

    const items = [];
    // Prev
    items.push(makePageItem(Math.max(1, page - 1), '«', page === 1));
    // Window of pages
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const realStart = Math.max(1, end - windowSize + 1);
    for (let p = realStart; p <= end; p++) {
        items.push(makePageItem(p, null, false, p === page));
    }
    // Next
    items.push(makePageItem(Math.min(totalPages, page + 1), '»', page === totalPages));

    container.innerHTML = `<ul class="pagination">${items.join('')}</ul>`;

    // Навешиваем обработчики
    container.querySelectorAll('a.page-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = parseInt(e.currentTarget.getAttribute('data-page'));
            if (!Number.isNaN(targetPage) && targetPage !== customerListParams.page) {
                customerListParams.page = targetPage;
                loadCustomers();
            }
        });
    });
}

// Функции для работы с товарами
async function loadCategoriesForFilter() {
    try {
        const categories = await apiCall('/api/admin/categories');
        const filterSelect = document.getElementById('productCategoryFilter');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Все категории</option>' + 
                categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            
            // Добавляем обработчик изменения фильтра
            filterSelect.addEventListener('change', applyProductFilters);
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий для фильтра:', error);
    }
}

// Загрузить статусы для фильтра
async function loadStatusesForFilter() {
    try {
        const statuses = await getOrderStatuses();
        const select = document.getElementById('statusFilter');
        if (select) {
            select.innerHTML = '<option value="">Все статусы</option>' + 
                statuses.map(status => 
                    `<option value="${status.key}">${status.name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки статусов для фильтра:', error);
    }
}

function applyProductFilters() {
    const categoryFilter = document.getElementById('productCategoryFilter');
    productFilters.category = categoryFilter?.value || '';
    productListParams.category_id = productFilters.category;
    productListParams.page = 1;
    
    let filteredProducts = currentProducts;
    
    // Серверная фильтрация + пагинация
    loadProducts();
}

function renderProductsPagination(pagination) {
    const container = document.getElementById('productsPagination');
    if (!container) return;
    const { page, totalPages } = pagination;
    if (!totalPages || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    const items = [];
    const make = (p, label = null, disabled = false, active = false) => {
        const text = label || p;
        return `<li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}"><a class="page-link" href="#" data-page="${p}">${text}</a></li>`;
    };
    items.push(make(Math.max(1, page - 1), '«', page === 1));
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const realStart = Math.max(1, end - windowSize + 1);
    for (let p = realStart; p <= end; p++) items.push(make(p, null, false, p === page));
    const disableNext = page === totalPages || lastProductsPageCount < productListParams.limit;
    items.push(make(Math.min(totalPages, page + 1), '»', disableNext));
    container.innerHTML = `<ul class="pagination">${items.join('')}</ul>`;
    container.querySelectorAll('a.page-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const p = parseInt(e.currentTarget.getAttribute('data-page'));
            if (!Number.isNaN(p) && p !== productListParams.page) {
                productListParams.page = p;
                loadProducts();
            }
        });
    });
}

async function showProductCard(productId) {
    try {
        const product = currentProducts.find(p => p.id == productId);
        if (!product) {
            showAlert('Товар не найден', 'danger');
            return;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('productCardModal'));
        const modalContent = document.getElementById('productCardContent');
        
        modalContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    ${product.image ? 
                        `<img src="${product.image}" alt="${product.name}" class="img-fluid rounded" style="max-height: 300px; width: 100%; object-fit: cover;">` : 
                        '<div class="bg-light rounded d-flex align-items-center justify-content-center" style="height: 300px; font-size: 48px;">🖼️</div>'
                    }
                </div>
                <div class="col-md-6">
                    <h4>${product.name}</h4>
                    <p class="text-muted">${product.description || 'Описание отсутствует'}</p>
                    
                    <table class="table table-sm">
                        <tr><td><strong>ID:</strong></td><td>${product.id}</td></tr>
                        <tr><td><strong>Цена:</strong></td><td><span class="h5 text-primary">${product.price} ₽</span></td></tr>
                        ${product.network_price ? `<tr><td><strong>Цена в сети:</strong></td><td><span class="text-muted">${product.network_price} ₽</span></td></tr>` : ''}
                        <tr><td><strong>Вес:</strong></td><td>${product.weight ? product.weight + ' г' : 'Не указан'}</td></tr>
                        <tr><td><strong>Категория:</strong></td><td><span class="badge bg-secondary">${product.category_name || 'Без категории'}</span></td></tr>
                        <tr><td><strong>Статус:</strong></td><td>
                            <span class="badge bg-${product.active ? 'success' : 'danger'}">
                                ${product.active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td></tr>
                        <tr><td><strong>Создан:</strong></td><td>${formatDateTime(product.created_at)}</td></tr>
                        ${product.updated_at ? `<tr><td><strong>Обновлен:</strong></td><td>${formatDateTime(product.updated_at)}</td></tr>` : ''}
                    </table>
                </div>
            </div>
        `;
        
        // Настраиваем кнопку редактирования
        const editBtn = document.getElementById('editProductBtn');
        editBtn.onclick = () => {
            modal.hide();
            editProduct(productId);
        };
        
        modal.show();
    } catch (error) {
        showAlert('Ошибка загрузки карточки товара: ' + error.message, 'danger');
    }
}

async function editProduct(productId) {
    try {
        const product = currentProducts.find(p => p.id == productId);
        if (!product) {
            showAlert('Товар не найден', 'danger');
            return;
        }
        
        // Заполняем форму редактирования данными товара
        const form = document.getElementById('editProductForm');
        if (!form) {
            showAlert('Форма редактирования не найдена', 'danger');
            return;
        }
        
        // Заполняем поля формы
        form.querySelector('input[name="name"]').value = product.name || '';
        form.querySelector('textarea[name="description"]').value = product.description || '';
        form.querySelector('input[name="price"]').value = product.price || '';
        form.querySelector('input[name="network_price"]').value = product.network_price || '';
        form.querySelector('input[name="weight"]').value = product.weight || '';
        form.querySelector('select[name="category_id"]').value = product.category_id || '';
        form.querySelector('input[name="order_priority"]').value = product.order_priority || 0;
        form.querySelector('input[name="active"]').checked = product.active;
        
        // Показываем текущее изображение, если есть
        const currentImageEl = document.getElementById('currentProductImage');
        if (product.image && currentImageEl) {
            currentImageEl.src = product.image;
            currentImageEl.style.display = 'block';
        } else if (currentImageEl) {
            currentImageEl.style.display = 'none';
        }
        
        // Сохраняем ID товара для последующего обновления
        form.dataset.productId = productId;
        
        // Загружаем категории для формы редактирования
        await loadCategories(true);
        
        // Устанавливаем правильную категорию
        const categorySelect = form.querySelector('select[name="category_id"]');
        if (categorySelect) {
            categorySelect.value = product.category_id || '';
        }
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка при подготовке редактирования товара:', error);
        showAlert('Ошибка при подготовке редактирования: ' + error.message, 'danger');
    }
}

function deleteProduct(productId) {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        showAlert('Функция удаления товара в разработке', 'info');
    }
}

// ===== ФУНКЦИИ УПРАВЛЕНИЯ БЕЗОПАСНОСТЬЮ =====

async function loadSecurityStats() {
    try {
        console.log('Loading security statistics...');
        const stats = await apiCall('/security/stats');
        console.log('Security stats received:', stats);
        
        renderSecurityStats(stats);
    } catch (error) {
        console.error('Error loading security stats:', error);
        document.getElementById('securityStats').innerHTML = `
            <div class="alert alert-danger">
                <strong>Ошибка:</strong> ${error.message}
            </div>
        `;
    }
}

function renderSecurityStats(stats) {
    const container = document.getElementById('securityStats');
    const blacklistedContainer = document.getElementById('blacklistedIPs');
    
    // Основная статистика
    container.innerHTML = `
        <div class="row text-center">
            <div class="col-6">
                <div class="bg-danger text-white p-2 rounded">
                    <h4>${stats.blacklistedIPs?.length || 0}</h4>
                    <small>Заблокированных IP</small>
                </div>
            </div>
            <div class="col-6">
                <div class="bg-warning text-dark p-2 rounded">
                    <h4>${Object.keys(stats.suspiciousIPs || {}).length}</h4>
                    <small>Подозрительных IP</small>
                </div>
            </div>
        </div>
        <div class="mt-3">
            <small class="text-muted">Обновлено: ${new Date(stats.timestamp).toLocaleString()}</small>
        </div>
    `;
    
    // Заблокированные IP
    if (stats.blacklistedIPs && stats.blacklistedIPs.length > 0) {
        blacklistedContainer.innerHTML = `
            <div class="list-group">
                ${stats.blacklistedIPs.map(ip => `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <code>${ip}</code>
                        <button class="btn btn-sm btn-outline-warning" onclick="unblockSpecificIP('${ip}')">
                            Разблокировать
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        blacklistedContainer.innerHTML = '<div class="text-muted text-center">Нет заблокированных IP</div>';
    }
    
    // Подозрительные IP (если есть)
    if (stats.suspiciousIPs && Object.keys(stats.suspiciousIPs).length > 0) {
        const suspiciousHTML = Object.entries(stats.suspiciousIPs).map(([ip, data]) => `
            <div class="alert alert-warning small mb-2">
                <strong>${ip}</strong> - ${data.attempts} попыток 
                <span class="text-muted">(${new Date(data.lastAttempt).toLocaleString()})</span>
            </div>
        `).join('');
        
        blacklistedContainer.innerHTML += `
            <div class="mt-3">
                <h6>Подозрительные IP:</h6>
                ${suspiciousHTML}
            </div>
        `;
    }
}

async function unblockIP() {
    const ipInput = document.getElementById('unblockIP');
    const ip = ipInput.value.trim();
    
    if (!ip) {
        showAlert('Введите IP адрес для разблокировки', 'warning');
        return;
    }
    
    try {
        await apiCall(`/security/unblock/${ip}`, 'POST');
        showAlert(`IP ${ip} успешно разблокирован`, 'success');
        ipInput.value = '';
        loadSecurityStats(); // Обновляем статистику
    } catch (error) {
        showAlert('Ошибка при разблокировке IP: ' + error.message, 'danger');
    }
}

async function unblockSpecificIP(ip) {
    try {
        await apiCall(`/security/unblock/${ip}`, 'POST');
        showAlert(`IP ${ip} успешно разблокирован`, 'success');
        loadSecurityStats(); // Обновляем статистику
    } catch (error) {
        showAlert('Ошибка при разблокировке IP: ' + error.message, 'danger');
    }
}

// Функция для обновления админских координат
async function updateAdminCoordinates(addressId, field, value) {
    try {
        // Получаем текущие данные адреса
        const currentData = {};
        const inputs = document.querySelectorAll(`[onchange*="${addressId}"]`);
        
        inputs.forEach(input => {
            const fieldName = input.getAttribute('onchange').match(/'([^']+)'/)[1];
            if (fieldName === 'admin_latitude' || fieldName === 'admin_longitude') {
                currentData[fieldName] = parseFloat(input.value) || null;
            } else if (fieldName === 'admin_coordinate_comment') {
                currentData[fieldName] = input.value.trim() || null;
            }
        });
        
        // Обновляем конкретное поле
        currentData[field] = field === 'admin_coordinate_comment' ? value.trim() || null : parseFloat(value) || null;
        
        // Отправляем запрос на сервер
        await apiCall(`/addresses/admin/${addressId}`, 'PUT', currentData);
        
        // Показываем уведомление об успехе
        showAlert('Координаты обновлены', 'success');
        
    } catch (error) {
        showAlert('Ошибка обновления координат: ' + error.message, 'danger');
        console.error('Ошибка обновления координат:', error);
    }
}

// Функции для управления статусами товаров
async function toggleProductAvailability(productId, available) {
    try {
        const product = currentProducts.find(p => p.id == productId);
        if (!product) return;
        
        await apiCall(`/api/admin/products/${productId}/status`, 'PATCH', {
            available: available,
            discontinued: product.discontinued || false
        });
        
        // Обновляем локальные данные
        product.available = available ? 1 : 0;
        
        showAlert(`Товар ${available ? 'доступен' : 'недоступен'} для заказа`, 'success');
    } catch (error) {
        console.error('Ошибка обновления доступности товара:', error);
        showAlert('Ошибка обновления статуса: ' + error.message, 'danger');
        
        // Возвращаем чекбокс в исходное состояние
        const checkbox = document.getElementById(`available-${productId}`);
        if (checkbox) {
            checkbox.checked = !available;
        }
    }
}

async function toggleProductDiscontinued(productId, discontinued) {
    try {
        const product = currentProducts.find(p => p.id == productId);
        if (!product) return;
        
        await apiCall(`/api/admin/products/${productId}/status`, 'PATCH', {
            available: product.available !== 0,
            discontinued: discontinued
        });
        
        // Обновляем локальные данные
        product.discontinued = discontinued ? 1 : 0;
        
        showAlert(`Товар ${discontinued ? 'выведен из оборота' : 'возвращен в оборот'}`, 'success');
    } catch (error) {
        console.error('Ошибка обновления статуса товара:', error);
        showAlert('Ошибка обновления статуса: ' + error.message, 'danger');
        
        // Возвращаем чекбокс в исходное состояние
        const checkbox = document.getElementById(`discontinued-${productId}`);
        if (checkbox) {
            checkbox.checked = !discontinued;
        }
    }
}

// ====== ФУНКЦИИ ДЛЯ РАБОТЫ С НАСТРОЙКАМИ ======

// Переменная для хранения оригинального текста согласия
let originalPrivacyConsentText = '';

// Загрузить настройки при открытии страницы
async function loadSettings() {
    try {
        console.log('Загрузка настроек...');
        
        // Загружаем все настройки
        const settings = await apiCall('/settings');
        
        // Устанавливаем критический статус
        const criticalStatus = settings.critical_order_status?.value || 'собирается';
        const select = document.getElementById('criticalStatus');
        if (select) {
            select.value = criticalStatus;
        }
        
        // Устанавливаем минимальную сумму заказа
        const minimumAmount = settings.minimum_order_amount?.value || '500';
        const amountInput = document.getElementById('minimumOrderAmount');
        if (amountInput) {
            amountInput.value = minimumAmount;
        }
        
        // Загружаем текст согласия
        const privacyConsentText = settings.privacy_consent_text?.value || '';
        const textarea = document.getElementById('privacyConsentText');
        if (textarea) {
            textarea.value = privacyConsentText;
            updatePrivacyConsentCharCount();
        }
        
        // Отображаем все настройки в таблице
        renderAllSettings(settings);
        
        // Загружаем статистику заказов
        loadOrderStats();
        
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        showAlert('Ошибка загрузки настроек: ' + error.message, 'danger');
    }
}

// Обновить счетчик символов для текста согласия
function updatePrivacyConsentCharCount() {
    const textarea = document.getElementById('privacyConsentText');
    const counter = document.getElementById('privacyConsentCharCount');
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
    }
}

// Обновить счетчик символов в модальном окне
function updatePrivacyConsentCharCountModal() {
    const textarea = document.getElementById('privacyConsentTextModal');
    const counter = document.getElementById('privacyConsentCharCountModal');
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
    }
}

// Редактировать текст согласия
function editPrivacyConsentText() {
    const textarea = document.getElementById('privacyConsentText');
    const modalTextarea = document.getElementById('privacyConsentTextModal');
    
    if (textarea && modalTextarea) {
        // Сохраняем оригинальный текст
        originalPrivacyConsentText = textarea.value;
        
        // Копируем текст в модальное окно
        modalTextarea.value = textarea.value;
        updatePrivacyConsentCharCountModal();
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('privacyConsentEditModal'));
        modal.show();
    }
}

// Сохранить текст согласия из модального окна
async function savePrivacyConsentFromModal() {
    const modalTextarea = document.getElementById('privacyConsentTextModal');
    const mainTextarea = document.getElementById('privacyConsentText');
    
    if (!modalTextarea || !mainTextarea) return;
    
    const newText = modalTextarea.value.trim();
    
    if (newText.length === 0) {
        showAlert('Текст согласия не может быть пустым', 'warning');
        return;
    }
    
    if (newText.length > 2500) {
        showAlert('Текст согласия не может превышать 2500 символов', 'warning');
        return;
    }
    
    try {
        // Обновляем настройку через API
        await apiCall('/settings/privacy_consent_text', 'PUT', {
            value: newText,
            description: 'Текст согласия на обработку персональных данных для показа пользователям'
        });
        
        // Обновляем основной textarea
        mainTextarea.value = newText;
        updatePrivacyConsentCharCount();
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('privacyConsentEditModal'));
        modal.hide();
        
        showAlert('✅ Текст согласия успешно обновлен', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения текста согласия:', error);
        showAlert('Ошибка сохранения текста согласия: ' + error.message, 'danger');
    }
}

// Сохранить текст согласия (прямое редактирование)
async function savePrivacyConsentText() {
    const textarea = document.getElementById('privacyConsentText');
    if (!textarea) return;
    
    const newText = textarea.value.trim();
    
    if (newText.length === 0) {
        showAlert('Текст согласия не может быть пустым', 'warning');
        return;
    }
    
    if (newText.length > 2500) {
        showAlert('Текст согласия не может превышать 2500 символов', 'warning');
        return;
    }
    
    try {
        await apiCall('/settings/privacy_consent_text', 'PUT', {
            value: newText,
            description: 'Текст согласия на обработку персональных данных для показа пользователям'
        });
        
        // Переводим в режим только для чтения
        textarea.readOnly = true;
        document.getElementById('savePrivacyConsentBtn').style.display = 'none';
        document.getElementById('cancelPrivacyConsentBtn').style.display = 'none';
        document.querySelector('button[onclick="editPrivacyConsentText()"]').style.display = 'inline-block';
        
        showAlert('✅ Текст согласия успешно обновлен', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения текста согласия:', error);
        showAlert('Ошибка сохранения текста согласия: ' + error.message, 'danger');
    }
}

// Отменить редактирование текста согласия
function cancelPrivacyConsentEdit() {
    const textarea = document.getElementById('privacyConsentText');
    if (textarea) {
        textarea.value = originalPrivacyConsentText;
        updatePrivacyConsentCharCount();
        textarea.readOnly = true;
    }
    
    document.getElementById('savePrivacyConsentBtn').style.display = 'none';
    document.getElementById('cancelPrivacyConsentBtn').style.display = 'none';
    document.querySelector('button[onclick="editPrivacyConsentText()"]').style.display = 'inline-block';
}

// Отобразить все настройки в таблице
function renderAllSettings(settings) {
    const tbody = document.getElementById('allSettings');
    if (!tbody) return;
    
    const rows = Object.entries(settings).map(([key, setting]) => {
        const updatedAt = setting.updated_at ? 
            new Date(setting.updated_at).toLocaleString('ru-RU') : 
            'Не указано';
            
        return `
            <tr>
                <td><code>${key}</code></td>
                <td>${setting.value}</td>
                <td>${setting.description || 'Нет описания'}</td>
                <td>${updatedAt}</td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows || '<tr><td colspan="4" class="text-center"><em>Настройки не найдены</em></td></tr>';
}

// Сохранить настройки заказов
async function saveOrderSettings() {
    try {
        const select = document.getElementById('criticalStatus');
        const amountInput = document.getElementById('minimumOrderAmount');
        
        const newStatus = select.value;
        const newAmount = amountInput.value;
        
        if (!newStatus) {
            showAlert('Выберите статус', 'warning');
            return;
        }
        
        if (!newAmount || newAmount < 0) {
            showAlert('Введите корректную минимальную сумму', 'warning');
            return;
        }
        
        console.log('Сохранение настроек заказов:', { status: newStatus, amount: newAmount });
        
        // Сохраняем критический статус
        await apiCall('/settings/critical_order_status', 'PUT', {
            value: newStatus,
            description: 'Критический статус заказа, после которого отмена невозможна'
        });
        
        // Сохраняем минимальную сумму заказа
        await apiCall('/settings/minimum_order_amount', 'PUT', {
            value: newAmount,
            description: 'Минимальная сумма заказа в рублях'
        });
        
        showAlert('Настройки успешно сохранены', 'success');
        
        // Обновляем таблицу настроек
        loadSettings();
        
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showAlert('Ошибка сохранения: ' + error.message, 'danger');
    }
}

// Загрузить статистику заказов
async function loadOrderStats() {
    try {
        const container = document.getElementById('orderStats');
        if (!container) return;
        
        container.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>Загрузка статистики...</p></div>';
        
        // Получаем все заказы для статистики
        const orders = await apiCall('/api/admin/orders');
        
        // Подсчитываем статистику
        const stats = {
            total: orders.length,
            pending: orders.filter(o => o.status === 'pending').length,
            в_обработке: orders.filter(o => o.status === 'в_обработке').length,
            собирается: orders.filter(o => o.status === 'собирается').length,
            в_доставке: orders.filter(o => o.status === 'в_доставке').length,
            доставлен: orders.filter(o => o.status === 'доставлен').length,
            отменен: orders.filter(o => o.status === 'отменен').length
        };
        
        // Отображаем статистику
        container.innerHTML = `
            <div class="row g-2">
                <div class="col-6">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center p-2">
                            <h6 class="card-title mb-1">Всего</h6>
                            <h4 class="mb-0">${stats.total}</h4>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-warning text-white">
                        <div class="card-body text-center p-2">
                            <h6 class="card-title mb-1">Ожидают</h6>
                            <h4 class="mb-0">${stats.pending}</h4>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-info text-white">
                        <div class="card-body text-center p-2">
                            <h6 class="card-title mb-1">В обработке</h6>
                            <h4 class="mb-0">${stats.в_обработке}</h4>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-secondary text-white">
                        <div class="card-body text-center p-2">
                            <h6 class="card-title mb-1">Собираются</h6>
                            <h4 class="mb-0">${stats.собирается}</h4>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-warning text-white">
                        <div class="card-body text-center p-2">
                            <h6 class="card-title mb-1">В доставке</h6>
                            <h4 class="mb-0">${stats.в_доставке}</h4>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center p-2">
                            <h6 class="card-title mb-1">Доставлены</h6>
                            <h4 class="mb-0">${stats.доставлен}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики заказов:', error);
        const container = document.getElementById('orderStats');
        if (container) {
            container.innerHTML = '<div class="alert alert-danger">Ошибка загрузки статистики</div>';
        }
    }
}

// ====== ФУНКЦИИ ДЛЯ РАБОТЫ СО СТАТУСАМИ ЗАКАЗОВ ======

// Загрузить статусы заказов
async function loadOrderStatuses() {
    try {
        console.log('Загрузка статусов заказов...');
        
        const statuses = await apiCall('/api/admin/order-statuses');
        renderOrderStatusesTable(statuses);
        
    } catch (error) {
        console.error('Ошибка загрузки статусов заказов:', error);
        showAlert('Ошибка загрузки статусов: ' + error.message, 'danger');
    }
}

// Отобразить таблицу статусов заказов
function renderOrderStatusesTable(statuses) {
    const tbody = document.getElementById('statusesTableBody');
    if (!tbody) return;
    
    if (!statuses || statuses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><em>Статусы не найдены</em></td></tr>';
        return;
    }
    
    tbody.innerHTML = statuses.map(status => `
        <tr>
            <td>
                <span class="badge bg-secondary">${status.order_priority}</span>
            </td>
            <td>
                <code>${status.key}</code>
            </td>
            <td>
                <span style="color: ${status.color}">${status.name}</span>
            </td>
            <td>
                <small class="text-muted">${status.description || 'Нет описания'}</small>
            </td>
            <td>
                <div style="width: 20px; height: 20px; background-color: ${status.color}; border-radius: 3px; display: inline-block;"></div>
                <code class="ms-2">${status.color}</code>
            </td>
            <td>
                ${status.is_final ? '<span class="badge bg-warning">Да</span>' : '<span class="badge bg-secondary">Нет</span>'}
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editOrderStatus(${status.id})" title="Редактировать">
                        ✏️
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteOrderStatus(${status.id}, '${status.key}')" title="Удалить">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Показать модальное окно добавления статуса
function showAddStatusModal() {
    const modal = new bootstrap.Modal(document.getElementById('addStatusModal'));
    
    // Очищаем форму
    document.getElementById('addStatusForm').reset();
    
    // Предлагаем следующую очередность
    suggestNextPriority('addStatusForm');
    
    modal.show();
}

// Предложить следующую очередность для нового статуса
async function suggestNextPriority(formId) {
    try {
        const statuses = await apiCall('/api/admin/order-statuses');
        const maxPriority = Math.max(...statuses.map(s => s.order_priority), 0);
        
        const priorityInput = document.querySelector(`#${formId} input[name="order_priority"]`);
        if (priorityInput) {
            priorityInput.value = maxPriority + 1;
        }
    } catch (error) {
        console.error('Ошибка получения максимальной очередности:', error);
    }
}

// Обработать добавление нового статуса
async function handleAddStatus(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const statusData = {
            key: formData.get('key'),
            name: formData.get('name'),
            description: formData.get('description'),
            order_priority: parseInt(formData.get('order_priority')),
            color: formData.get('color'),
            is_final: formData.get('is_final') === 'on'
        };
        
        await apiCall('/api/admin/order-statuses', 'POST', statusData);
        clearCache(); // Сбрасываем кэш после добавления статуса
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('addStatusModal'));
        modal.hide();
        
        // Обновляем таблицу
        loadOrderStatuses();
        
        showAlert('Статус успешно добавлен', 'success');
        
    } catch (error) {
        console.error('Ошибка добавления статуса:', error);
        showAlert('Ошибка добавления статуса: ' + error.message, 'danger');
    }
}

// Редактировать статус заказа
async function editOrderStatus(statusId) {
    try {
        const status = await apiCall(`/api/admin/order-statuses/${statusId}`);
        
        // Заполняем форму редактирования
        const form = document.getElementById('editStatusForm');
        form.querySelector('input[name="id"]').value = status.id;
        form.querySelector('input[name="key"]').value = status.key;
        form.querySelector('input[name="name"]').value = status.name;
        form.querySelector('textarea[name="description"]').value = status.description || '';
        form.querySelector('input[name="order_priority"]').value = status.order_priority;
        form.querySelector('input[name="color"]').value = status.color;
        form.querySelector('input[name="is_final"]').checked = status.is_final === 1;
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('editStatusModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка загрузки статуса:', error);
        showAlert('Ошибка загрузки статуса: ' + error.message, 'danger');
    }
}

// Обработать редактирование статуса
async function handleEditStatus(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const statusId = formData.get('id');
        const statusData = {
            key: formData.get('key'),
            name: formData.get('name'),
            description: formData.get('description'),
            order_priority: parseInt(formData.get('order_priority')),
            color: formData.get('color'),
            is_final: formData.get('is_final') === 'on'
        };
        
        await apiCall(`/api/admin/order-statuses/${statusId}`, 'PUT', statusData);
        clearCache(); // Сбрасываем кэш после редактирования статуса
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('editStatusModal'));
        modal.hide();
        
        // Обновляем таблицу
        loadOrderStatuses();
        
        showAlert('Статус успешно обновлен', 'success');
        
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showAlert('Ошибка обновления статуса: ' + error.message, 'danger');
    }
}

// Сохранение сообщения оператора
async function saveOperatorMessage(orderId) {
    try {
        const messageTextarea = document.getElementById('operatorMessage');
        const saveBtn = document.getElementById('saveOperatorMessageBtn');
        
        if (!messageTextarea) {
            showAlert('Ошибка: поле сообщения не найдено', 'danger');
            return;
        }
        
        const operatorMessage = messageTextarea.value.trim();
        
        // Показываем состояние загрузки
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳ Сохранение...';
        
        // Отправляем запрос на сервер
        const response = await apiCall(`/api/admin/orders/${orderId}/operator-message`, 'PUT', {
            operator_message: operatorMessage
        });
        
        // Показываем успешное сообщение
        showAlert('Сообщение оператора сохранено', 'success');
        
        // Восстанавливаем кнопку
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Сохранить сообщение';
        
    } catch (error) {
        console.error('Ошибка сохранения сообщения оператора:', error);
        showAlert('Ошибка сохранения сообщения: ' + error.message, 'danger');
        
        // Восстанавливаем кнопку
        const saveBtn = document.getElementById('saveOperatorMessageBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Сохранить сообщение';
        }
    }
}

// Удалить статус заказа
async function deleteOrderStatus(statusId, statusKey) {
    if (!confirm(`Вы уверены, что хотите удалить статус "${statusKey}"?\n\nЭто действие нельзя отменить.`)) {
        return;
    }
    
    try {
        await apiCall(`/api/admin/order-statuses/${statusId}`, 'DELETE');
        clearCache(); // Сбрасываем кэш после удаления статуса
        
        // Обновляем таблицу
        loadOrderStatuses();
        
        showAlert('Статус успешно удален', 'success');
        
    } catch (error) {
        console.error('Ошибка удаления статуса:', error);
        showAlert('Ошибка удаления статуса: ' + error.message, 'danger');
    }
}