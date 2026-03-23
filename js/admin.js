// ============== KUKU YETU ADMIN PANEL ==============
// Uses API_BASE_URL from api.js (loaded first)

let adminToken = null;
let products = [];
let orders = [];
let currentOrder = null;

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', () => {
    console.log('👑 Admin panel initializing...');
    const token = localStorage.getItem('adminToken');
    if (token) {
        verifyAdmin(token);
    } else {
        showLoginForm();
    }
    
    // Add favicon to prevent 404
    if (!document.querySelector('link[rel="icon"]')) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.href = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E';
        document.head.appendChild(favicon);
    }
});
async function adminLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
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
        
        console.log('🔐 Admin login attempt:', { email });
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        console.log('📡 Login response:', result);
        
        // FIX: Just check if token exists and success is true
        if (result.success === true && result.token) {
            console.log('✅ Login successful!');
            localStorage.setItem('adminToken', result.token);
            adminToken = result.token;
            showAdminNotification('Login successful!', 'success');
            showDashboard();
            loadDashboardData();
        } else {
            console.log('❌ Login failed:', result);
            showAdminNotification(result.message || 'Invalid credentials', 'error');
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
function adminLogout() {
    localStorage.removeItem('adminToken');
    adminToken = null;
    showAdminNotification('Logged out successfully', 'success');
    showLoginForm();
}

// ============== DASHBOARD ==============
async function loadDashboardData() {
    showAdminLoader();
    try {
        console.log('📊 Loading dashboard data...');
        
        // Fetch orders
        const ordersResponse = await fetch('/api/orders', {
            headers: { 'x-auth-token': adminToken }
        });
        orders = await ordersResponse.json();
        console.log(`📦 Orders loaded: ${orders.length}`);
        
        // Fetch products
        const productsResponse = await fetch('/api/products');
        products = await productsResponse.json();
        console.log(`📦 Products loaded: ${products.length}`);
        
        // Update stats
        document.getElementById('totalOrders').textContent = orders.length || 0;
        document.getElementById('totalProducts').textContent = products.length || 0;
        
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        document.getElementById('pendingOrders').textContent = pendingOrders || 0;
        
        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
        document.getElementById('completedOrders').textContent = completedOrders || 0;
        
        displayRecentOrders(orders.slice(0, 5));
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showAdminNotification('Failed to load dashboard', 'error');
    } finally {
        hideAdminLoader();
    }
}

function displayRecentOrders(recentOrders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    
    if (!recentOrders || recentOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No recent orders</td></tr>';
        return;
    }
    
    tbody.innerHTML = recentOrders.map(order => `
        <tr>
            <td>${order.order_number || order.id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>Ksh ${parseFloat(order.total_amount || 0).toFixed(2)}</td>
            <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td><button onclick="viewOrder(${order.id})" class="btn-sm">View</button></td>
        </tr>
    `).join('');
}

// ============== PRODUCT MANAGEMENT ==============
async function loadProducts() {
    showAdminLoader();
    try {
        console.log('📦 Loading products...');
        const response = await fetch('/api/products');
        products = await response.json();
        displayProductsTable(products);
    } catch (error) {
        console.error('Products error:', error);
        showAdminNotification('Failed to load products', 'error');
    } finally {
        hideAdminLoader();
    }
}

function displayProductsTable(products) {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.product_id || product.id}</td>
            <td><img src="${getImageUrl(product.images?.[0])}" class="product-thumb" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E'"></td>
            <td>${product.title}</td>
            <td>${product.category}</td>
            <td>Ksh ${parseFloat(product.price).toFixed(2)}</td>
            <td><span class="stock-badge ${product.stock_status}">${product.stock_status === 'low' ? 'Low' : 'In stock'}</span></td>
            <td>${product.rating || 0}★</td>
            <td>
                <button onclick="editProduct(${product.id})" class="btn-edit">Edit</button>
                <button onclick="deleteProduct(${product.id})" class="btn-delete">Delete</button>
            </td>
        </tr>
    `).join('');
}

function getImageUrl(imagePath) {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    if (imagePath.startsWith('/')) return imagePath;
    return `/${imagePath}`;
}

function openAddProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

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
        
        const productId = document.getElementById('productId').value;
        const formData = new FormData();
        formData.append('title', document.getElementById('productTitle').value);
        formData.append('price', document.getElementById('productPrice').value);
        formData.append('oldPrice', document.getElementById('productOldPrice').value || '');
        formData.append('description', document.getElementById('productDescription').value);
        formData.append('category', document.getElementById('productCategory').value);
        formData.append('stockStatus', document.getElementById('productStock').value);
        formData.append('rating', document.getElementById('productRating').value);
        
        const images = document.getElementById('productImages').files;
        for (let i = 0; i < images.length; i++) {
            formData.append('images', images[i]);
        }
        
        const url = productId ? `/api/products/${productId}` : '/api/products';
        const method = productId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'x-auth-token': adminToken },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAdminNotification(productId ? 'Product updated!' : 'Product added!', 'success');
            closeProductModal();
            loadProducts();
        } else {
            showAdminNotification(result.msg || 'Failed to save product', 'error');
        }
    } catch (error) {
        console.error('Save product error:', error);
        showAdminNotification('Error saving product', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'Save Product';
        }
    }
}

async function editProduct(productId) {
    try {
        showAdminLoader();
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();
        
        document.getElementById('productId').value = product.id;
        document.getElementById('productTitle').value = product.title;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productOldPrice').value = product.old_price || '';
        document.getElementById('productDescription').value = product.description;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productStock').value = product.stock_status;
        document.getElementById('productRating').value = product.rating;
        
        openAddProductModal();
    } catch (error) {
        console.error('Edit product error:', error);
        showAdminNotification('Failed to load product', 'error');
    } finally {
        hideAdminLoader();
    }
}

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
        console.error('Delete product error:', error);
        showAdminNotification('Error deleting product', 'error');
    }
}

// ============== ORDER MANAGEMENT ==============
async function loadOrders() {
    showAdminLoader();
    try {
        console.log('📦 Loading orders...');
        const response = await fetch('/api/orders', {
            headers: { 'x-auth-token': adminToken }
        });
        orders = await response.json();
        displayOrdersTable(orders);
    } catch (error) {
        console.error('Orders error:', error);
        showAdminNotification('Failed to load orders', 'error');
    } finally {
        hideAdminLoader();
    }
}

function displayOrdersTable(orders) {
    const tbody = document.getElementById('allOrdersBody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.order_number || order.id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.phone || 'N/A'}</td>
            <td>${order.location || 'N/A'}</td>
            <td>${order.products?.length || 0} items</td>
            <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
            <td><button onclick="viewOrder(${order.id})" class="btn-sm">View</button></td>
        </tr>
    `).join('');
}

