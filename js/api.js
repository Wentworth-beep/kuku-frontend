// ============== API CONFIGURATION ==============
const API_BASE_URL = 'https://kuku-backend-ntr4.onrender.com';

// Override fetch to use the correct API base
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    if (typeof url === 'string' && url.startsWith('/api')) {
        url = API_BASE_URL + url;
        console.log('API Request:', url);
    }
    return originalFetch(url, options);
};

// ============== AUTHENTICATION API ==============

// Register user
async function register(userData) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await response.json();
    } catch (error) {
        console.error('Register API error:', error);
        throw error;
    }
}

// Login user
async function login(email, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await response.json();
    } catch (error) {
        console.error('Login API error:', error);
        throw error;
    }
}

// Verify token
async function verifyToken(token) {
    try {
        const response = await fetch('/api/auth/verify', {
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Verify token API error:', error);
        throw error;
    }
}

// ============== PRODUCTS API ==============

// Get all products
async function getProducts(category = '', search = '') {
    try {
        let url = '/api/products';
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Get products API error:', error);
        throw error;
    }
}

// Get single product
async function getProduct(id) {
    try {
        const response = await fetch(`/api/products/${id}`);
        return await response.json();
    } catch (error) {
        console.error('Get product API error:', error);
        throw error;
    }
}

// Add product (admin only)
async function addProduct(formData, token) {
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'x-auth-token': token },
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('Add product API error:', error);
        throw error;
    }
}

// Update product (admin only)
async function updateProduct(id, formData, token) {
    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'x-auth-token': token },
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('Update product API error:', error);
        throw error;
    }
}

// Delete product (admin only)
async function deleteProduct(id, token) {
    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Delete product API error:', error);
        throw error;
    }
}

// ============== ORDERS API ==============

// Get all orders (admin only) - FIXED: This matches what admin.js expects
async function getAllOrders(token) {
    try {
        const response = await fetch('/api/orders', {
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Get all orders API error:', error);
        throw error;
    }
}

// Get all orders (admin only) - alias for compatibility
async function getOrders(token) {
    return getAllOrders(token);
}

// Get user orders
async function getUserOrders(token) {
    try {
        const response = await fetch('/api/orders/my-orders', {
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Get user orders API error:', error);
        throw error;
    }
}

// Create order
async function createOrder(orderData, token) {
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(orderData)
        });
        return await response.json();
    } catch (error) {
        console.error('Create order API error:', error);
        throw error;
    }
}

// Update order status (admin only)
async function updateOrderStatus(id, status, deliveryStatus, token) {
    try {
        const response = await fetch(`/api/orders/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ status, deliveryStatus })
        });
        return await response.json();
    } catch (error) {
        console.error('Update order status API error:', error);
        throw error;
    }
}

// ============== USERS API ==============

// Get user profile
async function getUserProfile(token) {
    try {
        const response = await fetch('/api/users/profile', {
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Get user profile API error:', error);
        throw error;
    }
}

// Update user profile
async function updateUserProfile(userData, token) {
    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(userData)
        });
        return await response.json();
    } catch (error) {
        console.error('Update user profile API error:', error);
        throw error;
    }
}

// Get user notifications - FIXED endpoint
async function getNotifications(token) {
    try {
        const response = await fetch('/api/notifications', {
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Get notifications API error:', error);
        throw error;
    }
}

// Mark notification as read - FIXED endpoint
async function markNotificationRead(id, token) {
    try {
        const response = await fetch(`/api/notifications/${id}/read`, {
            method: 'PUT',
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Mark notification read API error:', error);
        throw error;
    }
}

// Get user favorites
async function getFavorites(token) {
    try {
        const response = await fetch('/api/users/favorites', {
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Get favorites API error:', error);
        throw error;
    }
}

// Toggle favorite
async function toggleFavorite(productId, token) {
    try {
        const response = await fetch(`/api/users/favorites/${productId}`, {
            method: 'POST',
            headers: { 'x-auth-token': token }
        });
        return await response.json();
    } catch (error) {
        console.error('Toggle favorite API error:', error);
        throw error;
    }
}

// ============== EXPORT FUNCTIONS ==============
// Make all functions available globally
window.api = {
    // Auth
    register,
    login,
    verifyToken,
    
    // Products
    getProducts,
    getProduct,
    addProduct,
    updateProduct,
    deleteProduct,
    
    // Orders
    getOrders,
    getAllOrders,
    getUserOrders,
    createOrder,
    updateOrderStatus,
    
    // Users
    getUserProfile,
    updateUserProfile,
    getNotifications,
    markNotificationRead,
    getFavorites,
    toggleFavorite
};

// Also expose individual functions globally for admin.js
window.getAllOrders = getAllOrders;
window.getProducts = getProducts;

console.log('API module loaded with base URL:', API_BASE_URL);
