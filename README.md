# Logify Node SDK

A production-ready, cross-service logging SDK that automatically correlates logs with request and correlation IDs across distributed microservices.

## Features

- 🔗 **Automatic Correlation**: Request and correlation IDs automatically propagated across services
- 🚀 **Zero Configuration**: Works out of the box with sensible defaults
- 📝 **Structured Logging**: JSON-formatted logs with consistent schema
- 🔧 **Flexible Configuration**: Environment variables, JSON files, or programmatic config
- 🎯 **Context-Aware**: AsyncLocalStorage-based request context tracking
- 📊 **Multiple Transports**: Console, JSON, and Grafana Loki support
- 🛡️ **Type Safe**: Full TypeScript support with comprehensive types
- ⚡ **High Performance**: Optimized with caching and minimal overhead
- 🧪 **Well Tested**: Comprehensive unit test coverage

## Installation

```bash
npm install logify-node-sdk
```

## Quick Start

### Express.js Integration

```typescript
import express from 'express';
import { loadConfigFromObject, createLogger, createExpressMiddleware } from 'logify-node-sdk';

const app = express();

// Configure logger
const config = loadConfigFromObject({
  logLevel: 'info',
  transport: 'console',
  autoModule: true, // Automatically infer module names
});

const logger = createLogger(config);

// Add middleware to capture request context
app.use(createExpressMiddleware(config));

// Use logger in routes
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;
  
  logger.info('Fetching user', { 
    userId,
    module: 'UserController.getUser' 
  });
  
  try {
    const user = await getUserById(userId);
    logger.info('User fetched successfully', { userId });
    res.json(user);
  } catch (error) {
    logger.error('Failed to fetch user', { 
      userId,
      error // Automatically extracts error details
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

## Configuration

### Environment Variables

```bash
# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Header names for request/correlation IDs
REQUEST_ID_HEADER=x-request-id
CTID_HEADER=x-correlation-id

# Transport type
LOG_TRANSPORT=console  # console, json, loki

# Auto-detect module names from stack traces
LOG_AUTO_MODULE=true

# Loki configuration (when transport=loki)
LOKI_URL=https://loki.example.com
LOKI_TENANT_ID=your-tenant
LOKI_BASIC_AUTH=base64encodedcreds
```

### Configuration File

Create `logify.config.json`:

```json
{
  "logLevel": "info",
  "transport": "json",
  "autoModule": true,
  "requestIdHeader": "x-request-id",
  "ctidHeader": "x-correlation-id",
  "loki": {
    "url": "https://loki.example.com",
    "tenantId": "production",
    "basicAuth": "dXNlcjpwYXNz",
    "labels": {
      "service": "user-api",
      "environment": "production"
    }
  }
}
```

```typescript
import { loadConfigFromFile, createLogger } from 'logify-node-sdk';

const config = loadConfigFromFile('./logify.config.json');
const logger = createLogger(config);
```

### Programmatic Configuration

```typescript
import { loadConfigFromObject, createLogger } from 'logify-node-sdk';

const config = loadConfigFromObject({
  logLevel: 'debug',
  transport: 'console',
  autoModule: true,
});

const logger = createLogger(config);
```

## API Reference

### Logger Methods

All log methods follow the same signature:

```typescript
logger.info(message: string, options?: LogOptions): void
```

Where `LogOptions` allows any key-value pairs plus special options:

```typescript
interface LogOptions {
  module?: string;                    // Module override
  error?: Error;                      // Error object (auto-extracted)
  [key: string]: unknown;             // Any additional data
}
```

### Examples

```typescript
// Simple message
logger.info('User logged in');

// With structured data (no need for "details" wrapper)
logger.info('User logged in', {
  userId: 123, 
  email: 'user@example.com'
});

// With module name
logger.info('Processing payment', {
  amount: 100, 
  currency: 'USD',
  module: 'PaymentService.processPayment'
});

