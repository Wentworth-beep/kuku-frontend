// ============== KUKU YETU ADMIN PANEL ==============

const ADMIN_API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : 'https://kuku-backend-ntr4.onrender.com/api';

let adminToken = null;
let products = [];
let orders = [];
let currentOrder = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('👑 Admin panel initializing...');
    const token = localStorage.getItem('adminToken');
    if (token) {
        verifyAdmin(token);
    } else {
        showLoginForm();
    }
});

async function verifyAdmin(token) {
    try {
        const response = await fetch(`${ADMIN_API_BASE}/auth/verify`, {
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
    document.getElementById('adminLogin')?.classList.add('active');
    document.getElementById('adminDashboard')?.classList.remove('active');
}

function showDashboard() {
    document.getElementById('adminLogin')?.classList.remove('active');
    document.getElementById('adminDashboard')?.classList.add('active');
}

async function adminLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = event.target.querySelector('button');
    
    if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    
    try {
        const response = await fetch(`${ADMIN_API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.token && result.user?.isAdmin) {
            localStorage.setItem('adminToken', result.token);
            adminToken = result.token;
            showNotification('Login successful!', 'success');
            showDashboard();
            loadDashboardData();
        } else {
            showNotification('Invalid admin credentials', 'error');
        }
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

function adminLogout() {
    localStorage.removeItem('adminToken');
    adminToken = null;
    showNotification('Logged out', 'success');
    showLoginForm();
}

async function loadDashboardData() {
    showLoader();
    try {
        const [ordersRes, productsRes] = await Promise.all([
            fetch(`${ADMIN_API_BASE}/orders`, { headers: { 'x-auth-token': adminToken } }),
            fetch(`${ADMIN_API_BASE}/products`)
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
        showNotification('Failed to load dashboard', 'error');
    } finally {
        hideLoader();
    }
}

function displayRecentOrders(recentOrders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    
    if (recentOrders.length === 0) {
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

async function loadProducts() {
    showLoader();
    try {
        const response = await fetch(`${ADMIN_API_BASE}/products`);
        products = await response.json();
        displayProductsTable(products);
    } catch (error) {
        showNotification('Failed to load products', 'error');
    } finally {
        hideLoader();
    }
}

function displayProductsTable(products) {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '}<td colspan="8">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.product_id || product.id}</td>
            <td><img src="${getImageUrl(product.images?.[0])}" class="product-thumb" onerror="this.src='/assets/images/logo.png'"></td>
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
    if (!imagePath) return '/assets/images/logo.png';
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${ADMIN_API_BASE.replace('/api', '')}/${cleanPath}`;
}

async function openAddProductModal() {
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
    
    const url = productId ? `${ADMIN_API_BASE}/products/${productId}` : `${ADMIN_API_BASE}/products`;
    const method = productId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method,
            headers: { 'x-auth-token': adminToken },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(productId ? 'Product updated!' : 'Product added!', 'success');
            closeProductModal();
            loadProducts();
        } else {
            showNotification(result.msg || 'Failed to save product', 'error');
        }
    } catch (error) {
        showNotification('Error saving product', 'error');
    }
}

async function editProduct(productId) {
    try {
        const response = await fetch(`${ADMIN_API_BASE}/products/${productId}`);
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
        showNotification('Failed to load product', 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        const response = await fetch(`${ADMIN_API_BASE}/products/${productId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': adminToken }
        });
        
        if (response.ok) {
            showNotification('Product deleted', 'success');
            loadProducts();
        } else {
            showNotification('Failed to delete product', 'error');
        }
    } catch (error) {
        showNotification('Error deleting product', 'error');
    }
}

async function loadOrders() {
    showLoader();
    try {
        const response = await fetch(`${ADMIN_API_BASE}/orders`, {
            headers: { 'x-auth-token': adminToken }
        });
        orders = await response.json();
        displayOrdersTable(orders);
    } catch (error) {
        showNotification('Failed to load orders', 'error');
    } finally {
        hideLoader();
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
        const response = await fetch(`${ADMIN_API_BASE}/orders/${currentOrder.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': adminToken
            },
            body: JSON.stringify({ status, deliveryStatus: status })
        });
        
        if (response.ok) {
            showNotification(`Order ${status} successfully`, 'success');
            closeOrderModal();
            loadOrders();
            loadDashboardData();
        } else {
            showNotification('Failed to update order', 'error');
        }
    } catch (error) {
        showNotification('Error updating order', 'error');
    }
}

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

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white; border-radius: 5px; z-index: 10000; animation: fadeIn 0.3s;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showLoader() {
    let loader = document.getElementById('adminLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'adminLoader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;';
        document.body.appendChild(loader);
    }
}

function hideLoader() {
    const loader = document.getElementById('adminLoader');
    if (loader) loader.remove();
}

// Global exposure
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
