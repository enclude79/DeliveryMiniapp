// Глобальные переменные
let token = localStorage.getItem('adminToken');
let currentOrders = [];
let currentCustomers = [];
let filters = {
    dateFrom: '',
    dateTo: '',
    status: '',
    customerId: ''
};

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
    localStorage.removeItem('adminToken');
    location.reload();
}

// Управление интерфейсом
function showMainContent() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
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
        
        const endpoint = `/api/admin/orders${params.toString() ? '?' + params.toString() : ''}`;
        console.log('API endpoint:', endpoint);
        
        const orders = await apiCall(endpoint);
        console.log('Orders received:', orders);
        currentOrders = orders;
        
        renderOrdersTable(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('Ошибка загрузки заказов: ' + error.message, 'danger');
        document.getElementById('ordersTableBody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
    }
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
    console.log('Rendering customers table:', { customersCount: customers.length, customers });
    const customersTableBody = document.getElementById('customersTableBody');
    
    if (!customersTableBody) {
        console.error('customersTableBody element not found!');
        return;
    }
    
    if (!customers.length) {
        customersTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Клиенты не найдены</td></tr>';
        return;
    }
    
    customersTableBody.innerHTML = customers.map(customer => `
        <tr>
            <td>
                <strong>${customer.name || [customer.first_name || '', customer.last_name || ''].filter(Boolean).join(' ') || 'Без имени'}</strong>
                ${customer.username ? `<br><small class="text-muted">@${customer.username}</small>` : ''}
            </td>
            <td><code>${customer.telegram_id}</code></td>
            <td>${customer.phone || 'Не указан'}</td>
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
    `).join('');
}

// Работа с клиентами
async function loadCustomers() {
    try {
        showLoading('customersTableBody');
        const response = await apiCall('/api/admin/customers');
        // API возвращает объект с customers массивом
        const customers = response.customers || response;
        currentCustomers = customers;
        renderCustomersTable(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        showAlert('Ошибка загрузки клиентов: ' + error.message, 'danger');
        document.getElementById('customersTableBody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
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
                                <th>Количество</th>
                                <th>Цена</th>
                                <th>Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items ? order.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.price} ₽</td>
                                    <td><strong>${item.quantity * item.price} ₽</strong></td>
                                </tr>
                            `).join('') : '<tr><td colspan="4">Товары не найдены</td></tr>'}
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
                try {
                    await apiCall(`/api/admin/orders/${orderId}/status`, 'PUT', { status });
                    showAlert(`Статус заказа обновлен на "${getStatusText(status)}"`, 'success');
                    modal.hide();
                    loadOrders();
                } catch (error) {
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

// Получить статусы заказов из API
async function getOrderStatuses() {
    if (cachedOrderStatuses) {
        return cachedOrderStatuses;
    }
    
    try {
        cachedOrderStatuses = await apiCall('/api/admin/order-statuses');
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
        const isDisabled = isCurrentStatus || 
                          (status.is_final && order.status !== status.key) ||
                          (order.status === 'отменен' && status.key !== 'отменен') ||
                          (order.status === 'доставлен' && status.key !== 'доставлен');
        
        return `<button class="btn btn-sm btn-outline-${getStatusColor(status.key)} status-btn" 
                data-status="${status.key}" 
                ${isDisabled ? 'disabled' : ''}>
            ${status.name}
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
        const products = await apiCall('/api/admin/products');
        currentProducts = products;
        renderProductsTable(products);
        
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
    // Функция для фильтрации клиентов
    console.log('Apply customer filters');
}

function clearCustomerFilters() {
    // Функция для очистки фильтров клиентов
    console.log('Clear customer filters');
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
    
    let filteredProducts = currentProducts;
    
    if (productFilters.category) {
        filteredProducts = currentProducts.filter(product => 
            product.category_id == productFilters.category
        );
    }
    
    renderProductsTable(filteredProducts);
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
        
        // Отображаем все настройки в таблице
        renderAllSettings(settings);
        
        // Загружаем статистику заказов
        loadOrderStats();
        
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        showAlert('Ошибка загрузки настроек: ' + error.message, 'danger');
    }
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

// Сохранить критический статус
async function saveCriticalStatus() {
    try {
        const select = document.getElementById('criticalStatus');
        const newStatus = select.value;
        
        if (!newStatus) {
            showAlert('Выберите статус', 'warning');
            return;
        }
        
        console.log('Сохранение критического статуса:', newStatus);
        
        const response = await apiCall('/settings/critical_order_status', 'PUT', {
            value: newStatus,
            description: 'Критический статус заказа, после которого отмена невозможна'
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
        
        // Обновляем таблицу
        loadOrderStatuses();
        
        showAlert('Статус успешно удален', 'success');
        
    } catch (error) {
        console.error('Ошибка удаления статуса:', error);
        showAlert('Ошибка удаления статуса: ' + error.message, 'danger');
    }
}