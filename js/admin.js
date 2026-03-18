// ============== ADMIN GLOBAL VARIABLES ==============
let adminToken = null;
let currentOrder = null;
let currentProduct = null;
let products = [];
let orders = [];
let users = [];

// API Base URL - empty for relative paths
const API_URL = '';

// ============== IMAGE HELPER FUNCTIONS ==============

// Get image URL with fallback
function getAdminImageUrl(imagePath, productTitle = 'product') {
    if (!imagePath) {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' fill='%23999' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E`;
    }
    
    if (imagePath.startsWith('http')) {
        return imagePath;
    }
    
    return `/uploads/${imagePath}`;
}

// Handle image error in admin panel
function handleAdminImageError(img, productTitle) {
    console.warn('Admin image failed to load:', img.src);
    img.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' fill='%23999' text-anchor='middle' dy='.3em'%3E${productTitle || 'No Image'}%3C/text%3E%3C/svg%3E`;
}

// ============== AUTHENTICATION ==============

// Check if admin is logged in
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin panel initializing...');
    const token = localStorage.getItem('adminToken');
    if (token) {
        verifyAdmin(token);
    } else {
        showLoginForm();
    }
});

// Verify admin token
async function verifyAdmin(token) {
    try {
        console.log('Verifying admin token...');
        const response = await fetch('/api/auth/verify', {
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        
        if (data.user && data.user.isAdmin) {
            adminToken = token;
            console.log('Admin verified:', data.user.email);
            showDashboard();
            loadDashboardData();
        } else {
            console.log('Not an admin, showing login form');
            localStorage.removeItem('adminToken');
            showLoginForm();
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('adminToken');
        showLoginForm();
    }
}

// Show login form
function showLoginForm() {
    const loginEl = document.getElementById('adminLogin');
    const dashboardEl = document.getElementById('adminDashboard');
    if (loginEl) loginEl.style.display = 'flex';
    if (dashboardEl) dashboardEl.style.display = 'none';
}

// Show dashboard
function showDashboard() {
    const loginEl = document.getElementById('adminLogin');
    const dashboardEl = document.getElementById('adminDashboard');
    if (loginEl) loginEl.style.display = 'none';
    if (dashboardEl) dashboardEl.style.display = 'flex';
}

// Admin login
async function adminLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('adminEmail')?.value;
    const password = document.getElementById('adminPassword')?.value;
    const loginBtn = event.target.querySelector('button[type="submit"]');
    const originalText = loginBtn?.textContent;
    
    if (!email || !password) {
        showAdminNotification('Please enter email and password', 'error');
        return;
    }
    
    try {
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';
        }
        
        console.log('Admin login attempt:', email);
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        console.log('Login response:', result);
        
        if (result.token && result.user && result.user.isAdmin) {
            localStorage.setItem('adminToken', result.token);
            adminToken = result.token;
            showAdminNotification('Login successful!', 'success');
            showDashboard();
            loadDashboardData();
        } else {
            showAdminNotification('Invalid admin credentials', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAdminNotification('Login failed: ' + error.message, 'error');
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText || 'Login';
        }
    }
}

// Admin logout
function adminLogout() {
    localStorage.removeItem('adminToken');
    adminToken = null;
    showAdminNotification('Logged out successfully', 'success');
    showLoginForm();
}

// ============== DASHBOARD ==============

// Load dashboard data
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        showAdminLoader();
        
        // Load orders
        const ordersResponse = await fetch('/api/orders', {
            headers: { 'x-auth-token': adminToken }
        });
        orders = await ordersResponse.json();
        console.log('Orders loaded:', orders.length);
        
        // Load products
        const productsResponse = await fetch('/api/products');
        products = await productsResponse.json();
        console.log('Products loaded:', products.length);
        
        // Update stats
        document.getElementById('totalOrders').textContent = orders.length || 0;
        document.getElementById('totalProducts').textContent = products.length || 0;
        
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        
        // Load users count if endpoint exists
        try {
            const usersResponse = await fetch('/api/users/all', {
                headers: { 'x-auth-token': adminToken }
            });
            const users = await usersResponse.json();
            document.getElementById('totalCustomers').textContent = users.length || 0;
        } catch (e) {
            console.log('Users endpoint not available');
            document.getElementById('totalCustomers').textContent = 'N/A';
        }
        
        // Display recent orders
        displayRecentOrders(orders.slice(0, 5));
        
        hideAdminLoader();
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAdminNotification('Error loading dashboard data', 'error');
        hideAdminLoader();
    }
}

