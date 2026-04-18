// ============== KUKU YETU ADMIN PANEL ==============

let adminToken = null;
let currentOrders = [];
let currentProducts = [];
let imagesToRemove = [];
let isSubmitting = false;

const CATEGORIES = ['broilers', 'layers', 'eggs', 'chicks', 'other'];

function getCategoryDisplayName(category) {
    const names = {
        'broilers': 'Broilers',
        'layers': 'Layers',
        'eggs': 'Eggs',
        'chicks': 'Chicks',
        'other': 'Other Products'
    };
    return names[category] || category;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin panel initializing...');
    
    const storedToken = localStorage.getItem('adminToken');
    const storedAdmin = localStorage.getItem('admin');
    
    if (storedToken && storedAdmin) {
        adminToken = storedToken;
        console.log('Using stored token');
        showDashboard();
        loadDashboardData();
    } else {
        showLoginForm();
    }
    setupAdminEventListeners();
    populateCategoryDropdowns();
});

function populateCategoryDropdowns() {
    const productCategory = document.getElementById('productCategory');
    if (productCategory) {
        productCategory.innerHTML = '<option value="">Select Category</option>' +
            CATEGORIES.map(cat => `<option value="${cat}">${getCategoryDisplayName(cat)}</option>`).join('');
    }
    const editProductCategory = document.getElementById('editProductCategory');
    if (editProductCategory) {
        editProductCategory.innerHTML = '<option value="">Select Category</option>' +
            CATEGORIES.map(cat => `<option value="${cat}">${getCategoryDisplayName(cat)}</option>`).join('');
    }
}

function setupAdminEventListeners() {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) loginForm.addEventListener('submit', adminLogin);

    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('addProductModal')?.classList.remove('active');
            document.getElementById('editProductModal')?.classList.remove('active');
            document.getElementById('orderDetailsModal')?.classList.remove('active');
            document.getElementById('editOrderModal')?.classList.remove('active');
        });
    });

    const addProductForm = document.getElementById('addProductForm');
    if (addProductForm) addProductForm.addEventListener('submit', handleAddProduct);

    const editProductForm = document.getElementById('editProductForm');
    if (editProductForm) editProductForm.addEventListener('submit', handleEditProduct);

    const editOrderForm = document.getElementById('editOrderForm');
    if (editOrderForm) editOrderForm.addEventListener('submit', handleEditOrder);

    const productImages = document.getElementById('productImages');
    if (productImages) productImages.addEventListener('change', handleImagePreview);

    const editProductImages = document.getElementById('editProductImages');
    if (editProductImages) editProductImages.addEventListener('change', handleEditImagePreview);
}

function showLoginForm() {
    const loginDiv = document.getElementById('adminLogin');
    const dashboardDiv = document.getElementById('adminDashboard');
    if (loginDiv) loginDiv.style.display = 'flex';
    if (dashboardDiv) dashboardDiv.style.display = 'none';
}

function showDashboard() {
    const loginDiv = document.getElementById('adminLogin');
    const dashboardDiv = document.getElementById('adminDashboard');
    if (loginDiv) loginDiv.style.display = 'none';
    if (dashboardDiv) dashboardDiv.style.display = 'block';
}

async function adminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const loginBtn = event.target.querySelector('button[type="submit"]');
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
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
        
        if (response.ok && result.token && result.user && 
            (result.user.email === 'admin@kukuyetu.com' || result.user.is_admin === true)) {
            localStorage.setItem('adminToken', result.token);
            localStorage.setItem('admin', JSON.stringify(result.user));
            adminToken = result.token;
            showToast('Login successful!', 'success');
            showDashboard();
            loadDashboardData();
        } else {
            showToast('Access denied. Admin credentials required.', 'error');
            document.getElementById('adminPassword').value = '';
            // Clear invalid token
            localStorage.removeItem('adminToken');
            localStorage.removeItem('admin');
            adminToken = null;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed: ' + error.message, 'error');
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }
}

function adminLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    adminToken = null;
    showToast('Logged out successfully', 'success');
    showLoginForm();
}

function showTab(tab) {
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.admin-tab').forEach(tabEl => {
        tabEl.classList.toggle('active', tabEl.id === tab + 'Tab');
    });
    if (tab === 'products') loadProducts();
    else if (tab === 'orders') loadAllOrders();
    else if (tab === 'dashboard') loadDashboardData();
}

async function loadDashboardData() {
    // Check if token is valid
    if (!adminToken) {
        showToast('Please login again', 'error');
        showLoginForm();
        return;
    }
    
    showLoading();
    try {
        // Load orders
        let orders = [];
        try {
            const ordersData = await getAllOrders();
            // Handle both array and object responses
            if (Array.isArray(ordersData)) {
                orders = ordersData;
            } else if (ordersData && ordersData.orders && Array.isArray(ordersData.orders)) {
                orders = ordersData.orders;
            } else if (ordersData && ordersData.data && Array.isArray(ordersData.data)) {
                orders = ordersData.data;
            } else {
                orders = [];
            }
        } catch (e) {
            console.error('Error loading orders:', e);
            orders = [];
        }
        currentOrders = orders;

        // Load products
        let products = [];
        try {
            const productsData = await getProducts();
            if (Array.isArray(productsData)) {
                products = productsData;
            } else if (productsData && productsData.products && Array.isArray(productsData.products)) {
                products = productsData.products;
            } else {
                products = [];
            }
        } catch (e) {
            console.error('Error loading products:', e);
            products = [];
        }
        currentProducts = products;

        updateDashboardStats(orders, products);
        loadRecentOrders(orders.slice(0, 10));
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

function updateDashboardStats(orders, products) {
    // Ensure orders is an array
    const ordersArray = Array.isArray(orders) ? orders : [];
    const productsArray = Array.isArray(products) ? products : [];
    
    const totalOrders = ordersArray.length;
    const pendingOrders = ordersArray.filter(o => o && o.status === 'pending').length;
    const completedOrders = ordersArray.filter(o => o && (o.status === 'completed' || o.status === 'delivered')).length;
    
    const totalOrdersEl = document.getElementById('totalOrders');
    const pendingOrdersEl = document.getElementById('pendingOrders');
    const completedOrdersEl = document.getElementById('completedOrders');
    const totalProductsEl = document.getElementById('totalProducts');
    
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders;
    if (completedOrdersEl) completedOrdersEl.textContent = completedOrders;
    if (totalProductsEl) totalProductsEl.textContent = productsArray.length;
}

async function loadProducts() {
    showLoading();
    try {
        const productsData = await getProducts();
        let products = [];
        if (Array.isArray(productsData)) {
            products = productsData;
        } else if (productsData && productsData.products && Array.isArray(productsData.products)) {
            products = productsData.products;
        }
        currentProducts = products;
        renderProductsTable(products);
    } catch (error) {
        console.error('Products error:', error);
        showToast('Failed to load products', 'error');
        renderProductsTable([]);
    } finally {
        hideLoading();
    }
}

function getImageUrl(imagePath) {
    if (!imagePath) return 'https://placehold.co/100x100/FF6B00/white?text=No+Image';
    if (imagePath.startsWith('http')) return imagePath;
    return 'https://placehold.co/100x100/FF6B00/white?text=KUKU+YETU';
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No products found</td></tr>';
        return;
    }
    tbody.innerHTML = products.map(product => {
        let imageUrl = 'https://placehold.co/100x100/FF6B00/white?text=No+Image';
        if (product.images && product.images[0]) imageUrl = getImageUrl(product.images[0]);
        return `
            <tr>
                <td>${product.product_id || product.id}</td>
                <td><img src="${imageUrl}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" onerror="this.src='https://placehold.co/100x100/FF6B00/white?text=Error'"></td>
                <td>${product.title || 'N/A'}</td>
                <td>${getCategoryDisplayName(product.category) || 'N/A'}</td>
                <td>Ksh ${product.price || 0}</td>
                <td><span class="stock-badge ${product.stock_status}">${product.stock_status === 'low' ? 'Few Units' : product.stock_status === 'available' ? 'In Stock' : 'Out of Stock'}</span></td>
                <td>${product.rating || 0} ★</td>
                <td><button class="btn-view" onclick="openEditProductModal(${product.id})" style="background:#2196f3;">Edit</button><button class="btn-view" onclick="deleteProduct(${product.id})" style="background:#f44336;">Delete</button></td>
            </tr>
        `;
    }).join('');
}

function openAddProductModal() {
    document.getElementById('addProductModal')?.classList.add('active');
    document.getElementById('addProductForm')?.reset();
    document.getElementById('imagePreview').innerHTML = '';
    populateCategoryDropdowns();
}

function handleImagePreview(e) {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    preview.innerHTML = '';
    for (let file of e.target.files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;margin:5px;border-radius:4px;border:2px solid #ff6b00;';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

async function handleAddProduct(e) {
    e.preventDefault();
    
    if (isSubmitting) {
        console.log('Submission already in progress');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Adding Product...';
    }
    
    isSubmitting = true;
    
    const formData = new FormData();
    formData.append('title', document.getElementById('productTitle').value);
    formData.append('price', document.getElementById('productPrice').value);
    formData.append('old_price', document.getElementById('productOldPrice').value || '');
    formData.append('description', document.getElementById('productDescription').value);
    formData.append('category', document.getElementById('productCategory').value);
    formData.append('stock_status', document.getElementById('productStock').value);
    formData.append('rating', document.getElementById('productRating').value);
    
    const images = document.getElementById('productImages').files;
    console.log('Adding product with', images.length, 'images');
    
    for (let i = 0; i < images.length; i++) {
        formData.append('images', images[i]);
    }
    
    showLoading();
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'x-auth-token': token },
            body: formData
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            showToast('Product added successfully!', 'success');
            document.getElementById('addProductModal')?.classList.remove('active');
            loadProducts();
        } else {
            showToast(result.message || 'Failed to add product', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
        isSubmitting = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Product';
        }
    }
}

async function openEditProductModal(productId) {
    showLoading();
    imagesToRemove = [];
    try {
        const response = await fetch(`/api/products/${productId}`);
        const data = await response.json();
        const product = data.product || data;
        if (!product) throw new Error('Product not found');
        
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductTitle').value = product.title || '';
        document.getElementById('editProductPrice').value = product.price || '';
        document.getElementById('editProductOldPrice').value = product.old_price || '';
        document.getElementById('editProductDescription').value = product.description || '';
        document.getElementById('editProductCategory').value = product.category || '';
        document.getElementById('editProductStock').value = product.stock_status || 'available';
        document.getElementById('editProductRating').value = product.rating || '4';
        
        const previewDiv = document.getElementById('editImagePreview');
        if (previewDiv && product.images && product.images.length) {
            previewDiv.innerHTML = product.images.map(img => `
                <div style="position:relative;display:inline-block;margin:5px;" data-image="${img}">
                    <img src="${getImageUrl(img)}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">
                    <button type="button" onclick="removeExistingImage('${img}')" style="position:absolute;top:-5px;right:-5px;background:#f44336;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;">×</button>
                </div>
            `).join('');
        } else if (previewDiv) {
            previewDiv.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">No images</p>';
        }
        document.getElementById('editProductModal').classList.add('active');
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Failed to load product details', 'error');
    } finally {
        hideLoading();
    }
}

function removeExistingImage(imgUrl) {
    if (confirm('Remove this image?')) {
        imagesToRemove.push(imgUrl);
        const div = document.querySelector(`div[data-image="${imgUrl}"]`);
        if (div) div.remove();
    }
}

function handleEditImagePreview(e) {
    const preview = document.getElementById('editImagePreview');
    if (!preview) return;
    for (let file of e.target.files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;margin:5px;border-radius:4px;border:2px solid #4caf50;';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    
    const productId = document.getElementById('editProductId').value;
    const title = document.getElementById('editProductTitle').value;
    const price = document.getElementById('editProductPrice').value;
    const oldPrice = document.getElementById('editProductOldPrice').value;
    const description = document.getElementById('editProductDescription').value;
    const category = document.getElementById('editProductCategory').value;
    const stockStatus = document.getElementById('editProductStock').value;
    const rating = document.getElementById('editProductRating').value;
    const newImages = document.getElementById('editProductImages').files;
    
    if (!title || !price || !description || !category || !rating) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Updating...';
    }
    
    showLoading();
    try {
        const token = localStorage.getItem('adminToken');
        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', parseFloat(price));
        formData.append('description', description);
        formData.append('category', category);
        formData.append('stock_status', stockStatus);
        formData.append('rating', parseFloat(rating));
        if (oldPrice) formData.append('old_price', parseFloat(oldPrice));
        if (imagesToRemove.length > 0) formData.append('images_to_remove', JSON.stringify(imagesToRemove));
        for (let i = 0; i < newImages.length; i++) {
            formData.append('images', newImages[i]);
        }
        
        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'x-auth-token': token },
            body: formData
        });
        const result = await response.json();
        
        if (response.ok) {
            showToast('Product updated!', 'success');
            document.getElementById('editProductModal').classList.remove('active');
            imagesToRemove = [];
            loadProducts();
        } else {
            showToast(result.message || 'Failed to update', 'error');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showToast('Failed to update: ' + error.message, 'error');
    } finally {
        hideLoading();
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Update Product';
        }
    }
}

