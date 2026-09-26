// Spec 022 — global test setup. Loaded for every vitest file (node + jsdom).
// jest-dom matchers are safe to import under node too: they only attach
// matchers to expect, they never touch document at import time.
import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
