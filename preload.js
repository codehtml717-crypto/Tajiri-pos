const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("TAJIRI_API_BASE", "http://localhost:3000");
