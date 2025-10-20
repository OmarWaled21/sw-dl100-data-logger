// main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");

// ✅ Import Next.js server مباشرة
require("./server");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL("http://localhost:3000");

  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(() => {
  console.log("🚀 Launching Electron + Next.js App...");
  // ✅ ننتظر شوية لحد السيرفر يشتغل
  setTimeout(createWindow, 3000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
