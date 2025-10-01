export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogifyConfig {
  logLevel: LogLevel;
  requestIdHeader: string;
  ctidHeader: string;
  transport: 'console' | 'json' | 'loki';
  autoModule?: boolean; // if true, infer module from callsite when not provided
  loki?: {
    url: string;
    tenantId?: string;
    basicAuth?: string;
    labels?: Record<string, string>;
  };
}

export type PartialLogifyConfig = Partial<LogifyConfig> & {
  loki?: Partial<NonNullable<LogifyConfig['loki']>>;
};

function readEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? defaultValue : value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LogifyConfig {
  const logLevel = (env.LOG_LEVEL as LogLevel) || 'info';
  const requestIdHeader = env.REQUEST_ID_HEADER || 'x-request-id';
  const ctidHeader = env.CTID_HEADER || 'x-correlation-id';
  const transport = (env.LOG_TRANSPORT as LogifyConfig['transport']) || 'console';
  const autoModule = (env.LOG_AUTO_MODULE || '').toLowerCase() === 'true';

  const config: LogifyConfig = {
    logLevel,
    requestIdHeader,
    ctidHeader,
    transport,
    autoModule,
  };

  if (transport === 'loki') {
    config.loki = {
      url: readEnv('LOKI_URL', '') || '',
      tenantId: readEnv('LOKI_TENANT_ID'),
      basicAuth: readEnv('LOKI_BASIC_AUTH'),
    };
  }

  return config;
}

export function loadConfigFromObject(input: PartialLogifyConfig): LogifyConfig {
  const base = loadConfig({});
  const merged: LogifyConfig = {
    logLevel: input.logLevel ?? base.logLevel,
    requestIdHeader: input.requestIdHeader ?? base.requestIdHeader,
    ctidHeader: input.ctidHeader ?? base.ctidHeader,
    transport: input.transport ?? base.transport,
    loki: undefined,
  };
  if ((input.transport ?? base.transport) === 'loki') {
    const lokiBase = base.loki ?? { url: '' };
    merged.loki = {
      url: input.loki?.url ?? lokiBase.url,
      tenantId: input.loki?.tenantId ?? lokiBase.tenantId,
      basicAuth: input.loki?.basicAuth ?? lokiBase.basicAuth,
      labels: input.loki?.labels ?? lokiBase.labels,
    };
  }
  return merged;
}

export function loadConfigFromFile(filePath: string): LogifyConfig {
  const fs = require('node:fs');
  const path = require('node:path');
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw);
  return loadConfigFromObject(parsed as PartialLogifyConfig);
}

