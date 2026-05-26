# FB Lubricentro — Sistema de Gestión
### Documentación técnica para AntiGravity

---

## 1. Resumen del sistema

Sistema de gestión operativo para **gomería y lubricentro**, desplegado en Vercel con Google Sheets como base de datos temporal. Permite al gomero cargar órdenes desde una tablet y a la caja cobrarlas desde una PC, en tiempo real.

El sistema fue diseñado con una arquitectura progresiva: arranca simple (Sheets como DB) y está preparado para migrar a PostgreSQL/Prisma cuando el volumen o la complejidad lo justifiquen.

---

## 2. URLs del sistema

| Pantalla | URL | Dispositivo |
|---|---|---|
| Inicio | `https://fb-lubricentro-int-1yii.vercel.app/` | Cualquiera |
| Gomería | `https://fb-lubricentro-int-1yii.vercel.app/gomeria` | Tablet |
| Caja | `https://fb-lubricentro-int-1yii.vercel.app/caja` | PC |
| Importador | `https://fb-lubricentro-int-1yii.vercel.app/importar` | PC |

> **Nota:** Actualmente las páginas son **abiertas** (sin login). Cualquiera con la URL puede acceder. La autenticación es una mejora pendiente para próximos sprints.

---

## 3. Instalación como PWA en la tablet (gomería)

1. Abrir **Chrome** en la tablet
2. Navegar a `https://fb-lubricentro-int-1yii.vercel.app/gomeria`
3. Menú `⋮` → **"Agregar a pantalla de inicio"**
4. La app queda instalada como ícono nativo, sin barra del navegador

---

## 4. Stack tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework | Next.js | 14.2.3 | Routing, SSR, API Routes |
| UI | React | 18 | Componentes y estado |
| Base de datos | Google Sheets | API v4 | DB temporal (lista para migrar) |
| Cliente Sheets | googleapis | ^140.0.0 | SDK oficial de Google |
| UUIDs | uuid | ^9.0.0 | IDs únicos de ventas e ítems |
| Importación Excel | xlsx | ^0.18.5 | Lectura de listas de proveedores |
| Deploy | Vercel | — | Hosting + CI/CD automático |
| Linting | ESLint + eslint-config-next | 14.2.3 | Calidad de código |
| Estilos | CSS inline + globals.css | — | Estilos por página + reset global |

> **Sobre los estilos:** No hay Tailwind ni módulos CSS. El `styles/globals.css` es mínimo (reset básico). Cada página maneja sus propios estilos inline dentro del JSX usando objetos de estilo de React.

---

## 5. Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   CLIENTE                        │
│                                                  │
│  Tablet (Gomería)          PC (Caja)             │
│  /gomeria                  /caja                 │
│  polling pasivo            polling cada 5 seg    │
└──────────────┬─────────────────┬────────────────┘
               │  HTTP fetch     │  HTTP fetch
               ▼                 ▼
