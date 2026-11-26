/**
 * Code block languages (ED-B10). `id` is stored in the `language` attr — do not rename.
 * Each grammar is its own lazy chunk, loaded the first time a block uses it.
 */
export const LANGUAGES: { id: string; label: string; load?: () => Promise<{ default: unknown }> }[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript', load: () => import('highlight.js/lib/languages/javascript') },
  { id: 'typescript', label: 'TypeScript', load: () => import('highlight.js/lib/languages/typescript') },
  { id: 'python', label: 'Python', load: () => import('highlight.js/lib/languages/python') },
  { id: 'java', label: 'Java', load: () => import('highlight.js/lib/languages/java') },
  { id: 'kotlin', label: 'Kotlin', load: () => import('highlight.js/lib/languages/kotlin') },
  { id: 'swift', label: 'Swift', load: () => import('highlight.js/lib/languages/swift') },
  { id: 'go', label: 'Go', load: () => import('highlight.js/lib/languages/go') },
  { id: 'rust', label: 'Rust', load: () => import('highlight.js/lib/languages/rust') },
  { id: 'c', label: 'C', load: () => import('highlight.js/lib/languages/c') },
  { id: 'cpp', label: 'C++', load: () => import('highlight.js/lib/languages/cpp') },
  { id: 'csharp', label: 'C#', load: () => import('highlight.js/lib/languages/csharp') },
  { id: 'php', label: 'PHP', load: () => import('highlight.js/lib/languages/php') },
  { id: 'ruby', label: 'Ruby', load: () => import('highlight.js/lib/languages/ruby') },
  { id: 'dart', label: 'Dart', load: () => import('highlight.js/lib/languages/dart') },
  { id: 'bash', label: 'Shell', load: () => import('highlight.js/lib/languages/bash') },
  { id: 'sql', label: 'SQL', load: () => import('highlight.js/lib/languages/sql') },
  { id: 'json', label: 'JSON', load: () => import('highlight.js/lib/languages/json') },
  { id: 'yaml', label: 'YAML', load: () => import('highlight.js/lib/languages/yaml') },
  { id: 'xml', label: 'HTML / XML', load: () => import('highlight.js/lib/languages/xml') },
  { id: 'css', label: 'CSS', load: () => import('highlight.js/lib/languages/css') },
  { id: 'markdown', label: 'Markdown', load: () => import('highlight.js/lib/languages/markdown') },
]
