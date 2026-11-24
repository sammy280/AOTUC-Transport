import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 1: AOTUC Service Worker Application Shell Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const webAdminPublicDir = path.join(rootDir, 'web-admin', 'public');
  const webAdminDistDir = path.join(rootDir, 'web-admin', 'dist');
  const swPath = path.join(webAdminPublicDir, 'sw.js');
  const distSwPath = path.join(webAdminDistDir, 'sw.js');
  const manifestPath = path.join(webAdminPublicDir, 'manifest.json');
  const distManifestPath = path.join(webAdminDistDir, 'manifest.json');
  const indexHtmlPath = path.join(rootDir, 'web-admin', 'index.html');
  const distIndexHtmlPath = path.join(webAdminDistDir, 'index.html');
  const mainTsxPath = path.join(rootDir, 'web-admin', 'src', 'main.tsx');

  test('1. Service worker file exists in public/ and is copied to dist/', () => {
    expect(fs.existsSync(swPath)).toBe(true);
    expect(fs.existsSync(distSwPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf8');
    const distSwContent = fs.readFileSync(distSwPath, 'utf8');
    expect(swContent.length).toBeGreaterThan(500);
    expect(swContent).toEqual(distSwContent);
  });

  test('2. Manifest file exists, is valid JSON, and is copied to dist/', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(distManifestPath)).toBe(true);

    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.name).toContain('AOTUC');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('3. HTML files correctly link to manifest, theme-color, and branding', () => {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const distIndexHtml = fs.readFileSync(distIndexHtmlPath, 'utf8');

    expect(indexHtml).toContain('href="/manifest.json"');
    expect(indexHtml).toContain('name="theme-color"');
    expect(indexHtml).toContain('href="/aotuc-logo.png"');

    expect(distIndexHtml).toContain('href="/manifest.json"');
    expect(distIndexHtml).toContain('name="theme-color"');
  });

  test('4. main.tsx registers service worker with update lifecycle tracking', () => {
    const mainTsx = fs.readFileSync(mainTsxPath, 'utf8');
    expect(mainTsx).toContain("'serviceWorker' in navigator");
    expect(mainTsx).toContain("register('/sw.js'");
    expect(mainTsx).toContain('updatefound');
  });

  test('5. Service worker parses as valid JavaScript without syntax errors', () => {
    const swContent = fs.readFileSync(swPath, 'utf8');
    // Test syntax by creating a Script
    expect(() => {
      new vm.Script(swContent);
    }).not.toThrow();
  });

  test('6. Service worker enforces strict API isolation (/api/* is network-only)', () => {
    const swContent = fs.readFileSync(swPath, 'utf8');
    // Must check for /api/ and return early without respondWith
    expect(swContent).toMatch(/url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
    // Ensure no caching for api requests
    const apiBlock = swContent.substring(
      swContent.indexOf("url.pathname.startsWith('/api/')"),
      swContent.indexOf("url.pathname.startsWith('/api/')") + 150
    );
    expect(apiBlock).toContain('return;');
  });

  test('7. Service worker precaches application shell and handles offline navigation fallback', () => {
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain("'/index.html'");
    expect(swContent).toContain("'/manifest.json'");
    expect(swContent).toContain("'/aotuc-logo.png'");
    expect(swContent).toContain("request.mode === 'navigate'");
    expect(swContent).toContain("caches.match('/index.html')");
  });

  test('8. Service worker manages cache lifecycle (skipWaiting and clients.claim)', () => {
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('self.skipWaiting()');
    expect(swContent).toContain('self.clients.claim()');
    expect(swContent).toContain('caches.delete');
  });
});
