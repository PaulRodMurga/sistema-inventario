const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Ejecuta los controladores reales sobre un simulador de transacciones y de los
// triggers normales de devolución. No abre conexiones ni ejecuta MySQL real.
const clonar = (valor) => JSON.parse(JSON.stringify(valor));
const directorio = process.env.INVENTARIO_CONTROLLERS_DIR || path.join(__dirname, '../src/controllers');

function cargar(archivo, pool) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(directorio, archivo), 'utf8'), {
        module, Buffer, console: { error() { } },
        require: (nombre) => { assert.equal(nombre, '../config/database'); return pool; }
    }, { filename: archivo });
    return module.exports;
}

function respuesta() {
    return {
        statusCode: 200,
        status(codigo) { this.statusCode = codigo; return this; },
        json(body) { this.body = clonar(body); return this; }
    };
}

function entorno(opciones = {}) {
    const asignacion = {
        id: 7, equipo_id: 20, colaborador_id: 3, acta_id: 10,
        estado: 'ACTIVA', fecha_asignacion: '2026-08-19', fecha_devolucion: null,
        observaciones: 'Entrega con cargador', descripcion_equipo_anterior: 'Equipo anterior'
    };
    const detalle = {
        id: 100, acta_id: 10, equipo_id: 20, estado: 'ENTREGADO', devolvio_equipo: 'NO',
        fecha_entrega: '2026-08-19', fecha_devolucion: null, observaciones: 'Nota original del detalle'
    };
    let datos = {
        asignaciones: [asignacion, { ...asignacion, id: 8, equipo_id: 21 },
            { ...asignacion, id: 9, acta_id: 11, estado: 'FINALIZADA', fecha_devolucion: '2026-08-10' }],
        actas: [{ id: 10, colaborador_id: 3, estado: 'ACTIVA', nro_acta: 'ACTA-10', firmo_amo: 'SI', firmo_dmo: 'NO', observaciones: 'Documento original' },
        { id: 11, colaborador_id: 3, estado: 'CERRADA', nro_acta: 'ACTA-11' }],
        detalles: [detalle, { ...detalle, id: 101, equipo_id: 21 },
            { ...detalle, id: 102, acta_id: 11, estado: 'DEVUELTO', devolvio_equipo: 'SI', fecha_devolucion: '2026-08-10' }],
        equipos: { 20: 'ASIGNADO', 21: 'ASIGNADO' },
        movimientos: [{ id: 5, asignacion_id: 9, tipo_movimiento: 'DEVOLUCION', descripcion: 'Movimiento histórico', autorizado_por: null }]
    };
    if (opciones.preparar) opciones.preparar(datos);
    const consultas = [];
    const eventos = [];
    let tx;
    function fallar(paso) {
        if (opciones.falla === paso) throw Object.assign(new Error(`Fallo simulado: ${paso}`), opciones.error || {});
    }
    const conexion = {
        async beginTransaction() { eventos.push('begin'); tx = clonar(datos); },
        async query(sql, valores = []) {
            assert.ok(tx, 'Toda escritura usa la transacción abierta');
            const q = sql.replace(/\s+/g, ' ').trim();
            const p = clonar(valores);
            consultas.push({ sql: q, parametros: p });
            if (q.startsWith('SELECT id, equipo_id, estado,')) {
                assert.match(q, /colaborador_id, acta_id,/);
                assert.match(q, /WHERE id = \? FOR UPDATE$/);
                return [tx.asignaciones.filter((a) => a.id === p[0])];
            }
            if (q.startsWith('SELECT id, colaborador_id, estado FROM acta')) {
                fallar('leerActa');
                assert.equal(q, 'SELECT id, colaborador_id, estado FROM acta WHERE id = ? FOR UPDATE');
                return [tx.actas.filter((a) => a.id === p[0])];
            }
            if (q.startsWith('SELECT id FROM asignacion WHERE acta_id')) {
                fallar('leerOtras');
                assert.equal(q, 'SELECT id FROM asignacion WHERE acta_id = ? AND equipo_id = ? AND id <> ? LIMIT 1');
                assert.match(consultas[consultas.length - 2].sql, /FROM acta WHERE id = \? FOR UPDATE$/);
                return [tx.asignaciones.filter((a) => a.acta_id === p[0] && a.equipo_id === p[1] && a.id !== p[2]).slice(0, 1)];
            }
            if (q.startsWith('SELECT id, estado, devolvio_equipo,')) {
                fallar('leerDetalle');
                assert.match(q, /FROM detalle_acta WHERE acta_id = \? AND equipo_id = \? FOR UPDATE$/);
                return [tx.detalles.filter((d) => d.acta_id === p[0] && d.equipo_id === p[1])];
            }
            if (q === 'SELECT id FROM colaborador WHERE id = ?') return [p[0] === 3 ? [{ id: 3 }] : []];
            if (q.startsWith('SELECT COALESCE(MAX(id), 0)')) {
                return [[{ ultimo_id: Math.max(0, ...tx.movimientos.filter((m) => m.asignacion_id === p[0] && m.tipo_movimiento === 'DEVOLUCION').map((m) => m.id)) }]];
            }
            if (q.startsWith('UPDATE asignacion')) {
                assert.equal(q, "UPDATE asignacion SET estado = 'FINALIZADA', fecha_devolucion = ? WHERE id = ? AND estado = 'ACTIVA'");
                const a = tx.asignaciones.find((a) => a.id === p[1]);
                a.estado = 'FINALIZADA';
                a.fecha_devolucion = p[0];
                tx.equipos[a.equipo_id] = 'LIBRE';
                if (!opciones.sinMovimiento) tx.movimientos.push({
                    id: Math.max(0, ...tx.movimientos.map((m) => m.id)) + 1,
                    asignacion_id: a.id, tipo_movimiento: 'DEVOLUCION', descripcion: `Devolución automática ${a.id}`, autorizado_por: null
                });
                fallar('actualizarAsignacion');
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('SELECT id, descripcion FROM movimiento_equipo')) {
                return [tx.movimientos.filter((m) => m.asignacion_id === p[0] && m.id > p[1] && m.tipo_movimiento === 'DEVOLUCION')];
            }
            if (q.startsWith('UPDATE movimiento_equipo')) {
                const m = tx.movimientos.find((m) => m.id === p[2] && m.asignacion_id === p[3]);
                m.descripcion = p[0];
                m.autorizado_por = p[1];
                fallar('actualizarMovimiento');
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('UPDATE detalle_acta')) {
                assert.equal(q, "UPDATE detalle_acta SET estado = 'DEVUELTO', devolvio_equipo = 'SI', fecha_devolucion = ? WHERE id = ? AND acta_id = ? AND equipo_id = ? AND estado = 'ENTREGADO' AND devolvio_equipo = 'NO' AND fecha_devolucion IS NULL");
                if (opciones.sinCambioDetalle) return [{ affectedRows: 0 }];
                const d = tx.detalles.find((d) => d.id === p[1] && d.acta_id === p[2] && d.equipo_id === p[3]);
                assert.equal(d.estado, 'ENTREGADO');
                assert.equal(d.devolvio_equipo, 'NO');
                assert.equal(d.fecha_devolucion, null);
                d.estado = 'DEVUELTO';
                d.devolvio_equipo = 'SI';
                d.fecha_devolucion = p[0];
                fallar('actualizarDetalle');
                return [{ affectedRows: 1 }];
            }
            throw new Error(`SQL no esperado: ${q}`);
        },
        async commit() { eventos.push('commit'); fallar('commit'); datos = clonar(tx); tx = null; },
        async rollback() { eventos.push('rollback'); tx = null; },
        release() { eventos.push('release'); },
        destroy() { eventos.push('destroy'); tx = null; }
    };
    const pool = {
        async getConnection() { eventos.push('acquire'); return conexion; },
        async query(sql, parametros) {
            // Integra la lectura real de Actas 04 con el resultado de esta devolución.
            assert.match(sql, /FROM acta a/);
            assert.match(sql, /LEFT JOIN detalle_acta da/);
            const acta = datos.actas.find((a) => a.id === parametros[0]);
            if (!acta) return [[]];
            return [datos.detalles.filter((d) => d.acta_id === acta.id).map((d) => ({
                ...acta, colaborador: 'PERSONA DE PRUEBA', fecha: '2026-08-19',
                detalle_id: d.id, equipo_id: d.equipo_id, estado_detalle: d.estado,
                devolvio_equipo: d.devolvio_equipo, fecha_entrega: d.fecha_entrega,
                fecha_devolucion: d.fecha_devolucion, observaciones_detalle: d.observaciones,
                marca: 'Marca prueba', modelo: `Equipo ${d.equipo_id}`, estado_actual: datos.equipos[d.equipo_id]
            }))];
        }
    };
    const controller = cargar('asignacionController.js', pool);
    const actas = cargar('actaController.js', pool);
    return {
        datos: () => clonar(datos), consultas, eventos,
        async devolver(body = {}, id = 7) {
            const res = respuesta();
            await controller.devolverAsignacion({ params: { id: String(id) }, body: { fecha_devolucion: '2026-09-03', ...body } }, res);
            return res;
        },
        async verActa() {
            const res = respuesta();
            await actas.obtenerActaPorId({ params: { id: '10' } }, res);
            return res;
        }
    };
}

