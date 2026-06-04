/**
 * /api/lubricentro/sync/fusion
 *
 * Scraper autenticado para Distribuidora Fusión (WooCommerce).
 * Hace login con las credenciales del .env, busca productos y devuelve
 * nombre, código, precio_costo (precio logueado) y precio_lista (precio público).
 *
 * POST body:
 *   { accion: 'buscar', query: 'motul 5100' }
 *   { accion: 'sincronizar_uno', producto_id: 'motul_5100_1l' }
 *   { accion: 'sincronizar_todos' }
 */

import { getSheetsClient, getRows, updateRowWhere } from '../../../../lib/sheets';

const BASE_URL = 'https://www.distribuidorafusion.com.ar';
const LOGIN_URL = `${BASE_URL}/wp-login.php`;
const SEARCH_URL = `${BASE_URL}/productos/`;

// ─── Helper: hace login y devuelve la cookie de sesión ───────────────────────
async function loginFusion() {
  const usuario = process.env.FUSION_USUARIO;
  const password = process.env.FUSION_PASSWORD;

  if (!usuario || !password) {
    throw new Error('Credenciales de Fusión no configuradas en variables de entorno');
  }

  // Primero traemos la página de login para obtener el nonce de WordPress
  const loginPage = await fetch(LOGIN_URL, { redirect: 'manual' });
  const loginHtml = await loginPage.text();
  const cookies = loginPage.headers.get('set-cookie') || '';

  // Extraer el redirect_to del formulario si existe
  const redirectMatch = loginHtml.match(/name="redirect_to"\s+value="([^"]*)"/);
  const redirectTo = redirectMatch ? redirectMatch[1] : `${BASE_URL}/mi-cuenta/`;

  // POST de login con credenciales
  const loginBody = new URLSearchParams({
    log: usuario,
    pwd: password,
    'wp-submit': 'Acceder',
    redirect_to: redirectTo,
    testcookie: '1',
  });

  const loginRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: loginBody.toString(),
    redirect: 'manual',
  });

  // WordPress redirige al hacer login exitoso; las cookies de sesión vienen en set-cookie
  const authCookies = loginRes.headers.get('set-cookie') || '';
  if (!authCookies.includes('wordpress_logged_in')) {
    throw new Error('Login fallido en Distribuidora Fusión. Verificar credenciales.');
  }

  // Construir string de cookies para requests posteriores
  const allCookies = [cookies, authCookies]
    .join('; ')
    .split(/,\s*(?=[a-zA-Z])/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  return allCookies;
}

