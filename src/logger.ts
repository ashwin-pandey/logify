import { getContext } from './context';
import { LogifyConfig, LogLevel } from './config';
import { LokiTransport } from './transports/loki';

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  ctid?: string;
  module?: string;
  details?: Record<string, unknown> | undefined;
}

export interface LogifyLogger {
  debug(message: string, details?: Record<string, unknown>, moduleName?: string): void;
  info(message: string, details?: Record<string, unknown>, moduleName?: string): void;
  warn(message: string, details?: Record<string, unknown>, moduleName?: string): void;
  error(message: string, details?: Record<string, unknown>, moduleName?: string): void;
  child(bindings: Record<string, unknown>): LogifyLogger; // bindings may include `module`
}

function nowIso(): string {
  return new Date().toISOString();
}

function levelAllows(current: LogLevel, incoming: LogLevel): boolean {
  const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(incoming) >= order.indexOf(current);
}

export function createLogger(config: LogifyConfig): LogifyLogger {
  let baseBindings: Record<string, unknown> = {};
  let baseModule: string | undefined = undefined;
  const loki = config.transport === 'loki' ? new LokiTransport(config) : undefined;

  function emit(record: LogRecord) {
    const line = JSON.stringify(record);
    process.stdout.write(line + '\n');
    if (loki) void loki.log(line, { level: record.level });
  }

  function log(level: LogLevel, message: string, details?: Record<string, unknown>, moduleName?: string) {
    if (!levelAllows(config.logLevel, level)) return;
    const { requestId, ctid } = getContext();
    const inferredModule = !moduleName && config.autoModule ? inferModuleFromStack() : undefined;
    const record: LogRecord = {
      timestamp: nowIso(),
      level,
      message,
      requestId,
      ctid,
      module: moduleName ?? inferredModule ?? baseModule,
      details: details ? { ...baseBindings, ...details } : (Object.keys(baseBindings).length ? { ...baseBindings } : undefined),
    };
    emit(record);
  }

  const api: LogifyLogger = {
    debug(message: string, details?: Record<string, unknown>, moduleName?: string) { log('debug', message, details, moduleName); },
    info(message: string, details?: Record<string, unknown>, moduleName?: string) { log('info', message, details, moduleName); },
    warn(message: string, details?: Record<string, unknown>, moduleName?: string) { log('warn', message, details, moduleName); },
    error(message: string, details?: Record<string, unknown>, moduleName?: string) { log('error', message, details, moduleName); },
    child(bindings: Record<string, unknown>) {
      const { module: moduleMaybe, ...rest } = bindings as { module?: unknown } & Record<string, unknown>;
      const moduleName = typeof moduleMaybe === 'string' ? moduleMaybe : undefined;
      const childBindings = { ...baseBindings, ...rest };
      return createChildLogger(config, childBindings, moduleName ?? baseModule, loki);
    }
  };

  function createChildLogger(cfg: LogifyConfig, bindings: Record<string, unknown>, moduleName: string | undefined, lokiTransport?: LokiTransport): LogifyLogger {
    function emitChild(record: LogRecord) {
      const line = JSON.stringify(record);
      process.stdout.write(line + '\n');
      if (lokiTransport) void lokiTransport.log(line, { level: record.level });
    }
    function logChild(level: LogLevel, message: string, details?: Record<string, unknown>, moduleOverride?: string) {
      if (!levelAllows(cfg.logLevel, level)) return;
      const { requestId, ctid } = getContext();
      const inferredModule = !moduleOverride && cfg.autoModule ? inferModuleFromStack() : undefined;
      const record: LogRecord = {
        timestamp: nowIso(),
        level,
        message,
        requestId,
        ctid,
        module: moduleOverride ?? inferredModule ?? moduleName,
        details: details ? { ...bindings, ...details } : (Object.keys(bindings).length ? { ...bindings } : undefined),
      };
      emitChild(record);
    }
    return {
      debug(message: string, details?: Record<string, unknown>, moduleOverride?: string) { logChild('debug', message, details, moduleOverride); },
      info(message: string, details?: Record<string, unknown>, moduleOverride?: string) { logChild('info', message, details, moduleOverride); },
      warn(message: string, details?: Record<string, unknown>, moduleOverride?: string) { logChild('warn', message, details, moduleOverride); },
      error(message: string, details?: Record<string, unknown>, moduleOverride?: string) { logChild('error', message, details, moduleOverride); },
      child(extra: Record<string, unknown>) {
        const { module: extraModuleMaybe, ...restExtra } = extra as { module?: unknown } & Record<string, unknown>;
        const extraModule = typeof extraModuleMaybe === 'string' ? extraModuleMaybe : undefined;
        return createChildLogger(cfg, { ...bindings, ...restExtra }, extraModule ?? moduleName, lokiTransport);
      }
    };
  }

  return api;
}

function inferModuleFromStack(): string | undefined {
  const err = new Error();
  const stack = err.stack || '';
  // Find the first external callsite by skipping frames including 'logger.ts'
  const lines = stack.split('\n').map(s => s.trim());
  for (const line of lines) {
    if (!line.includes('logger.ts') && line.startsWith('at ')) {
      // attempt to parse 'at FunctionName (file:line:col)' or 'at file:line:col'
      const match = line.match(/^at\s+(.*?)(\s+\(|\s+)([^\s)]+):\d+:\d+\)?$/);
      if (match) {
        const fn = match[1].replace(/^Object\./, '').replace(/\s+/g, '.');
        const file = match[3].split(/[\\/]/).pop() || 'root';
        const base = file.replace(/\.[^.]+$/, '') || 'root';
        const func = fn && fn !== 'at' ? fn : 'func';
        return `${base}.${func}`;
      }
    }
  }
  return undefined;
}

