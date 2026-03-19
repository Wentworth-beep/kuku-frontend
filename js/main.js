// Global variables
let products = [];
let allProducts = []; // Store all products for filtering
let filteredProducts = [];
let cart = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentPage = 'home';
let currentProduct = null;
let currentOrder = null;
let notificationInterval = null;
let currentUser = null;

const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : window.API_BASE_URL || 'https://kuku-backend-ntr4.onrender.com/api';

// Pagination variables
let currentPageNumber = 1;
let productsPerPage = 6;

// Token management
function getAuthToken() {
    return localStorage.getItem("token");
}

let isLoading = false;
let hasMoreProducts = true;

// Image slider variable
let currentSlide = 0;
let slideInterval;

// Check for saved user on load
const savedUser = localStorage.getItem('user');
if (savedUser) {
    try {
        currentUser = JSON.parse(savedUser);
    } catch (e) {
        console.error('Error parsing saved user:', e);
    }
}

// DOM Elements
const loadingSpinner = document.getElementById('loading-spinner');
const menuToggle = document.getElementById('menuToggle');
const sideMenu = document.getElementById('sideMenu');
const closeMenu = document.getElementById('closeMenu');
const notificationBtn = document.getElementById('notificationBtn');
const notificationPanel = document.getElementById('notificationPanel');
const closeNotifications = document.getElementById('closeNotifications');
const notificationList = document.getElementById('notificationList');
const notificationBadge = document.getElementById('notificationBadge');
const searchInput = document.getElementById('searchInput');
const productsGrid = document.getElementById('productsGrid');
const productModal = document.getElementById('productModal');
const cartModal = document.getElementById('cartModal');
const loginModal = document.getElementById('loginModal');
const cartBtn = document.getElementById('cartBtn');
const cartBadge = document.getElementById('cartBadge');
const toastContainer = document.getElementById('toastContainer');
const whatsappBtn = document.getElementById('whatsappBtn');
const supportBtn = document.getElementById('supportBtn');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    requestNotificationPermission();
});

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

async function initApp() {
    showLoading();
    try {
        await loadAllProducts();
        setupEventListeners();
        await checkAuthAndRestoreSession();
        startNotificationPolling();
        loadCart();
        updateCartBadge();
        updateUIForLoggedInUser();
        
        window.addEventListener('scroll', handleInfiniteScroll);
        
        const redirect = sessionStorage.getItem('redirectAfterLogin');
        if (redirect && currentUser) {
            sessionStorage.removeItem('redirectAfterLogin');
            if (redirect === 'checkout') {
                const productId = sessionStorage.getItem('checkoutProductId');
                sessionStorage.removeItem('checkoutProductId');
                if (productId) proceedToCheckout(parseInt(productId));
            } else if (redirect === 'cart') {
                openCart();
            } else if (redirect === 'profile') {
                navigateTo('profile');
            }
        }
    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to initialize app', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAllProducts() {
    try {
        console.log('📦 Loading all products...');
        const response = await getProducts();
        console.log('📦 API Response:', response);
        
        if (response && response.success === true && response.products) {
            allProducts = response.products;
            console.log(`✅ Loaded ${allProducts.length} products from API`);
        } else if (Array.isArray(response)) {
            allProducts = response;
            console.log(`✅ Loaded ${allProducts.length} products from array`);
        } else {
            console.warn('Unexpected response format, using empty array');
            allProducts = [];
        }
        
        currentPageNumber = 1;
        hasMoreProducts = allProducts.length > productsPerPage;
        
        await loadProductsPage(1);
        
    } catch (error) {
        console.error('❌ Failed to load products:', error);
        showToast('Failed to load products', 'error');
        allProducts = [];
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="no-products" style="text-align: center; padding: 50px;">Failed to load products. Please refresh the page.</div>';
        }
    }
}

async function loadProductsPage(page) {
    if (!allProducts || allProducts.length === 0) {
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="no-products" style="text-align: center; padding: 50px;">No products available</div>';
        }
        return;
    }
    
    const start = (page - 1) * productsPerPage;
    const end = page * productsPerPage;
    const pageProducts = allProducts.slice(start, end);
    
    if (page === 1) {
        products = pageProducts;
        renderProducts(products);
    } else {
        products = [...products, ...pageProducts];
        appendProducts(pageProducts);
    }
    
    hasMoreProducts = end < allProducts.length;
    console.log(`📄 Page ${page}: Loaded ${pageProducts.length} products, more: ${hasMoreProducts}`);
}

function renderProducts(productsToRender) {
    if (!productsGrid) {
        console.error('Products grid not found');
        return;
    }
    
    console.log('Rendering products:', productsToRender?.length || 0);
    
    if (!productsToRender || productsToRender.length === 0) {
        productsGrid.innerHTML = '<div class="no-products" style="text-align: center; padding: 50px; font-size: 18px;">No products found</div>';
        return;
    }

    productsGrid.innerHTML = productsToRender.map(product => createProductCard(product)).join('');
    attachProductEventListeners();
    lazyLoadImages();
}

function appendProducts(newProducts) {
    if (!productsGrid) return;
    if (!newProducts || newProducts.length === 0) return;
    
    const newHTML = newProducts.map(product => createProductCard(product)).join('');
    productsGrid.innerHTML += newHTML;
    attachProductEventListeners();
    lazyLoadImages();
}

