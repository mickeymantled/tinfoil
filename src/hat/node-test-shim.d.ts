// Minimal types for the Node built-ins used by geometry.test.ts. The client
// tsconfig only loads `vite/client` types (no @types/node), and pulling Node
// types into the browser program would change globals for every file.
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  const assert: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  };
  export default assert;
}
