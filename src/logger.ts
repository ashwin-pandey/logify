import { getContext } from './context';
import { LogifyConfig, LogLevel } from './config';
import { LokiTransport } from './transports/loki';

/**
 * Structured log record interface
 */
export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  ctid?: string;
  module?: string;
  details?: Record<string, unknown>;
}

/**
 * Log method options interface for better API design
 */
export interface LogOptions {
  /** Module name override (e.g., 'UserService.create') */
  module?: string;
  /** Error object to extract stack trace from */
  error?: Error;
  /** Any additional key-value pairs to include in details */
  [key: string]: unknown;
}

/**
 * Main logger interface with improved API design
 */
export interface LogifyLogger {
  /** Log debug message */
  debug(message: string, options?: LogOptions): void;
  /** Log info message */
  info(message: string, options?: LogOptions): void;
  /** Log warning message */
  warn(message: string, options?: LogOptions): void;
  /** Log error message */
  error(message: string, options?: LogOptions): void;
  /** Create child logger with bound context */
  child(bindings: Record<string, unknown>): LogifyLogger;
}

/**
 * Cache for parsed stack traces to improve performance
 */
const stackTraceCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 100;

/**
 * Generate ISO timestamp string
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Check if a log level should be emitted based on current config
 */
function levelAllows(current: LogLevel, incoming: LogLevel): boolean {
  const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(incoming) >= order.indexOf(current);
}

/**
 * Extract error details from Error object
 */
function extractErrorDetails(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause ? { cause: error.cause } : {}),
  };
}

/**
 * Create a new logger instance with the given configuration
 * @param config - Validated logger configuration
 * @returns Logger instance
 */
export function createLogger(config: LogifyConfig): LogifyLogger {
  const baseBindings: Record<string, unknown> = {};
  let baseModule: string | undefined = undefined;
  let loki: LokiTransport | undefined;

  // Initialize Loki transport with error handling
  if (config.transport === 'loki') {
    try {
      loki = new LokiTransport(config);
    } catch (error) {
      console.error('Failed to initialize Loki transport:', error);
      // Continue without Loki transport
    }
  }

  /**
   * Emit log record to configured transports
   */
  function emit(record: LogRecord): void {
    const line = JSON.stringify(record);
    
    // Always write to stdout for console/json transports
    if (config.transport !== 'loki') {
      process.stdout.write(line + '\n');
    }
    
    // Send to Loki if configured (fire-and-forget with error handling)
    if (loki) {
      loki.log(line, { level: record.level }).catch(error => {
        console.error('Loki transport error:', error);
      });
    }
  }

  /**
   * Core logging function
   */
  function log(level: LogLevel, message: string, options: LogOptions = {}): void {
    // Early return if level not enabled
    if (!levelAllows(config.logLevel, level)) return;

    const { requestId, ctid } = getContext();
    const { module: moduleOverride, error, ...otherOptions } = options;

    // Determine module name
    let moduleName = moduleOverride ?? baseModule;
    if (!moduleName && config.autoModule) {
      moduleName = inferModuleFromStack();
    }

    // Build details from base bindings and any additional options (excluding module)
    let finalDetails: Record<string, unknown> | undefined;
    const hasBaseBindings = Object.keys(baseBindings).length > 0;
    const hasOtherOptions = Object.keys(otherOptions).length > 0;
    
    if (hasBaseBindings || hasOtherOptions || error) {
      finalDetails = { ...baseBindings, ...otherOptions };
      
      // Add error information if present
      if (error) {
        const errorDetails = extractErrorDetails(error);
        finalDetails.error = errorDetails;
      }
    }

    const record: LogRecord = {
      timestamp: nowIso(),
      level,
      message,
      requestId,
      ctid,
      module: moduleName,
      details: finalDetails,
    };

    emit(record);
  }

  return {
    debug(message: string, options?: LogOptions) { log('debug', message, options); },
    info(message: string, options?: LogOptions) { log('info', message, options); },
    warn(message: string, options?: LogOptions) { log('warn', message, options); },
    error(message: string, options?: LogOptions) { log('error', message, options); },
    child(bindings: Record<string, unknown>) {
      const { module: moduleMaybe, ...rest } = bindings as { module?: unknown } & Record<string, unknown>;
      const childModule = typeof moduleMaybe === 'string' ? moduleMaybe : baseModule;
      const childBindings = { ...baseBindings, ...rest };
      return createChildLogger(config, childBindings, childModule, loki);
    }
  };
}

