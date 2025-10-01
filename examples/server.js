const express = require('express');
const { loadConfigFromObject, createLogger, createExpressMiddleware } = require('../dist/cjs/index.js');

const app = express();
const config = loadConfigFromObject({ logLevel: 'debug', transport: 'console', autoModule: true });
const logger = createLogger(config);

app.use(createExpressMiddleware(config));

app.get('/ping', (_req, res) => {
  logger.info('pong', { route: '/ping' });
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => logger.info('example server started', { port }, 'examples.server'));

