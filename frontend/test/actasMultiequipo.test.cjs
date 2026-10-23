const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Linter } = require('eslint');

// Pruebas de la página y servicio reales, con hooks/HTTP simulados y análisis JSX.
// No abre navegador ni conecta al backend/MySQL.
const archivo = path.join(process.env.INVENTARIO_PAGES_DIR || path.join(__dirname, '../src/pages'), 'ActasPage.jsx');
const source = fs.readFileSync(archivo, 'utf8');
const servicio = fs.readFileSync(path.join(__dirname, '../src/services/actaService.js'), 'utf8');
const servicioEjecutable = servicio.replace(
    /^import \{ obtenerApiUrl \} from '\.\/apiClient';\r?\n/m,
    ''
);
const linter = new Linter();
const mensajes = linter.verify(source, [{
    files: ['**/*.jsx'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } }
}], { filename: 'ActasPage.jsx' });
assert.equal(mensajes.filter((m) => m.fatal).length, 0, 'JSX válido');
const ast = linter.getSourceCode().ast;
const componente = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'ActasPage');
const retorno = componente.body.body.find((n) => n.type === 'ReturnStatement');
const clonar = (valor) => JSON.parse(JSON.stringify(valor));

function equipo(id, cambios = {}) {
    return {
        detalle_id: id, equipo_id: id, marca: 'Marca Prueba', modelo: `Modelo ${id}`,
        imei: String(id).padStart(15, '0'), serie: `SERIE-${id}`, tipo: 'CELULAR',
        estado: 'ENTREGADO', devolvio_equipo: 'NO', devolucion_registrada: 'NO',
        fecha_entrega: '2026-08-19', fecha_devolucion: null, observaciones: null,
        ...cambios
    };
}

function acta(id = 10, cambios = {}) {
    return {
        id, nro_acta: `ACTA-${id}`, estado: 'ACTIVA', fecha: '2026-09-03',
        colaborador: `PERSONA ${id}`, codigo_colaborador: `C${id}`, firmo_amo: 'SI', firmo_dmo: 'NO',
        equipos: [equipo(1, { estado: 'DEVUELTO', devolvio_equipo: 'SI', devolucion_registrada: 'SI' }), equipo(2)],
        cantidad_equipos: 2, cantidad_devueltos: 1, cantidad_no_devueltos: 1,
        cantidad_por_revisar: 0, cantidad_incidencias: 0, estado_devolucion: 'PARCIAL', ...cambios
    };
}

function diferida() {
    let resolve;
    let reject;
    const promise = new Promise((ok, fallo) => { resolve = ok; reject = fallo; });
    return { promise, resolve, reject };
}

function crearApi() {
    const peticiones = [];
    const api = vm.runInNewContext(`${servicioEjecutable.replace(/^export /gm, '')}\n({ listarActas, obtenerActaPorId });`, {
        obtenerApiUrl: (ruta = '') =>
            `http://localhost:3000/api/${String(ruta).replace(/^\/+/, '')}`,
        fetch(url, opciones) {
            assert.ok(!opciones || !opciones.method || opciones.method === 'GET');
            const peticion = { url, ...diferida() };
            peticiones.push(peticion);
            return peticion.promise;
        }
    });
    function responder(indice, data, opciones = {}) {
        peticiones[indice].resolve({
            ok: opciones.ok ?? true,
            headers: { get: () => opciones.tipo ?? 'application/json' },
            json: async () => ({ success: opciones.success ?? true, data, mensaje: opciones.mensaje })
        });
    }
    return { api, peticiones, responder };
}

const nombresPuros = ['normalizar', 'formatearTexto', 'formatearFechaActa', 'obtenerNumeroActa', 'obtenerColaborador', 'obtenerEquipo'];
const funcionesPuras = ast.body.filter((n) => n.type === 'FunctionDeclaration' && nombresPuros.includes(n.id.name))
    .map((n) => source.slice(...n.range)).join('\n');

