import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes.js';

const app = express();

// CORS configuration
const corsOptions = {
    origin: function(origin, callback) {
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // In production, only allow specific origins
        const allowedOrigins = ['https://your-production-domain.com'];

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('Origin not allowed:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Apply CORS first, before any other middleware
app.use(cors(corsOptions));

// Other middleware
app.use(express.json());
app.use(cookieParser());

// Security headers middleware
app.use((req, res, next) => {
    // Security headers only - CORS is handled by cors middleware
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
    next();
});

// Add debug logging for all requests
app.use((req, res, next) => {
    next();
});

// Request logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// Add debug logging for routes
function registerRoutes(app, routes) {
    routes.forEach(route => {
        app[route.method](route.path, route.handler);
    });
}

// Route handler
app.use((req, res, next) => {
    // Convert route path pattern to regex
    const route = routes.find(r => {
        const routePattern = new RegExp('^' + r.path.replace(/:(\w+)/g, '([^/]+)') + '$');
        return routePattern.test(req.path) && r.method === req.method.toLowerCase();
    });

    if (!route) {
        return res.status(404).json({
            error: 'Route not found',
            path: req.path,
            method: req.method
        });
    }

    // Extract parameters from URL
    const routePattern = new RegExp('^' + route.path.replace(/:(\w+)/g, '([^/]+)') + '$');
    const matches = req.path.match(routePattern);
    if (matches) {
        const paramNames = (route.path.match(/:(\w+)/g) || []).map(name => name.slice(1));
        paramNames.forEach((name, index) => {
            req.params[name] = matches[index + 1];
        });
    }

    // If there is middleware
    if (route.middleware && route.middleware.length > 0) {
        let current = 0;
        const nextMiddleware = () => {
            if (current < route.middleware.length) {
                route.middleware[current++](req, res, nextMiddleware);
            } else {
                route.handler(req, res);
            }
        };
        nextMiddleware();
    } else {
        route.handler(req, res);
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        params: req.params,
        query: req.query
    });

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});