test('Vínculo válido: finaliza asignación y su detalle en un único commit', async () => {
    const app = entorno();
    const antes = app.datos();
    const res = await app.devolver({ observaciones: 'Recepción con cable', autorizado_por: 3 });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.sincronizacion_acta, { estado: 'ACTUALIZADA', acta_id: 10, detalle_id: 100 });
    const despues = app.datos();
    assert.equal(despues.asignaciones[0].estado, 'FINALIZADA');
    assert.equal(despues.equipos[20], 'LIBRE');
    assert.equal(despues.detalles[0].estado, 'DEVUELTO');
    assert.equal(despues.detalles[0].devolvio_equipo, 'SI');
    assert.equal(despues.detalles[0].fecha_devolucion, '2026-09-03');
    assert.equal(despues.asignaciones[0].observaciones, antes.asignaciones[0].observaciones);
    assert.equal(despues.detalles[0].observaciones, antes.detalles[0].observaciones);
    assert.deepEqual(despues.actas, antes.actas, 'No modifica estado administrativo, firmas ni encabezado');
    assert.deepEqual(despues.detalles.slice(1), antes.detalles.slice(1), 'No modifica otros equipos ni actas históricas');
    assert.deepEqual(despues.asignaciones.slice(1), antes.asignaciones.slice(1));
    assert.equal(despues.movimientos.length, antes.movimientos.length + 1);
    assert.ok(despues.movimientos.at(-1).descripcion.endsWith('Recepción con cable'));
    assert.equal(despues.movimientos.at(-1).autorizado_por, 3);
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'commit', 'release']);
});

