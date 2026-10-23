const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Contratos del controlador real con MySQL simulado. No conecta a una BD.
// La simulación reproduce SOLO los triggers de la devolución normal.
const clonar = (valor) => JSON.parse(JSON.stringify(valor));
const directorio = process.env.INVENTARIO_CONTROLLERS_DIR || path.join(__dirname, '../src/controllers');

function cargar(nombre, pool) {
    const modulo = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(directorio, nombre), 'utf8'), {
        module: modulo, Buffer,
        require(nombreModulo) {
            assert.equal(nombreModulo, '../config/database');
            return pool;
        },
        console: { error() { } }
    }, { filename: nombre });
    return modulo.exports;
}

function respuesta() {
    return {
        statusCode: 200,
        status(codigo) { this.statusCode = codigo; return this; },
        json(cuerpo) { this.body = clonar(cuerpo); return this; }
    };
}

function entorno(opciones = {}) {
    let datos = {
        asignacion: {
            id: 7, equipo_id: 20, estado: 'ACTIVA', fecha_asignacion: '2026-08-19',
            fecha_devolucion: null, descripcion_equipo_anterior: 'Equipo anterior A',
            observaciones: 'Entrega con cargador'
        },
        equipo: 'ASIGNADO',
        movimientos: [
            { id: 10, asignacion_id: 7, tipo_movimiento: 'ASIGNACION', descripcion: 'Entrega original', autorizado_por: null },
            { id: 11, asignacion_id: 7, tipo_movimiento: 'DEVOLUCION', descripcion: 'Histórico previo', autorizado_por: 8 },
            { id: 12, asignacion_id: 8, tipo_movimiento: 'DEVOLUCION', descripcion: 'Otra asignación', autorizado_por: 8 }
        ]
    };
    if (opciones.estado) datos.asignacion.estado = opciones.estado;
    if (opciones.sinAsignacion) datos.asignacion = null;
    const consultas = [];
    const eventos = [];
    let transaccion;
    let activo = false;
    let registrando = false;
    const fallar = (paso) => {
        if (opciones.falla === paso) {
            throw Object.assign(new Error(`Fallo simulado: ${paso}`), opciones.error || {});
        }
    };
    const conexion = {
        async beginTransaction() {
            eventos.push('begin');
            fallar('begin');
            transaccion = clonar(datos);
            activo = true;
        },
        async query(sql, valores = []) {
            assert.equal(activo, true, 'Toda consulta de devolución usa la transacción');
            const compacto = sql.replace(/\s+/g, ' ').trim();
            const parametros = clonar(valores);
            consultas.push({ sql: compacto, parametros, conexion: true });
            if (registrando) {
                if (compacto.startsWith('SELECT id, estado_actual FROM equipo')) return [[{ id: 20, estado_actual: 'LIBRE' }]];
                if (compacto.startsWith('SELECT id, estado FROM colaborador')) return [[{ id: 8, estado: 'ACTIVO' }]];
                if (compacto.startsWith('SELECT id FROM asignacion WHERE equipo_id')) return [[]];
                if (compacto.startsWith('INSERT INTO asignacion')) return [{ insertId: 77 }];
                throw new Error(`SQL de registro inesperado: ${compacto}`);
            }
            if (compacto.startsWith('SELECT id, equipo_id, estado,')) {
                fallar('leer');
                assert.match(compacto, /FROM asignacion WHERE id = \? FOR UPDATE$/);
                return [[transaccion.asignacion].filter((fila) => fila && fila.id === parametros[0])];
            }
            if (compacto === 'SELECT id FROM colaborador WHERE id = ?') {
                return [parametros[0] === 8 ? [{ id: 8 }] : []];
            }
            if (compacto.startsWith('SELECT COALESCE(MAX(id), 0) AS ultimo_id')) {
                assert.match(compacto, /asignacion_id = \? AND tipo_movimiento = 'DEVOLUCION'$/);
                return [[{
                    ultimo_id: Math.max(0, ...transaccion.movimientos.filter((m) =>
                        m.asignacion_id === parametros[0] && m.tipo_movimiento === 'DEVOLUCION'
                    ).map((m) => m.id))
                }]];
            }
            if (compacto.startsWith('UPDATE asignacion')) {
                fallar('actualizarAsignacion');
                assert.equal(compacto, "UPDATE asignacion SET estado = 'FINALIZADA', fecha_devolucion = ? WHERE id = ? AND estado = 'ACTIVA'");
                assert.equal(parametros[1], transaccion.asignacion.id);
                if (opciones.sinCambioAsignacion) return [{ affectedRows: 0 }];
                transaccion.asignacion.estado = 'FINALIZADA';
                transaccion.asignacion.fecha_devolucion = parametros[0];
                transaccion.equipo = 'LIBRE';
                // Efectos de trg_equipo_devuelto + trg_movimiento_devolucion.
                const cantidad = opciones.triggers === 'ausente' ? 0 : opciones.triggers === 'duplicado' ? 2 : 1;
                for (let i = 0; i < cantidad; i++) {
                    transaccion.movimientos.push({
                        id: Math.max(...transaccion.movimientos.map((m) => m.id)) + 1,
                        asignacion_id: 7, tipo_movimiento: 'DEVOLUCION', autorizado_por: null,
                        descripcion: opciones.descripcionTrigger ?? 'Devolucion registrada automaticamente. ID de asignacion: 7'
                    });
                }
                return [{ affectedRows: 1 }];
            }
            if (compacto.startsWith('SELECT id, descripcion FROM movimiento_equipo')) {
                fallar('leerMovimiento');
                assert.match(compacto, /asignacion_id = \? AND tipo_movimiento = 'DEVOLUCION' AND id > \? ORDER BY id FOR UPDATE$/);
                return [transaccion.movimientos.filter((m) =>
                    m.asignacion_id === parametros[0] && m.tipo_movimiento === 'DEVOLUCION' && m.id > parametros[1]
                )];
            }
            if (compacto.startsWith('UPDATE movimiento_equipo')) {
                fallar('actualizarMovimiento');
                assert.equal(compacto, "UPDATE movimiento_equipo SET descripcion = ?, autorizado_por = ? WHERE id = ? AND asignacion_id = ? AND tipo_movimiento = 'DEVOLUCION'");
                if (opciones.sinCambioMovimiento) return [{ affectedRows: 0 }];
                const movimiento = transaccion.movimientos.find((m) => m.id === parametros[2]);
                assert.equal(movimiento.asignacion_id, parametros[3]);
                assert.ok(movimiento.id > 12, 'No debe editar un movimiento histórico');
                [movimiento.descripcion, movimiento.autorizado_por] = parametros;
                return [{ affectedRows: 1 }];
            }
            throw new Error(`SQL inesperado: ${compacto}`);
        },
        async commit() {
            eventos.push('commit');
            fallar('commit');
            datos = clonar(transaccion);
            activo = false;
        },
        async rollback() {
            eventos.push('rollback');
            if (opciones.rollbackFalla) throw new Error('Conexión perdida');
            activo = false;
            transaccion = null;
        },
        release() { eventos.push('release'); },
        destroy() { eventos.push('destroy'); activo = false; }
    };
    const pool = {
        async getConnection() { eventos.push('acquire'); fallar('acquire'); return conexion; },
        async query(sql, valores = []) {
            fallar('poolQuery');
            consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros: clonar(valores), conexion: false });
            if (/INSERT INTO asignacion/.test(sql)) return [{ insertId: 77 }];
            return [[{ id: 7, observaciones: 'Entrega', descripcion_devolucion: 'Recepción' }]];
        }
    };
    const controladores = cargar('asignacionController.js', pool);
    return {
        eventos, consultas, controladores, pool,
        datos: () => clonar(datos),
        async devolver(body = {}, id = '7') {
            const res = respuesta();
            await controladores.devolverAsignacion({
                params: { id }, body: {
                    fecha_devolucion: '2026-09-03', ...body
                }
            }, res);
            return res;
        },
        async registrar(body = {}) {
            registrando = true;
            const res = respuesta();
            await controladores.registrarAsignacion({
                body: {
                    colaborador_id: 8, equipo_id: 20, fecha_asignacion: '2026-09-03', ...body
                }
            }, res);
            return res;
        }
    };
}

