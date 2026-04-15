import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

import 'highlight.js/styles/github.css'

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    const external = Boolean(href && /^https?:\/\//i.test(href))
    return (
      <a
        href={href}
        {...props}
        {...(external
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
      >
        {children}
      </a>
    )
  },
}

type Props = {
  source: string
  className?: string
}

/** Renders Markdown (GFM) with sanitization and syntax highlighting. */
export function KnowledgeMarkdown({ source, className = '' }: Props) {
  if (!source.trim()) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">Nothing to preview.</p>
    )
  }

  return (
    <div
      className={[
        'prose prose-slate max-w-none dark:prose-invert',
        'prose-headings:scroll-mt-20 prose-headings:mb-3 prose-headings:font-sans',
        'prose-p:leading-relaxed prose-p:[font-family:var(--font-reading)]',
        'prose-a:text-[#007a3d] dark:prose-a:text-emerald-300',
        'prose-pre:bg-slate-100 prose-pre:text-slate-900 dark:prose-pre:bg-slate-900 dark:prose-pre:text-slate-100',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-table:text-sm',
        className,
      ].join(' ')}
    >
      <div className="mx-auto max-w-[65ch]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize, rehypeHighlight]}
          components={markdownComponents}
        >
          {source}
        </ReactMarkdown>
      </div>
    </div>
  )
}
