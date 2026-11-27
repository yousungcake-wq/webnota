import type { Page } from '@playwright/test'

/** A generated image file (canvas in the page): returns its bytes for setInputFiles. */
export async function makeImage(page: Page, w: number, h: number, type = 'image/png') {
  const b64 = await page.evaluate(
    async ({ w, h, type }) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      // noisy content so JPEG/WebP sizes are realistic (a flat image compresses to nothing)
      const img = ctx.createImageData(w, h)
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (i * 13) % 255
        img.data[i + 1] = (i * 7) % 255
        img.data[i + 2] = Math.random() * 255
        img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.95))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(s)
    },
    { w, h, type },
  )
  return Buffer.from(b64, 'base64')
}

/** The editor's document as JSON (Tiptap editor on `.wn-editor`). */
export function editorJson(page: Page) {
  return page.evaluate(() => {
    const dom = document.querySelector('.wn-editor') as unknown as { editor: { getJSON: () => unknown } }
    return JSON.parse(JSON.stringify(dom.editor.getJSON())) as {
      content: { type: string; attrs?: Record<string, unknown> }[]
    }
  })
}

export async function imageAttrs(page: Page) {
  return (await editorJson(page)).content.filter((n) => n.type === 'image').map((n) => n.attrs!)
}

/** Dispatches a paste or drop of a generated image on the editor. */
export async function pasteOrDropImage(page: Page, kind: 'paste' | 'drop', w = 64, h = 32) {
  await page.evaluate(
    async ({ kind, w, h }) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.fillRect(0, 0, w, h)
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
      const dt = new DataTransfer()
      dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }))
      const target = document.querySelector('.wn-editor .ProseMirror p') ?? document.querySelector('.wn-editor')!
      if (kind === 'paste') {
        target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
      } else {
        const r = target.getBoundingClientRect()
        target.dispatchEvent(
          new DragEvent('drop', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
            clientX: r.left + 4,
            clientY: r.top + 4,
          }),
        )
      }
    },
    { kind, w, h },
  )
}

/** Moves the cursor to the start of the document (the inserted block is no longer selected). */
export function blurBlock(page: Page) {
  return page.evaluate(() => {
    const dom = document.querySelector('.wn-editor') as unknown as {
      editor: { commands: { focus: (p: string) => void } }
    }
    dom.editor.commands.focus('start')
  })
}