test('Actas 04 lee parcial tras la primera devolución y total tras la segunda', async () => {
    const app = entorno();
    assert.equal((await app.devolver()).statusCode, 200);
    const parcial = (await app.verActa()).body.data;
    assert.equal(parcial.estado_devolucion, 'PARCIAL');
    assert.equal(parcial.cantidad_devueltos, 1);
    assert.equal(parcial.cantidad_equipos, 2);
    assert.equal((await app.devolver({}, 8)).statusCode, 200);
    const total = (await app.verActa()).body.data;
    assert.equal(total.estado_devolucion, 'TOTAL');
    assert.equal(total.cantidad_devueltos, 2);
    assert.equal(total.estado, 'ACTIVA', 'Devolución total no cierra el documento automáticamente');
});

test('Sin acta_id: devuelve, informa SIN_ACTA y no busca actas por coincidencia', async () => {
    const app = entorno({ preparar: (d) => { d.asignaciones[0].acta_id = null; } });
    const antes = app.datos();
    const res = await app.devolver();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.sincronizacion_acta, { estado: 'SIN_ACTA' });
    assert.deepEqual(app.datos().actas, antes.actas);
    assert.deepEqual(app.datos().detalles, antes.detalles);
    assert.ok(app.consultas.every((c) => !/FROM acta\b|FROM detalle_acta|UPDATE detalle_acta/.test(c.sql)));
});

