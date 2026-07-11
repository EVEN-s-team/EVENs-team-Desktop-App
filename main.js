const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

const URL_PANEL = "https://evens-team-pagina-web-production.up.railway.app";

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

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    crearVentana();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
