import { app } from './src/app.js';
import { config } from './src/config.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.listen(config.PORT, () => {
  console.log(`Server listening on port http://localhost:${config.PORT}`);
});
