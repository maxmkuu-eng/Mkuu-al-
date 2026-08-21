// MKUU Image Studio no longer uses Puter.
// This script is intentionally kept as a no-op because the existing build
// pipeline still calls it. Keeping the file prevents a build-script change
// from being required elsewhere, while guaranteeing that no Puter SDK is
// injected into index.html and no Puter routing is written into aiEngine.ts.
console.log('MKUU: legacy Puter Image Studio injection disabled; using server Image Studio provider.');
