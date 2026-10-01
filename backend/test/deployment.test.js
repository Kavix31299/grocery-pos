const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

// Run away from .env files and never inherit database or signing credentials.
const runIsolated = (source, overrides = {}) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP)$/i.test(key)));
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: os.tmpdir(),
    env: { ...env, NODE_ENV: 'test', ...overrides },
    encoding: 'utf8',
    timeout: 15000
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
};

const dbPath = JSON.stringify(path.resolve(__dirname, '../src/config/db.js'));
const serverPath = JSON.stringify(path.resolve(__dirname, '../src/server.js'));

// Each diagnostic case runs with a replacement database module and an ephemeral
// test verifier. Never read the private production-test token or load pg here.
const databaseDiagnosticFixture = async (serverFile, scenario) => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const { createHash, randomBytes } = require('node:crypto');
  const { once } = require('node:events');
  const token = randomBytes(32).toString('hex');
  const digest = createHash('sha256').update(token).digest('hex');
  let source = fs.readFileSync(serverFile, 'utf8');
  const verifier = /const DATABASE_DIAGNOSTIC_TOKEN_SHA256 = '[a-f0-9]{64}';/;
  assert.equal(verifier.test(source), true);
  source = source.replace(verifier, `const DATABASE_DIAGNOSTIC_TOKEN_SHA256 = '${digest}';`);
  const expiry = /const DATABASE_DIAGNOSTIC_EXPIRES_AT = Date.parse\('([^']+)'\);/.exec(source);
  assert.equal(Boolean(expiry), true);
  const expiresAt = Date.parse(expiry[1]);
  assert.equal(Number.isFinite(expiresAt), true);
  let now = expiresAt - 1;
  class DiagnosticDate extends Date {
    static now() { return now; }
  }
  const expected = {
    current_database: 'neondb',
    current_user: 'neondb_owner',
    current_schema: scenario === 'nulls' ? null : 'public',
    current_schemas: scenario === 'nulls' ? ['pg_catalog'] : ['pg_catalog', 'public'],
    public_users: scenario === 'nulls' ? null : 'users',
    users: scenario === 'nulls' ? null : 'users',
    search_path: '"$user", public'
  };
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args);
      if (scenario === 'error') {
        const error = new Error(token);
        error.details = { password: token, hostname: token };
        throw error;
      }
      return { rows: [{ ...expected, token, password: token, hostname: token, connectionString: token }] };
    }
  };
  const serverRequire = createRequire(serverFile);
  const dbFile = serverRequire.resolve('./config/db');
  require.cache[dbFile] = {
    id: dbFile, filename: dbFile, loaded: true,
    exports: { pool, query: (...args) => pool.query(...args) }
  };
  let logCount = 0;
  const quietConsole = Object.fromEntries(
    ['log', 'info', 'warn', 'error', 'debug'].map(name => [name, () => { logCount += 1; }])
  );
  const appModule = { exports: {} };
  // Compile in the native Promise realm so Express does not emit a cross-realm warning.
  const loadApp = vm.compileFunction(source,
    ['require', 'module', '__dirname', 'process', 'Buffer', 'Date', 'console'],
    { filename: serverFile });
  loadApp(serverRequire, appModule, path.dirname(serverFile), process, Buffer, DiagnosticDate, quietConsole);
  const server = appModule.exports.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/api/diagnostics/database-target`;
  const request = async (credential, status, expectedBody, method = 'GET') => {
    const headers = credential === null ? {} : { 'X-Database-Diagnostic-Token': credential };
    const response = await fetch(endpoint, { headers, method });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.text();
    assert.equal(body.includes(token), false);
    if (method === 'HEAD') {
      assert.equal(body, '');
    } else {
      assert.deepEqual(JSON.parse(body), expectedBody);
    }
  };
  try {
    if (scenario === 'unauthorized') {
      for (const credential of [null, 'malformed', randomBytes(32).toString('hex'), `${token},${token}`]) {
        await request(credential, 401, { error: 'unauthorized' });
      }
    } else if (scenario === 'expired') {
      for (const clock of [expiresAt, expiresAt + 1]) {
        now = clock;
        await request(token, 401, { error: 'unauthorized' });
      }
    } else if (scenario === 'methods') {
      for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
        await request(token, 405, { error: 'method_not_allowed' }, method);
      }
    } else {
      await request(token, scenario === 'error' ? 503 : 200,
        scenario === 'error' ? { error: 'database_diagnostic_failed' } : expected);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].length, 1);
      assert.equal(calls[0][0].trim(), `SELECT
  pg_catalog.current_database()::text AS current_database,
  current_user::text AS current_user,
  pg_catalog.current_schema()::text AS current_schema,
  pg_catalog.current_schemas(true)::text[] AS current_schemas,
  pg_catalog.to_regclass('public.users')::text AS public_users,
  pg_catalog.to_regclass('users')::text AS users,
  pg_catalog.current_setting('search_path') AS search_path;`);
    }
    if (['unauthorized', 'expired', 'methods'].includes(scenario)) {
      assert.equal(calls.length, 0);
    }
    assert.equal(logCount, 0);
    assert.equal(Object.keys(require.cache).some(file => /[\\/]node_modules[\\/]pg[\\/]/.test(file)), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
};

for (const [scenario, description] of [
  ['unauthorized', 'rejects missing, malformed and incorrect credentials without querying'],
  ['expired', 'rejects credentials at and after the fixed expiry without querying'],
  ['methods', 'rejects non-GET methods without querying'],
  ['success', 'returns only the seven approved fields using the fixed SELECT'],
  ['nulls', 'preserves missing-relation and schema nulls'],
  ['error', 'returns only the sanitized 503 and does not log database errors']
]) {
  test(`database diagnostic: ${description}; no-store and silent output`, () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP)$/i.test(key)));
    const source = `(${databaseDiagnosticFixture.toString()})(${serverPath}, ${JSON.stringify(scenario)})
      .catch(() => { process.exitCode = 1; });`;
    const result = spawnSync(process.execPath, ['-e', source], {
      cwd: os.tmpdir(), env: { ...env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 15000
    });
    // Only report booleans/counts, including on failure; never forward child output.
    assert.equal(result.stdout?.length, 0, 'Diagnostic child stdout must be empty');
    assert.equal(result.stderr?.length, 0, 'Diagnostic child stderr must be empty');
    assert.equal(result.status, 0, 'Isolated diagnostic assertions must pass');
  });
}

test('Vercel import exports Express without starting a listener; API routes stay mounted', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { once } = require('node:events');
    const http = require('node:http');
    const originalListen = http.Server.prototype.listen;
    http.Server.prototype.listen = () => { throw new Error('Listener started during import'); };
    const signalCount = process.listenerCount('SIGTERM');
    const app = require(${serverPath});
    assert.equal(typeof app, 'function');
    assert.equal(process.listenerCount('SIGTERM'), signalCount);
    http.Server.prototype.listen = originalListen;
    const { pool } = require(${dbPath});
    assert.equal(pool.totalCount, 0);
    pool.query = async () => ({ rows: [{ current_time: 'test-time' }] });
    (async () => {
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const origin = 'http://127.0.0.1:' + server.address().port;
        for (const [route, status] of [
          ['/api', 200], ['/health', 200], ['/health/db', 200],
          ['/api/products', 401], ['/api/auth/profile', 401], ['/api/missing', 404]
        ]) {
          const response = await fetch(origin + route);
          assert.equal(response.status, status, route);
          assert.ok(response.headers.get('content-type').includes('application/json'));
          const body = await response.json();
          if (route === '/health/db') assert.equal(body.database, 'connected');
        }
      } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
      }
    })().catch(() => { process.exitCode = 1; });
  `, { VERCEL: '1', DATABASE_URL: 'postgresql://example.invalid/test?sslmode=verify-full' });
});

