/**
 * Global Vitest setup.
 * 1. Load Zone.js so all tests run with Zone patched.
 * 2. Mark the scry plugin as "applied" so Tracer.start()/end() don't throw.
 *    In production the babel plugin sets this; here we set it manually.
 */
import "zone.js";

// Simulate what the babel plugin injects: globalThis.scryPluginApplied = true
(globalThis as Record<string, unknown>)["scryPluginApplied"] = true;
