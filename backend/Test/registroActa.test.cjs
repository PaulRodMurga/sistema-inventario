const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Contratos y fallos con MySQL/triggers simulados, no concurrencia MySQL real.
const clonar = (dato) => JSON.parse(JSON.stringify(dato));
const directorio = process.env.INVENTARIO_CONTROLLERS_DIR || path.join(__dirname, '../src/controllers');
function entorno(opciones = {}) {
    let datos = {
        acta: { id: 10, colaborador_id: 8, estado: 'ACTIVA', firmo_amo: 'SI', observaciones: 'No alterar' },
        equipo: { id: 20, estado_actual: 'LIBRE' },
        colaborador: { id: 8, estado: 'ACTIVO' },
        detalles: [{
            id: 100, acta_id: 10, equipo_id: 20, estado: 'ENTREGADO', devolvio_equipo: 'NO',
            fecha_entrega: '2026-09-01', fecha_devolucion: null, observaciones: 'Documento original'
        }],
        asignaciones: [], movimientos: []
    };
    opciones.mutar?.(datos);
    const eventos = [];
    const consultas = [];
    let transaccion;
    let activa = false;
    const fallar = (paso) => {
        if (opciones.falla === paso) throw Object.assign(new Error(`Fallo: ${paso}`), opciones.error || {});
    };
    const conexion = {
        async beginTransaction() { eventos.push('begin'); fallar('begin'); activa = true; transaccion = clonar(datos); },
        async query(sql, parametros = []) {
            assert.equal(activa, true);
            const q = sql.replace(/\s+/g, ' ').trim();
            consultas.push({ sql: q, parametros: clonar(parametros) });
            if (q === 'SELECT id, colaborador_id, estado FROM acta WHERE id = ? FOR UPDATE') {
                fallar('acta');
                return [[transaccion.acta].filter((a) => a?.id === parametros[0])];
            }
            if (q === 'SELECT id, estado_actual FROM equipo WHERE id = ? FOR UPDATE') {
                fallar('equipo');
                return [[transaccion.equipo].filter((e) => e?.id === parametros[0])];
            }
            if (q === 'SELECT id, estado FROM colaborador WHERE id = ? FOR SHARE') {
                fallar('colaborador');
                return [[transaccion.colaborador].filter((c) => c?.id === parametros[0])];
            }
            if (q.startsWith('SELECT id FROM asignacion WHERE equipo_id')) {
                fallar('conflictos');
                assert.equal(q, "SELECT id FROM asignacion WHERE equipo_id = ? AND (estado = 'ACTIVA' OR acta_id = ?) LIMIT 1");
                assert.ok(consultas.slice(0, -1).every((c) => /FOR (UPDATE|SHARE)$/.test(c.sql)), 'Primera lectura consistente después de bloquear');
                return [transaccion.asignaciones.filter((a) => a.equipo_id === parametros[0] &&
                    (a.estado === 'ACTIVA' || (parametros[1] !== null && a.acta_id === parametros[1]))).slice(0, 1)];
            }
            if (q.includes('FROM detalle_acta')) {
                fallar('detalle');
                assert.match(q, /WHERE acta_id = \? AND equipo_id = \? FOR UPDATE$/);
                return [transaccion.detalles.filter((d) => d.acta_id === parametros[0] && d.equipo_id === parametros[1])];
            }
            if (q.startsWith('INSERT INTO asignacion')) {
                fallar('insertar');
                const [colaborador_id, equipo_id, linea_id, acta_id, modalidad, fecha_asignacion, ubicacion,
                    descripcion_equipo_anterior, observaciones] = parametros;
                const id = 77;
                transaccion.asignaciones.push({
                    id, colaborador_id, equipo_id, linea_id, acta_id, modalidad,
                    fecha_asignacion, ubicacion, descripcion_equipo_anterior, observaciones, estado: 'ACTIVA'
                });
                // Simula los efectos de los triggers actuales de alta.
                transaccion.equipo.estado_actual = 'ASIGNADO';
                transaccion.movimientos.push({ id: 1, asignacion_id: id, tipo_movimiento: 'ASIGNACION' });
                return [{ insertId: id }];
            }
            throw new Error(`SQL inesperado: ${q}`);
        },
        async commit() { eventos.push('commit'); fallar('commit'); datos = clonar(transaccion); activa = false; },
        async rollback() { eventos.push('rollback'); if (opciones.rollbackFalla) throw new Error('Sin conexión'); activa = false; },
        release() { eventos.push('release'); },
        destroy() { eventos.push('destroy'); activa = false; }
    };
    const pool = {
        async getConnection() { eventos.push('acquire'); fallar('acquire'); return conexion; },
        async query(sql, parametros) {
            assert.match(sql, /SELECT a.id, a.nro_acta/);
            assert.match(sql, /a.colaborador_id = \? AND da.equipo_id = \?/);
            assert.match(sql, /a.estado IN \('PENDIENTE', 'ACTIVA'\) AND c.estado = 'ACTIVO'/);
            assert.match(sql, /da.estado = 'ENTREGADO' AND da.devolvio_equipo = 'NO'/);
            assert.match(sql, /da.fecha_devolucion IS NULL AND e.estado_actual = 'LIBRE'/);
            assert.match(sql, /usada.acta_id = a.id AND usada.equipo_id = da.equipo_id/);
            assert.match(sql, /vigente.equipo_id = da.equipo_id AND vigente.estado = 'ACTIVA'/);
            consultas.push({ sql, parametros: clonar(parametros) });
            fallar('catalogo');
            return [[{
                id: 10, nro_acta: 'ACT-010', colaborador_id: 8, equipo_id: 20,
                estado: 'ACTIVA', detalle_id: 100, fecha_entrega: '2026-09-01'
            }]];
        }
    };
    const modulo = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(directorio, 'asignacionController.js'), 'utf8'), {
        module: modulo, Buffer, console: { error() { } }, require(nombre) {
            assert.equal(nombre, '../config/database'); return pool;
        }
    });
    function respuesta() { return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = clonar(body); return this; } }; }
    return {
        consultas, eventos, datos: () => clonar(datos),
        async registrar(body = {}) {
            const res = respuesta();
            await modulo.exports.registrarAsignacion({
                body: {
                    colaborador_id: 8, equipo_id: 20,
                    fecha_asignacion: '2026-09-03', acta_id: 10, ...body
                }
            }, res);
            return res;
        },
        async catalogo(query = { colaborador_id: '8', equipo_id: '20' }) {
            const res = respuesta(); await modulo.exports.listarActasDisponibles({ query }, res); return res;
        }
    };
}

