const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const frontendDir = path.join(__dirname, '..');
const apiClientSource = fs.readFileSync(
    path.join(frontendDir, 'src/services/apiClient.js'),
    'utf8'
);

const cargarConfiguracion = (valor) => {
    const valorJs = valor === undefined
        ? 'undefined'
        : JSON.stringify(valor);
    const ejecutable = apiClientSource
        .replace('import.meta.env.VITE_API_URL', valorJs)
        .replace(/^export /gm, '');

    return vm.runInNewContext(
        `${ejecutable}\n({ API_BASE, normalizarApiBase, obtenerApiUrl });`,
        {
            URL,
            Headers: class HeadersPrueba {},
            Request: class RequestPrueba {},
            CustomEvent: class CustomEventPrueba {},
            Symbol,
            sessionStorage: {
                getItem() { return null; },
                setItem() {},
                removeItem() {}
            },
            window: {
                location: { href: 'http://localhost:5173/' },
                fetch() {},
                dispatchEvent() {}
            }
        }
    );
};

test('sin variable conserva el backend local del proyecto', () => {
    const api = cargarConfiguracion();

    assert.equal(api.API_BASE, 'http://localhost:3000/api');
    assert.equal(
        api.obtenerApiUrl('/equipos/15'),
        'http://localhost:3000/api/equipos/15'
    );
    assert.equal(api.obtenerApiUrl(), 'http://localhost:3000/api');
});

test('acepta una URL absoluta personalizada y elimina barras sobrantes', () => {
    const api = cargarConfiguracion(
        '  https://inventario.empresa.pe/backend/api///  '
    );

    assert.equal(
        api.API_BASE,
        'https://inventario.empresa.pe/backend/api'
    );
    assert.equal(
        api.obtenerApiUrl('movimientos'),
        'https://inventario.empresa.pe/backend/api/movimientos'
    );
});

test('acepta una ruta relativa para despliegues bajo el mismo dominio', () => {
    const api = cargarConfiguracion('/api/');

    assert.equal(api.API_BASE, '/api');
    assert.equal(api.obtenerApiUrl('/usuarios'), '/api/usuarios');
});

test('una raíz relativa no genera barras dobles', () => {
    const api = cargarConfiguracion('/');

    assert.equal(api.obtenerApiUrl('/dashboard'), '/dashboard');
});

test('rechaza una configuración ambigua sin protocolo ni barra inicial', () => {
    assert.throws(
        () => cargarConfiguracion('servidor:3000/api'),
        /VITE_API_URL/
    );
});

test('todos los servicios usan el constructor común de URLs', () => {
    const serviciosDir = path.join(frontendDir, 'src/services');
    const archivos = fs.readdirSync(serviciosDir)
        .filter((archivo) => archivo.endsWith('Service.js'));

    for (const archivo of archivos) {
        const source = fs.readFileSync(
            path.join(serviciosDir, archivo),
            'utf8'
        );

        assert.match(
            source,
            /obtenerApiUrl/,
            `${archivo} debe construir sus rutas desde apiClient`
        );
        assert.doesNotMatch(
            source,
            /http:\/\/localhost:3000/,
            `${archivo} no debe fijar el servidor local`
        );
    }
});
