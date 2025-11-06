import dotenv from 'dotenv';
import { logger } from './lib/logger';
import app from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Reason: Graceful shutdown ensures connections are closed properly
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const server = app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});

// Reason: Handle uncaught errors to prevent crashes
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  process.exit(1);
});

export default server;