function montar() {
    const http = crearApi();
    const slots = [];
    const efectos = [];
    let indice = 0;
    let desmontado = false;
    let cambiosTrasSalir = 0;
    function useState(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { valor: inicial };
        return [slots[posicion].valor, (valor) => {
            if (desmontado) cambiosTrasSalir++;
            slots[posicion].valor = typeof valor === 'function' ? valor(slots[posicion].valor) : valor;
        }];
    }
    function useRef(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { current: inicial };
        return slots[posicion];
    }
    function useEffect(callback) {
        const posicion = indice++;
        if (!(posicion in slots)) {
            slots[posicion] = {};
            efectos.push(() => { slots[posicion].limpiar = callback(); });
        }
    }
    const render = vm.runInNewContext(`${funcionesPuras}\n${source.slice(componente.range[0], retorno.range[0])}
        return {
            cargarActas, verActa, cerrarDetalle, setBusqueda, setEstadoSeleccionado,
            estado: { actas, cargando, error, resumen, actasFiltradas, detalleAbierto,
                cargandoDetalle, errorDetalle, actaSeleccionada }
        };
    }\nActasPage;`, {
        useState, useRef, useEffect, useMemo: (f) => { indice++; return f(); },
        console: { error() { } }, ...http.api
    });
    function vista() {
        assert.equal(desmontado, false);
        indice = 0;
        const resultado = render();
        while (efectos.length) efectos.shift()();
        return resultado;
    }
    vista();
    return {
        ...http, vista, estado: () => clonar(vista().estado),
        async cargar(datos) {
            // Deja obsoleta la carga inicial para poder esperar a una carga explícita.
            const promesa = vista().cargarActas();
            http.responder(http.peticiones.length - 1, datos);
            await promesa;
        },
        salir() {
            for (const slot of slots) if (typeof slot?.limpiar === 'function') slot.limpiar();
            desmontado = true;
        },
        cambiosTrasSalir: () => cambiosTrasSalir
    };
}

test('Servicio: consulta el listado una sola vez y conserva todos los equipos', async () => {
    const http = crearApi();
    const pendiente = http.api.listarActas();
    http.responder(0, [acta()]);
    const datos = await pendiente;
    assert.equal(datos[0].equipos.length, 2);
    assert.equal(http.peticiones.length, 1);
    assert.equal(http.peticiones[0].url, 'http://localhost:3000/api/actas');
});

for (const [nombre, datos] of [
    ['respuesta antigua sin equipos', [{ id: 10, cantidad_equipos: 2 }]],
    ['data no es un array', {}],
    ['contador distinto de los detalles', [acta(10, { cantidad_equipos: 3 })]],
    ['contadores incompletos', [acta(10, { cantidad_no_devueltos: undefined })]],
    ['detalle sin clasificación', [acta(10, { equipos: [equipo(1), { detalle_id: 2 }] })]],
    ['estado de devolución desconocido', [acta(10, { estado_devolucion: 'COMPLETADA' })]]
]) {
    test(`Servicio: rechaza ${nombre}, no inventa una devolución pendiente`, async () => {
        const http = crearApi();
        const pendiente = http.api.listarActas();
        http.responder(0, datos);
        await assert.rejects(pendiente, /API|backend/);
    });
}

test('Servicio: acepta listado vacío', async () => {
    const http = crearApi();
    const pendiente = http.api.listarActas();
    http.responder(0, []);
    assert.equal((await pendiente).length, 0);
});

test('Servicio: detalle conserva ID y se obtiene con GET específico', async () => {
    const http = crearApi();
    const pendiente = http.api.obtenerActaPorId(10);
    http.responder(0, acta());
    assert.equal((await pendiente).id, 10);
    assert.equal(http.peticiones[0].url, 'http://localhost:3000/api/actas/10');
});

test('Servicio: rechaza detalle de otro ID', async () => {
    const http = crearApi();
    const pendiente = http.api.obtenerActaPorId(10);
    http.responder(0, acta(11));
    await assert.rejects(pendiente, /no corresponde/);
});

for (const opciones of [
    { ok: false, mensaje: 'No se pudo consultar' },
    { success: false, mensaje: 'No se pudo consultar' },
    { tipo: 'text/html' }
]) {
    test(`Servicio: propaga error HTTP/JSON ${JSON.stringify(opciones)}`, async () => {
        const http = crearApi();
        const pendiente = http.api.listarActas();
        http.responder(0, [], opciones);
        await assert.rejects(pendiente);
    });
}

