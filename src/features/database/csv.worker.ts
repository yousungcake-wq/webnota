import { parseCSV } from '@/core/io/csv'

// CSV parsing off the main thread (M6-06): big exports stay responsive.
self.onmessage = (e: MessageEvent<{ text: string }>) => {
  try {
    self.postMessage({ rows: parseCSV(e.data.text) })
  } catch (err) {
    self.postMessage({ error: String(err) })
  }
}
