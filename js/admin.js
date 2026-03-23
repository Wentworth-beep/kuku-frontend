// Admin specific JavaScript

let currentOrders = [];
let currentProducts = [];
let currentEditingProduct = null;
let imagesToRemove = [];

// Check if admin is logged in
document.addEventListener('DOMContentLoaded', () => {
    // Add data URI favicon to prevent 404
    if (!document.querySelector('link[rel="icon"]')) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.href = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E';
        document.head.appendChild(favicon);
    }
    
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
        showAdminDashboard();
        loadDashboardData();
    } else {
        showAdminLogin();
    }

    setupAdminEventListeners();
});

function setupAdminEventListeners() {
    // Admin login
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleAdminLogin);
    }

    // Tab switching
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchAdminTab(tab);
        });
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('addProductModal')?.classList.remove('active');
            document.getElementById('editProductModal')?.classList.remove('active');
            document.getElementById('orderDetailsModal')?.classList.remove('active');
        });
    });

    // Add product form
    const addProductForm = document.getElementById('addProductForm');
    if (addProductForm) {
        addProductForm.addEventListener('submit', handleAddProduct);
    }

    // Edit product form
    const editProductForm = document.getElementById('editProductForm');
    if (editProductForm) {
        editProductForm.addEventListener('submit', handleEditProduct);
    }

    // Image preview
    const productImages = document.getElementById('productImages');
    if (productImages) {
        productImages.addEventListener('change', handleImagePreview);
    }

    const editProductImages = document.getElementById('editProductImages');
    if (editProductImages) {
        editProductImages.addEventListener('change', handleEditImagePreview);
    }
}

// ============= AUTHENTICATION =============

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    console.log('Attempting login with:', email);

    showLoading();
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log('Login response:', data);

        if (response.ok && data.success && data.token) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('admin', JSON.stringify(data.user));
            showAdminDashboard();
            loadDashboardData();
            showToast('Login successful!', 'success');
            // Clear password field for security
            document.getElementById('adminPassword').value = '';
        } else {
            showToast(data.message || 'Login failed: Invalid credentials', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showAdminLogin() {
    const loginDiv = document.getElementById('adminLogin');
    const dashboardDiv = document.getElementById('adminDashboard');
    if (loginDiv) loginDiv.style.display = 'flex';
    if (dashboardDiv) dashboardDiv.style.display = 'none';
    
    // Clear password field for security
    const passwordField = document.getElementById('adminPassword');
    if (passwordField) passwordField.value = '';
}

function showAdminDashboard() {
    const loginDiv = document.getElementById('adminLogin');
    const dashboardDiv = document.getElementById('adminDashboard');
    if (loginDiv) loginDiv.style.display = 'none';
    if (dashboardDiv) dashboardDiv.style.display = 'block';
}

function adminLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    showAdminLogin();
    showToast('Logged out successfully', 'success');
}

// ============= TAB SWITCHING =============

function switchAdminTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab content
    document.querySelectorAll('.admin-tab').forEach(tabEl => {
        tabEl.classList.toggle('active', tabEl.id === tab + 'Tab');
    });

    // Load data for specific tabs
    if (tab === 'products') {
        loadProducts();
    } else if (tab === 'orders') {
        loadAllOrders();
    }
}

// ============= DASHBOARD FUNCTIONS =============

