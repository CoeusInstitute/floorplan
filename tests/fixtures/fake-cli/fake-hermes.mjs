// Stands in for `hermes` in tests: answers --version, and for `chat` logs what it was given (arguments,
// prompt) to $FAKE_LOG, then prints the JSONL events a real `hermes chat --format stream-json` run would.
// A prompt containing "NO-MODEL" fails the way Hermes does when it can't reach a model.
import fs from 'node:fs';

const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('Hermes Agent v0.0.0-test (2026.1.1)\nInstall directory: /nowhere'); process.exit(0); }
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args, input }) + '\n');
  const out = (ev) => console.log(JSON.stringify({ ...ev, timestamp: 1 }));
  out({ type: 'system', subtype: 'init', model: 'test-model', session_id: '' });
  if (input.includes('NO-MODEL')) {
    out({ type: 'result', session_id: '', exit_code: 1, text: '', error: 'No inference provider configured.' });
    process.exit(1);
  }
  out({ type: 'tool_use', name: 'terminal', input: { command: 'node floorplan/query.mjs find "refund"' } });
  out({ type: 'tool_result', name: 'terminal', output: '…', duration_ms: 1, is_error: false });
  out({ type: 'tool_use', name: 'read_file', input: { path: 'shop-api/routes/orders.js' } });
  out({ type: 'tool_use', name: 'search_files', input: { pattern: 'refund' } });
  out({ type: 'text', text: 'Let me check the refund route.' });
  // Hermes isn't held to a schema, so the answer can arrive fenced
  out({ type: 'result', session_id: 'local-test-session', exit_code: 0, text: '```json\n' + JSON.stringify({
    title: 'Refunds', answer: 'Refunds go through [[f:shop-api/routes/orders.js]].',
    items: [{ id: 'f:shop-api/routes/orders.js', note: 'Holds the refund endpoint.' }], steps: [], followups: ['Who can ask for one?'],
  }) + '\n```' });
});
