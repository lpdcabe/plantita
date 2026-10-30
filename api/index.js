import { createApp } from '../server/app.js';

// Vercel owns the HTTP listener; the Vite build is served by its static CDN.
export default createApp({ staticDirectory: false });
