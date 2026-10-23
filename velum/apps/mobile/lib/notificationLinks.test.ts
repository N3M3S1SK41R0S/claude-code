import { describe, expect, it } from 'vitest';

import { isAllowedNotificationRoute, routeFromNotificationData } from './notificationLinks';
import { routes } from './routes';

describe('liens profonds des notifications', () => {
  it('ouvre les écrans internes de la liste blanche', () => {
    expect(routeFromNotificationData({ url: '/cellar-peak' })).toBe('/cellar-peak');
    expect(routeFromNotificationData({ url: routes.cellarPeak() })).toBe('/cellar-peak');
    expect(routeFromNotificationData({ url: routes.cellarSommelier('gigot d’agneau') })).toBe(
      routes.cellarSommelier('gigot d’agneau'),
    );
    expect(routeFromNotificationData({ url: routes.item('abc-123'), itemId: 'abc-123' })).toBe('/item/abc-123');
  });

  it('refuse URL externes, chemins détournés et payloads malformés', () => {
    for (const url of [
      'https://evil.example/phish',
      '//evil.example',
      'javascript:alert(1)',
      '/item/',
      '/item/../paywall',
      '/paywall',
      '/settings\\x',
      '/cellar-peak extra',
      `/item/${'a'.repeat(400)}`,
    ]) {
      expect(isAllowedNotificationRoute(url)).toBe(false);
    }
    expect(routeFromNotificationData(null)).toBeNull();
    expect(routeFromNotificationData('/cellar-peak')).toBeNull();
    expect(routeFromNotificationData([{ url: '/cellar-peak' }])).toBeNull();
    expect(routeFromNotificationData({ url: 42 })).toBeNull();
    expect(routeFromNotificationData({})).toBeNull();
  });
});
