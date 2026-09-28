const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

let darajaProcess;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 760,
    backgroundColor: "#1e1e1e",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  darajaProcess = spawn(process.execPath, [path.join(__dirname, "daraja", "server.js")], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: process.env.PORT || "3000" },
    stdio: "inherit"
  });
  createWindow();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on("window-all-closed", () => {
  if (darajaProcess) darajaProcess.kill();
  if (process.platform !== "darwin") app.quit();
});
