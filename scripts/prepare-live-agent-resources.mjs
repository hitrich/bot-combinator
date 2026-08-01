#!/usr/bin/env node

// Development/live-account smoke runs execute sidecars directly, outside an
// Electron app bundle. Preserve the vendors' valid platform signatures for
// that case. Release packaging intentionally uses the default normalized mode
// and then signs the complete application bundle.
process.argv.push('--preserve-vendor-signatures');
await import('./prepare-resources.mjs');
