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
    
    // Remove favicon errors - create data URI favicon if missing
    if (!document.querySelector('link[rel="icon"]')) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.href = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E';
        document.head.appendChild(favicon);
    }
});

// ============== AUTHENTICATION ==============
async function verifyAdmin(token) {
    try {
        console.log('Verifying admin token...');
        const response = await fetch('/api/auth/verify', {
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        
        if (data.user && data.user.isAdmin) {
            adminToken = token;
            console.log('✅ Admin verified:', data.user.email);
            showDashboard();
            loadDashboardData();
        } else {
            localStorage.removeItem('adminToken');
            showLoginForm();
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('adminToken');
        showLoginForm();
    }
}

function showLoginForm() {
    const loginEl = document.getElementById('adminLogin');
    const dashboardEl = document.getElementById('adminDashboard');
    if (loginEl) loginEl.style.display = 'flex';
    if (dashboardEl) dashboardEl.style.display = 'none';
}

function showDashboard() {
    const loginEl = document.getElementById('adminLogin');
    const dashboardEl = document.getElementById('adminDashboard');
    if (loginEl) loginEl.style.display = 'none';
    if (dashboardEl) dashboardEl.style.display = 'flex';
}

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
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
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
        const [ordersRes, productsRes] = await Promise.all([
            fetch('/api/orders', { headers: { 'x-auth-token': adminToken } }),
            fetch('/api/products')
        ]);
        
        orders = await ordersRes.json();
        products = await productsRes.json();
        
        document.getElementById('totalOrders').textContent = orders.length || 0;
        document.getElementById('totalProducts').textContent = products.length || 0;
        document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'pending').length || 0;
        
        displayRecentOrders(orders.slice(0, 5));
        displayProductsTable(products);
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
        tbody.innerHTML = '<tr><td colspan="6">No recent orders</td></tr>';
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
        const response = await fetch('/api/products');
        products = await response.json();
        displayProductsTable(products);
    } catch (error) {
        showAdminNotification('Failed to load products', 'error');
    } finally {
        hideAdminLoader();
    }
}

function displayProductsTable(products) {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No products found</td></tr>';
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
    
    try {
        const response = await fetch(url, {
            method,
            headers: { 'x-auth-token': adminToken },
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
        showAdminNotification('Error saving product', 'error');
    }
}

async function editProduct(productId) {
    try {
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
        showAdminNotification('Failed to load product', 'error');
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
        showAdminNotification('Error deleting product', 'error');
    }
}

// ============== ORDER MANAGEMENT ==============
async function loadOrders() {
    showAdminLoader();
    try {
        const response = await fetch('/api/orders', {
            headers: { 'x-auth-token': adminToken }
        });
        orders = await response.json();
        displayOrdersTable(orders);
    } catch (error) {
        showAdminNotification('Failed to load orders', 'error');
    } finally {
        hideAdminLoader();
    }
}

function displayOrdersTable(orders) {
    const tbody = document.getElementById('ordersBody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.order_number || order.id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.phone || 'N/A'}</td>
            <td>${order.products?.length || 0} items</td>
            <td>Ksh ${parseFloat(order.total_amount || 0).toFixed(2)}</td>
            <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
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
            <ul>${order.products?.map(p => `<li>${p.title} x${p.quantity} - Ksh ${parseFloat(p.price).toFixed(2)}</li>`).join('') || '<li>No products</li>'}</ul>
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
        showAdminNotification('Error updating order', 'error');
    }
}

// ============== SECTION MANAGEMENT ==============
function showSection(section) {
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(`${section}Section`).classList.add('active');
    
    switch(section) {
        case 'dashboard': loadDashboardData(); break;
        case 'products': loadProducts(); break;
        case 'orders': loadOrders(); break;
    }
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
        loader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;';
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
window.showSection = showSection;
window.openAddProductModal = openAddProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewOrder = viewOrder;
window.closeOrderModal = closeOrderModal;
window.updateOrderStatus = updateOrderStatus;
