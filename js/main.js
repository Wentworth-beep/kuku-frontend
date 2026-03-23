// ============== FRONTEND PRODUCT CONTROLLER ==============
class FrontendProductController {
    constructor() {
        this.products = [];
        this.categories = ['broilers', 'layers', 'eggs', 'chicks'];
        this.apiBase = 'https://kuku-backend-ntr4.onrender.com/api';
    }

    async fetchProducts() {
        try {
            console.log('📦 Fetching products from backend...');
            const response = await fetch(`${this.apiBase}/products`);
            const data = await response.json();
            
            if (data.success === true && data.products) {
                this.products = data.products;
            } else if (Array.isArray(data)) {
                this.products = data;
            } else if (data.products && Array.isArray(data.products)) {
                this.products = data.products;
            } else {
                console.warn('Unexpected response format:', data);
                this.products = [];
            }
            
            console.log(`✅ Loaded ${this.products.length} products`);
            return this.products;
        } catch (error) {
            console.error('❌ Failed to fetch products:', error);
            this.products = [];
            return [];
        }
    }

    getProductById(id) {
        return this.products.find(p => p.id === parseInt(id));
    }

    filterByCategory(category) {
        if (category === 'all') return this.products;
        return this.products.filter(p => p.category === category);
    }

    searchProducts(query) {
        if (!query || query.trim() === '') return this.products;
        const term = query.toLowerCase().trim();
        return this.products.filter(p => 
            (p.title?.toLowerCase() || '').includes(term) ||
            (p.description?.toLowerCase() || '').includes(term) ||
            (p.category?.toLowerCase() || '').includes(term)
        );
    }

    getImageUrl(imagePath) {
        if (!imagePath) return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E';
        if (imagePath.startsWith('http')) return imagePath;
        
        let cleanPath = imagePath;
        if (cleanPath.startsWith('{{') && cleanPath.endsWith('}}')) {
            cleanPath = cleanPath.slice(1, -1);
        }
        if (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.slice(1);
        }
        
        return `https://kuku-backend-ntr4.onrender.com/${cleanPath}`;
    }

    formatPrice(price) {
        return `Ksh ${parseFloat(price || 0).toFixed(2)}`;
    }

    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - Math.ceil(rating);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star"></i>';
        if (halfStar) stars += '<i class="fas fa-star-half-alt"></i>';
        for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star"></i>';
        return stars;
    }
}

// Create global instance
const productController = new FrontendProductController();
window.productController = productController;

// ============== GLOBAL VARIABLES ==============
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentOrder = null;
let notificationInterval = null;

// DOM Elements
let productsGrid, loadingSpinner, cartBadge, notificationBadge, notificationList, toastContainer;

// API Base URL (from api.js)
const API_BASE_URL = 'https://kuku-backend-ntr4.onrender.com/api';

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 KUKU YETU initializing...');
    
    // Initialize DOM elements
    productsGrid = document.getElementById('productsGrid');
    loadingSpinner = document.getElementById('loadingSpinner');
    cartBadge = document.getElementById('cartBadge');
    notificationBadge = document.getElementById('notificationBadge');
    notificationList = document.getElementById('notificationList');
    toastContainer = document.getElementById('toastContainer');
    
    // Load data
    loadInitialData();
    setupEventListeners();
    updateCartBadge();
    checkAuthAndRestoreSession();
    startNotificationPolling();
});

async function loadInitialData() {
    showLoading();
    try {
        await productController.fetchProducts();
        renderProducts(productController.products);
    } catch (error) {
        console.error('Failed to load products:', error);
        showToast('Failed to load products. Please refresh the page.', 'error');
    } finally {
        hideLoading();
    }
}

// ============== RENDER FUNCTIONS ==============
function renderProducts(products) {
    if (!productsGrid) return;
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-box-open"></i>
                <p>No products found</p>
                <button onclick="filterProducts('all')" class="btn-primary">Browse All</button>
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = products.map(product => createProductCard(product)).join('');
    attachImageLazyLoading();
}

