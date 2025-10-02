const express = require('express');
const { loadConfigFromObject, createLogger, createExpressMiddleware } = require('../dist/cjs/index.js');

const app = express();
const config = loadConfigFromObject({ 
  logLevel: 'debug', 
  transport: 'console', 
  autoModule: true 
});
const logger = createLogger(config);

// Create child logger for this module
const serverLogger = logger.child({ module: 'examples.server' });

app.use(createExpressMiddleware(config));

app.get('/ping', (_req, res) => {
  logger.info('pong', { route: '/ping' });
  res.json({ ok: true });
});

app.get('/error', (_req, res) => {
  const error = new Error('Simulated error');
  logger.error('Something went wrong', { 
    route: '/error',
    error 
  });
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  serverLogger.info('example server started', { 
    port, 
    environment: process.env.NODE_ENV || 'development'
  });
});