function lazyLoadImages() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const dataSrc = img.getAttribute('data-src');
                
                if (dataSrc) {
                    img.src = dataSrc;
                    img.removeAttribute('data-src');
                    img.classList.add('loaded');
                }
                
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// ============= PRODUCT CARD FUNCTION =============
function createProductCard(product) {
    const isFavorite = favorites.includes(product.id);
    let stockClass = 'available';
    let stockText = 'In stock';
    
    if (product.stock_status === 'low') {
        stockClass = 'low';
        stockText = 'Few units left';
    } else if (product.stock_status === 'out') {
        stockClass = 'out';
        stockText = 'Out of stock';
    }
    
    const placeholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 300 200\'%3E%3Crect width=\'300\' height=\'200\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' font-family=\'Arial\' font-size=\'16\' fill=\'%23999\' text-anchor=\'middle\' dy=\'.3em\'%3ELoading...%3C/text%3E%3C/svg%3E';
    
    // Fix image URL - handle weird formatting
    let imagePath = product.images && product.images[0] ? product.images[0] : '';
    // Remove extra braces if they exist
    if (imagePath.startsWith('{{') && imagePath.endsWith('}}')) {
        imagePath = imagePath.slice(1, -1);
    }
    
    const imageUrl = imagePath 
        ? 'https://kuku-backend-ntr4.onrender.com' + imagePath
        : '/assets/images/logo.png';
    
    return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img data-src="${imageUrl}" 
                     src="${placeholder}"
                     alt="${product.title || 'Product'}" 
                     class="lazy-image"
                     onerror="this.src='/assets/images/logo.png'">
                <span class="product-category">${product.category || 'Uncategorized'}</span>
                <span class="stock-status ${stockClass}">${stockText}</span>
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.title || 'Untitled'}</h3>
                <p class="product-description">${product.description ? product.description.substring(0, 60) + '...' : 'No description'}</p>
                <div class="product-price">
                    <span class="current-price">Ksh ${parseFloat(product.price || 0).toFixed(2)}</span>
                    ${product.old_price ? `<span class="old-price">Ksh ${parseFloat(product.old_price).toFixed(2)}</span>` : ''}
                </div>
                <div class="product-rating">
                    ${generateStars(product.rating || 0)}
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

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - Math.ceil(rating);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (halfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    return stars;
}

function handleInfiniteScroll() {
    if (isLoading || !hasMoreProducts) return;
    
    const scrollY = window.scrollY;
    const visibleHeight = window.innerHeight;
    const totalHeight = document.documentElement.scrollHeight;
    
    if (scrollY + visibleHeight >= totalHeight - 300) {
        loadMoreProducts();
    }
}

async function loadMoreProducts() {
    if (isLoading || !hasMoreProducts) return;
    
    isLoading = true;
    showBottomLoader();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    currentPageNumber++;
    await loadProductsPage(currentPageNumber);
    
    isLoading = false;
    hideBottomLoader();
}

function showBottomLoader() {
    let loader = document.getElementById('bottom-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'bottom-loader';
        loader.style.textAlign = 'center';
        loader.style.padding = '20px';
        loader.style.gridColumn = '1 / -1';
        loader.innerHTML = '<div class="spinner" style="width: 30px; height: 30px; margin: 0 auto;"></div><p>Loading more products...</p>';
        if (productsGrid) productsGrid.appendChild(loader);
    }
}

function hideBottomLoader() {
    const loader = document.getElementById('bottom-loader');
    if (loader) loader.remove();
}

function setupEventListeners() {
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (sideMenu) sideMenu.classList.add('active');
        });
    }

    if (closeMenu) {
        closeMenu.addEventListener('click', () => {
            if (sideMenu) sideMenu.classList.remove('active');
        });
    }

    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            if (notificationPanel) {
                notificationPanel.classList.toggle('active');
                if (notificationPanel.classList.contains('active')) {
                    loadNotifications();
                }
            }
        });
    }

    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            if (notificationPanel) notificationPanel.classList.remove('active');
        });
    }

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchProducts(e.target.value);
            }, 500);
        });
    }

    document.querySelectorAll('[data-filter]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = e.target.dataset.filter;
            filterProducts(filter);
        });
    });

    document.querySelectorAll('.footer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            navigateTo(page);
        });
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            if (productModal) productModal.classList.remove('active');
            if (cartModal) cartModal.classList.remove('active');
            if (loginModal) loginModal.classList.remove('active');
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchAuthTab(tab);
        });
    });

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openWhatsApp();
        });
    }

    if (supportBtn) {
        supportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://wa.me/+254112402377', '_blank');
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            navigateTo('cart');
        });
    }

    document.addEventListener('click', (e) => {
        if (sideMenu && sideMenu.classList.contains('active') && !sideMenu.contains(e.target) && !menuToggle.contains(e.target)) {
            sideMenu.classList.remove('active');
        }
        if (notificationPanel && notificationPanel.classList.contains('active') && !notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationPanel.classList.remove('active');
        }
    });
}

async function checkAuthAndRestoreSession() {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('✅ Session restored for:', currentUser.full_name);
        } catch (error) {
            console.log('Session restore failed');
            logout();
        }
    }
}