test('Registro: equipo anterior y notas se insertan en columnas separadas', async () => {
    const app = entorno();
    const res = await app.registrar({ descripcion_equipo_anterior: '  Equipo viejo  ', observaciones: '  Con cargador\nSin daños  ' });
    assert.equal(res.statusCode, 201);
    const consulta = app.consultas.find((c) => c.sql.startsWith('INSERT INTO asignacion'));
    assert.match(consulta.sql, /estado, descripcion_equipo_anterior, observaciones\s*\)/);
    assert.match(consulta.sql, /'ACTIVA', \?, \?/);
    assert.deepEqual(consulta.parametros.slice(-2), ['Equipo viejo', 'Con cargador\nSin daños']);
    assert.equal(consulta.parametros.length, 9);
});

test('Registro: sin textos opcionales almacena NULL en ambos campos', async () => {
    const app = entorno();
    assert.equal((await app.registrar()).statusCode, 201);
    assert.deepEqual(app.consultas.find((c) => c.sql.startsWith('INSERT INTO asignacion')).parametros.slice(-2), [null, null]);
});

for (const [nombre, body] of [
    ['equipo anterior demasiado largo', { descripcion_equipo_anterior: 'a'.repeat(201) }],
    ['equipo anterior no textual', { descripcion_equipo_anterior: {} }],
    ['notas demasiado largas', { observaciones: 'é'.repeat(30001) }],
    ['notas no textuales', { observaciones: [] }],
    ['fecha imposible', { fecha_asignacion: '2026-02-30' }]
]) {
    test(`Registro: rechaza ${nombre} sin escribir`, async () => {
        const app = entorno();
        assert.equal((await app.registrar(body)).statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('Registro: admite los límites de 200 caracteres y 60000 bytes', async () => {
    const app = entorno();
    assert.equal((await app.registrar({ descripcion_equipo_anterior: 'ñ'.repeat(200), observaciones: 'é'.repeat(30000) })).statusCode, 201);
});

test('Devolución: preserva entrega, completa solo el evento nuevo y confirma todo junto', async () => {
    const app = entorno();
    const antes = app.datos();
    const res = await app.devolver({ observaciones: '  Recibido con cable\nPantalla rayada  ', autorizado_por: '8' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.movimiento_id, 13);
    const despues = app.datos();
    assert.equal(despues.asignacion.observaciones, antes.asignacion.observaciones);
    assert.equal(despues.asignacion.descripcion_equipo_anterior, antes.asignacion.descripcion_equipo_anterior);
    assert.equal(despues.asignacion.estado, 'FINALIZADA');
    assert.equal(despues.asignacion.fecha_devolucion, '2026-09-03');
    assert.equal(despues.equipo, 'LIBRE');
    assert.deepEqual(despues.movimientos.slice(0, 3), antes.movimientos);
    assert.equal(despues.movimientos[3].autorizado_por, 8);
    assert.equal(despues.movimientos[3].descripcion, 'Devolucion registrada automaticamente. ID de asignacion: 7\nObservaciones de devolución: Recibido con cable\nPantalla rayada');
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'commit', 'release']);
    assert.ok(app.consultas.every((c) => c.conexion));
    assert.equal(app.consultas.filter((c) => c.sql.startsWith('INSERT')).length, 0);
});

for (const observaciones of [undefined, null, '', '   ']) {
    test(`Devolución: notas ${JSON.stringify(observaciones)} no borran la entrega`, async () => {
        const app = entorno();
        assert.equal((await app.devolver({ observaciones })).statusCode, 200);
        assert.equal(app.datos().asignacion.observaciones, 'Entrega con cargador');
        assert.equal(app.datos().movimientos[3].autorizado_por, null);
        assert.equal(app.consultas.filter((c) => c.sql.startsWith('UPDATE movimiento')).length, 0);
    });
}

test('Devolución: autorizador sin notas conserva la descripción automática', async () => {
    const app = entorno();
    assert.equal((await app.devolver({ autorizado_por: 8 })).statusCode, 200);
    assert.equal(app.datos().movimientos[3].autorizado_por, 8);
    assert.doesNotMatch(app.datos().movimientos[3].descripcion, /Observaciones/);
});

test('Devolución: texto con comillas/SQL/HTML viaja como parámetro', async () => {
    const app = entorno();
    const texto = "'); DROP TABLE asignacion; -- <script>alert(1)</script>";
    assert.equal((await app.devolver({ observaciones: texto })).statusCode, 200);
    assert.ok(app.consultas.every((c) => !c.sql.includes(texto)));
    assert.ok(app.datos().movimientos[3].descripcion.endsWith(texto));
});

for (const id of ['0', '-1', '1.5', 'abc', '7 OR 1=1', '2147483648', true]) {
    test(`Devolución: ID inválido ${id} no abre conexión`, async () => {
        const app = entorno();
        assert.equal((await app.devolver({}, id)).statusCode, 400);
        assert.deepEqual(app.eventos, []);
    });
}

for (const body of [
    { autorizado_por: 'Administrador' }, { autorizado_por: true }, { autorizado_por: 0 },
    { autorizado_por: 1.5 }, { observaciones: {} }, { observaciones: '😀'.repeat(15001) },
    { fecha_devolucion: '2026-02-30' }, { fecha_devolucion: '03/09/2026' },
    { fecha_devolucion: '2026-09-03T12:00:00Z' }, { fecha_devolucion: false },
    { fecha_devolucion: '0000-01-01' }, { fecha_devolucion: '2026-13-01' }
]) {
    const nombre = Object.keys(body)[0];
    const valor = String(body[nombre]).slice(0, 28);
    test(`Devolución: rechaza ${nombre} inválido (${valor}) antes de abrir conexión`, async () => {
        const app = entorno();
        assert.equal((await app.devolver(body)).statusCode, 400);
        assert.deepEqual(app.eventos, []);
    });
}

test('Devolución: admite fecha igual a la entrega', async () => {
    assert.equal((await entorno().devolver({ fecha_devolucion: '2026-08-19' })).statusCode, 200);
});

test('Devolución: fecha omitida mantiene el valor por defecto UTC del API', async () => {
    const app = entorno();
    assert.equal((await app.devolver({ fecha_devolucion: undefined })).statusCode, 200);
    assert.equal(app.datos().asignacion.fecha_devolucion, new Date().toISOString().slice(0, 10));
});

for (const [nombre, opciones, body, status] of [
    ['fecha anterior', {}, { fecha_devolucion: '2026-08-18' }, 400],
    ['autorizador inexistente', {}, { autorizado_por: 999 }, 400],
    ['asignación inexistente', { sinAsignacion: true }, {}, 404],
    ['asignación finalizada', { estado: 'FINALIZADA' }, {}, 404],
    ['asignación cancelada', { estado: 'CANCELADA' }, {}, 404],
    ['trigger ausente', { triggers: 'ausente' }, { observaciones: 'Nota' }, 500],
    ['triggers duplicados', { triggers: 'duplicado' }, { observaciones: 'Nota' }, 500],
    ['actualización de asignación sin filas', { sinCambioAsignacion: true }, {}, 500],
    ['actualización de evento sin filas', { sinCambioMovimiento: true }, { observaciones: 'Nota' }, 500],
    ['descripción final demasiado larga', { descripcionTrigger: 'a'.repeat(6000) }, { observaciones: 'b'.repeat(60000) }, 400]
]) {
    test(`Devolución: ${nombre} revierte y libera la conexión`, async () => {
        const app = entorno(opciones);
        const antes = app.datos();
        assert.equal((await app.devolver(body)).statusCode, status);
        assert.deepEqual(app.datos(), antes);
        assert.deepEqual(app.eventos, ['acquire', 'begin', 'rollback', 'release']);
    });
}

for (const falla of ['leer', 'actualizarAsignacion', 'leerMovimiento', 'actualizarMovimiento', 'commit']) {
    test(`Devolución: fallo en ${falla} no persiste cambios parciales en el simulador`, async () => {
        const app = entorno({ falla });
        const antes = app.datos();
        assert.equal((await app.devolver({ observaciones: 'Nota' })).statusCode, 500);
        assert.deepEqual(app.datos(), antes);
        assert.ok(app.eventos.includes('rollback'));
        assert.equal(app.eventos.at(-1), 'release');
    });
}

test('Devolución: fallo de FK revierte y devuelve 400 sin exponer SQL', async () => {
    const app = entorno({ falla: 'actualizarMovimiento', error: { code: 'ER_NO_REFERENCED_ROW_2' } });
    const res = await app.devolver({ autorizado_por: 8 });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, undefined);
    assert.equal(app.datos().asignacion.estado, 'ACTIVA');
});

test('Devolución: fallo al adquirir conexión produce respuesta controlada', async () => {
    const app = entorno({ falla: 'acquire' });
    assert.equal((await app.devolver()).statusCode, 500);
    assert.deepEqual(app.eventos, ['acquire']);
});

test('Devolución: fallo al iniciar transacción libera conexión', async () => {
    const app = entorno({ falla: 'begin' });
    assert.equal((await app.devolver()).statusCode, 500);
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'release']);
});

