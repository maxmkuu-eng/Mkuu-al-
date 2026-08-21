const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'src', 'components', 'ChatView.tsx');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("from 'remark-gfm'")) {
  source = source.replace(
    "import Markdown from 'react-markdown';",
    "import Markdown from 'react-markdown';\nimport remarkGfm from 'remark-gfm';",
  );
}

source = source.replace(
  '<Markdown>{msg.content}</Markdown>',
  '<Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>',
);

fs.writeFileSync(file, source);
console.log('MKUU: GFM Markdown table rendering enabled.');
