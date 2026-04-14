import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// Convert \(...\) → $...$ and \[...\] → $$...$$ so remark-math picks them up
function normalizeMath(text) {
  if (!text) return text
  return text
    .split('\n')
    .map((line) =>
      line.trimStart().startsWith('|')
        ? line
        : line.replace(/<br\s*\/?>/gi, '\n\n')
    )
    .join('\n')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`)
}

function stripTags(text) {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseReasoningBlocks(content) {
  if (!content) return { blocks: [], remainder: '' }

  const blocks = []
  const detailsRegex = /<details\b[^>]*type=["']reasoning["'][^>]*>([\s\S]*?)<\/details>/gi
  let remainder = content
  let match

  while ((match = detailsRegex.exec(content)) !== null) {
    const fullMatch = match[0]
    const inner = match[1] || ''
    const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i)
    const summary = stripTags(summaryMatch?.[1] || 'Thought')
    const body = stripTags(inner.replace(/<summary>[\s\S]*?<\/summary>/i, ''))

    blocks.push({
      summary: normalizeMath(summary),
      body: normalizeMath(body),
    })

    remainder = remainder.replace(fullMatch, '').trim()
  }

  return {
    blocks,
    remainder: normalizeMath(remainder),
  }
}

function MarkdownBody({ content }) {
  if (!content) return null

  return (
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
      {content}
    </ReactMarkdown>
  )
}

export default function Markdown({ content }) {
  const { blocks, remainder } = parseReasoningBlocks(content)

  return (
    <div className="md">
      {blocks.map((block, index) => (
        <details key={`${block.summary}-${index}`} className="reasoning-block">
          <summary className="reasoning-summary">{block.summary}</summary>
          <div className="reasoning-body">
            <MarkdownBody content={block.body} />
          </div>
        </details>
      ))}

      <MarkdownBody content={remainder} />
    </div>
  )
}
