/**
 * Vitest setup — MSW lifecycle for unit tests that mock HTTP.
 * Pure helper tests do not need handlers; add them per-suite as needed.
 */
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";

export const mswServer = setupServer();

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});
