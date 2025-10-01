const assert = require('assert');
const { loadConfigFromObject, createLogger, runWithContext } = require('../dist/cjs/index.js');

function captureStdout(fn) {
  const origWrite = process.stdout.write;
  const chunks = [];
  process.stdout.write = (chunk, enc, cb) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    if (typeof cb === 'function') cb();
    return true;
  };
  try { fn(); } finally { process.stdout.write = origWrite; }
  return chunks.join('');
}

(function run() {
  const config = loadConfigFromObject({ logLevel: 'debug', transport: 'console', autoModule: false });
  const logger = createLogger(config);
  const output = captureStdout(() => {
    runWithContext({ requestId: '11111111-1111-1111-1111-111111111111', ctid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, () => {
      logger.info('hello', { foo: 'bar' }, 'test.smoke');
    });
  });
  const lines = output.trim().split('\n');
  assert(lines.length >= 1, 'expected at least one log line');
  const obj = JSON.parse(lines[0]);
  assert.equal(obj.level, 'info');
  assert.equal(obj.message, 'hello');
  assert.equal(obj.requestId, '11111111-1111-1111-1111-111111111111');
  assert.equal(obj.ctid, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(obj.module, 'test.smoke');
  assert.deepEqual(obj.details, { foo: 'bar' });
  console.log('smoke test passed');
})();

