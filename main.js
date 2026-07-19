const { app, BrowserWindow, shell, Menu, dialog, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, execFile } = require("child_process");
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
    // nativeImage.createFromPath (en vez de pasar la ruta en texto tal cual)
    // porque Electron a veces no sabe leer el icono de la ventana cuando la
    // ruta cae dentro del .asar empaquetado - con esto si funciona.
    const iconPath = path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : "icon.png");
    const ventana = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "EVEN's Team Panel",
        icon: nativeImage.createFromPath(iconPath),
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

// Nombres exactos del instalador tal como lo sirve la web, por plataforma.
// El navegador no permite que una web borre archivos, pero esto ya es la
// app corriendo con permisos normales de usuario en tu compu - puede
// limpiar el instalador que ella misma dejo en Descargas, una sola vez.
const NOMBRES_INSTALADOR_POR_PLATAFORMA = {
    win32: ["EVENs-Team-Panel-Setup.exe"],
    linux: ["EVENs-Team-Panel.deb", "EVENs-Team-Panel.AppImage"],
    darwin: ["EVENs-Team-Panel-Mac.zip"],
};

function limpiarInstaladorDescargado() {
    const nombres = NOMBRES_INSTALADOR_POR_PLATAFORMA[process.platform] || [];
    let carpetaDescargas;
    try {
        carpetaDescargas = app.getPath("downloads");
    } catch {
        return;
    }
    for (const nombre of nombres) {
        const ruta = path.join(carpetaDescargas, nombre);
        fs.unlink(ruta, () => {}); // silencioso: si no existe, no hay nada que hacer
    }
}

// ---------------------------------------------------------------
// Zona de peligro: cerrar sesion y desinstalar la app. Borrar
// cuentas queda fuera a proposito - eso solo desde Gestion staff
// en el panel, no desde un menu de la app.
// ---------------------------------------------------------------

function cerrarSesion() {
    const ventana = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (ventana) ventana.loadURL(`${URL_PANEL}/logout`);
}

async function desinstalarApp() {
    const confirmacion = await dialog.showMessageBox({
        type: "warning",
        title: "Desinstalar EVEN's Team Panel",
        message: "¿Seguro que quieres desinstalar la app?",
        detail: "Esto no se puede deshacer. La app se va a cerrar.",
        buttons: ["Cancelar", "Desinstalar"],
        defaultId: 0,
        cancelId: 0,
    });
    if (confirmacion.response !== 1) return;

    if (process.platform === "linux") {
        if (process.env.APPIMAGE) {
            // AppImage: no hace falta contraseña, solo es un archivo suelto.
            const rutaAppImage = process.env.APPIMAGE;
            exec(`sleep 1 && rm -f "${rutaAppImage}"`);
            app.quit();
            return;
        }
        // Instalada via .deb: pkexec abre el dialogo grafico de contraseña
        // del propio sistema (Polkit), como pide cualquier apt install/remove.
        exec("pkexec apt-get remove -y evens-team-panel", (error) => {
            if (error) {
                dialog.showErrorBox(
                    "No se pudo desinstalar",
                    "Puedes hacerlo a mano abriendo una terminal y escribiendo:\nsudo apt remove evens-team-panel"
                );
                return;
            }
            app.quit();
        });
        return;
    }

    if (process.platform === "win32") {
        const carpetaInstalacion = path.dirname(app.getPath("exe"));
        const desinstalador = path.join(carpetaInstalacion, "Uninstall EVENs Team Panel.exe");
        if (fs.existsSync(desinstalador)) {
            execFile(desinstalador, { detached: true });
            app.quit();
        } else {
            dialog.showErrorBox(
                "No se encontró el desinstalador",
                "Desinstálala desde Configuración > Aplicaciones de Windows."
            );
        }
        return;
    }

    if (process.platform === "darwin") {
        // En Mac la app es una carpeta .app suelta (normalmente en /Applications);
        // "desinstalar" es simplemente borrarla, no hace falta contraseña si el
        // usuario es dueño de esa carpeta.
        const rutaApp = path.resolve(process.resourcesPath, "..", "..", "..");
        exec(`sleep 1 && rm -rf "${rutaApp}"`);
        app.quit();
        return;
    }
}

function crearMenu() {
    const plantilla = [
        {
            label: "Cuenta",
            submenu: [
                { label: "Cerrar sesión", click: cerrarSesion },
                { type: "separator" },
                { label: "⚠️ Desinstalar la app...", click: desinstalarApp },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
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
    crearMenu();
    crearVentana();
    configurarAutoUpdate();
    limpiarInstaladorDescargado();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