async function deleteProduct(productId) {
    if (!confirm('Delete this product permanently?')) return;
    showLoading();
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': localStorage.getItem('adminToken') }
        });
        if (response.ok) {
            showToast('Product deleted', 'success');
            loadProducts();
        } else {
            showToast('Failed to delete', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadAllOrders() {
    showLoading();
    try {
        const ordersData = await getAllOrders();
        let orders = [];
        if (Array.isArray(ordersData)) {
            orders = ordersData;
        } else if (ordersData && ordersData.orders && Array.isArray(ordersData.orders)) {
            orders = ordersData.orders;
        }
        currentOrders = orders;
        renderAllOrdersTable(orders);
    } catch (error) {
        console.error('Orders error:', error);
        renderAllOrdersTable([]);
    } finally {
        hideLoading();
    }
}

function renderAllOrdersTable(orders) {
    const tbody = document.getElementById('allOrdersBody');
    if (!tbody) return;
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No orders found</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.order_id || order.id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.phone || 'N/A'}</td>
            <td>${order.location || 'N/A'}</td>
            <td>${order.products?.length || 0} items</td>
            <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
            <td>
                <button class="btn-view" onclick="viewOrderDetails(${order.id})" style="background:#4caf50;">View</button>
                <button class="btn-view" onclick="openEditOrderModal(${order.id})" style="background:#ff9800;">Edit</button>
                <button class="btn-view" onclick="deleteOrder(${order.id})" style="background:#f44336;">Delete</button>
            </td>
        </tr>
    `).join('');
}

function loadRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No recent orders</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.order_id || order.id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>Ksh ${order.total_amount || 0}</td>
            <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
            <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn-view" onclick="viewOrderDetails(${order.id})" style="background:#4caf50;">View</button>
                <button class="btn-view" onclick="openEditOrderModal(${order.id})" style="background:#ff9800;">Edit</button>
            </td>
        </tr>
    `).join('');
}