function updateUIForLoggedInUser() {
    if (currentUser) {
        const profileBtn = document.querySelector('.footer-btn[data-page="profile"] span');
        if (profileBtn) {
            profileBtn.textContent = currentUser.full_name.split(' ')[0];
        }
    }
}

function updateUIForLoggedOutUser() {
    const profileBtn = document.querySelector('.footer-btn[data-page="profile"] span');
    if (profileBtn) {
        profileBtn.textContent = 'Profile';
    }
}

async function filterProducts(category) {
    console.log('🔍 Filtering products for category:', category);
    
    showLoading();
    try {
        let filtered;
        if (category === 'all') {
            filtered = allProducts;
        } else {
            filtered = allProducts.filter(p => p.category === category);
        }
        
        renderProducts(filtered);
        
    } catch (error) {
        console.error('Filter error:', error);
        showToast('Failed to filter products', 'error');
    } finally {
        hideLoading();
    }
}

async function searchProducts(query) {
    if (!query.trim()) {
        renderProducts(products);
        return;
    }

    showLoading();
    try {
        const searchResults = allProducts.filter(p => 
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(query.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(query.toLowerCase()))
        );
        
        renderProducts(searchResults);
    } catch (error) {
        showToast('Search failed', 'error');
    } finally {
        hideLoading();
    }
}

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
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

async function openProductModal(productId) {
    showLoading();
    try {
        const product = allProducts.find(p => p.id === productId);
        if (!product) {
            throw new Error('Product not found');
        }
        currentProduct = product;
        renderProductModal(product);
        if (productModal) productModal.classList.add('active');
    } catch (error) {
        showToast('Failed to load product details', 'error');
    } finally {
        hideLoading();
    }
}