// ─── Helper: parsea productos de una página de resultados de Fusión ──────────
function parsearProductos(html) {
  const productos = [];

  // Buscar bloques de productos en el HTML de WooCommerce
  // Formato típico: <li class="product ..."> ... </li>
  const productBlocks = html.match(/<li[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/li>/g) || [];

  for (const block of productBlocks) {
    try {
      // Nombre del producto
      const nombreMatch = block.match(/<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
      const nombre = nombreMatch ? nombreMatch[1].replace(/<[^>]+>/g, '').trim() : null;

      // Precio — buscar el span de precio (puede ser .price con <ins> si hay precio tachado)
      // Precio logueado (precio especial del revendedor) suele estar en <ins>
      const precioInsMatch = block.match(/<ins[^>]*>[\s\S]*?<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const precioNormalMatch = block.match(/<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/);

      const precioRaw = precioInsMatch
        ? precioInsMatch[1]
        : precioNormalMatch
          ? precioNormalMatch[1]
          : null;

      const precio = precioRaw
        ? parseFloat(
            precioRaw.replace(/<[^>]+>/g, '').replace(/[^0-9.,]/g, '').replace(',', '.')
          )
        : null;

      // Precio de lista (precio tachado, si existe)
      const precioListaMatch = block.match(/<del[^>]*>[\s\S]*?<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const precioListaRaw = precioListaMatch ? precioListaMatch[1] : null;
      const precioLista = precioListaRaw
        ? parseFloat(precioListaRaw.replace(/<[^>]+>/g, '').replace(/[^0-9.,]/g, '').replace(',', '.'))
        : null;

      // SKU / código — busca data-product_id o texto con "SKU"
      const skuMatch = block.match(/data-product_id="(\d+)"/);
      const codigo = skuMatch ? skuMatch[1] : null;

      // URL del producto
      const urlMatch = block.match(/href="([^"]*\/productos\/[^"]+)"/);
      const url = urlMatch ? urlMatch[1] : null;

      if (nombre && precio) {
        productos.push({ nombre, codigo, precio_costo: precio, precio_lista: precioLista, url });
      }
    } catch {
      // Skip malformed product blocks
    }
  }

  return productos;
}

// ─── Acción: buscar productos en Fusión ──────────────────────────────────────
async function buscarEnFusion(query, cookies) {
  const url = `${SEARCH_URL}?srch=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Cookie: cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  const html = await res.text();
  return parsearProductos(html);
}

// ─── Acción: sincronizar todos los productos de Fusión en el Sheet ────────────
async function sincronizarTodos(sheets, cookies) {
  const productos = await getRows(sheets, 'productos_lubricentro');
  const deFusion = productos.filter((p) => p.proveedor === 'fusion' && p.nombre);

  const resumen = { actualizados: 0, sin_cambio: 0, errores: 0, detalles: [] };

  for (const prod of deFusion) {
    try {
      // Buscar por nombre en Fusión
      await new Promise((r) => setTimeout(r, 800)); // rate limiting: 1 req/~800ms
      const resultados = await buscarEnFusion(prod.nombre, cookies);

      if (!resultados.length) {
        resumen.errores++;
        resumen.detalles.push({ nombre: prod.nombre, estado: 'no_encontrado' });
        continue;
      }

      // Tomar el primer resultado más similar
      const match = resultados[0];
      const nuevoPrecioCosto = match.precio_costo;
      const anteriorPrecioCosto = parseFloat(prod.precio_costo) || 0;
      const margen = parseFloat(prod.margen) || 40;
      const nuevoPrecioVenta = Math.ceil(nuevoPrecioCosto * (1 + margen / 100));

      if (nuevoPrecioCosto !== anteriorPrecioCosto) {
        await updateRowWhere(sheets, 'productos_lubricentro', 'id', prod.id, {
          precio_costo: String(nuevoPrecioCosto),
          precio_lista: String(match.precio_lista || ''),
          precio_venta: String(nuevoPrecioVenta),
          ultima_actualizacion: new Date().toLocaleDateString('es-AR'),
        });
        resumen.actualizados++;
        resumen.detalles.push({
          nombre: prod.nombre,
          estado: 'actualizado',
          anterior: anteriorPrecioCosto,
          nuevo: nuevoPrecioCosto,
          precio_venta: nuevoPrecioVenta,
        });
      } else {
        resumen.sin_cambio++;
        resumen.detalles.push({ nombre: prod.nombre, estado: 'sin_cambio' });
      }
    } catch (err) {
      resumen.errores++;
      resumen.detalles.push({ nombre: prod.nombre, estado: 'error', mensaje: err.message });
    }
  }

  return resumen;
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { accion, query, producto_id } = req.body;

  if (!accion) {
    return res.status(400).json({ error: 'Se requiere el campo "accion"' });
  }

  try {
    // Login en Fusión
    let cookies;
    try {
      cookies = await loginFusion();
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    // ── buscar: busca en Fusión y devuelve resultados sin guardar
    if (accion === 'buscar') {
      if (!query) return res.status(400).json({ error: 'Se requiere "query"' });
      const resultados = await buscarEnFusion(query, cookies);
      return res.status(200).json({ resultados });
    }

    const sheets = await getSheetsClient();

    // ── sincronizar_uno: actualiza precios de un producto específico
    if (accion === 'sincronizar_uno') {
      if (!producto_id) return res.status(400).json({ error: 'Se requiere "producto_id"' });

      const productos = await getRows(sheets, 'productos_lubricentro');
      const prod = productos.find((p) => p.id === producto_id);
      if (!prod) return res.status(404).json({ error: 'Producto no encontrado en el catálogo' });

      const resultados = await buscarEnFusion(prod.nombre, cookies);
      if (!resultados.length) {
        return res.status(200).json({ ok: true, estado: 'no_encontrado_en_fusion' });
      }

      const match = resultados[0];
      const margen = parseFloat(prod.margen) || 40;
      const nuevoPrecioVenta = Math.ceil(match.precio_costo * (1 + margen / 100));

      await updateRowWhere(sheets, 'productos_lubricentro', 'id', producto_id, {
        precio_costo: String(match.precio_costo),
        precio_lista: String(match.precio_lista || ''),
        precio_venta: String(nuevoPrecioVenta),
        ultima_actualizacion: new Date().toLocaleDateString('es-AR'),
      });

      return res.status(200).json({
        ok: true,
        estado: 'actualizado',
        precio_costo: match.precio_costo,
        precio_lista: match.precio_lista,
        precio_venta: nuevoPrecioVenta,
      });
    }

    // ── sincronizar_todos: actualiza todos los productos del catálogo con proveedor=fusion
    if (accion === 'sincronizar_todos') {
      const resumen = await sincronizarTodos(sheets, cookies);
      return res.status(200).json({ ok: true, resumen });
    }

    return res.status(400).json({ error: `Acción desconocida: ${accion}` });
  } catch (err) {
    console.error('[sync/fusion]', err);
    res.status(500).json({ error: 'Error en sincronización con Fusión' });
  }
}
