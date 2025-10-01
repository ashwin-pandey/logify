import { getContext } from './context';

export interface PropagationHeadersOptions {
  requestIdHeader: string;
  ctidHeader: string;
}

export function buildPropagationHeaders(opts: PropagationHeadersOptions): Record<string, string> {
  const { requestId, ctid } = getContext();
  const headers: Record<string, string> = {};
  if (requestId) headers[opts.requestIdHeader] = requestId;
  if (ctid) headers[opts.ctidHeader] = ctid;
  return headers;
}

