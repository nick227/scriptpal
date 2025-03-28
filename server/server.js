import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes.js';

const app = express();

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ?
        'https://your-production-domain.com' : ['http://localhost', 'http://localhost:80', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
    next();
});

// Route handler
app.use((req, res, next) => {
    const route = routes.find(r =>
        r.path.replace(/:(\w+)/g, '([^/]+)') === req.path.replace(/:(\w+)/g, '([^/]+)') &&
        r.method === req.method.toLowerCase()
    );

    if (!route) {
        console.log('Route not found:', req.path);
        return res.status(404).json({ error: 'Route not found' });
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
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});