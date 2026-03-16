
   
// Store token
let authToken = localStorage.getItem('token');

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token || authToken) {
        headers['x-auth-token'] = token || authToken;
    }

    const config = {
        method,
        headers,
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Something went wrong');
        }

        return result;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Auth APIs
async function register(userData) {
    const response = await apiCall('/auth/register', 'POST', userData);
    if (response.token) {
        authToken = response.token;
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
}

async function login(credentials) {
    const response = await apiCall('/auth/login', 'POST', credentials);
    if (response.token) {
        authToken = response.token;
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
}

async function adminLogin(credentials) {
    const response = await apiCall('/auth/admin/login', 'POST', credentials);
    if (response.token) {
        authToken = response.token;
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('admin', JSON.stringify(response.user));
    }
    return response;
}

async function getCurrentUser() {
    return apiCall('/auth/me', 'GET', null, authToken);
}

// Product APIs
async function getProducts() {
    return apiCall('/products');
}

async function getProductsByCategory(category) {
    return apiCall(`/products/category/${category}`);
}

async function searchProducts(query) {
    return apiCall(`/products/search?q=${encodeURIComponent(query)}`);
}

async function getProduct(id) {
    return apiCall(`/products/${id}`);
}

async function createProduct(formData) {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
            'x-auth-token': token
        },
        body: formData
    });
    return response.json();
}

// Order APIs
async function createOrder(orderData) {
    return apiCall('/orders', 'POST', orderData, authToken);
}

async function getUserOrders() {
    return apiCall('/orders/my-orders', 'GET', null, authToken);
}

async function getAllOrders() {
    const token = localStorage.getItem('adminToken');
    return apiCall('/orders', 'GET', null, token);
}

async function updateOrderStatus(orderId, status) {
    const token = localStorage.getItem('adminToken');
    return apiCall(`/orders/${orderId}/status`, 'PUT', { status }, token);
}

async function getOrder(orderId) {
    return apiCall(`/orders/${orderId}`, 'GET', null, authToken);
}

// Notification APIs
async function getNotifications() {
    return apiCall('/notifications', 'GET', null, authToken);
}

async function markNotificationRead(notificationId) {
    return apiCall(`/notifications/${notificationId}/read`, 'PUT', null, authToken);
}

async function markAllNotificationsRead() {
    return apiCall('/notifications/read-all', 'PUT', null, authToken);
}

// Utility functions
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    localStorage.removeItem('cart');
    localStorage.removeItem('favorites');
    authToken = null;
    window.location.reload();
}

function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function isAdmin() {
    const admin = localStorage.getItem('admin');
    return admin ? JSON.parse(admin).isAdmin : false;
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}
