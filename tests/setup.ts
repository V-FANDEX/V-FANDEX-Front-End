import { webcrypto } from 'node:crypto';
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
