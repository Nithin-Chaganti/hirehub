import mongoose from 'mongoose';
import config from './env.js';
import { syncAllCandidateExperienceFields } from '../utils/userProfileUtils.js';

/**
 * MongoDB Connection via Mongoose
 *
 * Connects to MongoDB Atlas with event handlers for connection lifecycle.
 * Called once from server.js during startup — if it fails, the server won't start.
 *
 * Connection Events:
 * - connected: Logged on successful initial connection and reconnections
 * - error: Logged on connection errors (Mongoose auto-retries by default)
 * - disconnected: Logged when connection drops
 *
 * Strict Query Mode:
 * mongoose.set('strictQuery', true) prevents queries with fields not in the schema
 * from silently returning empty results. Instead, unknown fields are stripped from
 * the filter — this catches typos like .find({ emial: 'john@...' }).
 */

mongoose.set('strictQuery', true);

// ─── Connection Event Handlers ─────────────────────────────────

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// ─── Connect Function ──────────────────────────────────────────

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    void syncAllCandidateExperienceFields().catch((error) => {
      console.error('Candidate experience field sync failed:', error.message);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