test('production, Vercel and Render reject missing URLs even when local DB settings exist', () => {
  for (const runtime of [{ VERCEL: '1' }, { RENDER: 'true' }, { NODE_ENV: 'production' }]) {
    for (const databaseUrl of [undefined, '', '   ']) {
      runIsolated(`
        const assert = require('node:assert/strict');
        assert.throws(() => require(${dbPath}), error =>
          error.message.includes('DATABASE_URL is required in production/Vercel'));
      `, {
        ...runtime,
        ...(databaseUrl === undefined ? {} : { DATABASE_URL: databaseUrl }),
        DB_HOST: 'localhost', DB_PORT: '5432', PGHOST: 'localhost'
      });
    }
  }
});

test('invalid and local production URLs fail without exposing connection credentials', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const urls = [
      'postgresql:///test',
      'postgresql://example.invalid/',
      'https://example.invalid/test',
      'not-a-url',
      'postgresql://user:TEST_ONLY_PASSWORD@localhost/test',
      'postgresql://user:TEST_ONLY_PASSWORD@127.0.0.1/test',
      'postgresql://user:TEST_ONLY_PASSWORD@[::1]/test',
      'postgresql://user:TEST_ONLY_PASSWORD@example.invalid/test?host=localhost',
      'postgresql://user:TEST_ONLY_PASSWORD@example.invalid/test?host=%2Ftmp',
      'postgresql://user:TEST_ONLY_PASSWORD%E0%A4@example.invalid/test'
    ];
    for (const url of urls) {
      process.env.DATABASE_URL = url;
      assert.throws(() => require(${dbPath}), error => {
        assert.match(error.message, /DATABASE_URL/);
        assert.ok(!error.stack.includes('TEST_ONLY_PASSWORD'));
        assert.equal(error.cause, undefined);
        return true;
      });
    }
  `, { NODE_ENV: 'production' });
});

test('Render internal URL and local Docker PostgreSQL keep their non-TLS connections', () => {
  for (const env of [
    { RENDER: 'true', DATABASE_URL: 'postgresql://render-db.internal/test' },
    { DB_HOST: 'db', DB_NAME: 'test' }
  ]) {
    runIsolated(`
      const assert = require('node:assert/strict');
      const { pool } = require(${dbPath});
      const client = new pool.Client(pool.options);
      assert.equal(client.connectionParameters.host, ${JSON.stringify(env.RENDER ? 'render-db.internal' : 'db')});
      assert.equal(client.connectionParameters.ssl, false);
      assert.equal(pool.totalCount, 0);
      pool.end();
    `, env);
  }
});

test('local DATABASE_URL takes precedence over individual DB fields', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { pool } = require(${dbPath});
    const client = new pool.Client(pool.options);
    assert.equal(client.connectionParameters.host, '127.0.0.1');
    assert.equal(client.connectionParameters.port, 5433);
    assert.equal(client.connectionParameters.database, 'test');
    assert.equal(client.connectionParameters.ssl, false);
    pool.end();
  `, { DATABASE_URL: 'postgresql://127.0.0.1:5433/test?sslmode=disable', DB_HOST: 'ignored' });
});

