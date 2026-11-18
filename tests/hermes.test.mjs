// Hermes as the agent: a map made in a Hermes session records it, and its questions run through `hermes chat`.
// Hermes has no read-only sandbox, so what's checked is how the run is narrowed: file and terminal tools only,
// none of the person's rules or memory, and out of their session list. A stand-in CLI (fixtures/fake-cli)
// records what it was given, so these run without Hermes installed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { REPO, shopApp, run, readGraph, cleanup, lib } from './helpers.mjs';

const FAKE = path.join(REPO, 'tests', 'fixtures', 'fake-cli');
let root;
const servers = [];

/** Starts the map's server with only the stand-in Hermes to be found; returns { base, token, page, calls }. */
async function serve() {
  const log = path.join(root, `fake-${servers.length}.log`);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const none = path.join(root, 'no-such-cli');
  const server = spawn(process.execPath, [path.join(root, 'floorplan', 'serve.mjs'), '--port', String(port), '--no-open'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FLOORPLAN_NO_PROMPTS: '1', FLOORPLAN_ENGINE: '', FAKE_LOG: log, FLOORPLAN_CLAUDE: none, FLOORPLAN_CODEX: none, FLOORPLAN_HERMES: path.join(FAKE, 'fake-hermes.mjs') },
  });
  servers.push(server);
  const base = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`server didn't start: ${out}`)), 20000);
    server.stdout.on('data', (d) => { out += d; const m = /Floorplan: (http:\/\/\S+)/.exec(out); if (m) { clearTimeout(timer); resolve(m[1]); } });
    server.on('exit', (code) => reject(new Error(`server exited (${code}): ${out}`)));
  });
  const html = await (await fetch(base + '/')).text();
  const page = JSON.parse(/window\.FLOORPLAN_SERVER=(\{.*?\});/.exec(html)[1]);
  return { base, token: page.token, page, html, calls: () => fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) };
}
async function ask(s, question, session) {
  const r = await fetch(s.base + '/api/ask', { method: 'POST', headers: { 'content-type': 'application/json', 'x-floorplan-token': s.token }, body: JSON.stringify({ question, session }) });
  return (await r.text()).split('\n\n').filter(Boolean).map((b) => ({ event: /^event: (\w+)/.exec(b)[1], data: JSON.parse(/^data: (.*)$/m.exec(b)[1]) }));
}
const pick = (events, name) => events.filter((e) => e.event === name).map((e) => e.data);

before(() => { root = shopApp(); run('scan.mjs', root); run('build.mjs', root, '--agent', 'hermes'); });
after(async () => {
  await Promise.all(servers.filter((s) => s.exitCode === null).map((s) => new Promise((resolve) => { s.once('exit', resolve); s.kill(); })));
  cleanup(root);
});

test('a Hermes session is recognised by the variables Hermes sets, and named ones still win', async () => {
  const { detectAgent } = await lib('agent.mjs');
  assert.equal(detectAgent({}, { HERMES_AGENT: 'true' }), 'hermes');
  assert.equal(detectAgent({}, { HERMES_SESSION_ID: 'local-1' }), 'hermes');
  assert.equal(detectAgent({}, {}), 'claude');
  assert.equal(detectAgent({ agent: 'codex' }, { HERMES_AGENT: 'true' }), 'codex');
});

test('a map built by Hermes records it and leaves the project\'s notes alone', () => {
  assert.equal(readGraph(root).meta.agent, 'hermes');
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.local.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
});

test('questions run through Hermes, narrowed to its file and terminal tools and kept out of the session list', async () => {
  const s = await serve();
  assert.equal(s.page.engine, 'hermes');
  assert.equal(s.page.cli, true);
  assert.equal(s.page.version, 'Hermes Agent v0.0.0-test (2026.1.1)', 'only the first line of --version');
  assert.equal(s.page.change, false, 'answers are not held to a schema, so Change is not offered');

  const events = await ask(s, 'How do refunds work?');
  assert.deepEqual(pick(events, 'progress').map((p) => p.text), ['Searching the map for "refund"', 'Reading shop-api/routes/orders.js', 'Searching code for "refund"']);
  const [answer] = pick(events, 'answer');
  assert.equal(answer.title, 'Refunds', 'a fenced JSON answer is read');
  assert.deepEqual(answer.items.map((i) => i.id), ['f:shop-api/routes/orders.js']);
  assert.equal(answer.session, 'local-test-session');

  const [call] = s.calls();
  const flag = (name) => call.args[call.args.indexOf(name) + 1];
  assert.equal(call.args[0], 'chat');
  assert.equal(flag('--toolsets'), 'file,terminal', 'no web, browser, memory or connected apps');
  assert.ok(call.args.includes('--ignore-rules'), 'none of the person\'s rules, memory or skills');
  assert.equal(flag('--source'), 'tool', 'stays out of the person\'s session list');
  assert.equal(flag('--format'), 'stream-json');
  assert.ok(!call.args.includes('--yolo'), 'never waves through commands Hermes would stop to ask about');
  assert.ok(!call.args.includes('--resume'));
  assert.match(call.input, /How do refunds work\?/);
  assert.match(call.input, /node floorplan\/query\.mjs/);
  assert.match(call.input, /Only read/);
  assert.match(call.input, /JSON Schema/);
});

test('a follow-up resumes the Hermes session and sends only the new question', async () => {
  const s = await serve();
  await ask(s, 'Who can ask for one?', 'local-test-session');
  const [call] = s.calls();
  assert.equal(call.args[call.args.indexOf('--resume') + 1], 'local-test-session');
  assert.equal(call.input, 'Who can ask for one?');
});

test('when Hermes can\'t answer, the map says why instead of hanging', async () => {
  const s = await serve();
  const events = await ask(s, 'NO-MODEL please');
  assert.equal(pick(events, 'answer').length, 0);
  assert.match(pick(events, 'failure')[0].message, /No inference provider configured/);
});

test('the page names Hermes in its prompts, not another agent', async () => {
  const html = fs.readFileSync(path.join(root, 'floorplan', 'index.html'), 'utf8');
  assert.match(html, /AGENT_ID === 'hermes'/);
  assert.match(html, /"agent":"hermes"/);
});