function renderProductModal(product) {
    const modalBody = document.getElementById('productModalBody');
    if (!modalBody) return;
    
    let imagesHtml = '';
    if (product.images && product.images.length > 0) {
        imagesHtml = `
            <div class="product-images">
                <div class="image-slider">
                    <div class="slider-container" id="imageSlider">
                        ${product.images.map(img => `<img src="https://kuku-backend-ntr4.onrender.com${img}" alt="${product.title}" onerror="this.src='/assets/images/logo.png'">`).join('')}
                    </div>
                    ${product.images.length > 1 ? `
                        <button class="slider-btn prev" onclick="slideImage(-1)"><i class="fas fa-chevron-left"></i></button>
                        <button class="slider-btn next" onclick="slideImage(1)"><i class="fas fa-chevron-right"></i></button>
                    ` : ''}
                </div>
                ${product.images.length > 1 ? `
                    <div class="image-dots" id="imageDots">
                        ${product.images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="product-detail">
            ${imagesHtml}
            <h2 class="product-full-title">${product.title}</h2>
            <div class="product-full-price">
                <span class="full-price">Ksh ${parseFloat(product.price).toFixed(2)}</span>
                ${product.old_price ? `<span class="full-old-price">Ksh ${parseFloat(product.old_price).toFixed(2)}</span>` : ''}
            </div>
            <div class="product-rating">
                ${generateStars(product.rating || 0)}
                <span class="rating-text">(${product.rating || 0})</span>
            </div>
            <p class="full-description">${product.description || 'No description available'}</p>
            <p><strong>Product ID:</strong> ${product.product_id || 'N/A'}</p>
            <div class="product-buttons">
                <button class="btn-save" onclick="saveForLater(${product.id})">
                    <i class="fas fa-heart"></i> Save for later
                </button>
                <button class="btn-checkout" onclick="proceedToCheckout(${product.id})">
                    <i class="fas fa-shopping-cart"></i> Proceed to Checkout
                </button>
            </div>
        </div>
    `;

    if (product.images && product.images.length > 1) {
        startImageSlider();
    }
}

function startImageSlider() {
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    slideInterval = setInterval(() => {
        slideImage(1);
    }, 3000);
}

function slideImage(direction) {
    const slider = document.getElementById('imageSlider');
    const dots = document.querySelectorAll('.dot');
    if (!slider || !dots.length) return;

    const totalSlides = slider.children.length;
    currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
    
    slider.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function goToSlide(index) {
    currentSlide = index;
    const slider = document.getElementById('imageSlider');
    const dots = document.querySelectorAll('.dot');
    
    if (slider) {
        slider.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
        } catch (e) {
            cart = [];
        }
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    if (!cartBadge) return;
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartBadge.textContent = totalItems;
    cartBadge.style.display = totalItems > 0 ? 'block' : 'none';
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.images ? product.images[0] : null,
            quantity: 1
        });
    }

    saveCart();
    showToast('Product added to cart', 'success');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    if (cartModal && cartModal.classList.contains('active')) {
        renderCart();
    }
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = (item.quantity || 1) + change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
        }
    }
}

function renderCart() {
    const cartBody = document.getElementById('cartModalBody');
    if (!cartBody) return;
    
    if (cart.length === 0) {
        cartBody.innerHTML = '<div class="empty-cart" style="text-align: center; padding: 40px;">Your cart is empty</div>';
        return;
    }

    const total = cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.quantity || 1)), 0);

    cartBody.innerHTML = `
        <div class="cart-items" style="max-height: 400px; overflow-y: auto;">
            ${cart.map(item => {
                // Fix cart image URL
                const cartImageUrl = item.image 
                    ? 'https://kuku-backend-ntr4.onrender.com' + item.image 
                    : '/assets/images/logo.png';
                return `
                    <div class="cart-item" style="display: flex; gap: 15px; padding: 15px; border-bottom: 1px solid #eee;">
                        <img src="${cartImageUrl}" 
                             alt="${item.title}" 
                             class="cart-item-image" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                        <div class="cart-item-details" style="flex: 1;">
                            <h4 style="margin: 0 0 5px 0;">${item.title}</h4>
                            <div style="font-weight: bold; color: var(--primary-color); margin-bottom: 10px;">Ksh ${parseFloat(item.price).toFixed(2)}</div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)" style="width: 30px; height: 30px;">-</button>
                                <span style="min-width: 30px; text-align: center;">${item.quantity || 1}</span>
                                <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)" style="width: 30px; height: 30px;">+</button>
                                <button onclick="removeFromCart(${item.id})" style="background: none; border: none; color: #f44336; margin-left: 10px;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold;">
                <span>Total:</span>
                <span>Ksh ${total.toFixed(2)}</span>
            </div>
        </div>
        <div class="location-section" style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0;">Delivery Location</h3>
                <button class="get-location-btn" onclick="getUserLocation()" style="padding: 8px 15px;">
                    <i class="fas fa-location-arrow"></i> Get Location
                </button>
            </div>
            <input type="text" class="location-input" id="locationInput" 
                   placeholder="Click 'Get Location' to auto-fill" readonly
                   style="width: 100%; padding: 12px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
            <textarea class="address-input" id="addressInput" 
                      placeholder="Enter specific address or notes for delivery"
                      style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; min-height: 80px;"></textarea>
        </div>
        <div class="cart-actions" style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn-confirm" onclick="confirmOrder()" style="padding: 15px; background: var(--primary-color); color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer;">
                <i class="fas fa-check"></i> Confirm Order (Pay on Delivery)
            </button>
            <button class="btn-whatsapp" onclick="orderViaWhatsApp()" style="padding: 15px; background: #25D366; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer;">
                <i class="fab fa-whatsapp"></i> Order via WhatsApp
            </button>
            <button class="btn-generate" onclick="generateReceipt()" style="padding: 15px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer;">
                <i class="fas fa-file-pdf"></i> Generate Receipt
            </button>
        </div>
    `;
}

function openCart() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'cart');
        openLoginModal();
        return;
    }
    renderCart();
    if (cartModal) cartModal.classList.add('active');
}

function openLoginModal() {
    if (loginModal) {
        loginModal.classList.add('active');
        switchAuthTab('login');
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.id === tab + 'Form');
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            currentUser = data.user;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            if (loginModal) loginModal.classList.remove('active');
            updateUIForLoggedInUser();
            showToast(`Welcome back, ${currentUser.full_name}!`, 'success');
            
            const redirect = sessionStorage.getItem('redirectAfterLogin');
            if (redirect) {
                sessionStorage.removeItem('redirectAfterLogin');
                if (redirect === 'cart') openCart();
                else if (redirect === 'profile') navigateTo('profile');
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
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
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
            headers: {
                'Content-Type': 'application/json'
            },
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
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    
    currentUser = null;
    cart = [];
    
    updateUIForLoggedOutUser();
    updateCartBadge();
    navigateTo('home');
    showToast('Logged out successfully', 'success');
}

function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.footer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    switch(page) {
        case 'home':
            renderProducts(products);
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
    }
}

function showCategories() {
    if (!productsGrid) return;
    
    const categories = ['broilers', 'layers', 'eggs', 'chicks'];
    productsGrid.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px;">
            ${categories.map(cat => `
                <div onclick="filterProducts('${cat}')" style="background: white; padding: 30px; text-align: center; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.3s;">
                    <i class="fas fa-${cat === 'eggs' ? 'egg' : cat === 'chicks' ? 'crow' : 'drumstick-bite'}" style="font-size: 50px; color: var(--primary-color); margin-bottom: 15px;"></i>
                    <h3 style="text-transform: capitalize;">${cat}</h3>
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
    
    const favoriteProducts = allProducts.filter(p => favorites.includes(p.id));
    if (favoriteProducts.length === 0) {
        productsGrid.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <i class="fas fa-heart" style="font-size: 80px; color: #ccc; margin-bottom: 20px;"></i>
                <h3>No favorites yet</h3>
                <p style="color: #666; margin-bottom: 20px;">Save your favorite products to see them here!</p>
                <button onclick="navigateTo('home')" class="btn-primary">Browse Products</button>
            </div>
        `;
    } else {
        renderProducts(favoriteProducts);
    }
}

function showAbout() {
    productsGrid.innerHTML = `
        <div class="about-page" style="max-width: 800px; margin: 0 auto; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: var(--primary-color); margin-bottom: 20px;">About KUKU YETU</h2>
            <p style="margin-bottom: 20px; line-height: 1.8;">Welcome to KUKU YETU, your premier destination for high-quality poultry products. We specialize in providing the best broilers, layers, eggs, and chicks to our valued customers.</p>
            
            <h3 style="margin: 30px 0 15px; color: var(--primary-dark);">Contact Us</h3>
            <p style="margin: 10px 0;"><i class="fas fa-envelope" style="color: var(--primary-color); width: 30px;"></i> Email: info@kukuyetu.com</p>
            <p style="margin: 10px 0;"><i class="fas fa-phone" style="color: var(--primary-color); width: 30px;"></i> Phone: +254 700 000000</p>
            <p style="margin: 10px 0;"><i class="fas fa-phone-alt" style="color: var(--primary-color); width: 30px;"></i> Alternative: +254 711 000000</p>
            
            <h3 style="margin: 30px 0 15px; color: var(--primary-dark);">Our Location</h3>
            <p style="margin: 10px 0;"><i class="fas fa-map-marker-alt" style="color: var(--primary-color); width: 30px;"></i> Nairobi, Kenya</p>
            
            <h3 style="margin: 30px 0 15px; color: var(--primary-dark);">Business Hours</h3>
            <p style="margin: 10px 0;"><i class="far fa-clock" style="color: var(--primary-color); width: 30px;"></i> Monday - Friday: 8:00 AM - 6:00 PM</p>
            <p style="margin: 10px 0;"><i class="far fa-clock" style="color: var(--primary-color); width: 30px;"></i> Saturday: 9:00 AM - 4:00 PM</p>
            <p style="margin: 10px 0;"><i class="far fa-clock" style="color: var(--primary-color); width: 30px;"></i> Sunday: Closed</p>
        </div>
    `;
}

function showProfile() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'profile');
        openLoginModal();
        return;
    }

    productsGrid.innerHTML = `
        <div class="profile-page" style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: var(--primary-color); margin-bottom: 20px;">My Profile</h2>
            
            <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="width: 100px; height: 100px; background: var(--primary-color); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-user" style="font-size: 50px; color: white;"></i>
                    </div>
                    <h3 style="font-size: 24px; margin-bottom: 5px;">${currentUser.full_name}</h3>
                    <p style="color: #666;">Member since ${new Date().toLocaleDateString()}</p>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <p style="margin: 10px 0;"><strong><i class="fas fa-envelope" style="color: var(--primary-color); margin-right: 10px;"></i> Email:</strong> ${currentUser.email}</p>
                    <p style="margin: 10px 0;"><strong><i class="fas fa-phone" style="color: var(--primary-color); margin-right: 10px;"></i> Phone:</strong> ${currentUser.phone}</p>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="viewOrderHistory()" style="flex: 1; padding: 12px; background: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-history"></i> Order History
                    </button>
                    <button onclick="logout()" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        </div>
    `;
}