for (const busqueda of ['000000000000002', 'serie-2', 'Modelo 2', '  marca prueba  ', 'persona 10', 'c10']) {
    test(`Búsqueda: encuentra el acta por ${busqueda}`, async () => {
        const app = montar();
        await app.cargar([acta()]);
        app.vista().setBusqueda(busqueda);
        assert.deepEqual(app.estado().actasFiltradas.map((a) => a.id), [10]);
        assert.equal(app.peticiones.length, 2, 'Buscar no descarga un detalle por acta');
    });
}

test('Búsqueda y filtro de estado se combinan sin modificar los contadores generales', async () => {
    const app = montar();
    await app.cargar([acta(10), acta(11, { estado: 'CERRADA' })]);
    app.vista().setEstadoSeleccionado('CERRADA');
    app.vista().setBusqueda('SERIE-2');
    assert.deepEqual(app.estado().actasFiltradas.map((a) => a.id), [11]);
    assert.equal(app.estado().resumen.total, 2);
    assert.equal(app.estado().resumen.cerradas, 1);
});

test('Resumen cuenta actas, distingue CERRADA y separa devolución total/parcial', async () => {
    const app = montar();
    const total = {
        equipos: [equipo(3, { estado: 'DEVUELTO', devolvio_equipo: 'SI', devolucion_registrada: 'SI' })],
        cantidad_equipos: 1, cantidad_devueltos: 1, cantidad_no_devueltos: 0, estado_devolucion: 'TOTAL'
    };
    await app.cargar([
        acta(10), acta(11, { ...total, estado: 'CERRADA' }), acta(12, { ...total, estado: 'ANULADA' }),
        acta(13, {
            estado: 'PENDIENTE', equipos: [], cantidad_equipos: 0, cantidad_devueltos: 0,
            cantidad_no_devueltos: 0, estado_devolucion: 'SIN_EQUIPOS'
        })
    ]);
    assert.deepEqual(app.estado().resumen, { total: 4, cerradas: 1, pendientes: 1, devueltos: 2, parciales: 1, revisar: 0 });
});

test('Acta sin detalles no falla al buscar y no se cuenta como devuelta', async () => {
    const app = montar();
    await app.cargar([acta(10, {
        equipos: [], cantidad_equipos: 0, cantidad_devueltos: 0,
        cantidad_no_devueltos: 0, estado_devolucion: 'SIN_EQUIPOS'
    })]);
    app.vista().setBusqueda('IMEI-INEXISTENTE');
    assert.equal(app.estado().actasFiltradas.length, 0);
    assert.equal(app.estado().resumen.devueltos, 0);
});

test('Último equipo de un acta grande también participa en la búsqueda', async () => {
    const app = montar();
    const equipos = Array.from({ length: 150 }, (_, i) => equipo(i + 1));
    await app.cargar([acta(10, {
        equipos, cantidad_equipos: 150, cantidad_devueltos: 0,
        cantidad_no_devueltos: 150, estado_devolucion: 'PENDIENTE'
    })]);
    app.vista().setBusqueda('000000000000150');
    assert.equal(app.estado().actasFiltradas.length, 1);
});

test('Detalle: la respuesta vieja de A no reemplaza el acta B', async () => {
    const app = montar();
    const a = app.vista().verActa(10);
    const b = app.vista().verActa(11);
    app.responder(2, acta(11));
    await b;
    app.responder(1, acta(10));
    await a;
    assert.equal(app.estado().actaSeleccionada.id, 11);
});

test('Detalle: error antiguo no ensucia ni termina la carga vigente', async () => {
    const app = montar();
    const a = app.vista().verActa(10);
    const b = app.vista().verActa(11);
    app.peticiones[1].reject(new Error('Error viejo'));
    await a;
    assert.equal(app.estado().errorDetalle, '');
    assert.equal(app.estado().cargandoDetalle, true);
    app.responder(2, acta(11));
    await b;
});