// Display recent orders
function displayRecentOrders(recentOrders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    
    if (recentOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No recent orders</td></tr>';
        return;
    }
    
    tbody.innerHTML = recentOrders.map(order => `
        <tr>
            <td>${order.order_number || 'N/A'}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>KSh ${order.total_amount || 0}</td>
            <td>
                <span class="status-badge status-${order.status || 'pending'}">
                    ${order.status || 'pending'}
                </span>
            </td>
            <td>${order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewOrder(${order.id})">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

// ============== PRODUCT MANAGEMENT ==============

// Load products
async function loadProducts() {
    try {
        console.log('Loading products...');
        showAdminLoader();
        
        const response = await fetch('/api/products');
        products = await response.json();
        console.log('Products loaded:', products.length);
        
        displayProducts(products);
        hideAdminLoader();
    } catch (error) {
        console.error('Error loading products:', error);
        showAdminNotification('Error loading products', 'error');
        hideAdminLoader();
    }
}

// Display products in table
function displayProducts(products) {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => {
        const imageUrl = getAdminImageUrl(product.images?.[0], product.title);
        
        return `
        <tr>
            <td>${product.product_id || 'N/A'}</td>
            <td>
                <img src="${imageUrl}" 
                     alt="${product.title}" 
                     class="product-image-small"
                     onerror="this.onerror=null; handleAdminImageError(this, '${product.title}')"
                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
            </td>
            <td>${product.title || 'N/A'}</td>
            <td>${product.category || 'N/A'}</td>
            <td>KSh ${product.price || 0}</td>
            <td>
                <span class="status-badge ${product.stock_status === 'few' ? 'status-pending' : 'status-confirmed'}">
                    ${product.stock_status === 'few' ? 'Few units' : 'In stock'}
                </span>
            </td>
            <td>${product.rating || 0} ★</td>
            <td>
                <button class="action-btn edit-btn" onclick="editProduct(${product.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

// Open add product modal
function openAddProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('productModal').classList.add('active');
}

// Close product modal
function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// Save product
async function saveProduct(event) {
    event.preventDefault();
    
    if (!adminToken) {
        showAdminNotification('Please login first', 'error');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }
        
        const title = document.getElementById('productTitle')?.value;
        const price = document.getElementById('productPrice')?.value;
        const oldPrice = document.getElementById('productOldPrice')?.value;
        const description = document.getElementById('productDescription')?.value;
        const category = document.getElementById('productCategory')?.value;
        const stockStatus = document.getElementById('productStock')?.value;
        const rating = document.getElementById('productRating')?.value;
        const imageFiles = document.getElementById('productImages')?.files;
        const productId = document.getElementById('productId')?.value;
        
        if (!title || !price || !description || !category || !stockStatus || !rating) {
            showAdminNotification('Please fill all required fields', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', price);
        if (oldPrice) formData.append('oldPrice', oldPrice);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('stockStatus', stockStatus);
        formData.append('rating', rating);
        
        if (imageFiles && imageFiles.length > 0) {
            for (let i = 0; i < imageFiles.length; i++) {
                formData.append('images', imageFiles[i]);
            }
        }
        
        const url = productId ? `/api/products/${productId}` : '/api/products';
        const method = productId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'x-auth-token': adminToken
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminNotification(productId ? 'Product updated!' : 'Product added!', 'success');
            closeProductModal();
            loadProducts();
        } else {
            showAdminNotification(result.msg || 'Failed to save product', 'error');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showAdminNotification('Error saving product', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'Save Product';
        }
    }
}

// Edit product
async function editProduct(productId) {
    try {
        console.log('Editing product:', productId);
        showAdminLoader();
        
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();
        
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productTitle').value = product.title;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productOldPrice').value = product.old_price || '';
            document.getElementById('productDescription').value = product.description;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productStock').value = product.stock_status;
            document.getElementById('productRating').value = product.rating;
            
            // Show existing images
            const preview = document.getElementById('imagePreview');
            if (preview && product.images && product.images.length > 0) {
                preview.innerHTML = product.images.map(img => 
                    `<img src="/uploads/${img}" style="width: 50px; height: 50px; object-fit: cover; margin: 5px; border-radius: 5px;" onerror="this.style.display='none'">`
                ).join('');
            }
            
            openAddProductModal();
        }
        hideAdminLoader();
    } catch (error) {
        console.error('Error loading product:', error);
        showAdminNotification('Error loading product', 'error');
        hideAdminLoader();
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': adminToken }
        });
        
        if (response.ok) {
            showAdminNotification('Product deleted', 'success');
            loadProducts();
        } else {
            showAdminNotification('Failed to delete product', 'error');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showAdminNotification('Error deleting product', 'error');
    }
}