async function viewOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    currentOrder = order;
    
    const detailsDiv = document.getElementById('orderDetails');
    if (!detailsDiv) return;
    
    const productsHtml = order.products && order.products.length > 0 
        ? order.products.map(p => `<li>${p.title} x${p.quantity} - Ksh ${parseFloat(p.price).toFixed(2)}</li>`).join('')
        : '<li>No products</li>';
    
    detailsDiv.innerHTML = `
        <div class="order-detail">
            <p><strong>Order #:</strong> ${order.order_number || order.id}</p>
            <p><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Phone:</strong> ${order.phone}</p>
            <p><strong>Location:</strong> ${order.location}</p>
            <p><strong>Address:</strong> ${order.specific_address || 'N/A'}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <h4>Products:</h4>
            <ul>${productsHtml}</ul>
            <p><strong>Total:</strong> Ksh ${parseFloat(order.total_amount).toFixed(2)}</p>
        </div>
    `;
    
    document.getElementById('orderModal').classList.add('active');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    currentOrder = null;
}

async function updateOrderStatus(status) {
    if (!currentOrder) return;
    
    try {
        const response = await fetch(`/api/orders/${currentOrder.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': adminToken
            },
            body: JSON.stringify({ status, deliveryStatus: status })
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
        console.error('Update order error:', error);
        showAdminNotification('Error updating order', 'error');
    }
}

// ============== SECTION MANAGEMENT ==============
function showTab(tab) {
    // Update active tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show selected tab content
    document.querySelectorAll('.admin-tab').forEach(tabContent => {
        tabContent.classList.remove('active');
    });
    
    if (tab === 'dashboard') {
        document.getElementById('dashboardTab').classList.add('active');
        loadDashboardData();
    } else if (tab === 'products') {
        document.getElementById('productsTab').classList.add('active');
        loadProducts();
    } else if (tab === 'orders') {
        document.getElementById('ordersTab').classList.add('active');
        loadOrders();
    }
}

function showSection(section) {
    showTab(section);
}

// ============== UI HELPERS ==============
function showAdminNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white; border-radius: 5px; z-index: 10000; animation: fadeIn 0.3s;
        font-family: Arial, sans-serif; font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showAdminLoader() {
    let loader = document.getElementById('adminLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'adminLoader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 10px;';
        document.body.appendChild(loader);
    }
}

function hideAdminLoader() {
    const loader = document.getElementById('adminLoader');
    if (loader) loader.remove();
}

// ============== GLOBAL EXPOSURE ==============
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.showTab = showTab;
window.showSection = showSection;
window.openAddProductModal = openAddProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewOrder = viewOrder;
window.closeOrderModal = closeOrderModal;
window.updateOrderStatus = updateOrderStatus;
window.loadProducts = loadProducts;
window.loadOrders = loadOrders;
window.loadDashboardData = loadDashboardData;

console.log('✅ Admin panel ready');
