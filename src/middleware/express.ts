import type { Request, Response, NextFunction } from 'express';
import { runWithContext } from '../context';
import { LogifyConfig } from '../config';
import { randomUUID, randomBytes } from 'node:crypto';

export function createExpressMiddleware(config: LogifyConfig) {
  const rqHeader = config.requestIdHeader.toLowerCase();
  const ctHeader = config.ctidHeader.toLowerCase();

  return function logifyExpressMiddleware(req: Request, _res: Response, next: NextFunction) {
    const requestId = randomUUID();
    const existingCtid = (req.headers[ctHeader] as string | undefined);
    const ctid = existingCtid && /^[a-z0-9]{32}$/.test(existingCtid) ? existingCtid : generateCtid();
    // ensure headers exist for downstream services
    req.headers[rqHeader] = requestId;
    req.headers[ctHeader] = ctid;
    runWithContext({ requestId, ctid }, () => next());
  };
}

function generateCtid(): string {
  // 32 chars lowercase alphanumeric
  const bytes = randomBytes(32);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < 32; i++) {
    // map byte to 0-35 then to base36 char (0-9a-z)
    const v = bytes[i] % 36;
    out += v.toString(36);
  }
  // pad if needed
  while (out.length < 32) out += '0';
  return out.slice(0, 32);
}

