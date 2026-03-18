// ============== GLOBAL VARIABLES ==============
let currentUser = null;
let cart = [];
let favorites = [];
let currentProduct = null;
let slideInterval;
let productsLoaded = false;
let currentPage = 1;
let totalProducts = 0;
const productsPerPage = 6;

// ============== HELPER FUNCTIONS ==============

// Safe image URL generator with multiple fallbacks
function getImageUrl(product) {
    // If product has images array with at least one image
    if (product.images && Array.isArray(product.images) && product.images.length > 0 && product.images[0]) {
        const imageFile = product.images[0];
        // Check if it's already a full URL
        if (imageFile.startsWith('http')) {
            return imageFile;
        }
        // For uploaded images
        return `/uploads/${imageFile}`;
    }
    
    // Category-based fallback images
    const categoryImages = {
        'broilers': '/images/kienyeji.jpg',
        'layers': '/images/feeds.jpg',
        'eggs': '/images/eggs.jpg',
        'chicks': '/images/chicks.jpg'
    };
    
    // Try category-based image
    if (product.category && categoryImages[product.category.toLowerCase()]) {
        return categoryImages[product.category.toLowerCase()];
    }
    
    // Ultimate fallback - data URI with category name
    const category = product.category || 'product';
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' fill='%23999' text-anchor='middle' dy='.3em'%3E${category}%3C/text%3E%3C/svg%3E`;
}

// Image error handler
function handleImageError(img, product) {
    console.warn('Image failed to load:', img.src, 'for product:', product.title);
    
    // Try category-based fallback
    const categoryImages = {
        'broilers': '/images/kienyeji.jpg',
        'layers': '/images/feeds.jpg',
        'eggs': '/images/eggs.jpg',
        'chicks': '/images/chicks.jpg'
    };
    
    if (product.category && categoryImages[product.category.toLowerCase()]) {
        img.src = categoryImages[product.category.toLowerCase()];
        img.onerror = () => {
            // Ultimate fallback if even category image fails
            img.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' fill='%23999' text-anchor='middle' dy='.3em'%3E${product.category || 'No Image'}%3C/text%3E%3C/svg%3E`;
        };
    } else {
        // Ultimate fallback
        img.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' fill='%23999' text-anchor='middle' dy='.3em'%3E${product.category || 'No Image'}%3C/text%3E%3C/svg%3E`;
    }
}

// ============== LOAD PRODUCTS ==============

async function loadProducts(category = 'all', search = '') {
    try {
        console.log('📦 Loading all products...');
        showGlobalLoader();
        
        let url = '/api/products';
        const params = new URLSearchParams();
        if (category !== 'all') params.append('category', category);
        if (search) params.append('search', search);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📦 API Response:', data);
        
        let products = [];
        if (Array.isArray(data)) {
            products = data;
        } else if (data.products && Array.isArray(data.products)) {
            products = data.products;
        } else {
            console.error('Unexpected API response format:', data);
            products = [];
        }
        
        console.log(`✅ Loaded ${products.length} products from API`);
        
        // Store total count
        totalProducts = products.length;
        currentPage = 1;
        
        // Display first page
        displayProductsPage(products);
        
        // Setup pagination if needed
        if (totalProducts > productsPerPage) {
            setupPagination(products);
        }
        
        hideLoadingOverlay();
        productsLoaded = true;
        
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Error loading products', 'error');
        hideLoadingOverlay();
    } finally {
        hideGlobalLoader();
    }
}