function createProductCard(product) {
    const isFavorite = favorites.includes(product.id);
    const imageUrl = productController.getImageUrl(product.images?.[0]);
    const placeholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 300 200\'%3E%3Crect width=\'300\' height=\'200\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' font-family=\'Arial\' font-size=\'16\' fill=\'%23999\' text-anchor=\'middle\' dy=\'.3em\'%3ELoading...%3C/text%3E%3C/svg%3E';
    
    let stockClass = 'available';
    let stockText = 'In stock';
    if (product.stock_status === 'low') {
        stockClass = 'low';
        stockText = 'Few units left';
    } else if (product.stock_status === 'out') {
        stockClass = 'out';
        stockText = 'Out of stock';
    }
    
    return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img data-src="${imageUrl}" 
                     src="${placeholder}"
                     alt="${escapeHtml(product.title) || 'Product'}"
                     class="lazy-image"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E'">
                <span class="product-category">${product.category || 'Uncategorized'}</span>
                <span class="stock-status ${stockClass}">${stockText}</span>
            </div>
            <div class="product-info">
                <h3 class="product-title">${escapeHtml(product.title) || 'Untitled'}</h3>
                <p class="product-description">${escapeHtml(product.description?.substring(0, 60) || 'No description')}...</p>
                <div class="product-price">
                    <span class="current-price">${productController.formatPrice(product.price)}</span>
                    ${product.old_price ? `<span class="old-price">${productController.formatPrice(product.old_price)}</span>` : ''}
                </div>
                <div class="product-rating">
                    ${productController.generateStars(product.rating || 0)}
                    <span class="rating-text">(${product.rating || 0})</span>
                </div>
                <div class="product-actions">
                    <button class="view-btn" onclick="openProductModal(${product.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="cart-btn" onclick="addToCart(${product.id})"
                            ${product.stock_status === 'out' ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `;
}

function attachImageLazyLoading() {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const dataSrc = img.getAttribute('data-src');
                if (dataSrc) {
                    img.src = dataSrc;
                    img.removeAttribute('data-src');
                    img.classList.add('loaded');
                }
                imageObserver.unobserve(img);
            }
        });
    }, { rootMargin: '100px', threshold: 0.01 });
    
    document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

// ============== FILTER & SEARCH ==============
function filterProducts(category) {
    console.log('Filtering products by category:', category);
    showLoading();
    setTimeout(() => {
        const filtered = productController.filterByCategory(category);
        renderProducts(filtered);
        hideLoading();
        updateActiveFilter(category);
    }, 100);
}

function searchProducts() {
    const query = document.getElementById('searchInput')?.value || '';
    console.log('Searching products:', query);
    showLoading();
    setTimeout(() => {
        const results = productController.searchProducts(query);
        renderProducts(results);
        hideLoading();
    }, 300);
}

function updateActiveFilter(category) {
    document.querySelectorAll('.filter-btn, [data-filter]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === category || 
            (btn.textContent?.toLowerCase() === category)) {
            btn.classList.add('active');
        }
    });
}

// ============== CART FUNCTIONS ==============
function addToCart(productId) {
    const product = productController.getProductById(productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
        showToast(`Updated quantity: ${product.title}`, 'success');
    } else {
        cart.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.images?.[0],
            quantity: 1
        });
        showToast(`Added to cart: ${product.title}`, 'success');
    }
    
    saveCart();
    updateCartBadge();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartBadge();
    if (document.getElementById('cartModal')?.classList.contains('active')) {
        renderCart();
    }
    showToast('Item removed from cart', 'info');
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = (item.quantity || 1) + change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            updateCartBadge();
            if (document.getElementById('cartModal')?.classList.contains('active')) {
                renderCart();
            }
        }
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartBadge() {
    if (!cartBadge) return;
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartBadge.textContent = totalItems;
    cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
}

function openCart() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'cart');
        openLoginModal();
        return;
    }
    renderCart();
    document.getElementById('cartModal')?.classList.add('active');
}

function closeCartModal() {
    document.getElementById('cartModal')?.classList.remove('active');
}

function renderCart() {
    const cartBody = document.getElementById('cartModalBody');
    if (!cartBody) return;
    
    if (cart.length === 0) {
        cartBody.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
                <button onclick="closeCartModal()" class="btn-primary">Continue Shopping</button>
            </div>
        `;
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
    
    cartBody.innerHTML = `
        <div class="cart-items">
            ${cart.map(item => {
                const imageUrl = productController.getImageUrl(item.image);
                return `
                    <div class="cart-item">
                        <img src="${imageUrl}" alt="${escapeHtml(item.title)}" class="cart-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E'">
                        <div class="cart-item-details">
                            <h4>${escapeHtml(item.title)}</h4>
                            <div class="cart-item-price">${productController.formatPrice(item.price)}</div>
                            <div class="cart-item-quantity">
                                <button onclick="updateQuantity(${item.id}, -1)">-</button>
                                <span>${item.quantity || 1}</span>
                                <button onclick="updateQuantity(${item.id}, 1)">+</button>
                                <button onclick="removeFromCart(${item.id})" class="remove-btn">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="cart-summary">
            <div class="cart-total">
                <strong>Total:</strong>
                <strong>${productController.formatPrice(total)}</strong>
            </div>
            <div class="cart-location">
                <h4>Delivery Location</h4>
                <div class="location-input-group">
                    <input type="text" id="locationInput" placeholder="Click to get location" readonly>
                    <button onclick="getUserLocation()" class="location-btn">
                        <i class="fas fa-location-dot"></i> Get Location
                    </button>
                </div>
                <textarea id="addressInput" placeholder="Specific address or delivery notes"></textarea>
            </div>
            <div class="cart-actions">
                <button onclick="confirmOrder()" class="confirm-order-btn">
                    <i class="fas fa-check"></i> Confirm Order (Pay on Delivery)
                </button>
                <button onclick="orderViaWhatsApp()" class="whatsapp-order-btn">
                    <i class="fab fa-whatsapp"></i> Order via WhatsApp
                </button>
            </div>
        </div>
    `;
}

// ============== AUTHENTICATION ==============
async function checkAuthAndRestoreSession() {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('✅ Session restored for:', currentUser.full_name);
            updateUIForLoggedInUser();
        } catch (error) {
            console.log('Session restore failed');
            logout();
        }
    }
}

function updateUIForLoggedInUser() {
    const profileBtn = document.querySelector('[data-page="profile"] span');
    if (profileBtn && currentUser) {
        profileBtn.textContent = currentUser.full_name?.split(' ')[0] || 'Profile';
    }
}

function updateUIForLoggedOutUser() {
    const profileBtn = document.querySelector('[data-page="profile"] span');
    if (profileBtn) {
        profileBtn.textContent = 'Profile';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success && data.token) {
            currentUser = data.user;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            closeLoginModal();
            updateUIForLoggedInUser();
            showToast(`Welcome back, ${currentUser.full_name}!`, 'success');
            
            const redirect = sessionStorage.getItem('redirectAfterLogin');
            if (redirect) {
                sessionStorage.removeItem('redirectAfterLogin');
                if (redirect === 'cart') openCart();
                else if (redirect === 'profile') showProfile();
                else if (redirect === 'checkout') {
                    const productId = sessionStorage.getItem('checkoutProductId');
                    sessionStorage.removeItem('checkoutProductId');
                    if (productId) proceedToCheckout(parseInt(productId));
                }
            }
        } else {
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const userData = {
        full_name: document.getElementById('registerName')?.value,
        email: document.getElementById('registerEmail')?.value,
        phone: document.getElementById('registerPhone')?.value,
        password: document.getElementById('registerPassword')?.value
    };
    
    if (!userData.full_name || !userData.email || !userData.phone || !userData.password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('Registration successful! Please login.', 'success');
            switchAuthTab('login');
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    cart = [];
    currentUser = null;
    updateCartBadge();
    updateUIForLoggedOutUser();
    renderProducts(productController.products);
    showToast('Logged out successfully', 'success');
}

function openLoginModal() {
    document.getElementById('loginModal')?.classList.add('active');
    switchAuthTab('login');
}

function closeLoginModal() {
    document.getElementById('loginModal')?.classList.remove('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.id === `${tab}Form`);
    });
}

// ============== NAVIGATION FUNCTIONS ==============
function navigateTo(page) {
    console.log('Navigating to:', page);
    
    document.querySelectorAll('.footer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    switch(page) {
        case 'home':
            renderProducts(productController.products);
            break;
        case 'categories':
            showCategories();
            break;
        case 'cart':
            openCart();
            break;
        case 'favorites':
            showFavorites();
            break;
        case 'about':
            showAbout();
            break;
        case 'profile':
            showProfile();
            break;
        default:
            renderProducts(productController.products);
    }
}

function showCategories() {
    if (!productsGrid) return;
    productsGrid.innerHTML = `
        <div class="categories-grid">
            ${productController.categories.map(cat => `
                <div class="category-card" onclick="filterProducts('${cat}')">
                    <i class="fas fa-${cat === 'eggs' ? 'egg' : cat === 'chicks' ? 'crow' : 'drumstick-bite'}"></i>
                    <h3>${cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
                </div>
            `).join('')}
        </div>
    `;
}

function showFavorites() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'favorites');
        openLoginModal();
        return;
    }
    const favoriteProducts = productController.products.filter(p => favorites.includes(p.id));
    renderProducts(favoriteProducts);
}

function showAbout() {
    if (!productsGrid) return;
    productsGrid.innerHTML = `
        <div class="about-page">
            <div class="about-header">
                <i class="fas fa-egg"></i>
                <h2>About KUKU YETU</h2>
            </div>
            <p>KUKU YETU is your premier destination for quality poultry products in Kenya. We specialize in providing the best broilers, layers, eggs, and chicks to farmers and businesses across the nation.</p>
            <div class="contact-info">
                <h3>Contact Us</h3>
                <p><i class="fas fa-envelope"></i> info@kukuyetu.com</p>
                <p><i class="fas fa-phone"></i> +254 112 402377</p>
                <p><i class="fas fa-map-marker-alt"></i> Nairobi, Kenya</p>
            </div>
            <div class="business-hours">
                <h3>Business Hours</h3>
                <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
                <p>Saturday: 9:00 AM - 4:00 PM</p>
                <p>Sunday: Closed</p>
            </div>
        </div>
    `;
}

function showProfile() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'profile');
        openLoginModal();
        return;
    }
    
    if (!productsGrid) return;
    productsGrid.innerHTML = `
        <div class="profile-page">
            <div class="profile-header">
                <div class="profile-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <h2>${escapeHtml(currentUser.full_name)}</h2>
                <p class="profile-email">${escapeHtml(currentUser.email)}</p>
                <p class="profile-phone">${escapeHtml(currentUser.phone)}</p>
            </div>
            <div class="profile-actions">
                <button onclick="viewOrderHistory()" class="btn-primary">
                    <i class="fas fa-history"></i> Order History
                </button>
                <button onclick="logout()" class="btn-secondary">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    `;
}

// ============== PRODUCT MODAL ==============
function openProductModal(productId) {
    const product = productController.getProductById(productId);
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const modalBody = document.getElementById('productModalBody');
    if (!modal || !modalBody) return;
    
    const imageUrl = productController.getImageUrl(product.images?.[0]);
    
    modalBody.innerHTML = `
        <div class="product-detail">
            <div class="product-detail-image">
                <img src="${imageUrl}" alt="${escapeHtml(product.title)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E🐔%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="product-detail-info">
                <h2>${escapeHtml(product.title)}</h2>
                <div class="product-detail-price">
                    <span class="current-price">${productController.formatPrice(product.price)}</span>
                    ${product.old_price ? `<span class="old-price">${productController.formatPrice(product.old_price)}</span>` : ''}
                </div>
                <div class="product-detail-rating">
                    ${productController.generateStars(product.rating || 0)}
                    <span>(${product.rating || 0})</span>
                </div>
                <p class="product-detail-description">${escapeHtml(product.description || 'No description available')}</p>
                <p><strong>Product ID:</strong> ${product.product_id || 'N/A'}</p>
                <div class="product-detail-actions">
                    <button onclick="addToCart(${product.id})" class="btn-primary">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button onclick="proceedToCheckout(${product.id})" class="btn-success">
                        <i class="fas fa-credit-card"></i> Buy Now
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal')?.classList.remove('active');
}

function proceedToCheckout(productId) {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'checkout');
        sessionStorage.setItem('checkoutProductId', productId);
        openLoginModal();
        return;
    }
    addToCart(productId);
    closeProductModal();
    openCart();
}

