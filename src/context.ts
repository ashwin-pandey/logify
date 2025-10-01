import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string | undefined;
  ctid: string | undefined;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext {
  return storage.getStore() ?? { requestId: undefined, ctid: undefined };
}

export function setContext(next: Partial<RequestContext>): void {
  const current = getContext();
  const merged = { ...current, ...next };
  storage.enterWith(merged);
}