// Display paginated products
function displayProductsPage(allProducts) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    const start = (currentPage - 1) * productsPerPage;
    const end = start + productsPerPage;
    const pageProducts = allProducts.slice(start, end);
    
    console.log(`📄 Page ${currentPage}: Loaded ${pageProducts.length} products, more: ${end < allProducts.length}`);
    
    if (pageProducts.length === 0) {
        if (currentPage === 1) {
            grid.innerHTML = '<div class="no-products">No products found</div>';
        }
        return;
    }
    
    const productsHTML = pageProducts.map(product => {
        const productStr = JSON.stringify(product).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const imageUrl = getImageUrl(product);
        
        return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image" onclick='openProductModal(${productStr})'>
                <img 
                    src="${imageUrl}"
                    alt="${product.title}"
                    loading="lazy"
                    onerror="this.onerror=null; handleImageError(this, ${productStr})"
                >
            </div>
            <div class="product-info">
                <div class="product-title">${product.title}</div>
                <div class="product-category">${product.category}</div>
                <div class="product-prices">
                    <span class="current-price">KSh ${product.price}</span>
                    ${product.old_price ? `<span class="old-price">KSh ${product.old_price}</span>` : ''}
                </div>
                <div class="product-rating">${generateStars(product.rating)}</div>
                <div class="stock-status ${product.stock_status === 'few' ? 'few' : 'many'}">
                    ${product.stock_status === 'few' ? 'Few units left' : 'In stock'}
                </div>
                <div class="product-actions">
                    <button class="view-btn" onclick='openProductModal(${productStr})'>
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="add-to-cart-btn" onclick='addToCart(${productStr})'>
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
    
    if (currentPage === 1) {
        grid.innerHTML = productsHTML;
    } else {
        grid.insertAdjacentHTML('beforeend', productsHTML);
    }
}

// Setup pagination
function setupPagination(products) {
    let paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'pagination';
        paginationDiv.className = 'pagination';
        document.querySelector('.products-grid').after(paginationDiv);
    }
    
    const totalPages = Math.ceil(products.length / productsPerPage);
    let buttons = '';
    
    for (let i = 1; i <= totalPages; i++) {
        buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (currentPage < totalPages) {
        buttons += `<button class="page-btn next" onclick="goToPage(${currentPage + 1})">Next →</button>`;
    }
    
    paginationDiv.innerHTML = buttons;
}

// Go to page
function goToPage(page) {
    currentPage = page;
    loadMoreProducts();
}

// Load more products (for pagination)
function loadMoreProducts() {
    const category = document.querySelector('.filter-btn.active')?.textContent.toLowerCase() || 'all';
    const search = document.getElementById('searchInput')?.value || '';
    
    let url = '/api/products';
    const params = new URLSearchParams();
    if (category !== 'all') params.append('category', category);
    if (search) params.append('search', search);
    if (params.toString()) url += '?' + params.toString();
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            let products = Array.isArray(data) ? data : (data.products || []);
            displayProductsPage(products);
            setupPagination(products);
            window.scrollTo({ top: document.querySelector('.products-grid').offsetTop - 100, behavior: 'smooth' });
        })
        .catch(err => console.error('Error loading more products:', err));
}

// ============== GENERATE STARS ==============
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

// ============== CART FUNCTIONS ==============
function addToCart(product) {
    try {
        if (!product || !product.id) {
            showNotification('Invalid product', 'error');
            return false;
        }

        const cartItem = {
            id: product.id,
            title: product.title || product.name,
            price: parseFloat(product.price) || 0,
            quantity: 1,
            images: product.images || []
        };

        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
            showNotification('Quantity updated in cart', 'success');
        } else {
            cart.push(cartItem);
            showNotification('Added to cart', 'success');
        }

        updateCartBadge();
        saveCart();
        return true;
    } catch (err) {
        console.error('Add to cart failed', err);
        showNotification('Add to cart failed', 'error');
        return false;
    }
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'block' : 'none';
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCart() {
    try {
        cart = JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
        cart = [];
    }
    updateCartBadge();
}

function openCart() {
    displayCartItems();
    document.getElementById('cartModal')?.classList.add('active');
}

function closeCartModal() {
    document.getElementById('cartModal')?.classList.remove('active');
}

