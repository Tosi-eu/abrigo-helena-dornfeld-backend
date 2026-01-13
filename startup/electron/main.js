const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const http = require("http");
const fs = require("fs");

let mainWindow;

const FRONTEND_URL = "http://localhost:8081";
const BACKEND_URL = "http://localhost:3001/api/v1";
const CHECK_INTERVAL = 1000;
const MAX_WAIT_TIME = 120000;

const isWindows = process.platform === "win32";

const PROJECT_ROOT = app.isPackaged
  ? path.dirname(process.execPath)
  : path.resolve(__dirname, "..");

const STATE_FILE = path.join(app.getPath("userData"), "app-state.json");

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Erro ao ler estado:", error);
  }
  return { firstRun: true, lastStart: null };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar estado:", error);
  }
}

function runDockerCompose(args) {
  return new Promise((resolve, reject) => {
    const process = spawn("docker", ["compose", ...args], {
      cwd: PROJECT_ROOT,
      shell: isWindows,
      stdio: "inherit",
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const processV1 = spawn("docker-compose", args, {
          cwd: PROJECT_ROOT,
          shell: isWindows,
          stdio: "inherit",
        });

        processV1.on("close", (codeV1) => {
          if (codeV1 === 0) {
            resolve();
          } else {
            reject(new Error(`Docker compose falhou com código ${codeV1}`));
          }
        });

        processV1.on("error", (error) => {
          reject(error);
        });
      }
    });

    process.on("error", (error) => {
      const processV1 = spawn("docker-compose", args, {
        cwd: PROJECT_ROOT,
        shell: isWindows,
        stdio: "inherit",
      });

      processV1.on("close", (codeV1) => {
        if (codeV1 === 0) {
          resolve();
        } else {
          reject(error);
        }
      });

      processV1.on("error", () => {
        reject(error);
      });
    });
  });
}

function checkServicesRunning() {
  return new Promise((resolve) => {
    const checkBackend = new Promise((res) => {
      http
        .get(`${BACKEND_URL}/status`, { timeout: 2000 }, (response) => {
          res(true);
        })
        .on("error", () => res(false))
        .on("timeout", () => res(false));
    });

    const checkFrontend = new Promise((res) => {
      http
        .get(FRONTEND_URL, { timeout: 2000 }, (response) => {
          res(response.statusCode === 200);
        })
        .on("error", () => res(false))
        .on("timeout", () => res(false));
    });

    Promise.all([checkBackend, checkFrontend]).then(([backend, frontend]) => {
      resolve(backend && frontend);
    });
  });
}

function checkDockerContainers() {
  return new Promise((resolve) => {
    const cmd = isWindows ? "docker ps" : "docker ps";
    exec(cmd, { cwd: PROJECT_ROOT, shell: isWindows }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      const hasBackend = stdout.includes("backend");
      const hasFrontend = stdout.includes("frontend");
      const hasPostgres = stdout.includes("postgres");
      resolve(hasBackend && hasFrontend && hasPostgres);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,
    frame: true,
    show: false,
    backgroundColor: "#e0f2fe",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, "loading.html"));
}

function transitionToApp(url) {
  return new Promise((resolve) => {
    // Fade-out do loading
    mainWindow.webContents
      .executeJavaScript(`
        (function() {
          const body = document.body;
          if (body) {
            body.style.transition = 'opacity 0.4s ease-out';
            body.style.opacity = '0';
          }
        })();
      `)
      .catch(() => {
        // Ignora erros se não conseguir executar
      });

    // Aguarda animação de fade-out antes de carregar a nova página
    setTimeout(() => {
      // Configura fade-in para a nova página
      const fadeInHandler = () => {
        mainWindow.webContents
          .executeJavaScript(`
            (function() {
              const body = document.body;
              if (body) {
                body.style.opacity = '0';
                body.style.transition = 'opacity 0.4s ease-in';
                requestAnimationFrame(() => {
                  body.style.opacity = '1';
                });
              }
            })();
          `)
          .catch(() => {
            // Ignora erros
          });
        mainWindow.webContents.removeListener("did-finish-load", fadeInHandler);
        resolve();
      };

      mainWindow.webContents.once("did-finish-load", fadeInHandler);
      mainWindow.loadURL(url);
    }, 400);
  });
}

function checkFrontendReady() {
  return new Promise((resolve) => {
    http
      .get(FRONTEND_URL, { timeout: 2000 }, (res) => {
        resolve(res.statusCode === 200);
      })
      .on("error", () => resolve(false))
      .on("timeout", () => resolve(false));
  });
}

async function waitForFrontendReady() {
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > MAX_WAIT_TIME) {
      console.error("Timeout ao esperar frontend ficar pronto");
      break;
    }

    if (await checkFrontendReady()) {
      await transitionToApp(FRONTEND_URL);
      break;
    }

    await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
  }
}

async function initializeApp() {
  const state = readState();
  let needsStartup = false;

  const servicesRunning = await checkServicesRunning();

  if (!servicesRunning) {
    const containersExist = await checkDockerContainers();

    if (!containersExist || state.firstRun) {
      needsStartup = true;
      console.log("Iniciando docker compose...");

      try {
        await runDockerCompose(["up", "-d"]);
        state.firstRun = false;
        state.lastStart = new Date().toISOString();
        saveState(state);
      } catch (error) {
        console.error("Erro ao iniciar docker compose:", error);
      }
    } else {
      console.log("Reiniciando containers...");
      try {
        await runDockerCompose(["restart"]);
      } catch (error) {
        console.error("Erro ao reiniciar containers:", error);
      }
    }

    await waitForFrontendReady();
  } else {
    console.log("Serviços já estão rodando, carregando aplicação...");
    // Pequeno delay para garantir que a janela está visível antes da transição
    setTimeout(async () => {
      await transitionToApp(FRONTEND_URL);
    }, 300);
  }
}

app.whenReady().then(() => {
  createWindow();
  initializeApp();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    initializeApp();
  }
});

ipcMain.on("close-app", () => {
  app.quit();
});

app.on("before-quit", async () => {
});
