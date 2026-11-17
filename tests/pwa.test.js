// =====================================================
// tests/pwa.test.js — App packaging checks (Node only, no browser)
// Catches broken releases: missing files, invalid manifest,
// service-worker cache list pointing at files that don't exist.
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..");
const exists = f => fs.existsSync(path.join(ROOT, f));

test("manifest.json is valid JSON with required fields", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  for (const k of ["name", "short_name", "start_url", "display", "icons"])
    assert.ok(m[k], `manifest.json is missing "${k}"`);
});

test("every manifest icon file exists", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  for (const icon of m.icons) assert.ok(exists(icon.src), `missing icon: ${icon.src}`);
});

test("every file in the service-worker cache list exists", () => {
  // If a cached file is missing, the service worker fails to install and offline mode breaks.
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const block = sw.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(block, "STATIC_ASSETS list not found in sw.js");
  const files = [...block[1].matchAll(/["']\.\/([^"']+)["']/g)].map(x => x[1]);
  assert.ok(files.length > 0, "STATIC_ASSETS is empty");
  for (const f of files) assert.ok(exists(f), `sw.js caches a file that does not exist: ${f}`);
});

test("every local script referenced by index.html exists", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const refs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x => x[1])
    .filter(src => !/^https?:/.test(src));
  assert.ok(refs.length > 0, "no local scripts found in index.html");
  for (const src of refs) assert.ok(exists(src), `index.html loads a missing script: ${src}`);
});

test("app version is the same everywhere (About page, service worker, package.json)", () => {
  // The About page (Settings → About) shows APP_INFO.version from config.js.
  // The service worker's CACHE_NAME decides when installed phones update.
  // They must always match, so users see the version they actually run.
  const config = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
  const shown = config.match(/version:\s*"([\d.]+)"/)?.[1];
  const cache = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").match(/CACHE_NAME\s*=\s*"finmatrix-v([\d.]+)"/)?.[1];
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  assert.ok(shown && cache, "version found in config.js and sw.js");
  assert.equal(shown, cache, `About page shows ${shown} but the service worker is ${cache}`);
  assert.equal(pkg, cache, `package.json is ${pkg} but the service worker is ${cache}`);
});