function saveForLater(productId) {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'saveForLater');
        sessionStorage.setItem('saveProductId', productId);
        openLoginModal();
        return;
    }

    if (!favorites.includes(productId)) {
        favorites.push(productId);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        showToast('Product saved to favorites', 'success');
    } else {
        favorites = favorites.filter(id => id !== productId);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        showToast('Product removed from favorites', 'info');
    }
}

function proceedToCheckout(productId) {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'checkout');
        sessionStorage.setItem('checkoutProductId', productId);
        openLoginModal();
        return;
    }
    addToCart(productId);
    if (productModal) productModal.classList.remove('active');
    openCart();
}

function startNotificationPolling() {
    if (!currentUser) return;
    
    loadNotifications();
    
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }
    notificationInterval = setInterval(loadNotifications, 10000);
}

async function loadNotifications() {
    if (!currentUser) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        const data = await response.json();
        console.log('Notifications loaded:', data);
        
        let notifications = [];
        if (data.success && data.notifications) {
            notifications = data.notifications;
        } else if (Array.isArray(data)) {
            notifications = data;
        } else if (data.notifications) {
            notifications = data.notifications;
        }
        
        renderNotifications(notifications);
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        
        if (unreadCount > 0 && Notification.permission === 'granted') {
            const lastCount = parseInt(localStorage.getItem('lastNotificationCount') || '0');
            if (unreadCount > lastCount) {
                new Notification('KUKU YETU', {
                    body: `You have ${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`,
                    icon: '/assets/images/logo.png'
                });
            }
            localStorage.setItem('lastNotificationCount', unreadCount.toString());
        }
        
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function updateNotificationBadge(count) {
    if (notificationBadge) {
        notificationBadge.textContent = count;
        notificationBadge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function renderNotifications(notifications) {
    if (!notificationList) return;
    
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications" style="text-align: center; padding: 30px; color: #999;">No notifications</div>';
        return;
    }

    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" 
             onclick="openNotification(${notification.id})"
             data-id="${notification.id}"
             style="padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.3s; ${!notification.is_read ? 'background: #e8f5e9; border-left: 4px solid #4caf50;' : ''}">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 24px;">
                    ${getNotificationIcon(notification.title)}
                </div>
                <div style="flex: 1;">
                    <div class="notification-title" style="font-weight: bold; margin-bottom: 5px; color: #333;">
                        ${notification.title || 'Notification'}
                    </div>
                    <div class="notification-message" style="color: #666; margin-bottom: 5px; font-size: 14px;">
                        ${notification.message || ''}
                    </div>
                    <div class="notification-time" style="font-size: 12px; color: #999;">
                        ${formatDate(notification.created_at)}
                    </div>
                </div>
                ${!notification.is_read ? '<span style="background: #4caf50; width: 10px; height: 10px; border-radius: 50%;"></span>' : ''}
            </div>
        </div>
    `).join('');
}

function getNotificationIcon(title) {
    if (!title) return '📢';
    if (title.includes('Confirmed') || title.includes('confirmed')) {
        return '✅';
    } else if (title.includes('Shipped') || title.includes('shipped')) {
        return '🚚';
    } else if (title.includes('Delivered') || title.includes('delivered')) {
        return '📦';
    } else if (title.includes('Completed') || title.includes('completed')) {
        return '✨';
    } else if (title.includes('Cancelled') || title.includes('cancelled')) {
        return '❌';
    } else if (title.includes('Order')) {
        return '🛒';
    } else {
        return '📢';
    }
}

async function openNotification(notificationId) {
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'x-auth-token': token
            }
        });
        
        const notificationElement = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (notificationElement) {
            notificationElement.classList.remove('unread');
            notificationElement.classList.add('read');
            notificationElement.style.background = 'white';
            notificationElement.style.borderLeft = 'none';
            
            const dot = notificationElement.querySelector('span:last-child');
            if (dot) dot.remove();
        }
        
        loadNotifications();
        
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

function openWhatsApp() {
    const message = "Hello KUKU YETU, I'd like to know more about your products.";
    window.open(`https://wa.me/+254112402377?text=${encodeURIComponent(message)}`, '_blank');
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
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

function attachProductEventListeners() {
    // Handled by onclick attributes
}

function getUserLocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('Location data:', data);
                        
                        let locationText = '';
                        
                        if (data.city) {
                            locationText = data.city;
                        } else if (data.locality) {
                            locationText = data.locality;
                        } else if (data.town) {
                            locationText = data.town;
                        } else if (data.village) {
                            locationText = data.village;
                        }
                        
                        if (data.principalSubdivision) {
                            locationText += locationText ? `, ${data.principalSubdivision}` : data.principalSubdivision;
                        }
                        
                        if (data.countryName) {
                            locationText += locationText ? `, ${data.countryName}` : data.countryName;
                        }
                        
                        if (!locationText && data.localityInfo) {
                            const parts = [];
                            if (data.localityInfo.informative) {
                                const informative = data.localityInfo.informative;
                                if (informative.length >= 3) {
                                    parts.push(informative[informative.length-3].name);
                                    parts.push(informative[informative.length-2].name);
                                    parts.push(informative[informative.length-1].name);
                                }
                            }
                            locationText = parts.join(', ');
                        }
                        
                        if (!locationText) {
                            locationText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                        }
                        
                        const locationInput = document.getElementById('locationInput');
                        if (locationInput) {
                            locationInput.value = locationText;
                            showToast(`📍 ${locationText.split(',')[0]}`, 'success');
                        }
                    } else {
                        throw new Error('API response not OK');
                    }
                } catch (error) {
                    console.error('Geocoding error:', error);
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
                console.error('Geolocation error:', error);
                let errorMessage = 'Failed to get location: ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Please allow location access';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out';
                        break;
                    default:
                        errorMessage += error.message;
                }
                showToast(errorMessage, 'error');
                hideLoading();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showToast('Geolocation is not supported by your browser', 'error');
    }
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

    const locationInput = document.getElementById('locationInput');
    const addressInput = document.getElementById('addressInput');
    
    const location = locationInput?.value;
    const address = addressInput?.value;

    if (!location) {
        showToast('Please get your location first', 'warning');
        return;
    }

    if (!confirm('Confirm order? Payment will be made upon delivery.')) {
        return;
    }

    showLoading();
    try {
        const total = cart.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 1;
            return sum + (price * qty);
        }, 0);

        const orderData = {
            customer_name: currentUser.full_name,
            phone: currentUser.phone,
            alternative_phone: '',
            location: location,
            specific_address: address || '',
            products: cart.map(item => ({
                id: item.id,
                title: item.title,
                price: parseFloat(item.price) || 0,
                quantity: parseInt(item.quantity) || 1
            })),
            total_amount: total
        };

        console.log('Sending order data:', JSON.stringify(orderData, null, 2));

        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        console.log('Order response:', result);
        
        if (response.ok && result.success) {
            currentOrder = result.order;
            
            cart = [];
            saveCart();
            updateCartBadge();
            
            if (cartModal) cartModal.classList.remove('active');
            showToast('✅ Order confirmed successfully!', 'success');
            
            showToast(`Order #${currentOrder.order_id} has been placed!`, 'success');
            
            setTimeout(() => {
                navigateTo('profile');
                viewOrderHistory();
            }, 2000);
            
        } else {
            throw new Error(result.message || 'Failed to create order');
        }
        
    } catch (error) {
        console.error('Order confirmation error:', error);
        showToast('❌ Failed to confirm order: ' + error.message, 'error');
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

    const locationInput = document.getElementById('locationInput');
    const addressInput = document.getElementById('addressInput');
    
    const location = locationInput?.value;
    const address = addressInput?.value;

    if (!location) {
        showToast('Please get your location first', 'warning');
        return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-KE', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString('en-KE', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const itemsList = cart.map(item => 
        `• ${item.title} x${item.quantity || 1} = Ksh ${((parseFloat(item.price) || 0) * (item.quantity || 1)).toFixed(2)}`
    ).join('%0A');

    const total = cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.quantity || 1)), 0);

    const message = 
        `*KUKU YETU - New Order*%0A%0A` +
        `━━━━━━━━━━━━━━━━━━━━━%0A` +
        `*CUSTOMER DETAILS*%0A` +
        `━━━━━━━━━━━━━━━━━━━━━%0A` +
        `👤 *Name:* ${currentUser.full_name}%0A` +
        `📞 *Phone:* ${currentUser.phone}%0A` +
        `📧 *Email:* ${currentUser.email}%0A` +
        `📍 *Location:* ${location}%0A` +
        `${address ? `📝 *Notes:* ${address}%0A` : ''}` +
        `━━━━━━━━━━━━━━━━━━━━━%0A` +
        `*ORDER DETAILS*%0A` +
        `━━━━━━━━━━━━━━━━━━━━━%0A` +
        `📅 *Date:* ${dateStr} at ${timeStr}%0A` +
        `%0A*ITEMS ORDERED:*%0A` +
        `${itemsList}%0A` +
        `━━━━━━━━━━━━━━━━━━━━━%0A` +
        `*TOTAL: Ksh ${total.toFixed(2)}*%0A` +
        `━━━━━━━━━━━━━━━━━━━━━%0A%0A` +
        `_Thank you for choosing KUKU YETU!_%0A` +
        `_We'll process your order shortly._`;

    window.open(`https://wa.me/+254112402377?text=${message}`, '_blank');
}

