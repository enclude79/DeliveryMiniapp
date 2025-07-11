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
                <button class="btn btn-sm btn-outline-primary" onclick="showOrderDetails(${order.id})">
                    <i class="fas fa-eye"></i> Детали
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
                <button class="btn btn-sm btn-outline-primary" onclick="showCustomer('${customer.telegram_id}')">
                    <i class="fas fa-user"></i> Карточка
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
                <h6>Управление статусом</h6>
                <div class="btn-group" role="group">
                    ${getStatusButtons(order)}
                </div>
            </div>
        `;
        
        // Добавляем обработчики кнопок статуса
        modalBody.querySelectorAll('.status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const status = e.target.dataset.status;
                try {
                    await apiCall(`/admin/orders/${orderId}/status`, 'PUT', { status });
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
                                    <p class="mb-1">${addr.full_address}</p>
                                    ${addr.entrance || addr.floor || addr.apartment ? `
                                        <small class="text-muted">
                                            ${addr.entrance ? 'Подъезд: ' + addr.entrance + ' ' : ''}
                                            ${addr.floor ? 'Этаж: ' + addr.floor + ' ' : ''}
                                            ${addr.apartment ? 'Кв./оф.: ' + addr.apartment : ''}
                                        </small>
                                    ` : ''}
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

function getStatusButtons(order) {
    const statuses = [
        { key: 'получен', text: 'Получен', disabled: order.status === 'получен' },
        { key: 'в_обработке', text: 'В обработке', disabled: order.status === 'в_обработке' },
        { key: 'собирается', text: 'Собирается', disabled: order.status === 'собирается' },
        { key: 'в_доставке', text: 'В доставке', disabled: order.status === 'в_доставке' },
        { key: 'доставлен', text: 'Доставлен', disabled: order.status === 'доставлен' || order.status === 'отменен' },
        { key: 'отменен', text: 'Отменить', disabled: order.status === 'отменен' || order.status === 'доставлен' }
    ];
    
    return statuses.map(status => 
        `<button class="btn btn-sm btn-outline-${getStatusColor(status.key)} status-btn" 
                data-status="${status.key}" 
                ${status.disabled ? 'disabled' : ''}>
            ${status.text}
        </button>`
    ).join('');
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
            const categoriesList = document.getElementById('categoriesList');
            categoriesList.innerHTML = categories.map(category => `
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${category.name}</h5>
                            <p class="card-text">ID: ${category.id}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        showAlert('Ошибка загрузки категорий: ' + error.message, 'danger');
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
        productsTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Товары не найдены</td></tr>';
        return;
    }
    
    productsTableBody.innerHTML = products.map(product => `
        <tr>
            <td>
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 
                    '<div style="width: 50px; height: 50px; background: #f8f9fa; border-radius: 4px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-image text-muted"></i></div>'
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
            <td>${product.weight ? product.weight + ' г' : 'Не указан'}</td>
            <td>
                <span class="badge bg-secondary">${product.category_name || 'Без категории'}</span>
            </td>
            <td>
                <span class="badge bg-${product.active ? 'success' : 'danger'}">
                    ${product.active ? 'Активен' : 'Неактивен'}
                </span>
            </td>
            <td>
                <div class="btn-group-vertical btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm" onclick="showProductCard(${product.id})">
                        <i class="fas fa-eye"></i> Карточка
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i> Удалить
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
                        '<div class="bg-light rounded d-flex align-items-center justify-content-center" style="height: 300px;"><i class="fas fa-image fa-3x text-muted"></i></div>'
                    }
                </div>
                <div class="col-md-6">
                    <h4>${product.name}</h4>
                    <p class="text-muted">${product.description || 'Описание отсутствует'}</p>
                    
                    <table class="table table-sm">
                        <tr><td><strong>ID:</strong></td><td>${product.id}</td></tr>
                        <tr><td><strong>Цена:</strong></td><td><span class="h5 text-primary">${product.price} ₽</span></td></tr>
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
        form.querySelector('input[name="weight"]').value = product.weight || '';
        form.querySelector('select[name="category_id"]').value = product.category_id || '';
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