test('dotenv uses backend/.env from any working directory and preserves platform variables', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'grocery-pos-env-test-'));
  try {
    const configDir = path.join(fixture, 'src', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(fixture, '.env'), [
      'DATABASE_URL=postgresql://fixture.invalid/local',
      'DB_HOST=fixture.invalid',
      'GROCERY_POS_ENV_TEST=loaded'
    ].join('\n'));
    const envPath = JSON.stringify(path.resolve(__dirname, '../src/config/env.js'));
    const loadEnv = `
      const fs = require('node:fs');
      const { createRequire } = require('node:module');
      require('node:vm').runInNewContext(fs.readFileSync(${envPath}, 'utf8'), {
        process, module: { exports: {} },
        require: createRequire(${envPath}),
        __dirname: ${JSON.stringify(configDir)}
      });
    `;

    runIsolated(`
      const assert = require('node:assert/strict');
      ${loadEnv}
      assert.equal(process.env.DATABASE_URL, 'postgresql://fixture.invalid/local');
      assert.equal(process.env.GROCERY_POS_ENV_TEST, 'loaded');
    `, { NODE_ENV: 'development' });

    runIsolated(`
      const assert = require('node:assert/strict');
      ${loadEnv}
      assert.equal(process.env.DATABASE_URL, 'postgresql://platform.invalid/runtime');
      assert.equal(process.env.GROCERY_POS_ENV_TEST, 'loaded');
    `, { NODE_ENV: 'development', DATABASE_URL: 'postgresql://platform.invalid/runtime' });

    for (const runtime of [
      { NODE_ENV: 'production' }, { NODE_ENV: 'development', VERCEL: '1' },
      { NODE_ENV: 'development', RENDER: 'true' }, { NODE_ENV: 'test' }
    ]) {
      runIsolated(`
        const assert = require('node:assert/strict');
        ${loadEnv}
        assert.equal(process.env.DATABASE_URL, undefined);
        assert.equal(process.env.DB_HOST, undefined);
        assert.equal(process.env.GROCERY_POS_ENV_TEST, undefined);
      `, runtime);
    }
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('grocery-pos-env-test-'));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('standalone production entrypoint listens on the supplied PORT', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { spawn } = require('node:child_process');
    const { once } = require('node:events');
    const net = require('node:net');
    (async () => {
      const probe = net.createServer().listen(0, '127.0.0.1');
      await once(probe, 'listening');
      const port = probe.address().port;
      await new Promise(resolve => probe.close(resolve));
      const child = spawn(process.execPath, [${serverPath}], {
        env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
      });
      const exited = once(child, 'exit');
      try {
        await new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('exit', () => reject(new Error('Server exited before listening')));
          child.stdout.on('data', chunk => {
            if (chunk.toString().includes('listening on port ' + port)) resolve();
          });
        });
        const response = await fetch('http://127.0.0.1:' + port + '/health');
        assert.equal(response.status, 200);
        assert.equal((await response.json()).status, 'ok');
      } finally {
        child.kill();
        await exited;
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.invalid/test?sslmode=verify-full' });
});