function generateReceipt() {
    if (!currentUser) {
        sessionStorage.setItem('redirectAfterLogin', 'generateReceipt');
        openLoginModal();
        return;
    }

    if (cart.length === 0 && !currentOrder) {
        showToast('No order to generate receipt for', 'warning');
        return;
    }

    if (currentOrder) {
        generateOrderReceipt(currentOrder);
    } else {
        if (confirm('Generate receipt for items in cart? Note: This is not a confirmed order.')) {
            generateCartReceipt();
        }
    }
}

function generateOrderReceipt(order) {
    showLoading();
    
    setTimeout(() => {
        try {
            const receipt = generateReceiptHTML(order);
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Order Receipt - KUKU YETU</title>
                        <style>
                            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; margin: 0; background: #f5f5f5; }
                            .receipt { max-width: 800px; margin: 20px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2e7d32; padding-bottom: 20px; }
                            .header h1 { color: #2e7d32; margin: 0; font-size: 32px; }
                            .header p { color: #666; margin: 5px 0; }
                            .order-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                            .order-info p { margin: 5px 0; }
                            .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; text-transform: capitalize; }
                            .status-badge.pending { background: #fff3e0; color: #ff9800; }
                            .status-badge.confirmed { background: #e3f2fd; color: #2196f3; }
                            .status-badge.shipped { background: #f3e5f5; color: #9c27b0; }
                            .status-badge.delivered { background: #e8f5e9; color: #4caf50; }
                            .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
                            .status-badge.cancelled { background: #ffebee; color: #f44336; }
                            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            th { background: #2e7d32; color: white; padding: 12px; text-align: left; }
                            td { padding: 12px; border-bottom: 1px solid #ddd; }
                            .total { font-size: 1.3em; font-weight: bold; text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #333; }
                            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; }
                            .signature { display: flex; justify-content: space-between; margin-top: 40px; }
                            .signature div { text-align: center; }
                            .signature-line { width: 200px; border-top: 1px solid #333; margin-top: 40px; }
                            @media print {
                                body { background: white; }
                                .receipt { box-shadow: none; margin: 0; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        ${receipt}
                        <div class="no-print" style="text-align: center; margin-top: 20px;">
                            <button onclick="window.print()" style="padding: 10px 30px; background: #2e7d32; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-right: 10px;">🖨️ Print Receipt</button>
                            <button onclick="window.close()" style="padding: 10px 30px; background: #666; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">✖️ Close</button>
                        </div>
                    </body>
                </html>
            `);
            printWindow.document.close();
            
            hideLoading();
            showToast('Receipt generated successfully', 'success');
        } catch (error) {
            console.error('Receipt generation error:', error);
            hideLoading();
            showToast('Failed to generate receipt', 'error');
        }
    }, 1000);
}

function generateReceiptHTML(order) {
    const date = order.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString();
    let products = [];
    
    try {
        products = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
    } catch (e) {
        products = [];
    }
    
    const subtotal = products.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.quantity || 1)), 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    const isPaid = order.status === 'delivered' || order.status === 'completed';
    const paymentStatus = isPaid ? '✅ PAID' : '⏳ PENDING';

    return `
        <div class="receipt">
            <div class="header">
                <h1>🐔 KUKU YETU</h1>
                <p>Premium Poultry Products</p>
                <p style="font-size: 18px; font-weight: bold;">OFFICIAL RECEIPT</p>
                <p>Receipt #: ${order.order_id || 'N/A'}</p>
                <p>Date: ${date}</p>
            </div>
            
            <div class="order-info">
                <h3 style="margin-top: 0; display: flex; justify-content: space-between;">
                    <span>Order Status:</span> 
                    <span class="status-badge ${order.status || 'pending'}">${(order.status || 'pending').toUpperCase()}</span>
                </h3>
                <p><strong>Customer:</strong> ${order.customer_name || currentUser?.full_name || 'N/A'}</p>
                <p><strong>Phone:</strong> ${order.phone || currentUser?.phone || 'N/A'}</p>
                <p><strong>Email:</strong> ${currentUser?.email || 'N/A'}</p>
                <p><strong>Delivery Location:</strong> ${order.location || 'Not specified'}</p>
                ${order.specific_address ? `<p><strong>Address Details:</strong> ${order.specific_address}</p>` : ''}
                <p><strong>Payment Status:</strong> ${paymentStatus}</p>
            </div>
            
            <h3>Order Items</h3>
            <table>
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(item => `
                        <tr>
                            <td>${item.title || 'Product'}</td>
                            <td>${item.quantity || 1}</td>
                            <td>Ksh ${(parseFloat(item.price) || 0).toFixed(2)}</td>
                            <td>Ksh ${((parseFloat(item.price) || 0) * (item.quantity || 1)).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="text-align: right; margin-top: 20px;">
                <p><strong>Subtotal:</strong> Ksh ${subtotal.toFixed(2)}</p>
                <p><strong>VAT (16%):</strong> Ksh ${tax.toFixed(2)}</p>
                <p style="font-size: 1.3em; font-weight: bold; border-top: 2px solid #333; padding-top: 10px;">
                    <strong>TOTAL AMOUNT:</strong> Ksh ${total.toFixed(2)}
                </p>
            </div>
            
            <div style="margin: 40px 0;">
                <p><strong>Amount in words:</strong> ${numberToWords(total)}</p>
            </div>
            
            <div class="signature">
                <div>
                    <div class="signature-line"></div>
                    <p>Customer Signature</p>
                </div>
                <div>
                    <div class="signature-line"></div>
                    <p>Authorized Signature</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing KUKU YETU!</p>
                <p>This is a computer generated receipt. No signature required.</p>
                <p>For any inquiries, please contact us:</p>
                <p>📧 support@kukuyetu.com | 📞 +254112402377 | 📍 Nairobi, Kenya</p>
            </div>
        </div>
    `;
}

function generateCartReceipt() {
    if (!currentUser || cart.length === 0) return;
    
    const mockOrder = {
        order_id: 'CART-' + Date.now(),
        customer_name: currentUser.full_name,
        phone: currentUser.phone,
        location: document.getElementById('locationInput')?.value || 'Not specified',
        specific_address: document.getElementById('addressInput')?.value,
        products: cart,
        status: 'pending',
        created_at: new Date().toISOString()
    };
    
    generateOrderReceipt(mockOrder);
}

function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);
    
    function convertDollars(n) {
        if (n === 0) return 'Zero';
        if (n < 10) return ones[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertDollars(n % 100) : '');
        return 'Number too large';
    }
    
    return `${convertDollars(dollars)} Dollar${dollars !== 1 ? 's' : ''} and ${cents} Cent${cents !== 1 ? 's' : ''}`;
}

async function viewOrderHistory() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
            headers: {
                'x-auth-token': localStorage.getItem('token')
            }
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
    if (!orders || orders.length === 0) {
        productsGrid.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <i class="fas fa-shopping-bag" style="font-size: 80px; color: #ccc; margin-bottom: 20px;"></i>
                <h3>No orders yet</h3>
                <p style="color: #666; margin-bottom: 20px;">Start shopping to see your orders here!</p>
                <button onclick="navigateTo('home')" class="btn-primary">Browse Products</button>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <h2 style="color: var(--primary-color); margin-bottom: 20px;">My Orders</h2>
            ${orders.map(order => {
                const productsList = order.products || [];
                
                return `
                    <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <strong>Order #${order.order_id}</strong>
                                <span style="color: #666; margin-left: 10px;">${order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}</span>
                            </div>
                            <span class="status-badge ${order.status}" style="padding: 5px 15px; border-radius: 20px;">${order.status}</span>
                        </div>
                        <p><strong>Items:</strong> ${productsList.map(p => p.title).join(', ')}</p>
                        <p><strong>Total:</strong> Ksh ${parseFloat(order.total_amount || 0).toFixed(2)}</p>
                        <p><strong>Delivery Location:</strong> ${order.location || 'N/A'}</p>
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button onclick="viewOrderDetails(${order.id})" style="padding: 8px 20px; background: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                                View Details
                            </button>
                            <button onclick='generateOrderReceipt(${JSON.stringify(order).replace(/'/g, "\\'")})' style="padding: 8px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                <i class="fas fa-file-pdf"></i> Receipt
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function viewOrderDetails(orderId) {
    showToast('View order details: ' + orderId, 'info');
}

async function getProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        return { success: false, products: [] };
    }
}

window.openProductModal = openProductModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.slideImage = slideImage;
window.goToSlide = goToSlide;
window.saveForLater = saveForLater;
window.proceedToCheckout = proceedToCheckout;
window.getUserLocation = getUserLocation;
window.confirmOrder = confirmOrder;
window.orderViaWhatsApp = orderViaWhatsApp;
window.generateReceipt = generateReceipt;
window.generateOrderReceipt = generateOrderReceipt;
window.logout = logout;
window.navigateTo = navigateTo;
window.filterProducts = filterProducts;
window.viewOrderHistory = viewOrderHistory;
window.openNotification = openNotification;
