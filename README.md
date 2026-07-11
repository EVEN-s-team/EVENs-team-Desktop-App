# EVEN's Team Panel — App de escritorio

App de Windows que abre el [panel web de EVEN's Team](https://evens-team-pagina-web-production.up.railway.app) en su propia ventana, sin barra de navegador ni pestañas — como una app normal, con icono en el escritorio y en el menú de inicio.

No es una copia de la web: cada vez que la abres carga la version en vivo desde Railway, y mientras la tienes abierta te avisa si sale una actualizacion (igual que en el navegador).

## Descargar e instalar

Ve a la pestaña [Releases](../../releases) de este repositorio y descarga el `.exe` de la ultima version. Ejecutalo y sigue el asistente de instalacion.

## Desarrollo

```
npm install
npm start          # abre la app en modo desarrollo
npm run build       # genera el instalador en dist/
```

La URL del panel esta fija en `main.js` (`URL_PANEL`). Si cambia el dominio de Railway, hay que actualizarla ahi y volver a compilar.
