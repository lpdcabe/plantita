import 'dotenv/config';
import { createApp } from './app.js';

// Vite reads the same PORT setting for its development API proxy.
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = createApp().listen(port, host, () => {
  console.log(`Sprout API is ready at http://${host}:${port}`);
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another PORT in .env.` : error.message);
  process.exitCode = 1;
});