function displayCartItems() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        document.getElementById('cartTotal').textContent = 'KSh 0';
        return;
    }
    
    let total = 0;
    container.innerHTML = cart.map((item, index) => {
        total += item.price * item.quantity;
        return `
        <div class="cart-item">
            <img src="${item.images?.[0] ? '/uploads/' + item.images[0] : '/images/placeholder.jpg'}" alt="${item.title}" class="cart-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\'%3E%3Crect width=\\'60\\' height=\\'60\\' fill=\\'%23f0f0f0\\'/%3E%3Ctext x=\\'30\\' y=\\'30\\' font-family=\\'Arial\\' font-size=\\'10\\' fill=\\'%23999\\' text-anchor=\\'middle\\' dy=\\'.3em\\'%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-price">KSh ${item.price}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="updateQuantity(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${index}, 1)">+</button>
                </div>
            </div>
            <button class="remove-item" onclick="removeFromCart(${index})">×</button>
        </div>
    `}).join('');
    
    document.getElementById('cartTotal').textContent = `KSh ${total}`;
}

function updateQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity = Math.max(1, (cart[index].quantity || 1) + change);
        saveCart();
        displayCartItems();
        updateCartBadge();
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        cart.splice(index, 1);
        saveCart();
        displayCartItems();
        updateCartBadge();
        showNotification('Item removed from cart', 'info');
    }
}

// ============== NOTIFICATIONS ==============
async function loadNotifications() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/users/notifications', {
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        console.log('Notifications loaded:', data);
        
        const list = document.getElementById('notificationList');
        const badge = document.getElementById('notificationBadge');
        
        if (badge && data.count) {
            badge.textContent = data.count;
        }
        
        if (list && data.notifications) {
            if (data.notifications.length === 0) {
                list.innerHTML = '<div class="no-notifications">No notifications</div>';
            } else {
                list.innerHTML = data.notifications.map(n => `
                    <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
                        <div class="notification-title">${n.title}</div>
                        <div class="notification-message">${n.message}</div>
                        <div class="notification-time">${new Date(n.created_at).toLocaleString()}</div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// ============== AUTH FUNCTIONS ==============
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        fetch('/api/auth/verify', {
            headers: { 'x-auth-token': token }
        })
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                currentUser = data.user;
                console.log('✅ Session restored for:', currentUser.fullName);
            }
        })
        .catch(() => {
            localStorage.removeItem('token');
        });
    }
}

// ============== UI HELPER FUNCTIONS ==============
function filterProducts(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadProducts(category);
}

function toggleSideNav() {
    document.getElementById('sideNav')?.classList.toggle('active');
}

function toggleNotification() {
    document.getElementById('notificationPanel')?.classList.toggle('active');
    if (document.getElementById('notificationPanel')?.classList.contains('active')) {
        loadNotifications();
    }
}

function openWhatsApp() {
    window.open('https://wa.me/254112402377', '_blank');
}

function callSupport() {
    window.location.href = 'tel:+254112402377';
}

function showCategories() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="categories-grid">
            <div class="category-card" onclick="filterProducts('broilers')">
                <i class="fas fa-drumstick-bite"></i>
                <h3>Broilers</h3>
            </div>
            <div class="category-card" onclick="filterProducts('layers')">
                <i class="fas fa-egg"></i>
                <h3>Layers</h3>
            </div>
            <div class="category-card" onclick="filterProducts('eggs')">
                <i class="fas fa-egg"></i>
                <h3>Eggs</h3>
            </div>
            <div class="category-card" onclick="filterProducts('chicks')">
                <i class="fas fa-seedling"></i>
                <h3>Chicks</h3>
            </div>
        </div>
    `;
}

function showFavorites() {
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.innerHTML = '<div class="info">Favorites feature coming soon</div>';
    }
}

function showAbout() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="about-page">
            <h2>About KUKU YETU</h2>
            <p>KUKU YETU is your premier destination for quality poultry products in Kenya.</p>
            <p>We specialize in broilers, layers, eggs, and chicks for farmers and businesses.</p>
            <h3>Contact Us</h3>
            <p>Email: info@kukuyetu.com</p>
            <p>Phone: +254 112 402377</p>
            <p>Location: Nairobi, Kenya</p>
        </div>
    `;
}

function showProfile() {
    if (!currentUser) {
        openAuthModal();
        return;
    }
    
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="profile-page">
            <h2>My Profile</h2>
            <p><strong>Name:</strong> ${currentUser.fullName || 'N/A'}</p>
            <p><strong>Email:</strong> ${currentUser.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${currentUser.phone || 'N/A'}</p>
            <button onclick="logout()" class="logout-btn">Logout</button>
        </div>
    `;
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    cart = [];
    saveCart();
    updateCartBadge();
    showNotification('Logged out successfully', 'success');
    window.location.reload();
}