// ============== NOTIFICATIONS ==============
function startNotificationPolling() {
    if (!currentUser) return;
    loadNotifications();
    if (notificationInterval) clearInterval(notificationInterval);
    notificationInterval = setInterval(loadNotifications, 30000);
}

async function loadNotifications() {
    if (!currentUser) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        
        const notifications = data.success ? data.notifications : (Array.isArray(data) ? data : []);
        renderNotifications(notifications);
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function renderNotifications(notifications) {
    if (!notificationList) return;
    
    if (!notifications || notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }
    
    notificationList.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
            <div class="notification-icon">${getNotificationIcon(n.title)}</div>
            <div class="notification-content">
                <div class="notification-title">${escapeHtml(n.title)}</div>
                <div class="notification-message">${escapeHtml(n.message)}</div>
                <div class="notification-time">${formatDate(n.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function getNotificationIcon(title) {
    if (!title) return '📢';
    if (title.includes('Confirmed')) return '✅';
    if (title.includes('Shipped')) return '🚚';
    if (title.includes('Delivered')) return '📦';
    if (title.includes('Completed')) return '✨';
    return '📢';
}

async function markNotificationRead(id) {
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
            method: 'PUT',
            headers: { 'x-auth-token': token }
        });
        loadNotifications();
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (panel) panel.classList.toggle('active');
    if (panel?.classList.contains('active')) {
        loadNotifications();
    }
}

// ============== LOCATION & ORDER ==============
function getUserLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }
    
    showLoading();
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                );
                const data = await response.json();
                
                let locationText = data.city || data.locality || data.town || data.village || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                if (data.principalSubdivision) locationText += `, ${data.principalSubdivision}`;
                if (data.countryName) locationText += `, ${data.countryName}`;
                
                const locationInput = document.getElementById('locationInput');
                if (locationInput) {
                    locationInput.value = locationText;
                    showToast(`📍 ${locationText.split(',')[0]}`, 'success');
                }
            } catch (error) {
                const locationInput = document.getElementById('locationInput');
                if (locationInput) {
                    locationInput.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                    showToast('📍 Location captured (coordinates)', 'success');
                }
            } finally {
                hideLoading();
            }
        },
        (error) => {
            let errorMsg = 'Failed to get location';
            if (error.code === 1) errorMsg = 'Please allow location access';
            else if (error.code === 2) errorMsg = 'Location unavailable';
            else if (error.code === 3) errorMsg = 'Location request timed out';
            showToast(errorMsg, 'error');
            hideLoading();
        }
    );
}

