const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/components/ChatView.tsx');

if (!fs.existsSync(filePath)) {
  console.log('MKUU: ChatView.tsx not found; skipping Markdown table patch.');
  process.exit(0);
}

let source = fs.readFileSync(filePath, 'utf8');

if (!source.includes("import remarkGfm from 'remark-gfm';")) {
  const marker = "import Markdown from 'react-markdown';";
  if (!source.includes(marker)) {
    console.log('MKUU: react-markdown import marker not found; skipping Markdown table patch.');
    process.exit(0);
  }
  source = source.replace(marker, `${marker}\nimport remarkGfm from 'remark-gfm';`);
}

const oldMarkdown = '<Markdown>{msg.content}</Markdown>';
const newMarkdown = `<Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-3 w-full overflow-x-auto rounded-xl border border-[#333333] bg-[#0b0b0b] shadow-inner" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <table className="w-full min-w-[720px] border-collapse text-[11px] sm:text-xs">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-[#D4AF37]/10">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-[#2a2a2a]">{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-[#2a2a2a] last:border-b-0">{children}</tr>,
                  th: ({ children, style, ...props }) => <th {...props} style={style} className="px-2.5 py-2 text-left font-bold text-[#D4AF37] border border-[#333333] whitespace-nowrap align-middle">{children}</th>,
                  td: ({ children, style, ...props }) => <td {...props} style={style} className="px-2.5 py-2 text-left text-[#F5F2ED] border border-[#2a2a2a] whitespace-nowrap align-middle">{children}</td>,
                }}
              >{msg.content}</Markdown>`;

if (source.includes(oldMarkdown)) {
  source = source.replace(oldMarkdown, newMarkdown);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('MKUU: Markdown GFM tables enabled with responsive aligned table styling.');
} else if (source.includes('remarkPlugins={[remarkGfm]}')) {
  console.log('MKUU: Markdown GFM table patch already enabled; skipping.');
} else {
  console.log('MKUU: Markdown response marker not found; skipping table patch.');
}
