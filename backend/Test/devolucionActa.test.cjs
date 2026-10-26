const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directorio = process.env.INVENTARIO_CONTROLLERS_DIR || path.join(__dirname, '../src/controllers');

function cargar(pool) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(directorio, 'asignacionController.js'), 'utf8'), {
        module, Buffer, console: { error() {} },
        require: (nombre) => {
            assert.equal(nombre, '../config/database');
            return pool;
        }
    }, { filename: 'asignacionController.js' });
    return module.exports;
}

function entorno(opciones = {}) {
    let asignacion = {
        id: 7, equipo_id: 20, colaborador_id: 3,
        estado: 'ACTIVA', fecha_asignacion: '2026-08-19',
        fecha_devolucion: null
    };
    let movimientos = [{ id: 5, asignacion_id: 6, tipo_movimiento: 'DEVOLUCION', descripcion: 'Histórico', autorizado_por: null }];
    const consultas = [];
    const eventos = [];
    let tx = false;

    const conexion = {
        async beginTransaction() { tx = true; eventos.push('begin'); },
        async query(sql, parametros = []) {
            assert.equal(tx, true, 'Las consultas de devolución deben usar una transacción');
            const q = sql.replace(/\s+/g, ' ').trim();
            const p = [...parametros];
            consultas.push({ sql: q, parametros: p });

            if (q.startsWith('SELECT id, equipo_id, estado, colaborador_id,')) {
                return [asignacion && asignacion.id === p[0] ? [{ ...asignacion }] : []];
            }
            if (q === 'SELECT id FROM colaborador WHERE id = ?') {
                return [p[0] === 3 ? [{ id: 3 }] : []];
            }
            if (q.startsWith('SELECT COALESCE(MAX(id), 0)')) {
                const anteriores = movimientos.filter(m => m.asignacion_id === p[0] && m.tipo_movimiento === 'DEVOLUCION');
                return [[{ ultimo_id: Math.max(0, ...anteriores.map(m => m.id)) }]];
            }
            if (q.startsWith('UPDATE asignacion')) {
                if (opciones.errorEn === 'actualizarAsignacion') throw new Error('Fallo simulado');
                if (!asignacion || asignacion.id !== p[1] || asignacion.estado !== 'ACTIVA') return [{ affectedRows: 0 }];
                asignacion = { ...asignacion, estado: 'FINALIZADA', fecha_devolucion: p[0] };
                if (!opciones.sinMovimiento) {
                    movimientos.push({
                        id: Math.max(0, ...movimientos.map(m => m.id)) + 1,
                        asignacion_id: asignacion.id,
                        tipo_movimiento: 'DEVOLUCION',
                        descripcion: 'Devolución automática',
                        autorizado_por: null
                    });
                }
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('SELECT id, descripcion FROM movimiento_equipo')) {
                return [movimientos.filter(m => m.asignacion_id === p[0] && m.id > p[1] && m.tipo_movimiento === 'DEVOLUCION')];
            }
            if (q.startsWith('UPDATE movimiento_equipo')) {
                if (opciones.errorEn === 'actualizarMovimiento') throw new Error('Fallo simulado');
                const m = movimientos.find(m => m.id === p[2] && m.asignacion_id === p[3]);
                if (!m) return [{ affectedRows: 0 }];
                m.descripcion = p[0];
                m.autorizado_por = p[1];
                return [{ affectedRows: 1 }];
            }
            throw new Error(`SQL no esperado: ${q}`);
        },
        async commit() {
            if (opciones.errorEn === 'commit') throw new Error('Fallo simulado en commit');
            eventos.push('commit');
            tx = false;
        },
        async rollback() { eventos.push('rollback'); tx = false; },
        release() { eventos.push('release'); },
        destroy() { eventos.push('destroy'); tx = false; }
    };
    const pool = { async getConnection() { eventos.push('acquire'); return conexion; } };
    const controller = cargar(pool);

    return {
        consultas, eventos,
        estado: () => ({ asignacion: asignacion && { ...asignacion }, movimientos: movimientos.map(m => ({ ...m })) }),
        async devolver(body = {}, id = 7) {
            const res = {
                statusCode: 200,
                body: undefined,
                status(codigo) { this.statusCode = codigo; return this; },
                json(cuerpo) { this.body = cuerpo; return this; }
            };
            await controller.devolverAsignacion({
                params: { id: String(id) },
                body: { fecha_devolucion: '2026-09-03', ...body }
            }, res);
            return res;
        }
    };
}

test('La devolución finaliza la asignación y conserva el movimiento generado', async () => {
    const app = entorno();
    const res = await app.devolver({ observaciones: 'Recepción con cable', autorizado_por: 3 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const estado = app.estado();
    assert.equal(estado.asignacion.estado, 'FINALIZADA');
    assert.equal(estado.asignacion.fecha_devolucion, '2026-09-03');
    assert.equal(estado.movimientos.length, 2);
    assert.match(estado.movimientos.at(-1).descripcion, /Recepción con cable/);
    assert.equal(estado.movimientos.at(-1).autorizado_por, 3);
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'commit', 'release']);
    assert.ok(app.consultas.every(c => !/FROM acta\b|FROM detalle_acta|UPDATE detalle_acta/.test(c.sql)),
        'La devolución no sincroniza automáticamente actas ni sus detalles');
});

test('Una segunda devolución de la misma asignación responde 404', async () => {
    const app = entorno();
    assert.equal((await app.devolver()).statusCode, 200);
    const antes = app.estado();
    assert.equal((await app.devolver()).statusCode, 404);
    assert.deepEqual(app.estado(), antes);
});

test('Una fecha anterior a la asignación se rechaza y revierte la transacción', async () => {
    const app = entorno();
    const antes = app.estado();
    const res = await app.devolver({ fecha_devolucion: '2026-08-18' });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(app.estado(), antes);
    assert.deepEqual(app.eventos, ['acquire', 'begin', 'rollback', 'release']);
});

test('Un autorizador inexistente se rechaza sin finalizar la asignación', async () => {
    const app = entorno();
    const antes = app.estado();
    const res = await app.devolver({ autorizado_por: 999 });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(app.estado(), antes);
    assert.ok(app.eventos.includes('rollback'));
});

test('Sin movimiento generado por el trigger, revierte la devolución', async () => {
    const app = entorno({ sinMovimiento: true });
    const antes = app.estado();
    const res = await app.devolver();
    assert.equal(res.statusCode, 500);
    assert.deepEqual(app.estado(), antes);
    assert.ok(app.eventos.includes('rollback'));
});

test('Un error al actualizar el movimiento revierte toda la operación', async () => {
    const app = entorno({ errorEn: 'actualizarMovimiento' });
    const antes = app.estado();
    const res = await app.devolver({ observaciones: 'Nota de recepción' });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(app.estado(), antes);
    assert.ok(app.eventos.includes('rollback'));
});

