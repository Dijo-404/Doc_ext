const express = require('express');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// N8N Webhook URLs
// Use webhook-test when testing in n8n editor, use webhook when workflow is activated
const N8N_WEBHOOK_URL = process.env.N8N_PROD === 'true'
    ? 'http://localhost:5678/webhook/upload-marksheet'
    : 'http://localhost:5678/webhook-test/upload-marksheet';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.'));
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to upload marksheet and extract data
app.post('/api/extract', upload.single('marksheet'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('📁 File uploaded:', req.file.originalname, '| Type:', req.file.mimetype);

        // Read the uploaded file
        const filePath = req.file.path;

        // Create form data with the file
        const formData = new FormData();
        formData.append('data', fs.createReadStream(filePath), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        console.log('📤 Sending to n8n webhook...');

        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            body: formData,
            headers: {
                ...formData.getHeaders()
            }
        });

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        const responseText = await response.text();
        console.log('📥 N8N Response status:', response.status);

        if (!response.ok) {
            console.error('❌ N8N Error:', responseText);
            return res.status(500).json({
                error: 'Failed to process marksheet',
                details: responseText
            });
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { raw: responseText };
        }

        console.log('✅ Extraction complete');

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            error: 'Server error',
            message: error.message
        });
    }
});

// Test endpoint to check n8n connection
app.get('/api/test-n8n', async (req, res) => {
    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
        });
        const text = await response.text();
        res.json({
            status: response.status,
            ok: response.ok,
            response: text
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log('');
    console.log('🚀 Marksheet Extractor Server');
    console.log('═══════════════════════════════════════');
    console.log(`📍 Frontend:     http://localhost:${PORT}`);
    console.log(`📍 N8N Webhook:  ${N8N_WEBHOOK_URL}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('⚠️  Make sure n8n workflow is ACTIVATED!');
    console.log('');
});