function openEditOrderModal(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;
    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editOrderNumber').value = order.order_id || order.id;
    document.getElementById('editCustomerName').value = order.customer_name || '';
    document.getElementById('editCustomerPhone').value = order.phone || '';
    document.getElementById('editCustomerLocation').value = order.location || '';
    document.getElementById('editCustomerAddress').value = order.specific_address || '';
    document.getElementById('editOrderStatus').value = order.status || 'pending';
    document.getElementById('editOrderTotal').value = parseFloat(order.total_amount || 0).toFixed(2);
    
    const productsList = document.getElementById('editOrderProducts');
    if (productsList) {
        let products = [];
        try { products = JSON.parse(order.products); } catch(e) { products = order.products || []; }
        productsList.innerHTML = products.map(p => `
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;">
                <span>${p.title}</span>
                <span>${p.quantity} x Ksh ${p.price}</span>
                <span><strong>Ksh ${(p.price * p.quantity).toFixed(2)}</strong></span>
            </div>
        `).join('');
    }
    document.getElementById('editOrderModal').classList.add('active');
}

async function handleEditOrder(e) {
    e.preventDefault();
    const orderId = document.getElementById('editOrderId').value;
    const orderData = {
        customer_name: document.getElementById('editCustomerName').value,
        phone: document.getElementById('editCustomerPhone').value,
        location: document.getElementById('editCustomerLocation').value,
        specific_address: document.getElementById('editCustomerAddress').value,
        status: document.getElementById('editOrderStatus').value
    };
    showLoading();
    try {
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('adminToken') },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showToast('Order updated!', 'success');
            document.getElementById('editOrderModal').classList.remove('active');
            loadAllOrders();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function updateOrderStatus(orderId, status) {
    if (!confirm(`Mark order as ${status}?`)) return;
    showLoading();
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('adminToken') },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            showToast(`Order ${status}`, 'success');
            loadAllOrders();
            loadDashboardData();
        } else {
            showToast('Failed', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function viewOrderDetails(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;
    const modalBody = document.getElementById('orderDetailsBody');
    if (!modalBody) return;
    let products = [];
    try { products = JSON.parse(order.products); } catch(e) { products = order.products || []; }
    modalBody.innerHTML = `
        <div class="order-details">
            <h3>Order #${order.order_id || order.id}</h3>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="status-badge ${order.status}">${order.status}</span></p>
            <p><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Phone:</strong> ${order.phone}</p>
            <p><strong>Location:</strong> ${order.location}</p>
            <p><strong>Address:</strong> ${order.specific_address || 'N/A'}</p>
            <p><strong>Total:</strong> Ksh ${order.total_amount}</p>
            <h4>Products:</h4>
            <ul>${products.map(p => `<li>${p.title} x${p.quantity} - Ksh ${p.price * p.quantity}</li>`).join('')}</ul>
            <div class="order-actions" style="margin-top:20px;">
                <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'confirmed')">Confirm</button>
                <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'shipped')">Ship</button>
                <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'delivered')">Deliver</button>
                <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'completed')">Complete</button>
                <button class="btn-danger" onclick="updateOrderStatus(${order.id}, 'cancelled')">Cancel</button>
            </div>
        </div>
    `;
    document.getElementById('orderDetailsModal')?.classList.add('active');
}

async function deleteOrder(orderId) {
    if (!confirm('Delete this order permanently?')) return;
    showLoading();
    try {
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': localStorage.getItem('adminToken') }
        });
        if (response.ok) {
            showToast('Order deleted', 'success');
            loadAllOrders();
            loadDashboardData();
        } else {
            showToast('Failed to delete', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function getProducts() {
    const response = await fetch('/api/products');
    const data = await response.json();
    return data;
}

async function getAllOrders() {
    const token = localStorage.getItem('adminToken');
    if (!token) return [];
    const response = await fetch('/api/orders', { headers: { 'x-auth-token': token } });
    const data = await response.json();
    return data;
}

function showLoading() {
    document.getElementById('loading-spinner')?.classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-spinner')?.classList.remove('active');
}

function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.showTab = showTab;
window.openAddProductModal = openAddProductModal;
window.openEditProductModal = openEditProductModal;
window.openEditOrderModal = openEditOrderModal;
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.deleteProduct = deleteProduct;
window.deleteOrder = deleteOrder;
window.removeExistingImage = removeExistingImage;
window.handleEditOrder = handleEditOrder;

console.log('Admin panel ready - Cloudinary enabled');
