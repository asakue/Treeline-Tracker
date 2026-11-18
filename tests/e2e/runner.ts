/**
 * Standalone Master Test Runner for Treeline Tracker E2E Test Suite
 * 
 * Capabilities:
 * - Standalone DSL: describe, it, test, beforeAll, afterAll, beforeEach, afterEach
 * - Rich Assertion Engine: expect(...).toBe, toEqual, toBeGreaterThan, toContain, toThrow, etc.
 * - Dynamic CLI options: --tier=1|2|3|4, --filter=<regex>, --bail, --timeout=<ms>
 * - Embedded TestServer auto-start with zero external dependencies
 * - Hierarchical tree output with timing & clean ANSI colors
 * - Final summary matrix report
 * - Exit code 0 on all tests passing, exit code 1 on failure
 */

import { TestServer } from './harness/testServer';

// ============================================================================
// ASSERTION ENGINE
// ============================================================================

export class AssertionError extends Error {
  constructor(message: string, public actual?: any, public expected?: any) {
    super(message);
    this.name = 'AssertionError';
  }
}

function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    return false;
  }
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export class Expectation<T = any> {
  private isNot = false;

  constructor(private actual: T) {}

  get not(): Expectation<T> {
    const inverted = new Expectation(this.actual);
    inverted.isNot = !this.isNot;
    return inverted;
  }

  get rejects(): { toThrow: (expected?: string | RegExp) => Promise<void> } {
    return {
      toThrow: async (expected?: string | RegExp) => {
        let threw = false;
        let caughtError: any;
        try {
          if (typeof this.actual === 'function') {
            await (this.actual as any)();
          } else {
            await (this.actual as any);
          }
        } catch (e) {
          threw = true;
          caughtError = e;
        }

        if (!threw) {
          throw new AssertionError('Expected promise to reject, but it resolved successfully');
        }

        if (expected) {
          const msg = caughtError?.message || String(caughtError);
          const matches = expected instanceof RegExp ? expected.test(msg) : msg.includes(expected);
          if (!matches) {
            throw new AssertionError(`Expected rejection to match '${expected}', but got '${msg}'`, msg, expected);
          }
        }
      },
    };
  }

  toBe(expected: any): void {
    const pass = Object.is(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(
        `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`,
        this.actual,
        expected
      );
    }
  }

  toEqual(expected: any): void {
    const pass = deepEqual(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(
        `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to deeply equal' : 'to deeply equal'} ${JSON.stringify(expected)}`,
        this.actual,
        expected
      );
    }
  }

  toBeDefined(): void {
    const pass = this.actual !== undefined;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected value ${this.isNot ? 'to be undefined' : 'to be defined'}, but got ${this.actual}`);
    }
  }

  toBeUndefined(): void {
    const pass = this.actual === undefined;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected value ${this.isNot ? 'not to be undefined' : 'to be undefined'}, but got ${this.actual}`);
    }
  }

  toBeNull(): void {
    const pass = this.actual === null;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected value ${this.isNot ? 'not to be null' : 'to be null'}, but got ${this.actual}`);
    }
  }

  toBeTruthy(): void {
    const pass = !!this.actual;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected truthy value, but got ${this.actual}`);
    }
  }

  toBeFalsy(): void {
    const pass = !this.actual;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected falsy value, but got ${this.actual}`);
    }
  }

  toBeGreaterThan(expected: number): void {
    const pass = (this.actual as any) > expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${this.actual} ${this.isNot ? '<=' : '>'} ${expected}`);
    }
  }

  toBeGreaterThanOrEqual(expected: number): void {
    const pass = (this.actual as any) >= expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${this.actual} ${this.isNot ? '<' : '>='} ${expected}`);
    }
  }

  toBeLessThan(expected: number): void {
    const pass = (this.actual as any) < expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${this.actual} ${this.isNot ? '>=' : '<'} ${expected}`);
    }
  }

  toBeLessThanOrEqual(expected: number): void {
    const pass = (this.actual as any) <= expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${this.actual} ${this.isNot ? '>' : '<='} ${expected}`);
    }
  }

  toBeCloseTo(expected: number, numDigits = 2): void {
    const tolerance = Math.pow(10, -numDigits) / 2;
    const diff = Math.abs((this.actual as any) - expected);
    const pass = diff < tolerance;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${this.actual} close to ${expected} (within ${tolerance}), diff: ${diff}`);
    }
  }

  toContain(item: any): void {
    let pass = false;
    if (typeof this.actual === 'string') {
      pass = this.actual.includes(item);
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.some((x) => deepEqual(x, item));
    } else if (this.actual instanceof Set) {
      pass = this.actual.has(item);
    }
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`);
    }
  }

  toHaveLength(length: number): void {
    const actualLen = (this.actual as any)?.length ?? (this.actual as any)?.size;
    const pass = actualLen === length;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected length ${length}, but got ${actualLen}`);
    }
  }

  toHaveProperty(prop: string, val?: any): void {
    const hasProp = this.actual !== null && typeof this.actual === 'object' && prop in (this.actual as any);
    let pass = hasProp;
    if (hasProp && val !== undefined) {
      pass = deepEqual((this.actual as any)[prop], val);
    }
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected object to have property '${prop}' with value ${JSON.stringify(val)}`);
    }
  }

  toThrow(expected?: string | RegExp): void {
    let threw = false;
    let caught: any;
    if (typeof this.actual !== 'function') {
      throw new AssertionError('toThrow requires a function');
    }
    try {
      (this.actual as any)();
    } catch (e) {
      threw = true;
      caught = e;
    }

    if (this.isNot) {
      if (threw) throw new AssertionError(`Expected not to throw, but caught ${caught}`);
      return;
    }

    if (!threw) {
      throw new AssertionError('Expected function to throw, but it returned cleanly');
    }

    if (expected) {
      const msg = caught?.message || String(caught);
      const matches = expected instanceof RegExp ? expected.test(msg) : msg.includes(expected);
      if (!matches) {
        throw new AssertionError(`Expected error message to match '${expected}', but got '${msg}'`, msg, expected);
      }
    }
  }
}

export function expect<T = any>(actual: T): Expectation<T> {
  return new Expectation(actual);
}

// ============================================================================
// TEST SUITE DEFINITIONS & ENGINE
// ============================================================================

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  tier: number;
  timeout: number;
}

export interface TestSuite {
  name: string;
  tier: number;
  tests: TestCase[];
  beforeAllHooks: Array<() => void | Promise<void>>;
  afterAllHooks: Array<() => void | Promise<void>>;
  beforeEachHooks: Array<() => void | Promise<void>>;
  afterEachHooks: Array<() => void | Promise<void>>;
}

export class TestRunnerEngine {
  public suites: TestSuite[] = [];
  public currentSuite?: TestSuite;
  public defaultTier = 1;
  public server?: TestServer;
  public baseUrl = 'http://127.0.0.1:3001';
  public wsUrl = 'ws://127.0.0.1:3001/ws';

  describe(name: string, fn: () => void | Promise<void>, tier?: number): void {
    const previous = this.currentSuite;
    const suite: TestSuite = {
      name: previous ? `${previous.name} > ${name}` : name,
      tier: tier || (previous ? previous.tier : this.defaultTier),
      tests: [],
      beforeAllHooks: previous ? [...previous.beforeAllHooks] : [],
      afterAllHooks: previous ? [...previous.afterAllHooks] : [],
      beforeEachHooks: previous ? [...previous.beforeEachHooks] : [],
      afterEachHooks: previous ? [...previous.afterEachHooks] : [],
    };
    this.suites.push(suite);
    this.currentSuite = suite;

    fn();

    this.currentSuite = previous;
  }

  it(name: string, fn: () => void | Promise<void>, options?: { timeout?: number; tier?: number }): void {
    if (!this.currentSuite) {
      this.describe('Root Suite', () => {
        this.it(name, fn, options);
      });
      return;
    }

    const testCase: TestCase = {
      name,
      fn,
      tier: options?.tier || this.currentSuite.tier,
      timeout: options?.timeout || 8000,
    };
    this.currentSuite.tests.push(testCase);
  }

  beforeAll(fn: () => void | Promise<void>): void {
    if (this.currentSuite) this.currentSuite.beforeAllHooks.push(fn);
  }

  afterAll(fn: () => void | Promise<void>): void {
    if (this.currentSuite) this.currentSuite.afterAllHooks.push(fn);
  }

  beforeEach(fn: () => void | Promise<void>): void {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn: () => void | Promise<void>): void {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }
}

export const runnerInstance = new TestRunnerEngine();

export function getHttpClient(): import('./harness/httpClient').ApiClient {
  const { ApiClient } = require('./harness/httpClient');
  return new ApiClient(runnerInstance.baseUrl);
}

export function getWsUrl(): string {
  return runnerInstance.wsUrl;
}

export const describe = runnerInstance.describe.bind(runnerInstance);
export const it = runnerInstance.it.bind(runnerInstance);
export const test = runnerInstance.it.bind(runnerInstance);
export const beforeAll = runnerInstance.beforeAll.bind(runnerInstance);
export const afterAll = runnerInstance.afterAll.bind(runnerInstance);
export const beforeEach = runnerInstance.beforeEach.bind(runnerInstance);
export const afterEach = runnerInstance.afterEach.bind(runnerInstance);

// ============================================================================
// RUNNER CLI & EXECUTION HARNESS
// ============================================================================

export interface RunnerOptions {
  tierFilter?: number;
  patternFilter?: string;
  bail?: boolean;
  timeoutMs?: number;
}

export async function runAllTests(options: RunnerOptions = {}): Promise<boolean> {
  const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
  };

  console.log(`\n${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}TREELINE TRACKER DUAL-TRACK E2E TEST SUITE RUNNER${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}\n`);

  // Start Embedded Test Server if live backend is not detected
  let serverStarted = false;
  let testServer: TestServer | undefined;
  try {
    const probe = await fetch('http://127.0.0.1:3001/api/v1/teams', { signal: AbortSignal.timeout(400) }).catch(() => null);
    if (!probe) {
      testServer = new TestServer();
      const port = await testServer.start(0);
      serverStarted = true;
      runnerInstance.server = testServer;
      runnerInstance.baseUrl = testServer.getBaseUrl();
      runnerInstance.wsUrl = testServer.getWsUrl();
      console.log(`${ANSI.gray}[TestRunner] Started embedded TestServer on port ${port}${ANSI.reset}`);
    } else {
      console.log(`${ANSI.gray}[TestRunner] Connected to live backend at http://127.0.0.1:3001${ANSI.reset}`);
    }
  } catch (_) {
    testServer = new TestServer();
    const port = await testServer.start(0);
    serverStarted = true;
    runnerInstance.server = testServer;
    runnerInstance.baseUrl = testServer.getBaseUrl();
    runnerInstance.wsUrl = testServer.getWsUrl();
    console.log(`${ANSI.gray}[TestRunner] Started embedded TestServer on port ${port}${ANSI.reset}`);
  }

  // Tier tracking stats
  const tierStats = new Map<number, { name: string; total: number; passed: number; failed: number; durationMs: number }>();
  tierStats.set(1, { name: 'Tier 1: Feature Coverage', total: 0, passed: 0, failed: 0, durationMs: 0 });
  tierStats.set(2, { name: 'Tier 2: Boundary & Corner', total: 0, passed: 0, failed: 0, durationMs: 0 });
  tierStats.set(3, { name: 'Tier 3: Cross-Feature', total: 0, passed: 0, failed: 0, durationMs: 0 });
  tierStats.set(4, { name: 'Tier 4: Real-World Scenarios', total: 0, passed: 0, failed: 0, durationMs: 0 });

  let allPassed = true;
  const suiteOverallStart = Date.now();

  for (const suite of runnerInstance.suites) {
    // Check tier filter
    if (options.tierFilter && suite.tier !== options.tierFilter) {
      continue;
    }

    // Filter tests
    const matchingTests = suite.tests.filter((t) => {
      if (options.tierFilter && t.tier !== options.tierFilter) return false;
      if (options.patternFilter) {
        const regex = new RegExp(options.patternFilter, 'i');
        if (!regex.test(t.name) && !regex.test(suite.name)) return false;
      }
      return true;
    });

    if (matchingTests.length === 0) continue;

    console.log(`\n${ANSI.bold}${ANSI.yellow}[Tier ${suite.tier}] ${suite.name}${ANSI.reset}`);

    if (runnerInstance.server) {
      runnerInstance.server.resetRateLimits();
    }

    // Run beforeAll hooks
    for (const hook of suite.beforeAllHooks) {
      await hook();
    }

    for (const t of matchingTests) {
      const stat = tierStats.get(t.tier) || { name: `Tier ${t.tier}`, total: 0, passed: 0, failed: 0, durationMs: 0 };
      stat.total++;

      // Run beforeEach hooks
      for (const hook of suite.beforeEachHooks) {
        await hook();
      }

      const tStart = Date.now();
      let testPassed = false;
      let errorMsg = '';

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Test timed out after ${t.timeout}ms`)), t.timeout)
        );
        await Promise.race([t.fn(), timeoutPromise]);
        testPassed = true;
      } catch (err: any) {
        testPassed = false;
        errorMsg = err?.stack || err?.message || String(err);
        allPassed = false;
      }

      const tDuration = Date.now() - tStart;
      stat.durationMs += tDuration;

      if (testPassed) {
        stat.passed++;
        console.log(`  ${ANSI.green}✓${ANSI.reset} ${t.name} ${ANSI.gray}(${tDuration}ms)${ANSI.reset}`);
      } else {
        stat.failed++;
        console.log(`  ${ANSI.red}✗${ANSI.reset} ${ANSI.bold}${t.name}${ANSI.reset} ${ANSI.gray}(${tDuration}ms)${ANSI.reset}`);
        console.log(`    ${ANSI.red}${errorMsg.split('\n').join('\n    ')}${ANSI.reset}`);
        if (options.bail) {
          console.log(`\n${ANSI.red}[Bail] Aborting test execution immediately due to --bail flag.${ANSI.reset}`);
          break;
        }
      }

      // Run afterEach hooks
      for (const hook of suite.afterEachHooks) {
        await hook();
      }

      if (!testPassed && options.bail) break;
    }

    // Run afterAll hooks
    for (const hook of suite.afterAllHooks) {
      await hook();
    }

    if (!allPassed && options.bail) break;
  }

  // Cleanup server
  if (serverStarted && testServer) {
    await testServer.close();
  }

  const totalDuration = Date.now() - suiteOverallStart;

  // Print Summary Matrix Table
  console.log(`\n${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}TREELINE TRACKER E2E TEST SUITE SUMMARY MATRIX${ANSI.reset}`);
  console.log(`${ANSI.cyan}------------------------------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}${'Tier'.padEnd(30)} | ${'Total'.padStart(5)} | ${'Passed'.padStart(6)} | ${'Failed'.padStart(6)} | ${'Duration'.padStart(10)}${ANSI.reset}`);
  console.log(`${ANSI.cyan}------------------------------------------------------------------------${ANSI.reset}`);

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  for (const [, s] of tierStats.entries()) {
    if (s.total === 0 && options.tierFilter && !s.name.includes(String(options.tierFilter))) continue;
    grandTotal += s.total;
    grandPassed += s.passed;
    grandFailed += s.failed;
    const color = s.failed > 0 ? ANSI.red : ANSI.green;
    console.log(
      `${s.name.padEnd(30)} | ${String(s.total).padStart(5)} | ${color}${String(s.passed).padStart(6)}${ANSI.reset} | ${s.failed > 0 ? ANSI.red : ANSI.gray}${String(s.failed).padStart(6)}${ANSI.reset} | ${String(s.durationMs + ' ms').padStart(10)}`
    );
  }

  console.log(`${ANSI.cyan}------------------------------------------------------------------------${ANSI.reset}`);
  console.log(
    `${ANSI.bold}${'TOTAL'.padEnd(30)} | ${String(grandTotal).padStart(5)} | ${grandPassed === grandTotal ? ANSI.green : ANSI.red}${String(grandPassed).padStart(6)}${ANSI.reset} | ${grandFailed > 0 ? ANSI.red : ANSI.gray}${String(grandFailed).padStart(6)}${ANSI.reset} | ${String(totalDuration + ' ms').padStart(10)}${ANSI.reset}`
  );
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);

  if (allPassed && grandTotal > 0) {
    console.log(`\n${ANSI.bold}${ANSI.green}STATUS: ALL ${grandTotal} TESTS PASSED (100% SUCCESS RATE)${ANSI.reset}\n`);
    return true;
  } else {
    console.log(`\n${ANSI.bold}${ANSI.red}STATUS: TEST RUN FAILED (${grandFailed} failures)${ANSI.reset}\n`);
    return false;
  }
}

// Parse CLI flags and execute when run directly
async function main() {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      options.tierFilter = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--filter=')) {
      options.patternFilter = arg.split('=')[1];
    } else if (arg === '--bail') {
      options.bail = true;
    } else if (arg.startsWith('--timeout=')) {
      options.timeoutMs = parseInt(arg.split('=')[1], 10);
    }
  }

  // Dynamically load all test suites
  try {
    await import('./tier1_feature_coverage.test');
  } catch (e: any) {
    if (!e.message.includes('Cannot find module')) console.error(e);
  }
  try {
    await import('./tier2_boundary_corner.test');
  } catch (e: any) {
    if (!e.message.includes('Cannot find module')) console.error(e);
  }
  try {
    await import('./tier3_cross_feature.test');
  } catch (e: any) {
    if (!e.message.includes('Cannot find module')) console.error(e);
  }
  try {
    await import('./tier4_real_world.test');
  } catch (e: any) {
    if (!e.message.includes('Cannot find module')) console.error(e);
  }

  const success = await runAllTests(options);
  process.exit(success ? 0 : 1);
}

if (process.argv[1]?.endsWith('runner.ts') || process.argv[1]?.endsWith('runner.js')) {
  main().catch((err) => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}
