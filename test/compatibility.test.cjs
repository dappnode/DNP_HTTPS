const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { test } = require("node:test");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "https-compatibility-"));
process.env.DOMAINS_DIR = path.join(tempDir, "domains");
process.env.NGINX_PATH = path.join(tempDir, "nginx");
process.env.CERT_BASE_DIR = path.join(tempDir, "certs");

test("Express mapping API preserves responses and rollback behavior", async (t) => {
  const nginx = require("../build/api/utils/nginx");
  let reconfigured = true;
  let reconfigureError;
  nginx.reconfigureNGINX = async () => {
    if (reconfigureError) throw reconfigureError;
    return reconfigured;
  };
  const { getHttpsApi } = require("../build/api/app");
  const server = getHttpsApi("example.com").listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, status, body) {
    const res = await fetch(base + route);
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), body);
  }

  await request("/", 200, []);
  await request("/missing", 404, { error: "Not Found" });
  await request("/add?from=bad.name&to=backend:80", 400, {
    error: "Bad param 'from': Must not be FQDN nor contain any subdomains",
  });
  await request(
    "/add?from=app&to=backend:80&external=true&auth=user:pass",
    200,
    {},
  );
  await request("/", 200, [
    { from: "app", to: "backend:80", external: true, auth: "user:pass" },
  ]);
  await request("/add?from=app&to=other:80", 400, {
    error: "External endpoint already exists",
  });
  reconfigured = false;
  await request("/add?from=rollback&to=backend:80", 500, {
    error: "Unable to add mapping",
  });
  reconfigured = true;
  reconfigureError = new Error("Certificate service unavailable");
  await request("/add?from=retry&to=backend:80", 500, {
    error: "Certificate service unavailable",
  });
  // Both false returns and thrown errors must leave the original mapping intact.
  await request("/", 200, [
    { from: "app", to: "backend:80", external: true, auth: "user:pass" },
  ]);
  reconfigureError = undefined;
  await request("/add?from=retry&to=backend:80", 200, {});
  await request("/remove?from=retry", 200, {});
  await request(
    "/add?from=injected&to=" +
      encodeURIComponent('backend:80; return 200 "oops"; #'),
    400,
    { error: "Bad param 'to': Must be a host with an optional port" },
  );
  await request("/remove?from=app", 200, {});
  await request("/", 200, []);
  await request("/add?from=private&to=backend:80&external=false", 200, {});
  await request("/reconfig", 200, true);
  await request("/clear", 200, {});
  await request("/", 200, []);
});

test("proxy targets accept internal hosts and IPs while rejecting nginx syntax", () => {
  const { sanitizeTo } = require("../build/api/utils/sanitize");
  for (const target of [
    "backend",
    "backend:80",
    "my.dappnode",
    "service_name.dnp.dappnode.eth:8545",
    "192.168.1.20:65535",
    "[::1]",
    "[fd00::1]:8545",
    "[::ffff:192.0.2.1]:80",
  ]) {
    assert.equal(sanitizeTo(target), target);
  }
  for (const target of [
    "",
    ["backend", "other"],
    "backend:0",
    "backend:65536",
    "backend:abc",
    "backend/path",
    "http://backend",
    "backend\n",
    "backend other",
    "backend; return 200; #",
    'backend"',
    "backend$variable",
    "[not:ipv6]:80",
  ]) {
    assert.throws(() => sanitizeTo(target), /Bad param 'to'/);
  }
});

test("EJS renders nginx templates with proxy, auth and IPv6 options", async () => {
  const ejs = require("ejs");
  const { generateServerConfig } = require("../build/nginx/templater");
  process.env.LISTEN_IPV6 = "true";
  process.env.WEBSOCKET = "true";
  process.env.LOCAL_PROXYING = "true";
  process.env.LOCAL_PROXY_DOMAIN = "dappnode";
  process.env.GLOBAL_RESOLVER = "172.33.1.2";
  const config = await generateServerConfig(
    { from: "app", to: "backend:80", external: false, auth: "user:pass" },
    "example.com",
  );
  assert.match(config, /server_name app\.example\.com;/);
  assert.match(config, /listen\s+\[::\]:80;/);
  assert.match(config, /http2 on;/);
  assert.match(config, /auth_basic_user_file conf\.d\/app\.auth;/);
  assert.match(config, /proxy_set_header Connection \$connection_upgrade;/);
  assert.match(config, /deny all;/);
  assert.match(config, /set \$backend http:\/\/backend:80;/);
  const main = await ejs.renderFile("templates/nginx.conf.ejs", {
    data: { dummyCert: "/tmp/default.pem", dummyKey: "/tmp/default.key" },
  });
  assert.match(main, /map \$http_upgrade \$connection_upgrade/);
  const local = await ejs.renderFile("templates/static/localproxy.ejs", {});
  assert.match(local, /server_name\s+dappnode\.local;/);
  assert.match(local, /resolver 172\.33\.1\.2;/);
});