test('Registro vinculado: conserva acta/detalle y registra una asignación con sus notas', async () => {
    const app = entorno(); const antes = app.datos();
    const res = await app.registrar({ observaciones: ' Entrega con cable ', descripcion_equipo_anterior: ' Equipo antiguo ', detalle_id: 999 });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'commit', 'release']);
    const despues = app.datos();
    assert.equal(despues.asignaciones[0].acta_id, 10);
    assert.equal(despues.asignaciones[0].observaciones, 'Entrega con cable');
    assert.equal(despues.asignaciones[0].descripcion_equipo_anterior, 'Equipo antiguo');
    assert.equal(despues.equipo.estado_actual, 'ASIGNADO');
    assert.equal(despues.movimientos.length, 1);
    assert.deepEqual(despues.acta, antes.acta);
    assert.deepEqual(despues.detalles, antes.detalles);
});

for (const acta_id of [undefined, null, '']) {
    test(`Registro sin acta (${String(acta_id)}): NULL sin leer ni modificar actas`, async () => {
        const app = entorno(); assert.equal((await app.registrar({ acta_id })).statusCode, 201);
        assert.equal(app.datos().asignaciones[0].acta_id, null);
        assert.equal(app.consultas.some((q) => /FROM (acta|detalle_acta)\b/.test(q.sql)), false);
    });
}

for (const [nombre, mutar] of [
    ['acta ausente', (d) => { d.acta = null; }],
    ['acta ajena', (d) => { d.acta.colaborador_id = 9; }],
    ...['CERRADA', 'ANULADA'].map((estado) => [estado, (d) => { d.acta.estado = estado; }]),
    ['sin detalle', (d) => { d.detalles = []; }],
    ['otro equipo', (d) => { d.detalles[0].equipo_id = 21; }],
    ['detalle duplicado', (d) => { d.detalles.push({ ...d.detalles[0], id: 101 }); }],
    ...['DEVUELTO', 'PERDIDO', 'ROBADO'].map((estado) => [estado, (d) => { d.detalles[0].estado = estado; }]),
    ['indicador contradictorio', (d) => { d.detalles[0].devolvio_equipo = 'SI'; }],
    ['fecha de devolución existente', (d) => { d.detalles[0].fecha_devolucion = '2026-09-02'; }],
    ['colaborador ausente', (d) => { d.colaborador = null; }],
    ['colaborador cesado', (d) => { d.colaborador.estado = 'CESADO'; }],
    ['equipo ausente', (d) => { d.equipo = null; }],
    ...['ASIGNADO', 'EN_CUSTODIA', 'PERDIDO', 'ROBADO', 'BAJA'].map((estado) => [`equipo ${estado}`, (d) => { d.equipo.estado_actual = estado; }]),
    ...['ACTIVA', 'FINALIZADA', 'CANCELADA'].map((estado) => [`vínculo previo ${estado}`, (d) => {
        d.asignaciones.push({ id: 1, equipo_id: 20, acta_id: 10, estado });
    }]),
    ['otra asignación activa sin acta', (d) => { d.asignaciones.push({ id: 1, equipo_id: 20, acta_id: null, estado: 'ACTIVA' }); }]
]) {
    test(`Rechaza ${nombre} sin guardar cambios parciales`, async () => {
        const app = entorno({ mutar }); const antes = app.datos();
        assert.equal((await app.registrar()).statusCode, 409);
        assert.deepEqual(app.datos(), antes);
        assert.equal(app.consultas.some((c) => c.sql.startsWith('INSERT')), false);
        assert.deepEqual(app.eventos.slice(-2), ['rollback', 'release']);
    });
}

