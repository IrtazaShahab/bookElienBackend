// app.js — dotenv MUST be first
require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

const db = require('./db');

// ✅ app must be created BEFORE any app.use()
var app = express();

/**
 * CORS Configuration
 */
const allowedOrigins = [
    'http://localhost:3020',
    'http://localhost:3000',
    'https://bookeilen.vercel.app',
    'https://bookeilen-frontend.vercel.app',
];

if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || /\.vercel\.app$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Other middleware
app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Session (required by passport — must come after app is created)
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
}));

// ✅ Passport (must come after session)
app.use(passport.initialize());
app.use(passport.session());

// ✅ Import routes AFTER app is created
var indexRouter = require('./routes/index');
var booksRouter = require('./routes/books');
var sessionsRouter = require('./routes/sessions');
const passwordResetRouter = require('./routes/reset-password');
const { router: usersRouter } = require('./routes/users');
const googleAuthRoutes = require('./routes/google-auth');

// Health check route
app.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM "users" LIMIT 5');
        res.json({
            status: 'ok',
            message: 'Backend is running!',
            users: result.rows,
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
});

// ✅ API Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/users', googleAuthRoutes);   // Google OAuth routes
app.use('/api/books', booksRouter);
app.use('/api', sessionsRouter);
app.use('/users', passwordResetRouter);

// 404 handler
app.use(function (req, res, next) {
    next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.json({
        error: err.message,
        status: err.status || 500
    });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3041;
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;