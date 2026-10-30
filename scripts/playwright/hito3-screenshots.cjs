/*
 * Prueba end-to-end del Hito 3 (vehículos de propietarios externos) con Playwright.
 *
 * Requisitos:
 *   - El stack de docker compose levantado.
 *   - El frontend de Vite en http://127.0.0.1:5173.
 *   - Un cliente con documento 30123456 (por ejemplo camila.externo@example.test
 *     / Usuario13*). El script lo usa para que la validación de titularidad de
 *     DEF456/ABC123/AE321KL sea satisfactoria.
 *   - Playwright instalado (se ejecuta con NODE_PATH apuntando a su node_modules).
 *
 * El script detiene verification-service, registra una patente para capturar el
 * estado PENDIENTE, lo vuelve a arrancar y espera la incorporación asíncrona.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..', '..');
const WEB = process.env.RENTAR_WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.RENTAR_API_URL || 'http://localhost:3000';
const RABBIT = process.env.RENTAR_RABBIT_URL || 'http://localhost:55673';
const RABBIT_USER = process.env.RABBITMQ_USER || 'rentar';
const RABBIT_PASSWORD = process.env.RABBITMQ_PASSWORD || 'rentar';
const CAPTURAS = path.join(RAIZ, 'docs', 'capturas');
const CLIENTE = {
  email: process.env.RENTAR_CLIENTE_EMAIL || 'camila.externo@example.test',
  password: process.env.RENTAR_CLIENTE_PASSWORD || 'Usuario13*',
};
const ADMIN = {
  email: process.env.RENTAR_ADMIN_EMAIL || 'admin@unla.com.ar',
  password: process.env.RENTAR_ADMIN_PASSWORD || 'Admin123',
};
const PATENTE = process.env.RENTAR_PATENTE || 'ABC123';

fs.mkdirSync(CAPTURAS, { recursive: true });

function docker(...args) {
  execFileSync('docker', ['compose', ...args], { cwd: RAIZ, stdio: 'inherit' });
}

async function api(ruta, metodo = 'GET', cuerpo = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw Object.assign(new Error(`HTTP ${respuesta.status}: ${JSON.stringify(datos)}`), {
      status: respuesta.status,
      datos,
    });
  }
  return datos;
}

async function asegurarCliente() {
  try {
    await api('/auth/login', 'POST', CLIENTE);
    return CLIENTE;
  } catch {
    // Puede ser que el cliente demo todavía no exista. Lo crea el admin.
  }

  const admin = await api('/auth/login', 'POST', ADMIN);
  const clientes = await api('/clientes', 'GET', null, admin.accessToken);
  const existente = clientes.find((c) => c.documento === '30123456');
  if (existente) {
    throw new Error(
      `Ya existe un cliente con documento 30123456 (id ${existente.id}, email ${existente.email}) ` +
        'pero las credenciales del script no funcionan. Configurá RENTAR_CLIENTE_EMAIL y RENTAR_CLIENTE_PASSWORD.',
    );
  }
  const nuevo = await api(
    '/clientes',
    'POST',
    {
      documento: '30123456',
      nombre: 'Camila',
      apellido: 'Torres',
      email: CLIENTE.email,
    },
    admin.accessToken,
  );
  return {
    email: nuevo.email,
    password: nuevo.contrasenaTemporal || `Usuario${nuevo.id}*`,
  };
}

async function login(page, credenciales) {
  await page.goto(`${WEB}/ingreso`);
  await page.locator('input[type="email"]').fill(credenciales.email);
  await page.locator('input[type="password"]').fill(credenciales.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function main() {
  const navegador = await chromium.launch({ headless: true });
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await contexto.newPage();
  let verificacionDetenida = false;

  try {
    const credenciales = await asegurarCliente();
    await login(page, credenciales);
    await page.getByRole('link', { name: 'Ofrecer mi vehículo' }).first().waitFor();
    await page.screenshot({
      path: path.join(CAPTURAS, '04-h3-home-cta.png'),
      fullPage: true,
    });

    await page.getByRole('link', { name: 'Ofrecer mi vehículo' }).first().click();
    await page.getByRole('heading', { name: 'Ofrecer mi vehículo' }).waitFor();
    await page.locator('input.fi').nth(0).fill(PATENTE);
    await page.locator('select.fi').nth(0).selectOption('Ford');
    await page.locator('select.fi').nth(1).selectOption('Focus');
    await page.locator('input.fi').nth(1).fill('2021');
    await page.locator('input.fi').nth(2).fill('Azul');
    await page.locator('input.fi').nth(3).fill('27000');
    await page.screenshot({
      path: path.join(CAPTURAS, '05-h3-formulario.png'),
      fullPage: true,
    });

    // Dejamos el worker de verificación detenido para que se vea el PENDIENTE.
    docker('stop', 'verification-service');
    verificacionDetenida = true;

    await page.getByRole('button', { name: 'Publicar vehículo' }).click();
    await page.getByText(/Solicitud #\d+ registrada/).waitFor({ timeout: 15000 });
    const filaPendiente = page.locator('tr', { hasText: PATENTE });
    await filaPendiente.getByText('Pendiente de validación').waitFor({ timeout: 15000 });
    await page.screenshot({
      path: path.join(CAPTURAS, '06-h3-pendiente.png'),
      fullPage: true,
    });

    docker('start', 'verification-service');
    verificacionDetenida = false;

    const filaAprobada = page.locator('tr', { hasText: PATENTE });
    const limite = Date.now() + 45000;
    let aprobado = false;
    while (Date.now() < limite) {
      const texto = await filaAprobada.innerText().catch(() => '');
      if (texto.includes('Incorporado a la flota')) {
        aprobado = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (!aprobado) throw new Error(`${PATENTE} no se incorporó a la flota a tiempo`);

    await page.screenshot({
      path: path.join(CAPTURAS, '07-h3-aprobado.png'),
      fullPage: true,
    });
    await page.locator('.tabla-wrap').first().screenshot({
      path: path.join(CAPTURAS, '08-h3-rechazos.png'),
    });

    // La incorporación asíncrona deja el vehículo disponible para reservar.
    await page.goto(`${WEB}/`);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.locator('.vcard', { hasText: PATENTE }).waitFor({ timeout: 15000 });
    await page.screenshot({
      path: path.join(CAPTURAS, '09-h3-disponibilidad.png'),
      fullPage: true,
    });

    // Captura opcional de la topología y las colas en RabbitMQ.
    try {
      await page.goto(`${RABBIT}/`);
      await page.waitForTimeout(2500);
      const usuario = page.locator('input[name="username"], input#username').first();
      const clave = page.locator('input[name="password"], input#password').first();
      if (await usuario.count()) {
        await usuario.fill(RABBIT_USER);
        await clave.fill(RABBIT_PASSWORD);
        await page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first().click();
        await page.waitForTimeout(2000);
      }
      await page.goto(`${RABBIT}/#/queues`);
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: path.join(CAPTURAS, '10-h3-rabbitmq.png'),
        fullPage: true,
      });
    } catch (error) {
      console.warn('No se pudo capturar RabbitMQ:', error.message);
    }

    console.log('Capturas generadas en', CAPTURAS);
  } finally {
    if (verificacionDetenida) {
      console.warn('Restaurando verification-service...');
      try { docker('start', 'verification-service'); } catch {}
    }
    await navegador.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
