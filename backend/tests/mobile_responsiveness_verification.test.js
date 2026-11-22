/**
 * Mobile Responsiveness & Phone Optimization Automated Verification Test
 * 
 * Verifies that the AOTUC web-admin application fulfills all mobile requirements:
 * 1. Base CSS prevents horizontal overflow and enables smooth touch manipulation.
 * 2. Mobile navigation drawer with touch open/close, profile card, and logout button.
 * 3. Responsive form grids (grid-cols-1 sm:grid-cols-2 / sm:grid-cols-3) preventing field squashing.
 * 4. Responsive data lists with mobile cards for drivers, vehicles, syndicats, and users.
 * 5. Full-screen and modal touch targets (min-h-[44px] / min-h-[40px]).
 * 6. Interactive Conakry GIS Map responsiveness on mobile viewports.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ADMIN_SRC = path.resolve(__dirname, '../../web-admin/src');

describe('AOTUC Web-Admin Mobile Responsiveness Verification', () => {

  test('1. Base CSS has mobile overflow protection and touch manipulation rules', () => {
    const cssPath = path.join(WEB_ADMIN_SRC, 'index.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('max-width: 100vw');
    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('touch-action: manipulation');
  });

  test('2. Navbar includes mobile menu hamburger toggle and responsive popovers', () => {
    const navbarPath = path.join(WEB_ADMIN_SRC, 'components/Navbar.tsx');
    expect(fs.existsSync(navbarPath)).toBe(true);
    const navbar = fs.readFileSync(navbarPath, 'utf8');

    expect(navbar).toContain('isMobileMenuOpen');
    expect(navbar).toContain('onToggleMobileMenu');
    expect(navbar).toContain('lg:hidden');
    // Ensure button touch target is at least 44px
    expect(navbar).toContain('min-w-[44px]');
    expect(navbar).toContain('min-h-[44px]');
  });

  test('3. Sidebar provides desktop sidebar (hidden lg:flex) and mobile slide-out drawer (lg:hidden)', () => {
    const sidebarPath = path.join(WEB_ADMIN_SRC, 'components/Sidebar.tsx');
    expect(fs.existsSync(sidebarPath)).toBe(true);
    const sidebar = fs.readFileSync(sidebarPath, 'utf8');

    // Desktop
    expect(sidebar).toContain('hidden lg:flex');
    // Mobile slide-out drawer
    expect(sidebar).toContain('lg:hidden');
    expect(sidebar).toContain('fixed inset-y-0 left-0');
    expect(sidebar).toContain('max-w-[85vw]');
    expect(sidebar).toContain('z-50');
    // Touch targets >= 44px
    expect(sidebar).toContain('min-h-[44px]');
    // One-tap logout in mobile drawer
    expect(sidebar).toContain('Se Déconnecter');
  });

  test('4. App.tsx wires mobile drawer state and handles responsive main padding', () => {
    const appPath = path.join(WEB_ADMIN_SRC, 'App.tsx');
    expect(fs.existsSync(appPath)).toBe(true);
    const app = fs.readFileSync(appPath, 'utf8');

    expect(app).toContain('isMobileMenuOpen');
    expect(app).toContain('setIsMobileMenuOpen');
    expect(app).toContain('overflow-x-hidden');
    expect(app).toContain('p-3 sm:p-5 md:p-6');
  });

  test('5. RegistrationDesk has responsive grids, mobile cards, and modal max-height', () => {
    const regPath = path.join(WEB_ADMIN_SRC, 'features/enrolment/RegistrationDesk.tsx');
    expect(fs.existsSync(regPath)).toBe(true);
    const reg = fs.readFileSync(regPath, 'utf8');

    // Form inputs: responsive grids
    expect(reg).toContain('grid-cols-1 sm:grid-cols-2');
    expect(reg).toContain('grid-cols-1 sm:grid-cols-3');
    // Mobile cards for drivers and vehicles
    expect(reg).toContain('sm:hidden divide-y');
    expect(reg).toContain('hidden sm:block overflow-x-auto');
    // Modals with max-height and internal scrolling
    expect(reg).toContain('max-h-[90vh] flex flex-col');
    expect(reg).toContain('overflow-y-auto flex-1');
  });

  test('6. UnionManagementView has responsive filters and mobile card list', () => {
    const unionPath = path.join(WEB_ADMIN_SRC, 'features/unions/UnionManagementView.tsx');
    expect(fs.existsSync(unionPath)).toBe(true);
    const union = fs.readFileSync(unionPath, 'utf8');

    expect(union).toContain('flex flex-wrap items-center');
    expect(union).toContain('sm:hidden divide-y');
    expect(union).toContain('hidden sm:block overflow-x-auto');
  });

  test('7. UserManagementView has mobile user cards and responsive creation modal', () => {
    const userPath = path.join(WEB_ADMIN_SRC, 'features/users/UserManagementView.tsx');
    expect(fs.existsSync(userPath)).toBe(true);
    const user = fs.readFileSync(userPath, 'utf8');

    expect(user).toContain('sm:hidden divide-y');
    expect(user).toContain('hidden sm:block overflow-x-auto');
    expect(user).toContain('max-h-[90vh] flex flex-col');
    expect(user).toContain('grid-cols-1 sm:grid-cols-2');
  });

  test('8. DashboardOverview and ValidationQueue buttons stack comfortably on mobile', () => {
    const dashPath = path.join(WEB_ADMIN_SRC, 'features/dashboard/DashboardOverview.tsx');
    const valPath = path.join(WEB_ADMIN_SRC, 'features/validation/ValidationQueue.tsx');

    const dash = fs.readFileSync(dashPath, 'utf8');
    const val = fs.readFileSync(valPath, 'utf8');

    expect(dash).toContain('w-full sm:w-auto');
    expect(dash).toContain('flex-col sm:flex-row');

    expect(val).toContain('flex-col sm:flex-row flex-wrap');
    expect(val).toContain('w-full sm:w-auto min-h-[44px]');
  });

  test('9. ConakryMapWidget supports mobile viewport width and touch controls', () => {
    const mapPath = path.join(WEB_ADMIN_SRC, 'features/mapping/ConakryMapWidget.tsx');
    expect(fs.existsSync(mapPath)).toBe(true);
    const map = fs.readFileSync(mapPath, 'utf8');

    expect(map).toContain('max-w-[190px] sm:max-w-none');
    expect(map).toContain('min-w-[36px] min-h-[36px]');
    expect(map).toContain('overflow-hidden');
  });

});