function openAuthModal() {
    document.getElementById('authModal')?.classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal')?.classList.remove('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('.auth-tab:first-child')?.classList.add('active');
        document.getElementById('loginForm')?.classList.add('active');
    } else {
        document.querySelector('.auth-tab:last-child')?.classList.add('active');
        document.getElementById('registerForm')?.classList.add('active');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = document.querySelector('#loginForm .auth-submit');

    if (!email || !password) {
        showNotification('Please provide email and password', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Logging in...';
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.token) {
            localStorage.setItem('token', result.token);
            currentUser = result.user;
            closeAuthModal();
            showNotification('Login successful!', 'success');
            window.location.reload();
        } else {
            showNotification(result.msg || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const userData = {
        fullName: document.getElementById('regFullName').value,
        email: document.getElementById('regEmail').value,
        phone: document.getElementById('regPhone').value,
        password: document.getElementById('regPassword').value
    };
    
    const btn = document.querySelector('#registerForm .auth-submit');

    if (!userData.fullName || !userData.email || !userData.phone || !userData.password) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Registering...';
        
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (result.token) {
            localStorage.setItem('token', result.token);
            currentUser = result.user;
            closeAuthModal();
            showNotification('Registration successful!', 'success');
            window.location.reload();
        } else {
            showNotification(result.msg || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Registration error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Register';
    }
}

// ============== NOTIFICATION FUNCTION ==============
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
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

// ============== LOADING OVERLAY ==============
function initLoadingOverlay() {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="spinner-container">
                <div class="spinner"></div>
                <div class="loading-text">Loading KUKU YETU...</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    }
}

function showGlobalLoader() {
    let loader = document.getElementById('globalLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999;';
        document.body.appendChild(loader);
    }
}

function hideGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.remove();
}

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', () => {
    console.log('KUKU YETU app initializing...');
    checkAuth();
    loadCart();
    loadProducts();
    loadNotifications();
    initLoadingOverlay();
});

// ============== STYLES ==============
if (!document.getElementById('notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
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
        .pagination {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin: 30px 0;
        }
        .page-btn {
            padding: 8px 15px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 5px;
        }
        .page-btn.active {
            background: #ff6b00;
            color: white;
            border-color: #ff6b00;
        }
        .page-btn:hover {
            background: #f0f0f0;
        }
    `;
    document.head.appendChild(style);
}

// ============== EXPOSE FUNCTIONS TO GLOBAL SCOPE ==============
window.filterProducts = filterProducts;
window.toggleSideNav = toggleSideNav;
window.toggleNotification = toggleNotification;
window.openWhatsApp = openWhatsApp;
window.callSupport = callSupport;
window.showCategories = showCategories;
window.openCart = openCart;
window.closeCartModal = closeCartModal;
window.showFavorites = showFavorites;
window.showAbout = showAbout;
window.showProfile = showProfile;
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.logout = logout;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.goToPage = goToPage;
window.handleImageError = handleImageError;