async function loadDashboardData() {
    showLoading();
    try {
        // Load orders (with error handling)
        let orders = [];
        try {
            orders = await getAllOrders();
        } catch (orderError) {
            console.warn('Could not load orders:', orderError.message);
            orders = [];
        }
        currentOrders = orders;

        // Load products
        let products = [];
        try {
            products = await getProducts();
        } catch (productError) {
            console.warn('Could not load products:', productError.message);
            products = [];
        }
        currentProducts = products;

        // Update stats
        updateDashboardStats(orders, products);
        
        // Load recent orders
        loadRecentOrders(orders.slice(0, 10));
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

function updateDashboardStats(orders, products) {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;

    const totalOrdersEl = document.getElementById('totalOrders');
    const pendingOrdersEl = document.getElementById('pendingOrders');
    const completedOrdersEl = document.getElementById('completedOrders');
    const totalProductsEl = document.getElementById('totalProducts');
    
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders;
    if (completedOrdersEl) completedOrdersEl.textContent = completedOrders;
    if (totalProductsEl) totalProductsEl.textContent = products.length;
}

// ============= PRODUCT FUNCTIONS =============

async function loadProducts() {
    showLoading();
    try {
        const products = await getProducts();
        currentProducts = products;
        renderProductsTable(products);
    } catch (error) {
        console.error('Failed to load products:', error);
        showToast('Failed to load products', 'error');
        renderProductsTable([]);
    } finally {
        hideLoading();
    }
}

function getImageUrl(imagePath) {
    if (!imagePath) return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E';
    if (imagePath.startsWith('http')) return imagePath;
    if (imagePath.startsWith('/')) return imagePath;
    return '/' + imagePath;
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '}<td colspan="8" style="text-align: center;">No products found</td><tr>';
        return;
    }

    tbody.innerHTML = products.map(product => {
        let imageUrl = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E';
        
        if (product.images && product.images[0]) {
            imageUrl = getImageUrl(product.images[0]);
        }
        
        return `
            <tr>
                <td>${product.product_id || product.id || 'N/A'}</td>
                <td>
                    <img src="${imageUrl}" 
                         alt="${product.title || 'Product'}" 
                         style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E'">
                </td>
                <td>${product.title || 'N/A'}</td>
                <td>${product.category || 'N/A'}</td>
                <td>Ksh ${product.price || 0}</td>
                <td>
                    <span class="stock-badge ${product.stock_status || 'available'}">
                        ${product.stock_status === 'low' ? 'Few Units' : 
                          product.stock_status === 'available' ? 'In Stock' : 'Out of Stock'}
                    </span>
                </td>
                <td>${product.rating || 0} ★</td>
                <td>
                    <button class="btn-view" onclick="openEditProductModal(${product.id})" style="margin-right: 5px; background: #2196f3;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-view" onclick="deleteProduct(${product.id})" style="background: #f44336;">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============= ORDER FUNCTIONS =============

async function loadAllOrders() {
    showLoading();
    try {
        const orders = await getAllOrders();
        renderAllOrdersTable(orders);
    } catch (error) {
        console.error('Failed to load orders:', error);
        showToast('Failed to load orders', 'error');
        renderAllOrdersTable([]);
    } finally {
        hideLoading();
    }
}

function renderAllOrdersTable(orders) {
    const tbody = document.getElementById('allOrdersBody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => {
        let products = [];
        try {
            products = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
        } catch (e) {
            products = [];
        }
        const productNames = products.map(p => p.title).join(', ');

        return `
            <tr>
                <td>${order.order_id || 'N/A'}</td>
                <td>${order.customer_name || 'N/A'}</td>
                <td>${order.phone || 'N/A'}</td>
                <td>${order.location || 'N/A'}</td>
                <td>${productNames.substring(0, 30)}${productNames.length > 30 ? '...' : ''}</td>
                <td><span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span></td>
                <td>
                    <button class="btn-view" onclick="viewOrderDetails(${order.id})" style="margin-right: 5px; background: #4caf50;" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-view" onclick="deleteOrder(${order.id})" style="background: #f44336;" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function loadRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => {
        let products = [];
        try {
            products = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
        } catch (e) {
            products = [];
        }
        const productNames = products.map(p => p.title).join(', ');

        return `
            <tr>
                <td>${order.order_id || 'N/A'}</td>
                <td>${order.customer_name || 'N/A'}</td>
                <td>Ksh ${order.total_amount || 0}</td>
                <td><span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span></td>
                <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn-view" onclick="viewOrderDetails(${order.id})" style="margin-right: 5px; background: #4caf50;" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-view" onclick="deleteOrder(${order.id})" style="background: #f44336;" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============= DELETE ORDER FUNCTION =============

async function deleteOrder(orderId) {
    if (!confirm('⚠️ Are you sure you want to permanently delete this order? This action cannot be undone.')) {
        return;
    }

    showLoading();
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });

        if (response.status === 404) {
            showToast('Order already deleted or not found', 'info');
            loadDashboardData();
            return;
        }

        const result = await response.json();
        
        if (response.ok && result.success) {
            showToast('✅ Order deleted successfully', 'success');
            if (document.getElementById('ordersTab')?.classList.contains('active')) {
                loadAllOrders();
            } else {
                loadDashboardData();
            }
        } else {
            showToast(result.message || 'Failed to delete order', 'error');
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        showToast('Failed to delete order: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============= ADD PRODUCT FUNCTIONS =============

function openAddProductModal() {
    const modal = document.getElementById('addProductModal');
    const form = document.getElementById('addProductForm');
    const preview = document.getElementById('imagePreview');
    
    if (modal) modal.classList.add('active');
    if (form) form.reset();
    if (preview) preview.innerHTML = '';
    
    setTimeout(() => {
        const textarea = document.getElementById('productDescription');
        if (textarea) {
            textarea.removeAttribute('disabled');
            textarea.removeAttribute('readonly');
            textarea.style.pointerEvents = 'auto';
            textarea.style.backgroundColor = '#ffffff';
        }
    }, 200);
}

function handleImagePreview(e) {
    const files = e.target.files;
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    
    preview.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.margin = '5px';
            preview.appendChild(img);
        };

        reader.readAsDataURL(file);
    }
}

async function handleAddProduct(e) {
    e.preventDefault();

    const title = document.getElementById('productTitle')?.value;
    const price = document.getElementById('productPrice')?.value;
    const oldPrice = document.getElementById('productOldPrice')?.value || '';
    const description = document.getElementById('productDescription')?.value;
    const category = document.getElementById('productCategory')?.value;
    const stockStatus = document.getElementById('productStock')?.value || 'available';
    const rating = document.getElementById('productRating')?.value;
    const images = document.getElementById('productImages')?.files;

    if (!title || !price || !description || !category || !rating) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (!images || images.length === 0) {
        showToast('Please select at least one image', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('price', price);
    formData.append('old_price', oldPrice);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('stock_status', stockStatus);
    formData.append('rating', rating);

    for (let i = 0; i < images.length; i++) {
        formData.append('images', images[i]);
    }

    showLoading();
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'x-auth-token': token
            },
            body: formData
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            showToast('Product added successfully!', 'success');
            document.getElementById('addProductModal')?.classList.remove('active');
            document.getElementById('addProductForm')?.reset();
            const preview = document.getElementById('imagePreview');
            if (preview) preview.innerHTML = '';
            loadProducts();
        } else {
            showToast(result.message || 'Failed to add product', 'error');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showToast('Failed to add product: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============= EDIT PRODUCT FUNCTIONS =============

async function openEditProductModal(productId) {
    showLoading();
    imagesToRemove = [];
    
    try {
        let product = currentProducts.find(p => p.id === productId);
        
        if (!product) {
            const response = await fetch(`/api/products/${productId}`);
            const data = await response.json();
            product = data.product || data;
        }
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        currentEditingProduct = product;
        
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductTitle').value = product.title || '';
        document.getElementById('editProductPrice').value = product.price || '';
        document.getElementById('editProductOldPrice').value = product.old_price || '';
        document.getElementById('editProductDescription').value = product.description || '';
        document.getElementById('editProductCategory').value = product.category || '';
        document.getElementById('editProductStock').value = product.stock_status || 'available';
        document.getElementById('editProductRating').value = product.rating || '4';
        
        const previewDiv = document.getElementById('editImagePreview');
        if (previewDiv) {
            if (product.images && product.images.length > 0) {
                previewDiv.innerHTML = product.images.map(img => {
                    const imageUrl = getImageUrl(img);
                    return `
                        <div style="position: relative; display: inline-block; margin: 5px;" data-image="${img}">
                            <img src="${imageUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" 
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E'">
                            <button type="button" onclick="removeExistingImage('${img}')" style="position: absolute; top: -5px; right: -5px; background: #f44336; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 14px; cursor: pointer;">×</button>
                        </div>
                    `;
                }).join('');
            } else {
                previewDiv.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No images available</p>';
            }
        }
        
        document.getElementById('editProductModal').classList.add('active');
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Failed to load product details', 'error');
    } finally {
        hideLoading();
    }
}

function removeExistingImage(imageUrl) {
    if (confirm('Remove this image?')) {
        imagesToRemove.push(imageUrl);
        const previewDiv = document.getElementById('editImagePreview');
        const images = previewDiv.querySelectorAll('div[data-image]');
        for (let imgDiv of images) {
            if (imgDiv.dataset.image === imageUrl) {
                imgDiv.remove();
                break;
            }
        }
    }
}

function handleEditImagePreview(e) {
    const files = e.target.files;
    const preview = document.getElementById('editImagePreview');
    if (!preview) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = (e) => {
            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.style.display = 'inline-block';
            imgContainer.style.margin = '5px';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '80px';
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.border = '2px solid #4caf50';
            
            imgContainer.appendChild(img);
            preview.appendChild(imgContainer);
        };

        reader.readAsDataURL(file);
    }
}

async function handleEditProduct(e) {
    e.preventDefault();

    const productId = document.getElementById('editProductId').value;
    const title = document.getElementById('editProductTitle').value;
    const price = document.getElementById('editProductPrice').value;
    const oldPrice = document.getElementById('editProductOldPrice').value || '';
    const description = document.getElementById('editProductDescription').value;
    const category = document.getElementById('editProductCategory').value;
    const stockStatus = document.getElementById('editProductStock').value;
    const rating = document.getElementById('editProductRating').value;
    const newImages = document.getElementById('editProductImages').files;

    if (!title || !price || !description || !category || !rating) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    showLoading();
    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', price);
        formData.append('old_price', oldPrice);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('stock_status', stockStatus);
        formData.append('rating', rating);
        
        if (imagesToRemove.length > 0) {
            formData.append('images_to_remove', JSON.stringify(imagesToRemove));
        }
        
        for (let i = 0; i < newImages.length; i++) {
            formData.append('new_images', newImages[i]);
        }

        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'x-auth-token': token
            },
            body: formData
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            showToast('Product updated successfully!', 'success');
            document.getElementById('editProductModal').classList.remove('active');
            document.getElementById('editProductForm').reset();
            document.getElementById('editImagePreview').innerHTML = '';
            document.getElementById('editProductImages').value = '';
            imagesToRemove = [];
            loadProducts();
        } else {
            showToast(result.message || 'Failed to update product', 'error');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showToast('Failed to update product: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============= DELETE PRODUCT FUNCTION =============

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }

    showLoading();
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            showToast('Product deleted successfully!', 'success');
            loadProducts();
        } else {
            showToast(result.message || 'Failed to delete product', 'error');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Failed to delete product: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============= ORDER MANAGEMENT =============

async function viewOrderDetails(orderId) {
    showLoading();
    try {
        const order = await getOrder(orderId);
        if (!order) {
            showToast('Order not found', 'error');
            return;
        }
        renderOrderDetails(order);
        document.getElementById('orderDetailsModal')?.classList.add('active');
    } catch (error) {
        console.error('Failed to load order details:', error);
        showToast('Failed to load order details', 'error');
    } finally {
        hideLoading();
    }
}

function renderOrderDetails(order) {
    const modalBody = document.getElementById('orderDetailsBody');
    if (!modalBody) return;

    let products = [];
    try {
        products = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
    } catch (e) {
        products = [];
    }

    modalBody.innerHTML = `
        <div class="order-details">
            <div class="order-info">
                <h3>Order Information</h3>
                <p><strong>Order ID:</strong> ${order.order_id || 'N/A'}</p>
                <p><strong>Date:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}</p>
                <p><strong>Status:</strong> <span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span></p>
            </div>

            <div class="customer-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> ${order.customer_name || 'N/A'}</p>
                <p><strong>Phone:</strong> ${order.phone || 'N/A'}</p>
                ${order.alternative_phone ? `<p><strong>Alternative Phone:</strong> ${order.alternative_phone}</p>` : ''}
                <p><strong>Location:</strong> ${order.location || 'N/A'}</p>
                ${order.specific_address ? `<p><strong>Address:</strong> ${order.specific_address}</p>` : ''}
            </div>

            <div class="order-items">
                <h3>Order Items</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(item => `
                            <tr>
                                <td>${item.title || 'N/A'}</td>
                                <td>${item.quantity || 0}</td>
                                <td>Ksh ${item.price || 0}</td>
                                <td>Ksh ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Total</strong></td>
                            <td><strong>Ksh ${order.total_amount || 0}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="order-actions">
                ${order.status === 'pending' ? `
                    <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'confirmed')">
                        Confirm Order
                    </button>
                ` : ''}
                
                ${order.status === 'confirmed' ? `
                    <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'shipped')">
                        Order Shipped
                    </button>
                ` : ''}
                
                ${order.status === 'shipped' ? `
                    <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'delivered')">
                        Order Delivered
                    </button>
                ` : ''}
                
                ${order.status === 'delivered' ? `
                    <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'completed')">
                        Mark as Completed
                    </button>
                ` : ''}
                
                <button class="btn-secondary" onclick="generateOrderReceipt(${order.id})">
                    Generate Receipt
                </button>
                
                <button class="btn-danger" onclick="cancelOrder(${order.id})">
                    Cancel Order
                </button>
                
                <button class="btn-danger" onclick="deleteOrder(${order.id})" style="background: #f44336; margin-top: 10px;">
                    <i class="fas fa-trash"></i> Delete Order Permanently
                </button>
            </div>
        </div>
    `;
}

