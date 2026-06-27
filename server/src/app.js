import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import config from './config/env.js';
import errorMiddleware from './middleware/errorMiddleware.js';
import ApiError from './utils/ApiError.js';
import ApiResponse from './utils/ApiResponse.js';
import { DB_STATES } from './utils/constants.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import jobRoutes from './routes/jobRoutes.js';

/**
 * Express Application Setup
 *
 * Configures middleware, routes, and error handling.
 * Separated from server.js for testability — supertest can import this
 * app without calling .listen(), enabling integration tests.
 *
 * Middleware Order:
 * 1. Helmet        — Security HTTP headers
 * 2. CORS          — Cross-origin request handling
 * 3. Rate Limiter  — Abuse / brute-force protection
 * 4. Body Parsers  — JSON + URL-encoded body parsing
 * 5. Cookie Parser — Parse cookies (refresh token)
 * 6. Morgan        — Request logging (dev only)
 * 7. Routes        — API endpoints
 * 8. 404 Handler   — Catch unmatched routes
 * 9. Error Handler — Centralized error processing (must be last)
 */

const app = express();

if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Helmet — Security Headers ───────────────────────────────

/**
 * Helmet sets various HTTP response headers to help protect the app:
 * - X-Content-Type-Options: nosniff     — prevents MIME-type sniffing
 * - Strict-Transport-Security           — enforces HTTPS
 * - X-Frame-Options: SAMEORIGIN         — prevents clickjacking
 * - X-XSS-Protection                    — legacy XSS filter
 * - Content-Security-Policy             — controls resource loading
 *
 * Interview Tip: "We use Helmet as the very first middleware so every
 * response — including error responses — gets security headers."
 */
app.use(helmet());

// ─── CORS Configuration ──────────────────────────────────────

/**
 * CORS setup for cross-origin requests between frontend and backend.
 *
 * In production, the React app (Vercel) and Express API (Render)
 * are on different domains, so CORS must be explicitly configured.
 *
 * credentials: true — required for the browser to send httpOnly cookies
 * (our refresh token) on cross-origin requests.
 *
 * sameSite: 'none' + secure: true is set on the cookie itself (in auth service),
 * not here. CORS just needs credentials: true to allow cookies through.
 */
const corsOptions = {
  origin: config.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// ─── Rate Limiter ────────────────────────────────────────────

/**
 * Global rate limiter — prevents brute-force attacks and DDoS abuse.
 *
 * Limits each IP to 100 requests per 15-minute window.
 * When the limit is exceeded, a 429 (Too Many Requests) response is
 * returned with a standardized ApiResponse format.
 *
 * Why global? Individual route-level limiters can be added later for
 * sensitive endpoints (e.g., /auth/login at 10 req/min), but a global
 * limiter provides a baseline safety net for all routes.
 *
 * Interview Tip: "We apply a global rate limiter as a baseline and add
 * stricter per-route limiters on sensitive endpoints like login and
 * password reset."
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per windowMs per IP
  standardHeaders: true,     // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,      // Disable deprecated `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json(
      new ApiResponse(429, null, 'Too many requests, please try again later')
    );
  },
});

app.use(globalLimiter);

// ─── Body Parsers ────────────────────────────────────────────

// Parse JSON request bodies (with 16kb limit to prevent abuse)
app.use(express.json({ limit: '16kb' }));

// Parse URL-encoded form data (for standard form submissions)
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ─── Cookie Parser ───────────────────────────────────────────

// Parse cookies from the request — needed to read the refresh token
app.use(cookieParser());

// ─── Request Logging ─────────────────────────────────────────

// Morgan logs HTTP requests in development (method, URL, status, response time)
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Health Check Endpoint ───────────────────────────────────

/**
 * GET /api/v1/health
 *
 * Used by deployment platforms (Render) to verify the server is running.
 * Returns server uptime, timestamp, environment, and database connection
 * status — useful for debugging production issues.
 *
 * Database readyState values (from mongoose.connection.readyState):
 *   0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
app.get('/api/v1/health', (req, res) => {
  const dbState = mongoose.connection.readyState;

  res.status(200).json(
    new ApiResponse(200, {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: DB_STATES[dbState] || 'unknown',
      databaseReadyState: dbState,
      memoryUsage: process.memoryUsage().rss,
    }, 'Server is healthy')
  );
});

// ─── API Routes ──────────────────────────────────────────────

// Routes are registered as they are built in each phase:
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/jobs', jobRoutes);
// app.use('/api/v1/applications', applicationRoutes);
// app.use('/api/v1/saved-jobs', savedJobRoutes);
// app.use('/api/v1/notifications', notificationRoutes);
// app.use('/api/v1/ai', aiRoutes);
// app.use('/api/v1/analytics', analyticsRoutes);
// app.use('/api/v1/talent', talentRoutes);
// app.use('/api/v1/dashboard', dashboardRoutes);

// ─── 404 Handler ─────────────────────────────────────────────

/**
 * Catch all unmatched routes and return a 404.
 * This must come AFTER all valid routes but BEFORE the error middleware.
 */
app.all('*', (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

// ─── Global Error Middleware ─────────────────────────────────

// Must be the LAST middleware — catches all errors from routes and middleware above
app.use(errorMiddleware);

export default app;
