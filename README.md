# Logify SDK (Node.js)

A cross-service logging SDK that automatically correlates logs with request and correlation IDs across microservices.

## Install

```bash
npm install @logify/node-sdk
```

## Quick start (Express)

```ts
import express from 'express';
import { loadConfig, loadConfigFromFile, loadConfigFromObject, createLogger, createExpressMiddleware } from '@logify/node-sdk';

const app = express();
// Option 1: from ENV (defaults)
// const config = loadConfig();
// Option 2: from JSON file
// const config = loadConfigFromFile('./logify.config.json');
// Option 3: from inline object
const config = loadConfigFromObject({
  logLevel: 'debug',
  transport: 'console',
  autoModule: true
});
const logger = createLogger(config);

app.use(createExpressMiddleware(config));

app.get('/ping', (_req, res) => {
  logger.info('pong', { route: '/ping' }, 'app.routes');
  res.json({ ok: true });
});

app.listen(3000);
```

## Log structure

Every line is JSON with the following shape:

```json
{
  "timestamp": "2025-10-01T12:34:56.789Z",
  "level": "info",
  "message": "pong",
  "requestId": "3e2f2d7e-...",
  "ctid": "a1b2c3...64chars...",
  "module": "app.routes",
  "details": { "route": "/ping" }
}
```

- `details` is optional and must be an object (any key-value pairs).
- `module` is optional and marks the origin of the log (e.g., `class.func`).

## Outbound propagation

```ts
import { buildPropagationHeaders } from '@logify/node-sdk';

const headers = buildPropagationHeaders({
  requestIdHeader: 'x-request-id',
  ctidHeader: 'x-correlation-id',
});
// pass headers to fetch/axios/etc.
```

## Configuration (ENV)

- `LOG_LEVEL` (debug|info|warn|error) default: info
- `REQUEST_ID_HEADER` default: x-request-id
- `CTID_HEADER` default: x-correlation-id
- `LOG_TRANSPORT` (console|json|loki) default: console
- `LOKI_URL`, `LOKI_TENANT_ID`, `LOKI_BASIC_AUTH` for Loki

## Transports

- console: JSON lines to stdout
- json: structured JSON lines (same as console; alias)
- loki: pushes JSON lines to Grafana Loki (minimal implementation)

## requestId and ctid semantics

- `requestId`: fresh UUID v4 generated for every inbound request; not persisted beyond the request.
- `ctid`: correlation ID that persists across connected flows. If an inbound header is present, it is used; otherwise a 32-character lowercase alphanumeric value is generated.

## Module name usage

Set per-call:

```ts
logger.info('user created', { userId }, 'userService.create'); // if autoModule is set to true, then no need to write module specifically
```

Bind via child logger:

```ts
const authLog = logger.child({ module: 'auth.routes' });
authLog.warn('invalid token', { ip });

Enable dynamic module inference (optional): set `autoModule: true` in config (or env `LOG_AUTO_MODULE=true`). When no module is provided, the logger will attempt to infer `file.function` from the callsite.
```

## License

MIT
