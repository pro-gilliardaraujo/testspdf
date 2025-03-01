# HTTPS and Advanced Logging Setup Guide for Node.js

## Table of Contents
1. [Project Setup](#1-project-setup)
2. [Environment Configuration](#2-environment-configuration)
3. [Certificate Generation](#3-certificate-generation)
4. [Server Setup with Advanced Logging](#4-server-setup)
5. [Running the Server](#5-running-the-server)
6. [Production Deployment](#6-production-deployment)
7. [Example Logs](#7-example-logs)
8. [Security Best Practices](#8-security-best-practices)

## 1. Project Setup

```bash
mkdir my-secure-server
cd my-secure-server
npm init -y

# Install core dependencies
npm install express cors dotenv express-handlebars https fs path winston
```

## 2. Environment Configuration

Create `.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3001

# Security Configuration
ENABLE_HTTPS=true
```

## 3. Certificate Generation

Create `generate-cert.js`:

```javascript
const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

// Create certs directory if it doesn't exist
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

// Generate certificates
const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256'
});

// Save certificates
fs.writeFileSync(path.join(certsDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certsDir, 'key.pem'), pems.private);

console.log('Certificates generated successfully!');
```

Add to package.json:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "cert": "node generate-cert.js",
    "setup": "npm install && npm run cert"
  }
}
```

## 4. Server Setup

Create `server.js`:

```javascript
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const winston = require('winston');
require('dotenv').config();

// Initialize Winston Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type']
};

// Apply CORS
app.use(cors(corsOptions));

// Request Logging Middleware
app.use((req, res, next) => {
    logger.info('Incoming Request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        origin: req.get('origin') || 'N/A',
        userAgent: req.get('user-agent'),
        contentType: req.get('content-type'),
        body: Object.keys(req.body).length > 0 ? req.body : undefined
    });
    
    // Log request details in a pretty format for console
    console.log('\n[Request] ✨ Nova requisição recebida');
    console.log('[Request] 📡 Método:', req.method);
    console.log('[Request] 🔗 Path:', req.path);
    console.log('[Request] 🌐 IP:', req.ip);
    console.log('[Request] 🌍 Origin:', req.get('origin') || 'N/A');
    console.log('[Request] 📱 User-Agent:', req.get('user-agent'));
    console.log('[Request] 📄 Content-Type:', req.get('content-type'));
    
    if (Object.keys(req.body).length > 0) {
        console.log('[Request] 📦 Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Parse JSON bodies
app.use(express.json({ 
    limit: '50mb',
    type: ['application/json', 'text/plain']
}));

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Server Error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// HTTPS Configuration
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

// Start HTTPS server
const server = https.createServer(httpsOptions, app).listen(port, 'localhost', () => {
    logger.info(`Server started`, {
        port: port,
        environment: process.env.NODE_ENV
    });
    console.log(`\n🚀 Servidor HTTPS rodando em https://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
    });
});
```

## 5. Running the Server

```bash
# First time setup
npm run setup

# Development mode
npm run dev

# Production mode
npm start
```

## 6. Production Deployment

Create `deploy.sh`:

```bash
#!/bin/bash
echo "Iniciando deploy do servidor..."

# Stop current server
echo "Parando servidor atual..."
pm2 stop my-secure-server
pm2 delete my-secure-server

# Install dependencies
echo "Instalando dependências..."
npm install

# Start server with PM2
echo "Iniciando servidor..."
pm2 start server.js --name "my-secure-server"

# Save PM2 configuration
echo "Salvando configuração do PM2..."
pm2 save

# Show status
echo "Status do servidor:"
pm2 status

echo "Deploy concluído! O servidor está rodando."
```

## 7. Example Logs

### Successful Request Log
```json
{
  "level": "info",
  "message": "Incoming Request",
  "timestamp": "2024-03-14T12:34:56.789Z",
  "method": "POST",
  "path": "/api/data",
  "ip": "::1",
  "origin": "https://localhost:3000",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
  "contentType": "application/json"
}
```

### Error Log
```json
{
  "level": "error",
  "message": "Server Error",
  "timestamp": "2024-03-14T12:34:56.789Z",
  "error": "Database connection failed",
  "stack": "Error: Database connection failed\n    at Object...",
  "path": "/api/data",
  "method": "POST"
}
```

### Console Output Example
```
[Request] ✨ Nova requisição recebida
[Request] 📡 Método: POST
[Request] 🔗 Path: /api/data
[Request] 🌐 IP: ::1
[Request] 🌍 Origin: https://localhost:3000
[Request] 📱 User-Agent: PostmanRuntime/7.32.3
[Request] 📄 Content-Type: application/json
[Request] 📦 Body: {
  "key": "value",
  "timestamp": "2024-03-14T12:34:56.789Z"
}
```

## 8. Security Best Practices

1. **Certificate Management**
   - Use proper SSL certificates in production (Let's Encrypt)
   - Keep private keys secure
   - Rotate certificates regularly

2. **Security Headers**
   - Set appropriate CORS headers
   - Use Helmet.js for additional security headers
   - Enable HSTS in production

3. **Error Handling**
   - Never expose stack traces in production
   - Log errors with proper context
   - Use different log levels appropriately

4. **Production Considerations**
   - Use process manager (PM2)
   - Implement rate limiting
   - Set up monitoring and alerting
   - Regular security audits

5. **Development vs Production**
   - Use different configurations
   - More verbose logging in development
   - Sanitize sensitive data in logs 