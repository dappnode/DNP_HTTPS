const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { finished } = require("node:stream/promises");
const { before, after, test } = require("node:test");
const axios = require("axios");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "https-certificates-"));
process.env.CERT_BASE_DIR = tempDir;
process.env.DAPPMANAGER_SIGN = "http://signer.test/sign";
process.env.CERTAPI_URL = "certificates.test";
delete process.env.FORCE;
const { config } = require("../build/config");
const apiSign = require("../build/certificates/apiSign").default;
let matchingCert;
let otherCert;

before(() => {
  for (const name of ["domain", "other"]) {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        `/CN=${name}.test`,
        "-keyout",
        path.join(tempDir, `${name}.key`),
        "-out",
        path.join(tempDir, `${name}.crt`),
      ],
      { stdio: "ignore" },
    );
  }
  matchingCert = fs.readFileSync(path.join(tempDir, "domain.crt"), "utf8");
  otherCert = fs.readFileSync(path.join(tempDir, "other.crt"), "utf8");
  fs.writeFileSync(config.csrPath, "test CSR");
});
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

function mockSigner(t, certificates) {
  const forceValues = [];
  t.mock.method(axios, "post", async () => ({
    data: { signature: "signature", address: "address" },
  }));
  t.mock.method(axios, "postForm", async (url, { csr }) => {
    await finished(csr.resume());
    const data = certificates[forceValues.length];
    forceValues.push(new URL(url).searchParams.get("force"));
    return { data };
  });
  return forceValues;
}

test("a matching certificate is installed with one signing request", async (t) => {
  const forces = mockSigner(t, [matchingCert]);
  await apiSign();
  assert.deepEqual(forces, ["0"]);
  assert.equal(fs.readFileSync(config.certPath, "utf8"), matchingCert);
});

test("a key mismatch forces one retry and validates its certificate", async (t) => {
  const forces = mockSigner(t, [otherCert, matchingCert]);
  await apiSign();
  assert.deepEqual(forces, ["0", "1"]);
  assert.equal(fs.readFileSync(config.certPath, "utf8"), matchingCert);
});

test("a mismatched retry preserves the installed certificate", async (t) => {
  fs.writeFileSync(config.certPath, matchingCert);
  const forces = mockSigner(t, [otherCert, otherCert]);
  await assert.rejects(apiSign(), /does not match the domain private key/);
  assert.deepEqual(forces, ["0", "1"]);
  assert.equal(fs.readFileSync(config.certPath, "utf8"), matchingCert);
});

test("an invalid certificate response preserves the installed certificate", async (t) => {
  fs.writeFileSync(config.certPath, matchingCert);
  mockSigner(t, ["not a certificate"]);
  await assert.rejects(apiSign());
  assert.equal(fs.readFileSync(config.certPath, "utf8"), matchingCert);
});

async function captureRenewalTimer(t, shouldRenew) {
  const openssl = require("../build/certificates/openssl");
  for (const name of [
    "generateDummyCert",
    "generateDomainKey",
    "generateDHParam",
    "createCSR",
  ]) {
    t.mock.method(openssl, name, async () => {});
  }
  t.mock.method(openssl, "shouldRenew", shouldRenew);
  const sign = t.mock.method(
    require("../build/certificates/apiSign"),
    "default",
    async () => {},
  );
  let callback;
  t.mock.method(global, "setInterval", (fn) => {
    callback = fn;
  });
  await require("../build/certificates").default("example.test");
  return { tick: () => callback(), sign };
}

test("scheduled renewal reloads nginx only when a certificate changes", async (t) => {
  let renew = true;
  const { tick, sign } = await captureRenewalTimer(t, async () => renew);
  const reload = t.mock.method(
    require("../build/utils/shell"),
    "default",
    async () => "",
  );
  await tick();
  assert.equal(sign.mock.callCount(), 1);
  assert.deepEqual(reload.mock.calls[0].arguments, ["nginx -s reload"]);
  renew = false;
  await tick();
  assert.equal(sign.mock.callCount(), 1);
  assert.equal(reload.mock.callCount(), 1);
});

test("a failed reload is retried without requesting another certificate", async (t) => {
  let renew = true;
  const { tick, sign } = await captureRenewalTimer(t, async () => renew);
  let reloads = 0;
  t.mock.method(require("../build/utils/shell"), "default", async () => {
    if (++reloads === 1) throw new Error("Reload failed");
    return "";
  });
  t.mock.method(console, "warn", () => {});
  await tick();
  renew = false;
  await tick();
  await tick();
  assert.equal(reloads, 2);
  assert.equal(sign.mock.callCount(), 1);
});