async function updateOrderStatus(orderId, status) {
    if (!confirm(`Are you sure you want to mark this order as ${status}?`)) {
        return;
    }

    showLoading();
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ status })
        });

        if (response.status === 404) {
            showToast('Order not found', 'error');
            return;
        }

        const result = await response.json();
        
        if (response.ok && result.success) {
            document.getElementById('orderDetailsModal')?.classList.remove('active');
            loadDashboardData();
            showToast(`Order marked as ${status}`, 'success');
        } else {
            showToast(result.message || 'Failed to update order', 'error');
        }
    } catch (error) {
        console.error('Failed to update order status:', error);
        showToast('Failed to update order status', 'error');
    } finally {
        hideLoading();
    }
}

function generateOrderReceipt(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) {
        showToast('Order not found', 'error');
        return;
    }

    let products = [];
    try {
        products = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
    } catch (e) {
        products = [];
    }

    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
        <html>
            <head>
                <title>Order Receipt - KUKU YETU</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .receipt { max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .section { margin: 20px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    .total { font-weight: bold; font-size: 1.2em; }
                    .footer { margin-top: 40px; text-align: center; }
                    .status { display: inline-block; padding: 5px 10px; border-radius: 4px; }
                    .status.${order.status} { background: ${getStatusColor(order.status)}; color: white; }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <h1>KUKU YETU</h1>
                        <p>Premium Poultry Products</p>
                        <h2>Order Receipt</h2>
                    </div>
                    
                    <div class="section">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> ${order.order_id || 'N/A'}</p>
                        <p><strong>Date:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}</p>
                        <p><strong>Status:</strong> <span class="status ${order.status || 'pending'}">${order.status || 'pending'}</span></p>
                    </div>
                    
                    <div class="section">
                        <h3>Customer Information</h3>
                        <p><strong>Name:</strong> ${order.customer_name || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${order.phone || 'N/A'}</p>
                        ${order.alternative_phone ? `<p><strong>Alternative Phone:</strong> ${order.alternative_phone}</p>` : ''}
                        <p><strong>Location:</strong> ${order.location || 'N/A'}</p>
                        ${order.specific_address ? `<p><strong>Address:</strong> ${order.specific_address}</p>` : ''}
                    </div>
                    
                    <div class="section">
                        <h3>Order Items</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(item => `
                                    <tr>
                                        <td>${item.title || 'N/A'}</td>
                                        <td>${item.quantity || 0}</td>
                                        <td>Ksh ${item.price || 0}</td>
                                        <td>Ksh ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        能有
                        <p class="total">Total Amount: Ksh ${order.total_amount || 0}</p>
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for choosing KUKU YETU!</p>
                        <p>For any inquiries, please contact us at support@kukuyetu.com</p>
                    </div>
                </div>
            </body>
        </html>
    `);
    receiptWindow.document.close();
    receiptWindow.print();
}

function getStatusColor(status) {
    switch(status) {
        case 'pending': return '#ff9800';
        case 'confirmed': return '#2196f3';
        case 'shipped': return '#9c27b0';
        case 'delivered': return '#4caf50';
        case 'completed': return '#2e7d32';
        case 'cancelled': return '#f44336';
        default: return '#999';
    }
}

function cancelOrder(orderId) {
    if (confirm('Are you sure you want to cancel this order?')) {
        updateOrderStatus(orderId, 'cancelled');
    }
}

// ============= API FUNCTIONS =============

async function getProducts() {
    try {
        const response = await fetch('/api/products');
        const data = await response.json();
        return data.products || data || [];
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

async function getAllOrders() {
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            console.warn('No admin token found');
            return [];
        }
        
        const response = await fetch('/api/orders', {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.status === 404) {
            console.warn('Orders endpoint not found - returning empty array');
            return [];
        }
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expired. Please login again.', 'error');
                adminLogout();
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.orders || data || [];
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
}

async function getOrder(orderId) {
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('No admin token found');
        }
        
        const response = await fetch(`/api/orders/${orderId}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.order || data || {};
    } catch (error) {
        console.error('Error fetching order:', error);
        return null;
    }
}

// ============= UTILITY FUNCTIONS =============

function showLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.add('active');
}

function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Export for global access
window.openAddProductModal = openAddProductModal;
window.openEditProductModal = openEditProductModal;
window.removeExistingImage = removeExistingImage;
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.generateOrderReceipt = generateOrderReceipt;
window.deleteProduct = deleteProduct;
window.cancelOrder = cancelOrder;
window.deleteOrder = deleteOrder;
window.adminLogout = adminLogout;
