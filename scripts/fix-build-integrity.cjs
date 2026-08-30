const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// Final build-stage sanitizer. Several historical MKUU patches touch the same
// files; this guarantees that the generated workspace is valid before Vite
// and esbuild run, without changing the runtime architecture.

// 1) Exa: exactly one governmentQuery declaration.
{
  const file = 'server/exaSearch.ts';
  if (fs.existsSync(path.join(root, file))) {
    let s = read(file);
    const decl = /\b(?:const|let|var)\s+governmentQuery\s*=\s*isGovernmentOfficeQuery\(query\)\s*;\s*/g;
    s = s.replace(decl, '');
    if (s.includes('function isGovernmentOfficeQuery')) {
      const anchor = "const apiKey=resolveExaApiKey(), dates=tanzaniaDateContext(), fresh=isFreshOrRelativeQuery(query), social=isSocialQuery(query), sports=isSportsQuery(query), news=isNewsQuery(query), finalResult=isFinalResultQuery(query), opponent=isOpponentQuestion(query), newsFact=isNewsFactQuestion(query);";
      if (s.includes(anchor)) {
        s = s.replace(anchor, anchor + "const governmentQuery=isGovernmentOfficeQuery(query);");
      }
    }
    write(file, s);
  }
}

// 2) App: never emit duplicate signal keys in the executeMkuuChat options.
{
  const file = 'src/App.tsx';
  if (fs.existsSync(path.join(root, file))) {
    let s = read(file);
    s = s.replace(
      /signal:\s*abortController\.signal,\s*\n\s*signal:\s*chatAbortControllerRef\.current\?\.signal,\s*/g,
      'signal: chatAbortControllerRef.current?.signal || abortController.signal,\n'
    );
    s = s.replace(
      /signal:\s*chatAbortControllerRef\.current\?\.signal,\s*\n\s*signal:\s*abortController\.signal,\s*/g,
      'signal: chatAbortControllerRef.current?.signal || abortController.signal,\n'
    );
    write(file, s);
  }
}

// 3) geminiService: exactly one local webSources declaration.
{
  const file = 'server/geminiService.ts';
  if (fs.existsSync(path.join(root, file))) {
    let s = read(file);
    const decl = "    let webSources: Array<{ title: string; url: string }> = [];";
    const count = s.split(decl).length - 1;
    if (count > 1) {
      const first = s.indexOf(decl);
      s = s.slice(0, first + decl.length) + s.slice(first + decl.length).replaceAll(decl, '');
    }
    write(file, s);
  }
}

require('./fix-final-runtime.cjs');
console.log('[MKUU] Final build-integrity normalization complete.');