// With error handling
try {
  await processPayment(paymentData);
} catch (error) {
  logger.error('Payment processing failed', {
    paymentId: payment.id,
    error // Automatically extracts name, message, stack, cause
  });
}
```

### Child Loggers

Create child loggers with bound context:

```typescript
// Create child logger with service context
const serviceLogger = logger.child({ 
  service: 'user-service',
  version: '1.2.0',
  module: 'UserService'
});

// All logs from this logger will include the bound context
serviceLogger.info('User created', { userId: 123 });
// Output includes: { service: 'user-service', version: '1.2.0', userId: 123 }

// Child loggers can be nested
const operationLogger = serviceLogger.child({ 
  operation: 'createUser',
  traceId: 'abc123'
});
```

### Outbound Request Propagation

Propagate correlation IDs to downstream services:

```typescript
import { buildPropagationHeaders } from 'logify-node-sdk';
import axios from 'axios';

// Inside a request handler
const headers = buildPropagationHeaders({
  requestIdHeader: 'x-request-id',
  ctidHeader: 'x-correlation-id',
});

const response = await axios.get('https://api.example.com/users', {
  headers: {
    ...headers,
    'Authorization': 'Bearer token'
  }
});
```

## Log Structure

Every log record has the following JSON structure:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User logged in",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "ctid": "a1b2c3d4e5f6789012345678901234567890abcd",
  "module": "AuthController.login",
  "details": {
    "userId": 123,
    "email": "user@example.com"
  }
}
```

### Field Descriptions

- **timestamp**: ISO 8601 timestamp
- **level**: Log level (debug, info, warn, error)
- **message**: Human-readable message
- **requestId**: Unique UUID v4 for each request (auto-generated)
- **ctid**: 32-character correlation ID (persists across services)
- **module**: Module/function name (optional, can be auto-detected)
- **details**: Structured additional data (optional)

## Request & Correlation IDs

### Request ID (`requestId`)
- Fresh UUID v4 generated for every inbound request
- Not persisted beyond the single request
- Used for tracking individual API calls

### Correlation ID (`ctid`)
- 32-character lowercase alphanumeric string
- Persists across connected flows and service boundaries
- If inbound request has valid ctid header, it's used
- Otherwise, a new ctid is generated
- Used for tracing entire user journeys across microservices

## Transports

### Console Transport
Human-readable JSON output to stdout (default):

```typescript
const config = loadConfigFromObject({ transport: 'console' });
```

### JSON Transport
Structured JSON lines to stdout (same as console):

```typescript
const config = loadConfigFromObject({ transport: 'json' });
```

### Loki Transport
Ships logs to Grafana Loki:

```typescript
const config = loadConfigFromObject({
  transport: 'loki',
  loki: {
    url: 'https://loki.example.com',
    tenantId: 'production',
    basicAuth: 'dXNlcjpwYXNz',
    labels: {
      service: 'user-api',
      environment: 'production'
    }
  }
});
```

## Error Handling

The SDK includes comprehensive error handling:

### Configuration Errors
```typescript
import { ConfigValidationError } from 'logify-node-sdk';

try {
  const config = loadConfigFromObject({ logLevel: 'invalid' });
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error('Config validation failed:', error.details);
  }
}
```

### Transport Errors
Loki transport errors are handled gracefully and logged to stderr without affecting application flow.

## Performance

- **Stack Trace Caching**: Module name inference results are cached
- **Level Filtering**: Early return for filtered log levels
- **Async Transport**: Loki transport is fire-and-forget with error handling
- **Minimal Overhead**: Optimized for high-throughput applications

## Testing

Run the test suite:

```bash
# Unit tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Smoke test
npm run smoke
```

## Development

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Build
npm run build

# Run example server
npm run example
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { 
  LogifyConfig, 
  LogifyLogger, 
  LogOptions, 
  LogRecord,
  RequestContext 
} from 'logify-node-sdk';
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run lint && npm test`
5. Submit a pull request

## License

MIT

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**Need help?** Open an issue on [GitHub](https://github.com/ashwin-pandey/logify/issues).