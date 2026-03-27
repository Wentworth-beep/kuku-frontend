// POST create product - WITH CLOUDINARY UPLOAD
router.post('/', auth, upload.array('images', 10), async (req, res) => {
    try {
        console.log('📦 Creating product...');
        const { title, price, old_price, description, category, stock_status, rating } = req.body;
        
        if (!title || !price || !description || !category) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const product_id = generateProductId();
        
        // UPLOAD TO CLOUDINARY
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} image(s) to Cloudinary...`);
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer);
                    imageUrls.push(result.secure_url);
                    console.log('✅ Uploaded to Cloudinary:', result.secure_url);
                } catch (uploadErr) {
                    console.error('Cloudinary upload error:', uploadErr.message);
                }
            }
        }
        
        if (imageUrls.length === 0) {
            imageUrls.push('https://placehold.co/400x300/FF6B00/white?text=KUKU+YETU');
        }
        
        const result = await pool.query(
            `INSERT INTO products (product_id, title, price, old_price, description, category, stock_status, rating, images) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [product_id, title, price, old_price || null, description, category, stock_status || 'available', rating || 4, imageUrls]
        );
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('Create product error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});
