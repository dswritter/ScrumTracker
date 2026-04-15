import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { PluggableList } from 'unified'

import 'highlight.js/styles/github.css'

import {
  kbInteractiveSanitizeSchema,
  kbRehypeSanitizeSchema,
} from '../lib/kbRehypeSchema'
import { rehypeKbSearchHighlight } from '../lib/rehypeKbSearchHighlight'
import { toggleNthTaskListItem } from '../lib/knowledgeMarkdown'

type Props = {
  source: string
  className?: string
  /** Highlight plain-text matches in rendered output (e.g. from knowledge search). */
  highlightQuery?: string
  /** When set with onTasksSourceChange, task checkboxes toggle the markdown source. */
  interactiveTasks?: boolean
  onTasksSourceChange?: (next: string) => void
}

/** Renders Markdown (GFM) with sanitization and syntax highlighting. */
export function KnowledgeMarkdown({
  source,
  className = '',
  highlightQuery,
  interactiveTasks = false,
  onTasksSourceChange,
}: Props) {
  const rehypePlugins = useMemo((): PluggableList => {
    const hi = highlightQuery?.trim()
    const searchPlugin = hi ? [rehypeKbSearchHighlight(hi)] : []
    const sanitizeSchema =
      interactiveTasks && onTasksSourceChange
        ? kbInteractiveSanitizeSchema
        : kbRehypeSanitizeSchema
    const tail: PluggableList = [
      ...searchPlugin,
      [rehypeSanitize, sanitizeSchema],
    ]
    return [rehypeRaw, rehypeHighlight, ...tail]
  }, [highlightQuery, interactiveTasks, onTasksSourceChange])

  if (!source.trim()) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">Nothing to preview.</p>
    )
  }

  let taskCheckboxIndex = 0

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
    input(props) {
      if (props.type !== 'checkbox') {
        return <input {...props} />
      }
      const n = taskCheckboxIndex++
      if (!interactiveTasks || !onTasksSourceChange) {
        return (
          <input
            {...props}
            type="checkbox"
            disabled
            readOnly
            className={props.className}
          />
        )
      }
      return (
        <input
          type="checkbox"
          className={props.className}
          checked={Boolean(props.checked)}
          onChange={() => {
            const next = toggleNthTaskListItem(source, n)
            if (next != null) onTasksSourceChange(next)
          }}
        />
      )
    },
  }

  return (
    <div
      className={[
        'prose prose-slate w-fit min-w-0 max-w-none dark:prose-invert',
        'prose-headings:scroll-mt-20 prose-headings:mb-3 prose-headings:font-sans',
        'prose-p:leading-relaxed prose-p:[font-family:var(--font-reading)]',
        'prose-a:text-[#007a3d] dark:prose-a:text-emerald-300',
        'prose-pre:bg-slate-100 prose-pre:text-slate-900 dark:prose-pre:bg-slate-900 dark:prose-pre:text-slate-100',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-table:text-sm',
        '[&_table.kb-html-table]:w-full [&_table.kb-html-table]:border-collapse [&_table.kb-html-table]:overflow-hidden [&_table.kb-html-table]:rounded-lg [&_table.kb-html-table]:border [&_table.kb-html-table]:border-slate-200 dark:[&_table.kb-html-table]:border-slate-600',
        '[&_table.kb-html-table_th]:bg-slate-100 [&_table.kb-html-table_th]:px-3 [&_table.kb-html-table_th]:py-2 [&_table.kb-html-table_th]:text-left [&_table.kb-html-table_th]:font-semibold dark:[&_table.kb-html-table_th]:bg-slate-800',
        '[&_table.kb-html-table_td]:border-t [&_table.kb-html-table_td]:border-slate-200 [&_table.kb-html-table_td]:px-3 [&_table.kb-html-table_td]:py-2 dark:[&_table.kb-html-table_td]:border-slate-600',
        '[&_table.kb-html-table_tbody_tr:nth-child(even)]:bg-slate-50/80 dark:[&_table.kb-html-table_tbody_tr:nth-child(even)]:bg-slate-900/40',
        'prose-ul:my-3 prose-ul:list-none prose-ul:pl-0',
        'prose-ol:my-3 prose-ol:list-decimal prose-ol:list-outside prose-ol:pl-6',
        '[&_ul:not(.contains-task-list)>li]:relative [&_ul:not(.contains-task-list)>li]:my-1.5 [&_ul:not(.contains-task-list)>li]:pl-6 [&_ul:not(.contains-task-list)>li]:leading-relaxed',
        '[&_ul:not(.contains-task-list)>li]:before:absolute [&_ul:not(.contains-task-list)>li]:before:left-0 [&_ul:not(.contains-task-list)>li]:before:top-[0.55em] [&_ul:not(.contains-task-list)>li]:before:h-1.5 [&_ul:not(.contains-task-list)>li]:before:w-1.5 [&_ul:not(.contains-task-list)>li]:before:rounded-full [&_ul:not(.contains-task-list)>li]:before:bg-slate-400 [&_ul:not(.contains-task-list)>li]:before:content-[""] dark:[&_ul:not(.contains-task-list)>li]:before:bg-slate-500',
        '[&_ol>li]:my-1.5 [&_ol>li]:leading-relaxed [&_ol>li]:marker:font-semibold [&_ol>li]:marker:text-[#007a3d] dark:[&_ol>li]:marker:text-emerald-400',
        '[&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0',
        '[&_li.task-list-item]:relative [&_li.task-list-item]:my-2 [&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2 [&_li.task-list-item]:pl-0',
        '[&_li.task-list-item>input]:mt-0.5 [&_li.task-list-item>input]:h-4 [&_li.task-list-item>input]:w-4 [&_li.task-list-item>input]:shrink-0 [&_li.task-list-item>input]:cursor-pointer [&_li.task-list-item>input]:rounded-sm [&_li.task-list-item>input]:border-slate-400 [&_li.task-list-item>input]:text-[#00B050] focus-visible:[&_li.task-list-item>input]:ring-2 focus-visible:[&_li.task-list-item>input]:ring-[#00B050]/40 dark:[&_li.task-list-item>input]:border-slate-500',
        '[&_mark.kb-search-hit]:rounded-sm [&_mark.kb-search-hit]:bg-[#00B050]/25 [&_mark.kb-search-hit]:px-0.5 [&_mark.kb-search-hit]:text-inherit dark:[&_mark.kb-search-hit]:bg-emerald-400/25',
        className,
      ].join(' ')}
    >
      <div className="min-w-0 px-1 sm:px-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={rehypePlugins}
          components={markdownComponents}
        >
          {source}
        </ReactMarkdown>
      </div>
    </div>
  )
}
