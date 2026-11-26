import * as Y from 'yjs'

/** Plain text of a page body (search, word counts): one line per text block. */
export function docPlainText(doc: Y.Doc): string {
  const lines: string[] = []
  const walk = (type: Y.XmlFragment | Y.XmlElement) => {
    let line = ''
    for (const child of type.toArray()) {
      if (child instanceof Y.XmlText) line += child.toString().replace(/<[^>]*>/g, '')
      else if (child instanceof Y.XmlElement) walk(child)
    }
    if (line) lines.push(line)
  }
  walk(doc.getXmlFragment('default'))
  return lines.join('\n')
}