for (const [campo, valor] of [['acta_id', 0], ['acta_id', true], ['acta_id', '10 OR 1=1'],
['colaborador_id', {}], ['equipo_id', 1.5], ['linea_id', -1], ['fecha_asignacion', '2026-02-30'],
['ubicacion', 'x'.repeat(101)], ['modalidad', []]]) {
    test(`Valida ${campo} (${String(valor).slice(0, 20)}) antes de conectar`, async () => {
        const app = entorno(); assert.equal((await app.registrar({ [campo]: valor })).statusCode, 400);
        assert.deepEqual(app.eventos, []);
    });
}

test('Acta pendiente y asignación histórica de otra acta no impiden una relación nueva', async () => {
    const app = entorno({
        mutar(d) {
            d.acta.estado = 'PENDIENTE';
            d.asignaciones.push({ id: 1, equipo_id: 20, acta_id: 11, estado: 'FINALIZADA' });
        }
    });
    assert.equal((await app.registrar()).statusCode, 201);
});
test('Fecha inválida heredada en detalle no se acepta', async () => {
    const app = entorno({ mutar(d) { d.detalles[0].fecha_entrega = '0000-00-00'; } });
    assert.equal((await app.registrar()).statusCode, 400);
});
test('Segundo registro del mismo equipo se rechaza sin duplicar movimiento', async () => {
    const app = entorno(); assert.equal((await app.registrar()).statusCode, 201);
    assert.equal((await app.registrar()).statusCode, 409);
    assert.equal(app.datos().asignaciones.length, 1);
    assert.equal(app.datos().movimientos.length, 1);
});

for (const paso of ['acquire', 'begin', 'acta', 'equipo', 'colaborador', 'conflictos', 'detalle', 'insertar', 'commit']) {
    test(`Fallo en ${paso}: respuesta controlada y sin cambios en el simulador`, async () => {
        const app = entorno({ falla: paso }); const antes = app.datos();
        const res = await app.registrar(); assert.equal(res.statusCode, 500);
        assert.deepEqual(app.datos(), antes);
        assert.equal(res.body.error, undefined);
        if (paso !== 'acquire') assert.equal(app.eventos.at(-1), 'release');
    });
}
for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    test(`${code}: conflicto recuperable y rollback`, async () => {
        const app = entorno({ falla: 'insertar', error: { code } });
        assert.equal((await app.registrar()).statusCode, 409);
        assert.deepEqual(app.eventos.slice(-2), ['rollback', 'release']);
    });
}
test('Fallo al revertir descarta la conexión en vez de reutilizarla', async () => {
    const app = entorno({ falla: 'insertar', rollbackFalla: true });
    assert.equal((await app.registrar()).statusCode, 500);
    assert.equal(app.eventos.at(-1), 'destroy');
    assert.equal(app.eventos.includes('release'), false);
});
test('Catálogo: una consulta parametrizada con todas las restricciones', async () => {
    const app = entorno(); const res = await app.catalogo();
    assert.equal(res.statusCode, 200); assert.equal(res.body.data[0].id, 10);
    assert.equal(app.consultas.length, 1); assert.deepEqual(app.consultas[0].parametros, [8, 20]);
    assert.deepEqual(app.eventos, []);
});
test('Catálogo: rechaza parámetros ausentes o inválidos y controla fallos', async () => {
    const app = entorno();
    for (const query of [{}, { colaborador_id: '8', equipo_id: '20 OR 1=1' }, { colaborador_id: ['8'], equipo_id: '20' }]) {
        assert.equal((await app.catalogo(query)).statusCode, 400);
    }
    assert.equal(app.consultas.length, 0);
    assert.equal((await entorno({ falla: 'catalogo' }).catalogo()).statusCode, 500);
});
test('Ruta del catálogo precede /:id y mantiene POST y devolución', () => {
    const rutas = [];
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/asignacionRoutes.js'), 'utf8');
    vm.runInNewContext(source, {
        module: { exports: {} }, require(nombre) {
            if (nombre === 'express') return {
                Router: () => Object.fromEntries(['get', 'post', 'put'].map((metodo) =>
                    [metodo, (ruta) => rutas.push([metodo, ruta])]))
            };
            if (nombre === '../controllers/correoActaController') return { enviarActaPorCorreo() {} };
            if (nombre === '../controllers/asignacionController') return {};
            throw new Error(`Módulo inesperado: ${nombre}`);
        }
    });
    assert.ok(rutas.findIndex(([m, p]) => m === 'get' && p === '/actas-disponibles') < rutas.findIndex(([m, p]) => m === 'get' && p === '/:id'));
    assert.ok(rutas.some(([m, p]) => m === 'post' && p === '/'));
    assert.ok(rutas.some(([m, p]) => m === 'put' && p === '/:id/devolver'));
});
