import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatically unmount and cleanup DOM after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (used by next-themes and responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (used by Radix UI primitives)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Ensure WebCrypto with Ed25519 & AES-GCM is available in JSDOM
if (typeof globalThis.crypto !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    writable: true,
    value: globalThis.crypto,
  });
}

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock HTMLImageElement for Radix UI Avatar in JSDOM
if (typeof window !== 'undefined' && window.Image) {
  Object.defineProperty(window.Image.prototype, 'src', {
    get() {
      return this._src || '';
    },
    set(src) {
      this._src = src;
      if (src) {
        Object.defineProperty(this, 'complete', { value: true, configurable: true });
        Object.defineProperty(this, 'naturalWidth', { value: 100, configurable: true });
        Object.defineProperty(this, 'naturalHeight', { value: 100, configurable: true });
        this.dispatchEvent(new Event('load'));
      }
    },
    configurable: true,
  });
}

