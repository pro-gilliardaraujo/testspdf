const winston = require('winston');

// Emojis para diferentes tipos de logs
const logEmojis = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    http: '🌐',
    verbose: '📝',
    debug: '🔍',
    silly: '🎈'
};

// Cores para diferentes tipos de logs
const logColors = {
    error: '\x1b[31m', // Vermelho
    warn: '\x1b[33m',  // Amarelo
    info: '\x1b[36m',  // Ciano
    http: '\x1b[35m',  // Magenta
    verbose: '\x1b[32m', // Verde
    debug: '\x1b[34m',   // Azul
    silly: '\x1b[37m'    // Branco
};

// Reset de cor
const resetColor = '\x1b[0m';

// Função para criar uma linha separadora
const createSeparator = (length = 50) => '─'.repeat(length);

// Função para formatar o timestamp
const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
};

// Formato personalizado para console
const customConsoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const emoji = logEmojis[level] || '📋';
    const color = logColors[level] || '';
    const ts = formatTimestamp(timestamp);
    
    let output = `\n${createSeparator()}\n`;
    output += `${color}${emoji} [${ts}] ${level.toUpperCase()}${resetColor}\n`;
    
    // Adiciona o título da operação
    if (metadata.operation) {
        output += `📌 Operação: ${metadata.operation}\n`;
    }

    // Adiciona a mensagem principal
    output += `📢 Mensagem: ${message}\n`;

    // Adiciona detalhes da requisição se disponíveis
    if (metadata.request) {
        output += '📥 Detalhes da Requisição:\n';
        output += `   • Método: ${metadata.request.method}\n`;
        output += `   • Path: ${metadata.request.path}\n`;
        output += `   • IP: ${metadata.request.ip}\n`;
        if (metadata.request.body) {
            output += `   • Body: ${JSON.stringify(metadata.request.body, null, 2)}\n`;
        }
    }

    // Adiciona detalhes da resposta se disponíveis
    if (metadata.response) {
        output += '📤 Detalhes da Resposta:\n';
        output += `   • Status: ${metadata.response.status}\n`;
        output += `   • Dados: ${JSON.stringify(metadata.response.data, null, 2)}\n`;
    }

    // Adiciona detalhes do erro se disponíveis
    if (metadata.error) {
        output += '🚨 Detalhes do Erro:\n';
        output += `   • Mensagem: ${metadata.error.message}\n`;
        if (metadata.error.stack) {
            output += `   • Stack: ${metadata.error.stack}\n`;
        }
    }

    // Adiciona metadados adicionais
    if (Object.keys(metadata).length > 0) {
        const filteredMetadata = { ...metadata };
        ['operation', 'request', 'response', 'error'].forEach(key => delete filteredMetadata[key]);
        
        if (Object.keys(filteredMetadata).length > 0) {
            output += '📋 Metadados Adicionais:\n';
            output += `${JSON.stringify(filteredMetadata, null, 2)}\n`;
        }
    }

    output += `${createSeparator()}\n`;
    return output;
});

// Configuração do logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

// Adiciona transporte de console em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            customConsoleFormat
        )
    }));
}

// Wrapper functions para logging mais estruturado
const enhancedLogger = {
    error: (message, metadata = {}) => {
        logger.error(message, metadata);
    },
    warn: (message, metadata = {}) => {
        logger.warn(message, metadata);
    },
    info: (message, metadata = {}) => {
        logger.info(message, metadata);
    },
    http: (message, metadata = {}) => {
        logger.http(message, metadata);
    },
    debug: (message, metadata = {}) => {
        logger.debug(message, metadata);
    },
    // Funções específicas para operações comuns
    logRequest: (req, operation = 'Requisição Recebida') => {
        logger.info(operation, {
            operation,
            request: {
                method: req.method,
                path: req.path,
                ip: req.ip,
                headers: req.headers,
                body: req.body
            }
        });
    },
    logResponse: (operation, responseData) => {
        logger.info(operation, {
            operation,
            response: responseData
        });
    },
    logError: (operation, error, request = null) => {
        logger.error(operation, {
            operation,
            error: {
                message: error.message,
                stack: error.stack
            },
            request: request ? {
                method: request.method,
                path: request.path,
                ip: request.ip
            } : null
        });
    }
};

module.exports = enhancedLogger; 