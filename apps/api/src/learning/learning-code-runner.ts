export interface CodeTestCase {
  name?: string;
  args: unknown[];
  expected: unknown;
  hidden?: boolean;
}

export interface CodeTestResult {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
  hidden: boolean;
}

export function runJavaScriptTests(
  code: string,
  functionName: string,
  tests: CodeTestCase[],
): { passed: number; total: number; results: CodeTestResult[] } {
  const results: CodeTestResult[] = [];
  let fn: (...args: unknown[]) => unknown;

  try {
    // eslint-disable-next-line no-new-func
    fn = new Function(`${code}; return ${functionName};`)() as (...args: unknown[]) => unknown;
    if (typeof fn !== 'function') {
      throw new Error(`Function "${functionName}" not found in submission`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const t of tests) {
      results.push({
        name: t.name ?? 'test',
        passed: false,
        error: message,
        hidden: Boolean(t.hidden),
      });
    }
    return { passed: 0, total: tests.length, results };
  }

  for (const t of tests) {
    try {
      const actual = fn(...t.args);
      const passed = deepEqual(actual, t.expected);
      results.push({
        name: t.name ?? 'test',
        passed,
        expected: t.hidden ? undefined : t.expected,
        actual: t.hidden ? undefined : actual,
        hidden: Boolean(t.hidden),
      });
    } catch (error) {
      results.push({
        name: t.name ?? 'test',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        hidden: Boolean(t.hidden),
      });
    }
  }

  return {
    passed: results.filter((r) => r.passed).length,
    total: tests.length,
    results,
  };
}

export function detectFunctionName(code: string, fallback = 'solve'): string {
  const match = code.match(/function\s+([a-zA-Z_$][\w$]*)\s*\(/);
  return match?.[1] ?? fallback;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
