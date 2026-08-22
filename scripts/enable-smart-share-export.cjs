const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
if (!fs.existsSync(file)) throw new Error('MKUU: ChatView.tsx not found.');

let source = fs.readFileSync(file, 'utf8');

// Smart Share & Export was intentionally removed. Clean any older build-time
// injection if it exists, then leave the existing chat UI untouched.
source = source.replace(/\nimport \{ SmartShareExport \} from '\.\/SmartShareExport';/g, '');
source = source.replace(/\n\s*const latestAssistantMessage = \[\.\.\.messages\]\.reverse\(\)\.find\(\(message\) => message\.role === 'assistant'\);\n?/g, '\n');
source = source.replace(/\n\s*\{latestAssistantMessage\?\.content && <SmartShareExport title=\{conversationTitle\} content=\{latestAssistantMessage\.content\} \/>\}/g, '');

fs.writeFileSync(file, source);
console.log('MKUU: Smart Share & Export disabled and removed; existing chat UI preserved.');
