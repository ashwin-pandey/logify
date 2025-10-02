import { request as httpRequest } from 'node:https';
import { request as httpRequestInsecure } from 'node:http';
import { URL } from 'node:url';
import { LogifyConfig } from '../config';

/**
 * Loki log line format
 */
export interface LokiLine {
  stream: Record<string, string>;
  values: [string, string][]; // [unix_nano_ts, line]
}

/**
 * Loki transport error
 */
export class LokiTransportError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'LokiTransportError';
  }
}

/**
 * Loki transport for shipping logs to Grafana Loki
 */
export class LokiTransport {
  private readonly endpoint: URL;
  private readonly headers: Record<string, string>;
  private readonly baseLabels: Record<string, string>;
  private readonly timeout: number;

  constructor(cfg: LogifyConfig) {
    if (!cfg.loki?.url) {
      throw new Error('LOKI_URL is required for loki transport');
    }

    try {
      this.endpoint = new URL('/loki/api/v1/push', cfg.loki.url);
    } catch (error) {
      throw new Error(`Invalid Loki URL: ${cfg.loki.url}`);
    }

    this.headers = { 
      'content-type': 'application/json',
      'user-agent': 'logify-node-sdk'
    };
    
    if (cfg.loki.basicAuth) {
      this.headers['authorization'] = `Basic ${cfg.loki.basicAuth}`;
    }
    if (cfg.loki.tenantId) {
      this.headers['x-scope-orgid'] = cfg.loki.tenantId;
    }
    
    this.baseLabels = { 
      app: 'logify', 
      ...cfg.loki.labels 
    };
    
    this.timeout = 5000; // 5 second timeout
  }

  /**
   * Push log line to Loki
   */
  push(line: LokiLine): Promise<void> {
    const body = JSON.stringify({ streams: [line] });
    const isHttps = this.endpoint.protocol === 'https:';
    
    const reqOptions = {
      method: 'POST',
      hostname: this.endpoint.hostname,
      port: this.endpoint.port || (isHttps ? 443 : 80),
      path: this.endpoint.pathname + this.endpoint.search,
      headers: { 
        ...this.headers, 
        'content-length': Buffer.byteLength(body).toString() 
      },
      timeout: this.timeout,
    };

    const reqFn = isHttps ? httpRequest : httpRequestInsecure;
    
    return new Promise((resolve, reject) => {
      const req = reqFn(reqOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new LokiTransportError(
              `Loki push failed: ${res.statusCode} ${res.statusMessage}. Response: ${responseData}`,
              res.statusCode
            ));
          }
        });
      });

      req.on('error', (error) => {
        reject(new LokiTransportError(`Loki request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new LokiTransportError('Loki request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Log a line to Loki with optional labels
   */
  async log(line: string, labels?: Record<string, string>): Promise<void> {
    const ts = BigInt(Date.now()) * 1_000_000n;
    const entry: LokiLine = {
      stream: { ...this.baseLabels, ...labels },
      values: [[ts.toString(), line]],
    };
    await this.push(entry);
  }
}


