# FB Lubricentro — Sistema de Gestión
### Documentación de entrega para AntiGravity

---

## Resumen del sistema

Sistema de gestión operativo para gomería y lubricentro, deployado en Vercel con Google Sheets como base de datos. Permite al gomero cargar órdenes desde una tablet y a la caja cobrarlas desde una PC, en tiempo real.

---

## URLs del sistema

| Pantalla | URL | Dispositivo |
|---|---|---|
| Inicio | `tu-app.vercel.app/` | Cualquiera |
| Gomería | `tu-app.vercel.app/gomeria` | Tablet |
| Caja | `tu-app.vercel.app/caja` | PC |
| Importador | `tu-app.vercel.app/importar` | PC |

> Reemplazar `tu-app` por la URL real asignada por Vercel.

---

## Instalación en la tablet (gomería)

1. Abrir Chrome en la tablet
2. Navegar a `tu-app.vercel.app/gomeria`
3. Menú `⋮` → **"Agregar a pantalla de inicio"**
4. La app queda instalada como ícono nativo, sin barra del navegador

---

## Arquitectura

```
Tablet (Gomería)          PC (Caja)
      ↓                       ↓
  Next.js (Vercel) ←→ Next.js (Vercel)
              ↓
       Google Sheets API
              ↓
     Google Sheets (DB temporal)
```

**Stack:** Next.js 14 · React 18 · Google Sheets API · Vercel

---

## Google Sheets — estructura

El archivo `FB Lubricentro - AntiGravity` contiene 4 pestañas:

### `ventas`
Registra cada transacción.

| Columna | Descripción |
|---|---|
| id | UUID único |
| fecha | Fecha en formato es-AR |
| hora | Hora HH:MM |
| origen | `gomeria` o `caja` |
| estado | `pendiente` o `cobrado` |
| forma_pago | efectivo / transferencia / debito / credito / qr |
| cliente | Nombre del cliente (opcional) |
| marketing | Origen del cliente |
| total | Monto total |
| hora_cobro | Hora en que se cobró |
| patente | Patente del vehículo |
| marca | Marca del vehículo |
| modelo | Modelo del vehículo |
| telefono | Teléfono del cliente |
| vehiculo | Resumen: patente · marca · modelo |
| es_efectivo | `true` si se aplicó precio efectivo |

### `venta_items`
Detalle de ítems por venta.

| Columna | Descripción |
|---|---|
| id | UUID único |
| venta_id | Referencia a ventas.id |
| nombre_item | Nombre del servicio o producto |
| cantidad | Cantidad |
| precio_unitario | Precio por unidad |

### `servicios_gomeria`
Servicios de la botonera de gomería. **Editable por el negocio.**

| Columna | Descripción |
|---|---|
| id | Identificador único (no modificar) |
| grupo | Autos / Motos / Camionetas / Otros |
| label | Nombre visible en la botonera |
| icon | Emoji del botón |
| precio | Precio del servicio |
| activo | `true` / `false` — oculta sin borrar |

> Para cambiar un precio: editar la columna `precio` y guardar. La tablet lo refleja en el próximo refresh.

### `productos_gomeria`
Productos físicos con stock. **Editable por el negocio.**

| Columna | Descripción |
|---|---|
| id | Identificador único (no modificar) |
| nombre | Nombre del producto |
| icon | Emoji |
| marca | Marca del producto |
| medida | Medida (ej: 175/65 R14) |
| precio | Precio normal |
| precio_efectivo | Precio especial en efectivo |
| stock | Stock actual |
| alerta_stock | Stock mínimo antes de alerta roja |
| activo | `true` / `false` |

> Para agregar un producto nuevo: agregar una fila al final con todos los campos completos. El `id` debe ser único y sin espacios (ej: `cam_moto_3`).

---

## API Routes

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/gomeria/orden` | Crea orden desde gomería |
| GET | `/api/gomeria/servicios` | Lista servicios desde Sheet |
| GET | `/api/gomeria/productos` | Lista productos con stock |
| POST | `/api/gomeria/stock/[id]` | Descuenta stock al vender |
| GET | `/api/caja/pendientes` | Lista órdenes pendientes |
| POST | `/api/caja/cobrar/[id]` | Marca orden como cobrada |
| POST | `/api/caja/venta-local` | Registra venta directa de caja |
| GET | `/api/productos` | Busca productos del lubricentro |
| POST | `/api/productos/importar` | Importa lista de proveedor |

---

## Variables de entorno (Vercel)

Configuradas en Vercel → Settings → Environment Variables:

| Variable | Descripción |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email de la cuenta de servicio de Google Cloud |
| `GOOGLE_PRIVATE_KEY` | Clave privada del JSON de Google Cloud |
| `SPREADSHEET_ID` | ID del Google Sheet (solo el ID, no la URL completa) |

> El `SPREADSHEET_ID` es el valor entre `/d/` y `/edit` en la URL del Sheet.

---

## Repositorio

- **GitHub:** `github.com/FBarto/fb-lubricentro-int`
- **Visibilidad:** Privado
- **Deploy automático:** Cada push a `main` redeploya en Vercel automáticamente

---

## Funcionalidades actuales

### Gomería (tablet)
- Botonera táctil con servicios por grupo (Autos / Motos / Camionetas / Otros)
- Precios cargados desde Google Sheets — actualizables sin tocar código
- Panel flotante 📦 con productos físicos (marca, medida, stock, precio efectivo)
- Stock en tiempo real con alerta visual cuando queda poco
- Popup de datos del vehículo: patente, marca, modelo, cliente, teléfono
- Selector Efectivo / Otro que aplica precios diferenciados
- Envío instantáneo a caja

### Caja (PC)
- Panel de cobros pendientes con polling cada 5 segundos
- Si la orden fue enviada con precio efectivo → solo permite cobrar en efectivo (bloqueado)
- Registro de forma de pago, origen del cliente (marketing) y nombre
- Nueva venta local con búsqueda de productos por nombre/código
- Historial de ventas de la sesión

### Importador de proveedores
- Sube listas de precios en Excel (.xlsx, .xls) o CSV
- Detecta automáticamente la fila de encabezados (funciona con listas con logo/título)
- Mapeo manual de columnas con auto-detección inteligente
- Soporta códigos alternativos (TECNECO, FRAM, MANN, WEGA)
- Actualiza precios de productos existentes sin duplicar

---

## Pendiente (próximas versiones)

- Dashboard de métricas (ventas del día / semana / mes, formas de pago, origen de clientes)
- Módulo completo de lubricentro con catálogo de productos
- Base de datos de clientes por patente
- Google Business Profile API (reseñas)
- Migración a base de datos real (PostgreSQL vía Prisma)

---

## Contacto técnico

Sistema desarrollado con asistencia de Claude (Anthropic).
Repositorio, credenciales y accesos en poder del cliente.

---

*Documento generado el 25/05/2026*
