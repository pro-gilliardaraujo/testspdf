require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const corsOptions = require('./config/cors');
const tratativaRoutes = require('./routes/tratativa.routes');

const app = express();

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos temporários
app.use('/temp', express.static(path.join(process.cwd(), 'temp')));

// Request logging middleware
app.use((req, res, next) => {
    logger.info('Incoming Request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        origin: req.get('origin') || 'N/A',
        userAgent: req.get('user-agent')
    });
    next();
});

// Routes
app.use('/api/tratativa', tratativaRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Server Error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    
    res.status(500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
});

const PORT = process.env.PORT || 3000;

// HTTPS configuration
const httpsOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH)
};

// Create HTTPS server
const server = https.createServer(httpsOptions, app);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server started on port ${PORT}`);
    console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
    });
}); 