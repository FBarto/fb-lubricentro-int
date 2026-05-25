# FB Lubricentro — AntiGravity
Sistema de gestión para gomería y lubricentro con Google Sheets como base de datos.

---

## Setup local (primera vez)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env.local
```
Editar `.env.local` con tus credenciales de Google (ver guia-google-sheets.md).

### 3. Correr en desarrollo
```bash
npm run dev
```
Abrir http://localhost:3000

---

## Estructura del proyecto

```
/pages
  index.js          → Pantalla de inicio (elegir Gomería o Caja)
  gomeria.js        → Botonera táctil para la tablet
  caja.js           → Panel de cobros y ventas para la PC
  /api
    /gomeria
      orden.js      → POST: crear orden desde gomería
    /caja
      pendientes.js → GET: listar órdenes pendientes
      venta-local.js → POST: registrar venta desde caja
      /cobrar
        [id].js     → POST: marcar orden como cobrada
    /productos
      index.js      → GET: buscar productos
/lib
  sheets.js         → Helper de conexión a Google Sheets
/styles
  globals.css
```

---

## Deploy en Vercel

### 1. Crear repositorio en GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/fb-lubricentro.git
git push -u origin main
```

### 2. Importar en Vercel
1. Ir a https://vercel.com → **Add New Project**
2. Importar el repositorio de GitHub
3. En **Environment Variables**, agregar las 3 variables:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`  ← pegar el valor completo con los `\n`
   - `SPREADSHEET_ID`
4. Click **Deploy**

### 3. URLs del sistema
Después del deploy vas a tener:
- `https://tu-app.vercel.app/` → Inicio
- `https://tu-app.vercel.app/gomeria` → Tablet gomería
- `https://tu-app.vercel.app/caja` → PC caja

### Tip: acceso rápido en tablet
En la tablet, abrir Chrome → ir a `/gomeria` → menú ⋮ → **"Agregar a pantalla de inicio"**.
Queda como app nativa sin barra del navegador.

---

## Uso del sistema

### Gomería (tablet)
1. Seleccionar servicios del turno actual
2. (Opcional) cargar nombre del cliente
3. Tocar **ENVIAR A CAJA** → la orden aparece en caja en segundos

### Caja (PC)
- **Pendientes**: ver órdenes de gomería, completar forma de pago y cobrar
- **Nueva Venta**: buscar productos, armar venta local y registrar
- **Historial**: ver todas las ventas del día en sesión

---

## Notas importantes

- El historial del tab "Historial" en caja solo persiste durante la sesión del navegador.
  Para ver el historial completo, consultarlo directamente en Google Sheets.
- Los precios de productos se pueden editar directamente en la hoja `productos` de Sheets.
- Para agregar nuevos servicios de gomería, editar el array `SERVICIOS` en `pages/gomeria.js`.
