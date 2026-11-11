const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const devServerUrl = process.env.VITE_DEV_SERVER_URL
const isDev = Boolean(devServerUrl)

ipcMain.handle('sheet:print', async (event) => {
  return new Promise((resolve) => {
    event.sender.print(
      {
        silent: false,
        printBackground: true,
        pageSize: 'A4',
        landscape: true,
      },
      (success, failureReason) => {
        resolve({ ok: success, reason: failureReason || null })
      },
    )
  })
})

ipcMain.handle('sheet:save-pdf', async (event, suggestedName) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save billing sheet as PDF',
    defaultPath: suggestedName || 'Trucking-Billing.pdf',
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  })

  if (canceled || !filePath) {
    return { canceled: true }
  }

  const pdf = await event.sender.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
  })
  await fs.writeFile(filePath, pdf)
  return { canceled: false, filePath }
})

// One window only: two copies writing localStorage / the same profile is a bad idea.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  function createWindow() {
    const win = new BrowserWindow({
      width: 1600,
      height: 960,
      minWidth: 1100,
      minHeight: 700,
      backgroundColor: '#f3f5f9',
      title: 'PITAC Trucking Billing',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    if (isDev) {
      win.loadURL(devServerUrl)
    } else {
      win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }

    win.maximize()
  }

  app.whenReady().then(createWindow)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