async function confirmOrder() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'confirmOrder');
        openLoginModal();
        return;
    }
    
    if (cart.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    
    const location = document.getElementById('locationInput')?.value;
    if (!location) {
        showToast('Please get your location first', 'warning');
        return;
    }
    
    if (!confirm('Confirm order? Payment will be made upon delivery.')) return;
    
    showLoading();
    try {
        const address = document.getElementById('addressInput')?.value;
        const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);
        
        const orderData = {
            customer_name: currentUser.full_name,
            phone: currentUser.phone,
            location: location,
            specific_address: address || '',
            products: cart.map(item => ({
                id: item.id,
                title: item.title,
                price: parseFloat(item.price),
                quantity: item.quantity || 1
            })),
            total_amount: total
        };
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            currentOrder = result.order;
            cart = [];
            saveCart();
            updateCartBadge();
            closeCartModal();
            showToast('✅ Order confirmed successfully!', 'success');
            
            // Load updated notifications
            loadNotifications();
            
            setTimeout(() => {
                showProfile();
            }, 2000);
        } else {
            throw new Error(result.message || 'Failed to create order');
        }
    } catch (error) {
        console.error('Order error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function orderViaWhatsApp() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'orderViaWhatsApp');
        openLoginModal();
        return;
    }
    
    if (cart.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    
    const location = document.getElementById('locationInput')?.value;
    if (!location) {
        showToast('Please get your location first', 'warning');
        return;
    }
    
    const itemsList = cart.map(item => 
        `• ${item.title} x${item.quantity || 1} = ${productController.formatPrice(parseFloat(item.price) * (item.quantity || 1))}`
    ).join('%0A');
    
    const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);
    const address = document.getElementById('addressInput')?.value || 'Not provided';
    
    const message = `*KUKU YETU - New Order*%0A%0A` +
        `*Customer:* ${currentUser.full_name}%0A` +
        `*Phone:* ${currentUser.phone}%0A` +
        `*Location:* ${location}%0A` +
        `*Address:* ${address}%0A%0A` +
        `*Items:*%0A${itemsList}%0A%0A` +
        `*Total:* ${productController.formatPrice(total)}%0A%0A` +
        `_Thank you for choosing KUKU YETU!_`;
    
    window.open(`https://wa.me/254112402377?text=${message}`, '_blank');
}