┌─────────────────────────────────────────────────┐
│            SERVIDOR — Next.js (Vercel)           │
│                                                  │
│  /pages/api/gomeria/*   /pages/api/caja/*        │
│  /pages/api/productos/*                          │
│                                                  │
│  lib/sheets.js  ←── cliente Google Sheets        │
└──────────────────────┬──────────────────────────┘
                       │  HTTPS + OAuth2 (Service Account)
                       ▼
┌─────────────────────────────────────────────────┐
│           Google Sheets API v4                   │
│                                                  │
│  Spreadsheet: "FB Lubricentro - AntiGravity"     │
│  - ventas          - venta_items                 │
│  - servicios_gomeria  - productos_gomeria        │
└─────────────────────────────────────────────────┘
```

### Principios de diseño clave

1. **Nunca escritura directa desde el cliente al Sheet.** Todo pasa por las API Routes de Next.js. Esto protege las credenciales y centraliza la lógica de negocio.
2. **Sin transacciones atómicas.** Al ser Sheets (no una DB relacional), si se cae la conexión en medio de un guardado, puede quedar una venta sin sus ítems. Esto es una limitación conocida del stack actual.
3. **Concurrencia limitada.** Si dos personas escriben al Sheet simultáneamente pueden generarse conflictos. No es un problema en el volumen actual del negocio, pero es la razón principal para migrar a PostgreSQL en el futuro.

---

## 6. Estructura de archivos

```
fb-lubricentro/
├── lib/
│   └── sheets.js              # Cliente Google Sheets + helpers (getRows, appendRow, updateRowWhere)
├── pages/
│   ├── _app.js                # Wrapper global de React
│   ├── index.js               # Pantalla de inicio (selector de módulo)
│   ├── gomeria.js             # UI de la tablet del gomero
│   ├── caja.js                # UI de la PC de caja
│   ├── importar.js            # Importador de listas de proveedores
│   └── api/
│       ├── gomeria/
│       │   ├── orden.js       # POST: crea orden desde gomería
│       │   ├── servicios.js   # GET: lista servicios desde Sheet
│       │   ├── productos.js   # GET: lista productos con stock
│       │   └── stock/
│       │       └── [id].js    # POST: descuenta stock al vender
│       ├── caja/
│       │   ├── pendientes.js  # GET: órdenes con estado=pendiente
│       │   ├── cobrar/
│       │   │   └── [id].js    # POST: marca orden como cobrada
│       │   ├── venta-local.js # POST: venta directa desde caja
│       │   └── historial.js   # GET: ventas del día actual (filtra por fecha === hoy)
│       └── productos/
│           ├── index.js       # GET: busca productos por nombre/código
│           └── importar.js    # POST: importa lista de proveedor
├── styles/
│   └── globals.css            # Reset CSS mínimo
├── next.config.js             # Configuración Next.js (reactStrictMode: true)
├── package.json
└── .env.local                 # Variables de entorno locales (no commiteado)
```

---

## 7. Módulo `lib/sheets.js` — helper central

Este archivo es el único punto de contacto con Google Sheets. Exporta:

| Función | Qué hace |
|---|---|
| `getSheetsClient()` | Autentica con Google via Service Account y retorna el cliente `sheets` |
| `getRows(sheets, sheetName)` | Lee todas las filas de una pestaña y las devuelve como array de objetos `{columna: valor}` |
| `appendRow(sheets, sheetName, rowData)` | Agrega una nueva fila al final de la pestaña |
| `updateRowWhere(sheets, sheetName, matchField, matchValue, updates)` | Busca una fila por campo+valor y actualiza campos específicos (sin sobreescribir toda la fila) |

> **Patrón de autenticación:** usa un Service Account de Google Cloud. Las credenciales viven en variables de entorno. El `private_key` necesita el reemplazo `\\n → \n` porque Vercel escapa los saltos de línea al guardar la variable.

---

## 8. Google Sheets — estructura de la base de datos

El Google Sheet `FB Lubricentro - AntiGravity` tiene 4 pestañas:

### `ventas`
Cada fila es una transacción completa (cabecera de la venta).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único de la venta |
| `fecha` | string | Fecha en formato `es-AR` (DD/MM/AAAA) |
| `hora` | string | Hora HH:MM |
| `origen` | enum | `gomeria` o `caja` |
| `estado` | enum | `pendiente` → `cobrado` |
| `forma_pago` | enum | efectivo / transferencia / debito / credito / qr |
| `cliente` | string | Nombre del cliente (opcional) |
| `marketing` | string | Origen del cliente (cómo llegó al negocio) |
| `total` | number | Monto total de la venta |
| `hora_cobro` | string | Hora en que se procesó el cobro en caja |
| `patente` | string | Patente del vehículo |
| `marca` | string | Marca del vehículo |
| `modelo` | string | Modelo del vehículo |
| `telefono` | string | Teléfono del cliente |
| `vehiculo` | string | Campo compuesto: `patente · marca · modelo` |
| `es_efectivo` | boolean string | `"true"` si aplica precio efectivo — **campo crítico** |

### `venta_items`
Detalle de los ítems de cada venta (relación 1:N con `ventas`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único del ítem |
| `venta_id` | UUID | FK a `ventas.id` |
| `nombre_item` | string | Nombre del servicio o producto |
| `cantidad` | number | Cantidad |
| `precio_unitario` | number | Precio por unidad en el momento de la venta |

### `servicios_gomeria`
Botonera de servicios de la tablet. **Editable directamente por el negocio.**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | string | ID único sin espacios (ej: `balanceo_auto`) — **no modificar** |
| `grupo` | enum | Autos / Motos / Camionetas / Otros |
| `label` | string | Nombre visible en el botón |
| `icon` | emoji | Emoji del botón |
| `precio` | number | Precio del servicio |
| `activo` | boolean string | `"true"` / `"false"` — oculta el botón sin borrar el registro |

> Para cambiar un precio: editar la columna `precio` y guardar. La tablet lo refleja en el próximo refresh de la página.

### `productos_gomeria`
Productos físicos con stock. **Editable directamente por el negocio.**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | string | ID único sin espacios (ej: `cam_moto_3`) — **no modificar** |
| `nombre` | string | Nombre del producto |
| `icon` | emoji | Emoji |
| `marca` | string | Marca del producto |
| `medida` | string | Medida (ej: 175/65 R14) |
| `precio` | number | Precio normal (transferencia/débito/crédito) |
| `precio_efectivo` | number | Precio especial en efectivo |
| `stock` | number | Stock actual — se descuenta automáticamente al vender |
| `alerta_stock` | number | Stock mínimo antes de mostrar alerta visual roja |
| `activo` | boolean string | `"true"` / `"false"` |

> Para agregar un producto: añadir fila al final con todos los campos. El `id` debe ser único y sin espacios.

---

## 9. Lógica de negocio crítica

### 9.1 Precios diferenciados: Efectivo vs. Otro

Este es el mecanismo más importante del sistema:

1. El **gomero** elige en la tablet si el cliente paga en **Efectivo** o **Otro método** antes de enviar la orden.
2. Si selecciona Efectivo, los productos muestran `precio_efectivo` (más barato); si no, muestran `precio` normal.
3. El flag `es_efectivo: true/false` viaja en el body del POST a `/api/gomeria/orden`.
4. Se guarda en la columna `es_efectivo` de la hoja `ventas`.
5. En **caja**, si `es_efectivo === "true"`, el selector de forma de pago queda **bloqueado exclusivamente en Efectivo**. El cajero no puede cambiar la forma de pago.

> ⚠️ **Este flag es crítico.** Si se pierde o corrompe, el cajero podría cobrar por transferencia una venta a precio de efectivo (precio menor). No romper esta cadena en ningún refactor.

### 9.2 Flujo completo de una venta desde gomería

```
1. Gomero abre /gomeria en la tablet
2. Selecciona servicios/productos de la botonera (precios vienen del Sheet)
3. Completa datos del vehículo: patente, marca, modelo, teléfono, nombre cliente
4. Selecciona Efectivo o No
5. Toca "Enviar a Caja" → POST /api/gomeria/orden
   - Se escribe la fila en `ventas` con estado=pendiente
   - Se escriben filas en `venta_items` (una por ítem)
   - Si hay productos físicos: POST /api/gomeria/stock/[id] descuenta stock
6. Caja hace polling cada 5 segundos → GET /api/caja/pendientes
7. La orden aparece en el panel de caja
8. Cajero elige forma de pago → POST /api/caja/cobrar/[id]
   - Se actualiza estado=cobrado, forma_pago, hora_cobro, cliente, marketing en el Sheet
```

### 9.3 Historial del día

La API de historial filtra ventas donde `fecha === hoy` (formato `es-AR`). **No hay paginación ni filtros por fecha histórica.** Para consultar días anteriores hay que ver el Sheet directamente o esperar a que se construya el dashboard.

### 9.4 Stock — limitación conocida

El stock se descuenta en Sheets al enviar la orden. Si la conexión cae entre el POST de la orden y el POST de descuento de stock, el stock puede no actualizarse correctamente. No hay rollback. Esta es una limitación aceptada del stack actual y se resuelve con la migración a PostgreSQL.

---

## 10. API Routes

### Gomería

| Método | Endpoint | Descripción | Body / Params |
|---|---|---|---|
| POST | `/api/gomeria/orden` | Crea orden desde gomería | `{ items, cliente_nombre, patente, marca, modelo, telefono, es_efectivo }` |
| GET | `/api/gomeria/servicios` | Lista servicios activos desde Sheet | — |
| GET | `/api/gomeria/productos` | Lista productos con stock desde Sheet | — |
| POST | `/api/gomeria/stock/[id]` | Descuenta stock de un producto | `id` en URL, `{ cantidad }` en body |

### Caja

| Método | Endpoint | Descripción | Body / Params |
|---|---|---|---|
| GET | `/api/caja/pendientes` | Lista órdenes con estado=pendiente + sus ítems | — |
| POST | `/api/caja/cobrar/[id]` | Marca orden como cobrada | `{ forma_pago, cliente, marketing }` |
| POST | `/api/caja/venta-local` | Registra venta directa desde caja (sin gomería) | `{ items, forma_pago, cliente, marketing }` |
| GET | `/api/caja/historial` | Ventas del día actual | — |

### Productos (lubricentro)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/productos` | Busca productos por nombre o código |
| POST | `/api/productos/importar` | Importa lista de proveedor (Excel/CSV) |

---

## 11. Variables de entorno

### En producción (Vercel → Settings → Environment Variables)

| Variable | Descripción |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email de la cuenta de servicio de Google Cloud (ej: `fb-lubricentro@proyecto.iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | Clave privada del JSON de Google Cloud. Vercel escapa los `\n`, el código los restaura con `.replace(/\\n/g, '\n')` |
| `SPREADSHEET_ID` | Solo el ID del Google Sheet (el valor entre `/d/` y `/edit` en la URL) |

### En desarrollo local

Crear `.env.local` en la raíz con las mismas variables. Este archivo está en `.gitignore` y nunca se commitea.

---

## 12. Repositorio y deploy

| Campo | Valor |
|---|---|
| **GitHub** | `github.com/FBarto/fb-lubricentro-int` (privado) |
| **Rama principal** | `main` |
| **Deploy automático** | Cada push a `main` redeploya en Vercel automáticamente |
| **Entorno productivo** | `https://fb-lubricentro-int-1yii.vercel.app` |

> **Flujo de trabajo:** Desarrollar en rama feature → merge a `main` → Vercel detecta el push y redeploya sin intervención manual.

---

## 13. Funcionalidades actuales

### Gomería (tablet)
- Botonera táctil con servicios organizados por grupo (Autos / Motos / Camionetas / Otros)
- Precios cargados desde Google Sheets — actualizables sin tocar código
- Panel flotante 📦 con productos físicos (marca, medida, stock en tiempo real, precio efectivo)
- Alerta visual roja cuando el stock está por debajo del mínimo configurado
- Popup de datos del vehículo: patente, marca, modelo, cliente, teléfono
- Selector **Efectivo / Otro** que aplica precios diferenciados y bloquea forma de pago en caja
- Envío instantáneo de la orden a caja

### Caja (PC)
- Panel de cobros pendientes con **polling automático cada 5 segundos**
- Si la orden tiene `es_efectivo=true` → forma de pago bloqueada solo en Efectivo
- Registro de forma de pago, origen del cliente (marketing) y nombre
- Nueva venta local con búsqueda de productos por nombre/código
- Historial de ventas del día actual

### Importador de proveedores
- Sube listas de precios en Excel (`.xlsx`, `.xls`) o CSV
- Detecta automáticamente la fila de encabezados (funciona con archivos con logo o título)
- Mapeo manual de columnas con auto-detección inteligente
- Soporta códigos alternativos (TECNECO, FRAM, MANN, WEGA)
- Actualiza precios de productos existentes sin duplicar registros

---

## 14. Limitaciones conocidas del stack actual

| Limitación | Causa | Solución futura |
|---|---|---|
| Sin autenticación | No implementada aún | Login simple (NextAuth o similar) |
| Sin transacciones atómicas | Google Sheets no es una DB transaccional | Migración a PostgreSQL/Prisma |
| Concurrencia limitada | Sheets no maneja bien escrituras simultáneas | PostgreSQL |
| Historial solo del día | API filtra por `fecha === hoy` sin paginación | Dashboard con filtros de fecha |
| Stock puede desincronizarse | Falta de atomicidad entre venta y descuento de stock | Transacciones en DB real |

---

## 15. Roadmap — próximas versiones

- [ ] **Autenticación básica** — proteger `/caja` y `/importar` con login simple
- [ ] **Dashboard de métricas** — ventas del día/semana/mes, formas de pago, origen de clientes, con filtros de fecha
- [ ] **Módulo completo de lubricentro** — catálogo de productos con búsqueda avanzada
- [ ] **Base de datos de clientes por patente** — historial de atenciones por vehículo
- [ ] **Historial con paginación y filtros** — consulta de días anteriores
- [ ] **Google Business Profile API** — gestión de reseñas
- [ ] **Migración a PostgreSQL vía Prisma** — reemplaza Google Sheets como DB principal

---

## 16. Contexto para retomar el trabajo

**Antes de cada sprint, recordar:**

1. El **Sheet de producción** es la fuente de verdad. Cualquier cambio de precios/servicios que haya hecho el cliente directamente en Sheets no se refleja en el código.
2. Siempre probar el flujo **gomería → caja** completo después de cualquier cambio en las API Routes.
3. El flag `es_efectivo` no debe romperse bajo ningún refactor — es lógica de negocio crítica.
4. Las variables de entorno en Vercel deben coincidir exactamente con las del `.env.local` de desarrollo.
5. El `GOOGLE_PRIVATE_KEY` en Vercel tiene los `\n` escapados — el código ya lo maneja, pero si se reconfigura hay que verificarlo.

---

## 17. Contacto técnico

Sistema desarrollado con AntiGravity.  
Repositorio, credenciales y accesos en poder del cliente.

---

*Documentación actualizada: Sprint 1 — 25/05/2026*
