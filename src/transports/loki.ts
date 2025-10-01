import { request as httpRequest } from 'node:https';
import { request as httpRequestInsecure } from 'node:http';
import { URL } from 'node:url';
import { LogifyConfig } from '../config';

export interface LokiLine {
  stream: Record<string, string>;
  values: [string, string][]; // [unix_nano_ts, line]
}

export class LokiTransport {
  private readonly endpoint: URL;
  private readonly headers: Record<string, string>;
  private readonly baseLabels: Record<string, string>;

  constructor(cfg: LogifyConfig) {
    if (!cfg.loki?.url) throw new Error('LOKI_URL is required for loki transport');
    this.endpoint = new URL('/loki/api/v1/push', cfg.loki.url);
    this.headers = { 'content-type': 'application/json' };
    if (cfg.loki.basicAuth) this.headers['authorization'] = `Basic ${cfg.loki.basicAuth}`;
    if (cfg.loki.tenantId) this.headers['x-scope-orgid'] = cfg.loki.tenantId;
    this.baseLabels = { app: 'logify', ...cfg.loki.labels };
  }

  push(line: LokiLine): Promise<void> {
    const body = JSON.stringify({ streams: [line] });
    const isHttps = this.endpoint.protocol === 'https:';
    const reqOptions = {
      method: 'POST',
      hostname: this.endpoint.hostname,
      port: this.endpoint.port || (isHttps ? 443 : 80),
      path: this.endpoint.pathname + this.endpoint.search,
      headers: { ...this.headers, 'content-length': Buffer.byteLength(body).toString() },
    };
    const reqFn = isHttps ? httpRequest : httpRequestInsecure;
    return new Promise((resolve, reject) => {
      const req = reqFn(reqOptions, (res) => {
        // drain
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`Loki push failed: ${res.statusCode}`));
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async log(line: string, labels?: Record<string, string>): Promise<void> {
    const ts = BigInt(Date.now()) * 1_000_000n;
    const entry: LokiLine = {
      stream: { ...this.baseLabels, ...labels },
      values: [[ts.toString(), line]],
    };
    await this.push(entry);
  }
}