// ============== ORDER HISTORY ==============
async function viewOrderHistory() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    
    showLoading();
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        
        if (data.success) {
            displayOrderHistory(data.orders || []);
        } else {
            showToast('Failed to load order history', 'error');
        }
    } catch (error) {
        console.error('Failed to load order history:', error);
        showToast('Failed to load order history', 'error');
    } finally {
        hideLoading();
    }
}

function displayOrderHistory(orders) {
    if (!productsGrid) return;
    
    if (!orders || orders.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-orders">
                <i class="fas fa-shopping-bag"></i>
                <h3>No orders yet</h3>
                <p>Start shopping to see your orders here!</p>
                <button onclick="navigateTo('home')" class="btn-primary">Browse Products</button>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = `
        <div class="orders-list">
            <h2>My Orders</h2>
            ${orders.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-id">Order #${order.order_id || order.id}</span>
                        <span class="order-status ${order.status || 'pending'}">${order.status || 'pending'}</span>
                    </div>
                    <div class="order-body">
                        <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                        <p><strong>Total:</strong> ${productController.formatPrice(order.total_amount)}</p>
                        <p><strong>Location:</strong> ${order.location || 'N/A'}</p>
                        <button onclick="viewOrderDetails(${order.id})" class="btn-outline">View Details</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function viewOrderDetails(orderId) {
    showToast(`Order #${orderId} details - Coming soon`, 'info');
}

// ============== UI HELPERS ==============
function showLoading() {
    if (loadingSpinner) loadingSpinner.classList.add('active');
}

function hideLoading() {
    if (loadingSpinner) loadingSpinner.classList.remove('active');
}

function showToast(message, type = 'info') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// ============== EVENT LISTENERS ==============
function setupEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const closeMenu = document.getElementById('closeMenu');
    const notificationBtn = document.getElementById('notificationBtn');
    const closeNotifications = document.getElementById('closeNotifications');
    const searchInput = document.getElementById('searchInput');
    const whatsappBtn = document.getElementById('whatsappBtn');
    const supportBtn = document.getElementById('supportBtn');
    
    if (menuToggle) menuToggle.addEventListener('click', () => {
        document.getElementById('sideMenu')?.classList.add('active');
    });
    if (closeMenu) closeMenu.addEventListener('click', () => {
        document.getElementById('sideMenu')?.classList.remove('active');
    });
    if (notificationBtn) notificationBtn.addEventListener('click', toggleNotificationPanel);
    if (closeNotifications) closeNotifications.addEventListener('click', toggleNotificationPanel);
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => searchProducts(), 500);
        });
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('productModal')?.classList.remove('active');
            document.getElementById('cartModal')?.classList.remove('active');
            document.getElementById('loginModal')?.classList.remove('active');
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
        if (e.target.classList.contains('side-nav')) {
            e.target.classList.remove('active');
        }
    });
    
    if (whatsappBtn) whatsappBtn.addEventListener('click', () => {
        window.open('https://wa.me/254112402377', '_blank');
    });
    if (supportBtn) supportBtn.addEventListener('click', () => {
        window.open('https://wa.me/254112402377', '_blank');
    });
}

// ============== GLOBAL EXPOSURE ==============
window.productController = productController;
window.renderProducts = renderProducts;
window.filterProducts = filterProducts;
window.searchProducts = searchProducts;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.openCart = openCart;
window.closeCartModal = closeCartModal;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.proceedToCheckout = proceedToCheckout;
window.navigateTo = navigateTo;
window.showCategories = showCategories;
window.showFavorites = showFavorites;
window.showAbout = showAbout;
window.showProfile = showProfile;
window.viewOrderHistory = viewOrderHistory;
window.viewOrderDetails = viewOrderDetails;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.switchAuthTab = switchAuthTab;
window.getUserLocation = getUserLocation;
window.confirmOrder = confirmOrder;
window.orderViaWhatsApp = orderViaWhatsApp;
window.generateReceipt = () => showToast('Receipt generation coming soon', 'info');
window.toggleNotificationPanel = toggleNotificationPanel;
window.markNotificationRead = markNotificationRead;

console.log('✅ KUKU YETU main.js loaded successfully');
