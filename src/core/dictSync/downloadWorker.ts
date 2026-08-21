// Runs the dictionary file fetch + JSON.parse off the main thread — a ~20-30MB
// JSON.parse blocks the UI (search input, typing) for a noticeable stretch if
// done inline. See syncManager.ts for how this is invoked.

interface WorkerRequest {
  url: string
}

type WorkerResponse =
  | { type: 'progress'; progress: number }
  | { type: 'done'; entries: unknown[] }
  | { type: 'error'; message: string }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { url } = e.data
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  // Uploaded gzip-compressed (Storage strips Content-Encoding, so the
  // browser won't auto-decompress) -- decode manually via DecompressionStream.
  xhr.responseType = 'arraybuffer'

  xhr.onprogress = (event) => {
    if (event.lengthComputable) {
      const progress = Math.round((event.loaded / event.total) * 100)
      self.postMessage({ type: 'progress', progress } satisfies WorkerResponse)
    }
  }

  xhr.onload = async () => {
    if (xhr.status !== 200) {
      self.postMessage({ type: 'error', message: `Gagal mengunduh file: HTTP ${xhr.status}` } satisfies WorkerResponse)
      return
    }
    try {
      const stream = new Blob([xhr.response]).stream().pipeThrough(new DecompressionStream('gzip'))
      const text = await new Response(stream).text()
      const entries = JSON.parse(text)
      self.postMessage({ type: 'done', entries } satisfies WorkerResponse)
    } catch {
      self.postMessage({ type: 'error', message: 'Format file unduhan tidak valid' } satisfies WorkerResponse)
    }
  }

  xhr.onerror = () => {
    self.postMessage({ type: 'error', message: 'Koneksi jaringan error saat mengunduh.' } satisfies WorkerResponse)
  }

  xhr.send()
}
