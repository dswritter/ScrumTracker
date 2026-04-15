import type { ElementContent, Root as HastRoot } from 'hast'
import type { Plugin } from 'unified'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Split text nodes into <mark class="kb-search-hit">…</mark> segments (skips pre/code/script/style). */
function transformChildren(
  children: ElementContent[],
  phrase: string,
): ElementContent[] {
  const re = new RegExp(escapeRegExp(phrase), 'gi')
  const out: ElementContent[] = []
  for (const child of children) {
    if (child.type === 'text') {
      const v = child.value
      if (!v) continue
      let last = 0
      let m: RegExpExecArray | null
      const r = new RegExp(re.source, re.flags)
      while ((m = r.exec(v)) !== null) {
        if (m.index > last) {
          out.push({ type: 'text', value: v.slice(last, m.index) })
        }
        out.push({
          type: 'element',
          tagName: 'mark',
          properties: { className: ['kb-search-hit'] },
          children: [{ type: 'text', value: m[0] }],
        })
        last = m.index + m[0].length
      }
      if (last < v.length) out.push({ type: 'text', value: v.slice(last) })
      if (last === 0 && out.length === 0) out.push(child)
      continue
    }
    if (child.type === 'element') {
      const tag = child.tagName
      if (tag === 'script' || tag === 'style') {
        out.push(child)
        continue
      }
      if (tag === 'pre') {
        const next = (child.children ?? []).map((c) => {
          if (c.type === 'element' && c.tagName === 'code') {
            return {
              ...c,
              children: transformChildren(
                (c.children ?? []) as ElementContent[],
                phrase,
              ),
            }
          }
          return c
        })
        out.push({ ...child, children: next })
        continue
      }
      if (tag === 'code') {
        const nextChildren = transformChildren(
          (child.children ?? []) as ElementContent[],
          phrase,
        )
        out.push({ ...child, children: nextChildren })
        continue
      }
      const nextChildren = transformChildren(
        (child.children ?? []) as ElementContent[],
        phrase,
      )
      out.push({ ...child, children: nextChildren })
      continue
    }
    out.push(child)
  }
  return out
}

/** Highlights plain-text matches in rendered HTML (not inside pre/code). */
export function rehypeKbSearchHighlight(
  phrase: string | undefined,
): Plugin<[], HastRoot> {
  return () => (tree: HastRoot) => {
    const q = phrase?.trim()
    if (!q) return
    tree.children = transformChildren(tree.children as ElementContent[], q) as HastRoot['children']
  }
}
