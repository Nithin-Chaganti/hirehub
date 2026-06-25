import config from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';

/**
 * Server Entry Point
 *
 * Startup Sequence:
 * 1. env.js validates all environment variables (crash if missing)
 * 2. connectDB() establishes MongoDB connection (crash if fails)
 * 3. app.listen() starts accepting HTTP requests
 *
 * Why separate from app.js?
 * In tests, we import app without calling .listen() — supertest
 * binds to an ephemeral port automatically. This separation lets
 * us test the full middleware + route pipeline without port conflicts.
 *
 * Graceful Shutdown:
 * On SIGINT (Ctrl+C) or SIGTERM (deployment platform stop signal),
 * we close the HTTP server first (stop accepting new connections),
 * then close the MongoDB connection. This prevents in-flight requests
 * from getting dropped and DB writes from being interrupted.
 */

const startServer = async () => {
  try {
    // Step 1: Connect to MongoDB (env.js already validated at import time)
    await connectDB();

    // Step 2: Start HTTP server
    const server = app.listen(config.PORT, () => {
      console.log(`\n Server running on port ${config.PORT} in ${config.NODE_ENV} mode`);
      console.log(`   Health check: http://localhost:${config.PORT}/api/v1/health\n`);
    });

    // ─── Graceful Shutdown ─────────────────────────────────────

    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(() => {
        console.log(' HTTP server closed');

        // Mongoose handles connection cleanup internally
        // when the process exits, but we log it for clarity
        import('mongoose').then((mongoose) => {
          mongoose.default.connection.close(false).then(() => {
            console.log(' MongoDB connection closed');
            process.exit(0);
          });
        });
      });

      // Force kill after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error('  Forced shutdown after 10s timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // ─── Unhandled Rejection Handler ───────────────────────────

    process.on('unhandledRejection', (reason, promise) => {
      console.error('UNHANDLED REJECTION!  Shutting down...');
      console.error('Reason:', reason);

      // Close server, then exit — don't just crash immediately
      server.close(() => {
        process.exit(1);
      });
    });

  } catch (error) {
    console.error(' Failed to start server:', error.message);
    process.exit(1);
  }
};

// ─── Global Uncaught Exception Handler ─────────────────────────

/**
 * Catches synchronous exceptions that escape the entire call stack
 * (e.g., a typo in a require path, accessing a property on undefined
 * outside of any try/catch, or a forgotten `await`).
 *
 * Why placed OUTSIDE startServer()?
 * So it catches exceptions during startup itself — not just during
 * request handling. A crash in connectDB() or app.listen() would be
 * caught by the try/catch inside startServer(), but an exception in
 * a required module or global initialization would bypass it.
 *
 * Why process.exit(1)?
 * Node.js docs explicitly recommend NOT resuming after an uncaught
 * exception — the process is in an undefined state. Log the error,
 * exit, and let the process manager (PM2, Docker, Render) restart
 * a clean instance.
 */
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION!  Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

startServer();
