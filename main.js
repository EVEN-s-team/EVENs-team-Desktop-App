const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const COMPROBAR_UPDATES_MS = 30 * 60 * 1000; // cada 30 minutos mientras esta abierta

const URL_PANEL = "https://evens-team-pagina-web-production.up.railway.app";

// Marca que la web usa para reconocer que la peticion viene de esta app y no
// de un navegador normal (ver app.before_request en el Flask).
const MARCA_APP = "EVENsTeamDesktopApp/1.0";

// Dominios en los que se permite navegar dentro de la propia ventana de la app
// (el panel en si, y discord.com porque el login pasa por ahi y tiene que
// volver a caer en el panel para completar la sesion). Cualquier otro enlace
// se abre en el navegador normal del sistema.
const DOMINIOS_PERMITIDOS = ["evens-team-pagina-web-production.up.railway.app", "discord.com"];

function esDominioPermitido(url) {
    try {
        const host = new URL(url).hostname;
        return DOMINIOS_PERMITIDOS.some((d) => host === d || host.endsWith("." + d));
    } catch {
        return false;
    }
}

function crearVentana() {
    const ventana = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "EVEN's Team Panel",
        icon: path.join(__dirname, "build", "icon.ico"),
        backgroundColor: "#0f1811",
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    ventana.webContents.setUserAgent(`${ventana.webContents.getUserAgent()} ${MARCA_APP}`);
    ventana.loadURL(URL_PANEL);

    ventana.webContents.on("will-navigate", (event, url) => {
        if (!esDominioPermitido(url)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    ventana.webContents.setWindowOpenHandler(({ url }) => {
        if (esDominioPermitido(url)) {
            return { action: "allow" };
        }
        shell.openExternal(url);
        return { action: "deny" };
    });

    return ventana;
}

function configurarAutoUpdate() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-downloaded", (info) => {
        dialog
            .showMessageBox({
                type: "info",
                title: "Actualización lista",
                message: `Hay una nueva versión (${info.version}) lista para instalar.`,
                detail: "Se cerrará la app un momento para instalarla.",
                buttons: ["Reiniciar ahora", "Más tarde"],
                defaultId: 0,
                cancelId: 1,
            })
            .then((resultado) => {
                if (resultado.response === 0) autoUpdater.quitAndInstall();
            });
    });

    autoUpdater.on("error", (err) => {
        console.error("Error comprobando actualizaciones:", err);
    });

    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, COMPROBAR_UPDATES_MS);
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    crearVentana();
    configurarAutoUpdate();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