test('Neon URL enables verified TLS and Vercel pool cleanup without connecting', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { pool } = require(${dbPath});
    const client = new pool.Client(pool.options);
    assert.ok(client.connectionParameters.ssl);
    assert.notEqual(client.connectionParameters.ssl.rejectUnauthorized, false);
    assert.equal(pool.options.connectionString, process.env.DATABASE_URL);
    assert.equal(pool.options.max, 5);
    assert.equal(pool.options.idleTimeoutMillis, 5000);
    assert.ok(pool.listenerCount('release') > 0);
    assert.equal(pool.totalCount, 0);
    pool.end();
  `, {
    VERCEL: '1',
    DATABASE_URL: 'postgresql://example.invalid/test?sslmode=require&channel_binding=require'
  });
});

test('production URL overrides stale local fields and controls TLS without VERCEL', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { pool } = require(${dbPath});
    const client = new pool.Client(pool.options);
    assert.equal(pool.options.connectionString, process.env.DATABASE_URL);
    assert.equal(Object.hasOwn(pool.options, 'host'), false);
    assert.equal(Object.hasOwn(pool.options, 'port'), false);
    assert.equal(Object.hasOwn(pool.options, 'ssl'), false);
    assert.equal(client.connectionParameters.host, 'example.invalid');
    assert.equal(client.connectionParameters.port, 6543);
    assert.equal(client.connectionParameters.database, 'test');
    assert.ok(client.connectionParameters.ssl);
    assert.notEqual(client.connectionParameters.ssl.rejectUnauthorized, false);
    assert.equal(pool.totalCount, 0);
    pool.end();
  `, {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example.invalid:6543/test?sslmode=verify-full',
    DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'ignored',
    PGHOST: 'localhost', PGPORT: '5432', DB_SSL: 'false', DB_SSL_REJECT_UNAUTHORIZED: 'false'
  });
});

test('local PostgreSQL and explicit TLS settings remain supported', () => {
  for (const [overrides, ssl] of [[{ DB_SSL: 'false' }, false], [{ DB_SSL: 'true' }, true]]) {
    runIsolated(`
      const assert = require('node:assert/strict');
      const { pool } = require(${dbPath});
      const client = new pool.Client(pool.options);
      assert.equal(Boolean(client.connectionParameters.ssl), ${ssl});
      assert.equal(client.connectionParameters.host, 'localhost');
      assert.equal(client.connectionParameters.port, 5432);
      if (${ssl}) assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
      assert.equal(pool.options.max, 10);
      assert.equal(pool.listenerCount('release'), 0);
      pool.end();
    `, overrides);
  }
});