test('Detalle: cerrar mientras carga descarta la respuesta', async () => {
    const app = montar();
    const pendiente = app.vista().verActa(10);
    app.vista().cerrarDetalle();
    app.responder(1, acta(10));
    await pendiente;
    assert.equal(app.estado().detalleAbierto, false);
    assert.equal(app.estado().actaSeleccionada, null);
});

test('Listado: una respuesta antigua no sustituye la actualización más reciente', async () => {
    const app = montar();
    const pendiente = app.vista().cargarActas();
    app.responder(1, [acta(11)]);
    await pendiente;
    app.responder(0, [acta(10)]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.estado().actas[0].id, 11);
});

test('Listado: un error vigente no deja datos antiguos presentados como actuales', async () => {
    const app = montar();
    await app.cargar([acta()]);
    const pendiente = app.vista().cargarActas();
    app.peticiones[2].reject(new Error('Sin conexión'));
    await pendiente;
    assert.equal(app.estado().error, 'Sin conexión');
    assert.deepEqual(app.estado().actas, []);
});

test('Salir de la página descarta respuestas y finalizaciones pendientes', async () => {
    const app = montar();
    const pendiente = app.vista().verActa(10);
    app.salir();
    app.responder(0, [acta()]);
    app.responder(1, acta());
    await pendiente;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.cambiosTrasSalir(), 0);
});

function buscar(nodo, predicado, resultado = []) {
    if (!nodo || typeof nodo !== 'object') return resultado;
    if (predicado(nodo)) resultado.push(nodo);
    for (const [key, valor] of Object.entries(nodo)) {
        if (['parent', 'tokens', 'comments', 'loc', 'range'].includes(key)) continue;
        if (Array.isArray(valor)) valor.forEach((hijo) => buscar(hijo, predicado, resultado));
        else if (valor && typeof valor === 'object') buscar(valor, predicado, resultado);
    }
    return resultado;
}

test('JSX: el detalle recorre equipos[], usa detalle_id y muestra ambos identificadores', () => {
    const detalle = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'DetalleActa');
    const maps = buscar(detalle, (n) => n.type === 'CallExpression' && n.callee.type === 'MemberExpression' &&
        source.slice(...n.callee.range) === 'acta.equipos.map');
    assert.equal(maps.length, 1);
    const callback = source.slice(...maps[0].arguments[0].range);
    for (const campo of ['detalle_id', 'imei', 'serie', 'fecha_entrega', 'fecha_devolucion', 'observaciones', 'estado', 'devolvio_equipo']) {
        assert.ok(callback.includes(`equipo.${campo}`), `Campo visible: ${campo}`);
    }
    assert.doesNotMatch(source.slice(...detalle.range), /acta\.(marca|modelo|imei|serie|asignacion_id|devolvio_equipo)\b/);
});

test('JSX: notas son texto; el estado de devolución no se deduce de firmas ni de estado_actual', () => {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    const devolucion = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'DevolucionActa');
    const cuerpo = source.slice(...devolucion.range);
    assert.match(cuerpo, /acta.estado_devolucion/);
    assert.match(cuerpo, /acta.cantidad_devueltos/);
    assert.doesNotMatch(cuerpo, /firmo_amo|firmo_dmo|estado_actual/);
});

test('JSX: estilos propios importados, contador CERRADA y aviso de detalles ausentes', () => {
    assert.ok(ast.body.some((n) => n.type === 'ImportDeclaration' && n.source.value === './ActasPage.css'));
    assert.doesNotMatch(source, /COMPLETADA|titulo="Equipos devueltos"/);
    assert.match(source, /Actas cerradas/);
    assert.match(source, /No hay equipos registrados en detalle_acta/);
    assert.match(source, /no se corrigieron automáticamente/);
});

test('Fechas se presentan como día/mes/año sin desplazar fechas de calendario', () => {
    const formatear = vm.runInNewContext(`${funcionesPuras}\nformatearFechaActa;`);
    assert.equal(formatear('2026-09-03'), '03/09/2026');
    assert.equal(formatear('2026-09-03T00:00:00.000Z'), '03/09/2026');
    assert.equal(formatear(null), '-');
});
