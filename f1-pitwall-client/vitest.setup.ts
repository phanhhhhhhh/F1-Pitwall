import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL's auto-cleanup only self-registers when it detects a global `afterEach`
// (i.e. `test.globals: true`). This project imports test globals explicitly,
// so unmount rendered trees between tests here instead.
afterEach(() => {
  cleanup();
});