test('Los IDs enviados en el body no cambian el acta ni equipo seleccionados en la BD', async () => {
    const app = entorno();
    const res = await app.devolver({ acta_id: 11, detalle_id: 102, equipo_id: 999, colaborador_id: 999 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sincronizacion_acta.acta_id, 10);
    assert.equal(app.datos().detalles[2].fecha_devolucion, '2026-08-10');
});

for (const estado of ['PENDIENTE', 'ACTIVA', 'CERRADA']) {
    test(`Acta ${estado}: registra la recepción sin cambiar el estado administrativo`, async () => {
        const app = entorno({ preparar: (d) => { d.actas[0].estado = estado; } });
        assert.equal((await app.devolver()).statusCode, 200);
        assert.equal(app.datos().actas[0].estado, estado);
    });
}

for (const [nombre, preparar] of [
    ['acta inexistente', (d) => { d.asignaciones[0].acta_id = 999; }],
    ['otro colaborador', (d) => { d.actas[0].colaborador_id = 999; }],
    ['acta anulada', (d) => { d.actas[0].estado = 'ANULADA'; }],
    ['detalle inexistente', (d) => { d.detalles = d.detalles.slice(1); }],
    ['detalle de otro equipo', (d) => { d.detalles[0].equipo_id = 999; }],
    ['detalle duplicado', (d) => { d.detalles.push({ ...d.detalles[0], id: 999 }); }],
    ['ya devuelto', (d) => { Object.assign(d.detalles[0], { estado: 'DEVUELTO', devolvio_equipo: 'SI', fecha_devolucion: '2026-09-01' }); }],
    ['estado PERDIDO', (d) => { d.detalles[0].estado = 'PERDIDO'; }],
    ['estado ROBADO', (d) => { d.detalles[0].estado = 'ROBADO'; }],
    ['indicadores contradictorios', (d) => { d.detalles[0].devolvio_equipo = 'SI'; }],
    ['fecha previa de devolución', (d) => { d.detalles[0].fecha_devolucion = '2026-09-01'; }]
]) {
    test(`Conflicto: ${nombre} no guarda ninguna parte de la devolución`, async () => {
        const app = entorno({ preparar });
        const antes = app.datos();
        const res = await app.devolver();
        assert.equal(res.statusCode, 409);
        assert.deepEqual(app.datos(), antes);
        assert.deepEqual(app.eventos, ['acquire', 'begin', 'rollback', 'release']);
        assert.equal(app.consultas.filter((c) => c.sql.startsWith('UPDATE')).length, 0);
    });
}

for (const estado of ['ACTIVA', 'FINALIZADA', 'CANCELADA']) {
    test(`Otra asignación ${estado} para el mismo acta/equipo se considera ambigua`, async () => {
        const app = entorno({ preparar: (d) => d.asignaciones.push({ ...d.asignaciones[0], id: 99, estado }) });
        const antes = app.datos();
        assert.equal((await app.devolver()).statusCode, 409);
        assert.deepEqual(app.datos(), antes);
    });
}

test('Fecha anterior a entrega del detalle: 400 y rollback', async () => {
    const app = entorno({ preparar: (d) => { d.detalles[0].fecha_entrega = '2026-09-04'; } });
    const antes = app.datos();
    assert.equal((await app.devolver()).statusCode, 400);
    assert.deepEqual(app.datos(), antes);
});

test('Fecha inválida heredada en el detalle no se completa automáticamente', async () => {
    const app = entorno({ preparar: (d) => { d.detalles[0].fecha_entrega = '0000-00-00'; } });
    assert.equal((await app.devolver()).statusCode, 400);
    assert.equal(app.datos().detalles[0].fecha_entrega, '0000-00-00');
});

test('La segunda devolución de la misma asignación no repite ni altera el detalle', async () => {
    const app = entorno();
    assert.equal((await app.devolver()).statusCode, 200);
    const antes = app.datos();
    assert.equal((await app.devolver()).statusCode, 404);
    assert.deepEqual(app.datos(), antes);
});

for (const falla of ['leerActa', 'leerOtras', 'leerDetalle', 'actualizarAsignacion', 'actualizarMovimiento', 'actualizarDetalle', 'commit']) {
    test(`Fallo simulado en ${falla}: no persiste ningún cambio parcial`, async () => {
        const app = entorno({ falla });
        const antes = app.datos();
        assert.equal((await app.devolver({ observaciones: 'Nota de recepción' })).statusCode, 500);
        assert.deepEqual(app.datos(), antes);
        assert.ok(app.eventos.includes('rollback'));
        assert.equal(app.eventos.at(-1), 'release');
    });
}

test('Detalle sin filas afectadas revierte también asignación, equipo y movimiento', async () => {
    const app = entorno({ sinCambioDetalle: true });
    const antes = app.datos();
    assert.equal((await app.devolver()).statusCode, 409);
    assert.deepEqual(app.datos(), antes);
});

test('Sin movimiento generado por trigger tampoco se actualiza el acta', async () => {
    const app = entorno({ sinMovimiento: true });
    const antes = app.datos();
    assert.equal((await app.devolver()).statusCode, 500);
    assert.deepEqual(app.datos(), antes);
});

for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    test(`${code}: devuelve conflicto controlado, libera conexión y revierte`, async () => {
        const app = entorno({ falla: 'actualizarDetalle', error: { code } });
        const antes = app.datos();
        const res = await app.devolver();
        assert.equal(res.statusCode, 409);
        assert.match(res.body.mensaje, /Otra operación/);
        assert.deepEqual(app.datos(), antes);
        assert.equal(app.eventos.at(-1), 'release');
    });
}