test('Devolución: si falla rollback descarta la conexión, no la devuelve al pool', async () => {
    const app = entorno({ falla: 'actualizarMovimiento', rollbackFalla: true });
    assert.equal((await app.devolver({ observaciones: 'Nota' })).statusCode, 500);
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'rollback', 'destroy']);
});

test('Devolución: segunda solicitud no crea otro movimiento ni cambia las notas', async () => {
    const app = entorno();
    assert.equal((await app.devolver({ observaciones: 'Primera' })).statusCode, 200);
    const antes = app.datos();
    assert.equal((await app.devolver({ observaciones: 'Segunda' })).statusCode, 404);
    assert.deepEqual(app.datos(), antes);
});

test('Lectura: listado no referencia alias que solo pertenecen al detalle', async () => {
    const app = entorno();
    await app.controladores.listarAsignaciones({}, respuesta());
    assert.doesNotMatch(app.consultas[0].sql, /\b(?:md|aut)\./);
});

test('Lectura: detalle incluye entrega y último movimiento de devolución con autorizador', async () => {
    const app = entorno();
    const res = respuesta();
    await app.controladores.obtenerAsignacionPorId({ params: { id: '7' } }, res);
    const sql = app.consultas[0].sql;
    assert.equal(res.statusCode, 200);
    assert.match(sql, /a\.\*/);
    assert.match(sql, /md\.descripcion AS descripcion_devolucion/);
    assert.match(sql, /SELECT MAX\(m.id\).*m.asignacion_id = a.id.*m.tipo_movimiento = 'DEVOLUCION'/);
    assert.match(sql, /LEFT JOIN colaborador aut ON aut.id = md.autorizado_por/);
    assert.match(sql, /AS devolucion_autorizado_por_nombre/);
});

test('Lectura: detalle de movimiento conserva ID y agrega nombre del autorizador', async () => {
    const app = entorno();
    const controller = cargar('movimientoController.js', app.pool);
    await controller.obtenerMovimientoPorId({ params: { id: '13' } }, respuesta());
    const sql = app.consultas[0].sql;
    assert.match(sql, /me\.autorizado_por AS autorizado_por_id/);
    assert.match(sql, /AS autorizado_por_nombre/);
    assert.match(sql, /LEFT JOIN colaborador aut ON aut.id = me.autorizado_por/);
    assert.match(sql, /me\.asignacion_id/);
});
