import { spawn } from 'node:child_process'
import electronPath from 'electron'
import { createServer } from 'vite'

const isWindows = process.platform === 'win32'

let server = null
let electron = null
let shuttingDown = false

function killTree(child) {
  if (!child || child.killed) return
  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  if (electron) {
    if (isWindows) killTree(electron)
    else electron.kill('SIGTERM')
  }

  try {
    await server?.close()
  } catch (error) {
    console.error('Could not stop the Vite server:', error)
  }

  process.exit(code)
}

async function main() {
  // Programmatic Vite: we get the exact host/port it bound to, so Electron can never
  // race ahead of the dev server or be pointed at the wrong address.
  server = await createServer()
  await server.listen()

  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 5173
  const url = `http://127.0.0.1:${port}`

  console.log(`\nStarting Electron on ${url}\n`)

  electron = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  })

  electron.on('close', (code) => shutdown(code ?? 0))
  electron.on('error', (error) => {
    console.error('Could not start Electron:', error)
    shutdown(1)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main().catch(async (error) => {
  console.error('Could not start the development environment:', error)
  try {
    await server?.close()
  } catch {
    // ignore
  }
  process.exit(1)
})
