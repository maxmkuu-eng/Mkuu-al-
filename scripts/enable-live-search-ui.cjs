const fs = require('node:fs');
const path = require('node:path');

// Live-search integration is now implemented directly in the source files.
// This build hook is intentionally idempotent and must never fail the build
// because an old patch target no longer exists after source refactors.
const targets = [
  path.join(process.cwd(), 'server.ts'),
  path.join(process.cwd(), 'src/services/aiEngine.ts'),
  path.join(process.cwd(), 'src/components/ChatView.tsx'),
];

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) continue;
  fs.accessSync(filePath, fs.constants.R_OK);
}

console.log('MKUU: live-search UI build hook verified; no legacy source patch required.');