// ============== ORDER MANAGEMENT ==============

// Load orders
async function loadOrders() {
    try {
        console.log('Loading orders...');
        showAdminLoader();
        
        const response = await fetch('/api/orders', {
            headers: { 'x-auth-token': adminToken }
        });
        orders = await response.json();
        console.log('Orders loaded:', orders.length);
        
        displayOrders(orders);
        hideAdminLoader();
    } catch (error) {
        console.error('Error loading orders:', error);
        showAdminNotification('Error loading orders', 'error');
        hideAdminLoader();
    }
}

// Display orders
function displayOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.order_number || 'N/A'}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.phone || 'N/A'}</td>
            <td>${order.products?.length || 0} items</td>
            <td>KSh ${order.total_amount || 0}</td>
            <td>
                <span class="status-badge status-${order.status || 'pending'}">
                    ${order.status || 'pending'}
                </span>
            </td>
            <td>${order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewOrder(${order.id})">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

// View order details
async function viewOrder(orderId) {
    try {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        
        currentOrder = order;
        
        const detailsDiv = document.getElementById('orderDetails');
        if (!detailsDiv) return;
        
        const productsHtml = order.products && order.products.length > 0 
            ? order.products.map(p => `
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
                    <span>${p.title || 'Product'} x${p.quantity || 1}</span>
                    <span>KSh ${(p.price * (p.quantity || 1))}</span>
                </div>
            `).join('')
            : '<p>No products</p>';
        
        detailsDiv.innerHTML = `
            <div class="order-info">
                <p><strong>Order #:</strong> ${order.order_number}</p>
                <p><strong>Customer:</strong> ${order.customer_name}</p>
                <p><strong>Phone:</strong> ${order.phone}</p>
                <p><strong>Alternative Phone:</strong> ${order.alternative_phone || 'N/A'}</p>
                <p><strong>Location:</strong> ${order.location}</p>
                <p><strong>Address:</strong> ${order.specific_address || 'N/A'}</p>
                <p><strong>Date:</strong> ${new Date(order.order_date).toLocaleString()}</p>
                <p><strong>Status:</strong> ${order.status}</p>
                <p><strong>Delivery Status:</strong> ${order.delivery_status || 'pending'}</p>
                
                <h3 style="margin-top: 20px;">Products</h3>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${productsHtml}
                </div>
                
                <p style="margin-top: 20px; font-size: 1.2em;">
                    <strong>Total:</strong> KSh ${order.total_amount}
                </p>
            </div>
        `;
        
        document.getElementById('orderModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing order:', error);
        showAdminNotification('Error loading order details', 'error');
    }
}

// Update order status
async function updateOrderStatus(status) {
    if (!currentOrder) return;
    
    try {
        const response = await fetch(`/api/orders/${currentOrder.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': adminToken
            },
            body: JSON.stringify({ 
                status: status,
                deliveryStatus: status 
            })
        });
        
        if (response.ok) {
            showAdminNotification(`Order ${status} successfully`, 'success');
            closeOrderModal();
            loadOrders();
            loadDashboardData();
        } else {
            showAdminNotification('Failed to update order', 'error');
        }
    } catch (error) {
        console.error('Error updating order:', error);
        showAdminNotification('Error updating order', 'error');
    }
}

// Close order modal
function closeOrderModal() {
    document.getElementById('orderModal')?.classList.remove('active');
    currentOrder = null;
}

// ============== NOTIFICATIONS ==============

// Send notification
async function sendNotification(event) {
    event.preventDefault();
    
    const userType = document.getElementById('notificationUser')?.value;
    const specificUser = document.getElementById('specificUser')?.value;
    const title = document.getElementById('notificationTitle')?.value;
    const message = document.getElementById('notificationMessage')?.value;
    
    if (!title || !message) {
        showAdminNotification('Please fill all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/users/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': adminToken
            },
            body: JSON.stringify({
                userType,
                specificUser,
                title,
                message
            })
        });
        
        if (response.ok) {
            showAdminNotification('Notification sent successfully', 'success');
            event.target.reset();
            loadNotificationsHistory();
        } else {
            showAdminNotification('Failed to send notification', 'error');
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        showAdminNotification('Error sending notification', 'error');
    }
}

// Load notifications history
async function loadNotificationsHistory() {
    try {
        const response = await fetch('/api/users/notifications/history', {
            headers: { 'x-auth-token': adminToken }
        });
        const notifications = await response.json();
        
        const list = document.getElementById('notificationsList');
        if (!list) return;
        
        if (notifications.length === 0) {
            list.innerHTML = '<p>No notifications sent</p>';
            return;
        }
        
        list.innerHTML = notifications.map(n => `
            <div class="notification-item">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${new Date(n.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// ============== SECTION MANAGEMENT ==============

// Show different sections
function showSection(section) {
    console.log('Showing section:', section);
    
    // Update active nav link
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });
    
    // Show selected section
    const sectionEl = document.getElementById(`${section}Section`);
    if (sectionEl) {
        sectionEl.classList.add('active');
    }
    
    // Load section data
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'products':
            loadProducts();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'notifications':
            loadNotificationsHistory();
            break;
    }
}

// ============== UI HELPERS ==============

// Show notification in admin panel
function showAdminNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 5px;
        z-index: 99999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Show loader
function showAdminLoader() {
    let loader = document.getElementById('adminLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'adminLoader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
        `;
        document.body.appendChild(loader);
        
        // Add spinner styles if not present
        if (!document.getElementById('adminSpinnerStyles')) {
            const style = document.createElement('style');
            style.id = 'adminSpinnerStyles';
            style.textContent = `
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #ff6b00;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .status-badge {
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .status-pending {
                    background: #fff3cd;
                    color: #856404;
                }
                .status-confirmed {
                    background: #d4edda;
                    color: #155724;
                }
                .status-shipped {
                    background: #cce5ff;
                    color: #004085;
                }
                .status-delivered {
                    background: #d1e7dd;
                    color: #0f5132;
                }
                .status-completed {
                    background: #e2d1e7;
                    color: #4a1b5e;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Hide loader
function hideAdminLoader() {
    const loader = document.getElementById('adminLoader');
    if (loader) loader.remove();
}

// Toggle specific user input
function toggleSpecificUser() {
    const userType = document.getElementById('notificationUser')?.value;
    const specificGroup = document.getElementById('specificUserGroup');
    if (specificGroup) {
        specificGroup.style.display = userType === 'specific' ? 'block' : 'none';
    }
}

// ============== EXPOSE FUNCTIONS TO GLOBAL SCOPE ==============
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.showSection = showSection;
window.openAddProductModal = openAddProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewOrder = viewOrder;
window.closeOrderModal = closeOrderModal;
window.updateOrderStatus = updateOrderStatus;
window.sendNotification = sendNotification;
window.toggleSpecificUser = toggleSpecificUser;
window.handleAdminImageError = handleAdminImageError;
