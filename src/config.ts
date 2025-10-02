import { readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

/**
 * Supported log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Loki transport configuration
 */
export interface LokiConfig {
  url: string;
  tenantId?: string;
  basicAuth?: string;
  labels?: Record<string, string>;
}

/**
 * Complete validated configuration interface
 */
export interface LogifyConfig {
  logLevel: LogLevel;
  requestIdHeader: string;
  ctidHeader: string;
  transport: 'console' | 'json' | 'loki';
  autoModule: boolean;
  loki?: LokiConfig;
}

/**
 * Partial configuration for user input
 */
export type PartialLogifyConfig = Partial<LogifyConfig> & {
  loki?: Partial<LokiConfig>;
};

/**
 * Configuration validation error with detailed field information
 */
export class ConfigValidationError extends Error {
  constructor(message: string, public readonly field?: string, public readonly value?: unknown) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Safely read environment variable with optional default
 */
function readEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? defaultValue : value;
}

/**
 * Validate log level
 */
function validateLogLevel(value: unknown): LogLevel {
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (typeof value === 'string' && validLevels.includes(value as LogLevel)) {
    return value as LogLevel;
  }
  if (value === undefined) {
    return 'info'; // default
  }
  throw new ConfigValidationError(
    `Invalid log level. Must be one of: ${validLevels.join(', ')}`,
    'logLevel',
    value
  );
}

/**
 * Validate transport type
 */
function validateTransport(value: unknown): 'console' | 'json' | 'loki' {
  const validTransports = ['console', 'json', 'loki'] as const;
  if (typeof value === 'string' && validTransports.includes(value as any)) {
    return value as 'console' | 'json' | 'loki';
  }
  if (value === undefined) {
    return 'console'; // default
  }
  throw new ConfigValidationError(
    `Invalid transport. Must be one of: ${validTransports.join(', ')}`,
    'transport',
    value
  );
}

/**
 * Validate header name
 */
function validateHeader(value: unknown, fieldName: string, defaultValue: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (value === undefined) {
    return defaultValue;
  }
  throw new ConfigValidationError(
    `${fieldName} must be a non-empty string`,
    fieldName,
    value
  );
}

/**
 * Validate boolean value
 */
function validateBoolean(value: unknown, fieldName: string, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === undefined) {
    return defaultValue;
  }
  throw new ConfigValidationError(
    `${fieldName} must be a boolean`,
    fieldName,
    value
  );
}

/**
 * Validate URL format
 */
function validateUrl(value: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new ConfigValidationError(
      'Invalid URL format',
      'loki.url',
      value
    );
  }
}

/**
 * Validate Loki configuration
 */
function validateLokiConfig(value: unknown): LokiConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  
  if (typeof value !== 'object' || value === null) {
    throw new ConfigValidationError(
      'Loki config must be an object',
      'loki',
      value
    );
  }

  const loki = value as Record<string, unknown>;
  
  if (typeof loki.url !== 'string' || loki.url.length === 0) {
    throw new ConfigValidationError(
      'Loki URL is required and must be a non-empty string',
      'loki.url',
      loki.url
    );
  }

  const validatedUrl = validateUrl(loki.url);

  const result: LokiConfig = {
    url: validatedUrl,
  };

  if (loki.tenantId !== undefined) {
    if (typeof loki.tenantId !== 'string') {
      throw new ConfigValidationError(
        'Loki tenantId must be a string',
        'loki.tenantId',
        loki.tenantId
      );
    }
    result.tenantId = loki.tenantId;
  }

  if (loki.basicAuth !== undefined) {
    if (typeof loki.basicAuth !== 'string') {
      throw new ConfigValidationError(
        'Loki basicAuth must be a string',
        'loki.basicAuth',
        loki.basicAuth
      );
    }
    result.basicAuth = loki.basicAuth;
  }

  if (loki.labels !== undefined) {
    if (typeof loki.labels !== 'object' || loki.labels === null || Array.isArray(loki.labels)) {
      throw new ConfigValidationError(
        'Loki labels must be an object',
        'loki.labels',
        loki.labels
      );
    }
    
    const labels = loki.labels as Record<string, unknown>;
    const validatedLabels: Record<string, string> = {};
    
    for (const [key, val] of Object.entries(labels)) {
      if (typeof val !== 'string') {
        throw new ConfigValidationError(
          `Loki label "${key}" must be a string`,
          `loki.labels.${key}`,
          val
        );
      }
      validatedLabels[key] = val;
    }
    
    result.labels = validatedLabels;
  }

  return result;
}

/**
 * Load and validate configuration from environment variables
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated configuration
 * @throws ConfigValidationError if validation fails
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): LogifyConfig {
  const logLevel = validateLogLevel(env.LOG_LEVEL);
  const requestIdHeader = validateHeader(env.REQUEST_ID_HEADER, 'requestIdHeader', 'x-request-id');
  const ctidHeader = validateHeader(env.CTID_HEADER, 'ctidHeader', 'x-correlation-id');
  const transport = validateTransport(env.LOG_TRANSPORT);
  const autoModule = validateBoolean(
    env.LOG_AUTO_MODULE?.toLowerCase() === 'true' ? true : 
    env.LOG_AUTO_MODULE?.toLowerCase() === 'false' ? false : undefined,
    'autoModule',
    false
  );

  const config: LogifyConfig = {
    logLevel,
    requestIdHeader,
    ctidHeader,
    transport,
    autoModule,
  };

  // Add Loki config if transport is loki
  if (transport === 'loki') {
    const lokiUrl = readEnv('LOKI_URL');
    if (!lokiUrl) {
      throw new ConfigValidationError(
        'LOKI_URL is required when transport is "loki"',
        'loki.url',
        undefined
      );
    }

    config.loki = validateLokiConfig({
      url: lokiUrl,
      tenantId: readEnv('LOKI_TENANT_ID'),
      basicAuth: readEnv('LOKI_BASIC_AUTH'),
    });
  }

  return config;
}

/**
 * Load and validate configuration from a partial config object
 * @param input - Partial configuration object
 * @returns Validated configuration with defaults applied
 * @throws ConfigValidationError if validation fails
 */
export function loadConfigFromObject(input: PartialLogifyConfig): LogifyConfig {
  const logLevel = validateLogLevel(input.logLevel);
  const requestIdHeader = validateHeader(input.requestIdHeader, 'requestIdHeader', 'x-request-id');
  const ctidHeader = validateHeader(input.ctidHeader, 'ctidHeader', 'x-correlation-id');
  const transport = validateTransport(input.transport);
  const autoModule = validateBoolean(input.autoModule, 'autoModule', false);

  const config: LogifyConfig = {
    logLevel,
    requestIdHeader,
    ctidHeader,
    transport,
    autoModule,
  };

  // Validate Loki config if present or required
  if (transport === 'loki' || input.loki) {
    if (transport === 'loki' && !input.loki) {
      throw new ConfigValidationError(
        'Loki configuration is required when transport is "loki"',
        'loki',
        undefined
      );
    }
    config.loki = validateLokiConfig(input.loki);
  }

  return config;
}

/**
 * Load and validate configuration from a JSON file
 * @param filePath - Path to JSON configuration file (relative or absolute)
 * @returns Validated configuration
 * @throws Error if file cannot be read or parsed
 * @throws ConfigValidationError if validation fails
 */
export function loadConfigFromFile(filePath: string): LogifyConfig {
  try {
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
    const rawContent = readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(rawContent);
    return loadConfigFromObject(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file ${filePath}: ${error.message}`);
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${filePath}`);
    }
    throw error;
  }
}