/**
 * Create child logger with bound context
 */
function createChildLogger(
  config: LogifyConfig, 
  bindings: Record<string, unknown>, 
  moduleName: string | undefined, 
  loki?: LokiTransport
): LogifyLogger {
  function emit(record: LogRecord): void {
    const line = JSON.stringify(record);
    
    if (config.transport !== 'loki') {
      process.stdout.write(line + '\n');
    }
    
    if (loki) {
      loki.log(line, { level: record.level }).catch(error => {
        console.error('Loki transport error:', error);
      });
    }
  }

  function log(level: LogLevel, message: string, options: LogOptions = {}): void {
    if (!levelAllows(config.logLevel, level)) return;

    const { requestId, ctid } = getContext();
    const { module: moduleOverride, error, ...otherOptions } = options;

    let finalModuleName = moduleOverride ?? moduleName;
    if (!finalModuleName && config.autoModule) {
      finalModuleName = inferModuleFromStack();
    }

    // Build details from bindings and any additional options (excluding module)
    let finalDetails: Record<string, unknown> | undefined;
    const hasBindings = Object.keys(bindings).length > 0;
    const hasOtherOptions = Object.keys(otherOptions).length > 0;
    
    if (hasBindings || hasOtherOptions || error) {
      finalDetails = { ...bindings, ...otherOptions };
      
      // Add error information if present
      if (error) {
        const errorDetails = extractErrorDetails(error);
        finalDetails.error = errorDetails;
      }
    }

    const record: LogRecord = {
      timestamp: nowIso(),
      level,
      message,
      requestId,
      ctid,
      module: finalModuleName,
      details: finalDetails,
    };

    emit(record);
  }

  return {
    debug(message: string, options?: LogOptions) { log('debug', message, options); },
    info(message: string, options?: LogOptions) { log('info', message, options); },
    warn(message: string, options?: LogOptions) { log('warn', message, options); },
    error(message: string, options?: LogOptions) { log('error', message, options); },
    child(extraBindings: Record<string, unknown>) {
      const { module: extraModuleMaybe, ...rest } = extraBindings as { module?: unknown } & Record<string, unknown>;
      const extraModule = typeof extraModuleMaybe === 'string' ? extraModuleMaybe : moduleName;
      const mergedBindings = { ...bindings, ...rest };
      return createChildLogger(config, mergedBindings, extraModule, loki);
    }
  };
}

/**
 * Infer module name from stack trace with caching for performance
 */
function inferModuleFromStack(): string | undefined {
  const err = new Error();
  const stack = err.stack || '';
  
  // Use stack as cache key (first few lines should be sufficient)
  const cacheKey = stack.split('\n').slice(0, 5).join('\n');
  
  if (stackTraceCache.has(cacheKey)) {
    return stackTraceCache.get(cacheKey);
  }

  const lines = stack.split('\n').map(s => s.trim());
  let result: string | undefined;

  for (const line of lines) {
    // Skip internal logger frames
    if (line.includes('logger.ts') || line.includes('logger.js')) continue;
    if (!line.startsWith('at ')) continue;

    // Parse stack frame: 'at FunctionName (file:line:col)' or 'at file:line:col'
    const match = line.match(/^at\s+(?:(.+?)\s+\()?([^)]+):(\d+):(\d+)\)?$/);
    if (match) {
      const [, functionName, filePath] = match;
      const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'root';
      const funcName = functionName?.replace(/^Object\./, '')?.replace(/\s+/g, '.') || 'func';
      result = `${fileName}.${funcName}`;
      break;
    }
  }

  // Cache result with size limit
  if (stackTraceCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = stackTraceCache.keys().next().value;
    if (firstKey) {
      stackTraceCache.delete(firstKey);
    }
  }
  if (result) {
    stackTraceCache.set(cacheKey, result);
  }

  return result;
}

