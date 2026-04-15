import { defaultSchema } from 'rehype-sanitize'

const widthStyle = /^width:\s*\d+(\.\d+)?%$/i

/** Sanitize schema: GFM + marks + images + safe HTML tables (colgroup / width). */
export const kbRehypeSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'mark',
    'colgroup',
    'col',
  ],
  ancestors: {
    ...defaultSchema.ancestors,
    col: ['colgroup'],
    colgroup: ['table'],
  },
  attributes: {
    ...defaultSchema.attributes,
    mark: ['className'],
    col: ['span', ['style', widthStyle]],
    table: [...(defaultSchema.attributes?.table ?? []), ['className', /^kb-html-table$/]],
    th: [['style', widthStyle]],
    td: [['style', widthStyle]],
  },
}

/** Interactive task lists in KB (checkboxes not forced disabled). */
export const kbInteractiveSanitizeSchema = {
  ...kbRehypeSanitizeSchema,
  attributes: {
    ...kbRehypeSanitizeSchema.attributes,
    input: ['type', 'checkbox', 'checked', 'className', 'disabled'],
  },
  required: {},
}
