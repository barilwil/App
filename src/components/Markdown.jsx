import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// Convert \(...\) → $...$ and \[...\] → $$...$$ so remark-math picks them up
function normalizeMath(text) {
  if (!text) return text
  return text
    // Only replace <br> outside table rows (lines starting with |)
    .split('\n')
    .map(line => line.trimStart().startsWith('|')
      ? line  // leave table rows untouched
      : line.replace(/<br\s*\/?>/gi, '\n\n')
    )
    .join('\n')
    // Display math \[...\] → $$...$$
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`)
    // Inline math \(...\) → $...$
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`)
}

export default function Markdown({ content }) {
  const normalized = normalizeMath(content)
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          code({ inline, className, children, ...props }) {
            return !inline
              ? <pre><code className={className} {...props}>{children}</code></pre>
              : <code className={className} {...props}>{children}</code>
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>
          },
          table({ children }) {
            return <div style={{ overflowX: 'auto' }}><table>{children}</table></div>
          }
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
