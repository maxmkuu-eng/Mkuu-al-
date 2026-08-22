const fs = require('fs');

// MKUU safety rollback:
// Keep the existing, verified Android /api/chat path intact.
// Do not rewrite the native client to /api/chat/stream at build time.
// The experimental streaming patch caused Android to report BACKEND_UNREACHABLE.
// Streaming is intentionally disabled here until it can be implemented without
// changing the working server connection or any existing feature.

console.log('MKUU: experimental real streaming patch disabled; existing Android chat/server path preserved.');
