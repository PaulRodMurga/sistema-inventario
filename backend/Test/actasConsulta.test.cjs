const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Pruebas del controlador real. MySQL se sustituye por filas sintéticas;
// no se importa el respaldo ni se contacta ninguna base de datos.
const filename = path.join(process.env.INVENTARIO_CONTROLLERS_DIR || path.join(__dirname, '../src/controllers'), 'actaController.js');
const source = fs.readFileSync(filename, 'utf8');
const clonar = (valor) => JSON.parse(JSON.stringify(valor));

function fila(cambios = {}) {
    return {
        id: 10, nro_acta: 'ACTA-PRUEBA', fecha: '2026-09-03', firmo_amo: 'SI', firmo_dmo: 'NO',
        estado: 'ACTIVA', observaciones: 'Nota del encabezado',
        colaborador_id: 3, codigo_colaborador: 'C-PRUEBA', dni: '00000000', colaborador: 'PERSONA DE PRUEBA',
        detalle_id: 101, equipo_id: 20, fecha_entrega: '2026-08-19', fecha_devolucion: null,
        devolvio_equipo: 'NO', estado_detalle: 'ENTREGADO', observaciones_detalle: 'Nota del equipo',
        tipo: 'CELULAR', marca: 'Marca prueba', modelo: 'Modelo A', imei: '000000000000001', serie: 'SERIE-A',
        estado_actual: 'ASIGNADO', ...cambios
    };
}

function entorno(filas = [], falla = false) {
    const consultas = [];
    const pool = {
        async query(sql, parametros = []) {
            assert.match(sql.trim(), /^SELECT\b/, 'Los endpoints consultados son de solo lectura');
            assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
            consultas.push({ sql, parametros: clonar(parametros) });
            if (falla) throw new Error('MySQL no disponible');
            return [clonar(parametros.length ? filas.filter((f) => f.id === parametros[0]) : filas)];
        },
        getConnection() { throw new Error('Las consultas no deben abrir transacciones de escritura'); }
    };
    const module = { exports: {} };
    vm.runInNewContext(source, {
        module, console: { error() { } },
        require: (nombre) => { assert.equal(nombre, '../config/database'); return pool; }
    }, { filename });
    async function invocar(nombre, params = {}) {
        const res = {
            statusCode: 200,
            status(codigo) { this.statusCode = codigo; return this; },
            json(datos) { this.body = clonar(datos); return this; }
        };
        await module.exports[nombre]({ params }, res);
        return res;
    }
    return { consultas, listar: () => invocar('listarActas'), detalle: (id = '10') => invocar('obtenerActaPorId', { id }) };
}

test('Acta con dos equipos: una devolución se representa como parcial', async () => {
    const app = entorno([
        fila({ estado_detalle: 'DEVUELTO', devolvio_equipo: 'SI', fecha_devolucion: '2026-09-01' }),
        fila({ detalle_id: 102, equipo_id: 21, modelo: 'Modelo B', imei: '000000000000002', serie: 'SERIE-B' })
    ]);
    const res = await app.listar();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.cantidad, 1, 'Cuenta actas, no filas del JOIN');
    const acta = res.body.data[0];
    assert.equal(acta.cantidad_equipos, 2);
    assert.equal(acta.cantidad_devueltos, 1);
    assert.equal(acta.cantidad_no_devueltos, 1);
    assert.equal(acta.cantidad_por_revisar, 0);
    assert.equal(acta.estado_devolucion, 'PARCIAL');
    assert.deepEqual(acta.equipos.map((e) => e.equipo_id), [20, 21]);
    assert.deepEqual(acta.equipos.map((e) => e.imei), ['000000000000001', '000000000000002']);
    assert.equal(app.consultas.length, 1);
});

test('Lista y detalle devuelven el mismo contrato y valores para el acta', async () => {
    const app = entorno([fila(), fila({ detalle_id: 102, equipo_id: 21 })]);
    const lista = await app.listar();
    const detalle = await app.detalle();
    assert.deepEqual(detalle.body.data, lista.body.data[0]);
    assert.equal(app.consultas.length, 2, 'Una consulta por petición, sin N+1');
    assert.deepEqual(app.consultas[1].parametros, [10]);
    assert.match(app.consultas[1].sql, /WHERE a.id = \? ORDER BY da.id ASC/);
});

test('Devuelve todos los equipos y preserva encabezado y notas independientes', async () => {
    const app = entorno([fila(), fila({ detalle_id: 102, equipo_id: 21, observaciones_detalle: 'Otra nota\nCon salto' })]);
    const acta = (await app.detalle()).body.data;
    assert.equal(acta.observaciones, 'Nota del encabezado');
    assert.equal(acta.equipos[0].observaciones, 'Nota del equipo');
    assert.equal(acta.equipos[1].observaciones, 'Otra nota\nCon salto');
    assert.equal(acta.equipos[1].fecha_entrega, '2026-08-19');
    assert.equal(acta.equipos[1].fecha_devolucion, null);
    assert.equal(acta.marca, undefined, 'No inventa un equipo único en el encabezado');
    assert.equal(acta.asignacion_id, undefined, 'No inventa una asignación única');
});

test('Dos actas con el mismo equipo permanecen separadas', async () => {
    const app = entorno([fila(), fila({ id: 9, detalle_id: 103, nro_acta: 'ACTA-ANTERIOR', estado: 'CERRADA' })]);
    const res = await app.listar();
    assert.equal(res.body.cantidad, 2);
    assert.deepEqual(res.body.data.map((a) => a.id), [10, 9]);
    assert.deepEqual(res.body.data.map((a) => a.cantidad_equipos), [1, 1]);
    assert.match(app.consultas[0].sql, /ORDER BY a.id DESC, da.id ASC/);
});

test('Sin detalles: mantiene el acta, devuelve array vacío y no inventa devolución total', async () => {
    const app = entorno([fila({ detalle_id: null, equipo_id: null })]);
    const acta = (await app.detalle()).body.data;
    assert.deepEqual(acta.equipos, []);
    assert.equal(acta.cantidad_equipos, 0);
    assert.equal(acta.cantidad_devueltos, 0);
    assert.equal(acta.estado_devolucion, 'SIN_EQUIPOS');
});

test('Conserva un detalle incluso si faltan datos descriptivos del equipo', async () => {
    const acta = (await entorno([fila({ marca: null, modelo: null, serie: null, imei: null })]).detalle()).body.data;
    assert.equal(acta.cantidad_equipos, 1);
    assert.equal(acta.equipos[0].equipo_id, 20);
});

test('Lista vacía es éxito, detalle inexistente es 404', async () => {
    const app = entorno();
    assert.deepEqual((await app.listar()).body, { success: true, cantidad: 0, data: [] });
    assert.equal((await app.detalle()).statusCode, 404);
});

test('Devolución total requiere al menos un detalle y todos devueltos', async () => {
    const filas = [101, 102].map((id) => fila({ detalle_id: id, estado_detalle: 'DEVUELTO', devolvio_equipo: 'SI' }));
    const acta = (await entorno(filas).detalle()).body.data;
    assert.equal(acta.estado_devolucion, 'TOTAL');
    assert.equal(acta.cantidad_devueltos, 2);
});

test('Un acta CERRADA no implica que sus equipos estén devueltos', async () => {
    const acta = (await entorno([fila({ estado: 'CERRADA' })]).detalle()).body.data;
    assert.equal(acta.estado, 'CERRADA');
    assert.equal(acta.estado_devolucion, 'PENDIENTE');
});

test('Firma y estado actual del equipo no alteran la devolución del detalle', async () => {
    const acta = (await entorno([fila({ firmo_amo: 'SI', firmo_dmo: 'SI', estado_actual: 'LIBRE' })]).detalle()).body.data;
    assert.equal(acta.estado_devolucion, 'PENDIENTE');
});

test('Una devolución registrada sigue visible aunque el equipo se haya reasignado', async () => {
    const acta = (await entorno([fila({ estado_actual: 'ASIGNADO', estado_detalle: 'DEVUELTO', devolvio_equipo: 'SI' })]).detalle()).body.data;
    assert.equal(acta.estado_devolucion, 'TOTAL');
});

for (const estado of ['PERDIDO', 'ROBADO']) {
    test(`${estado} se cuenta como incidencia, no como devolución`, async () => {
        const acta = (await entorno([fila({ estado_detalle: estado })]).detalle()).body.data;
        assert.equal(acta.cantidad_incidencias, 1);
        assert.equal(acta.cantidad_devueltos, 0);
        assert.equal(acta.cantidad_no_devueltos, 1);
        assert.equal(acta.equipos[0].estado, estado);
    });
}

for (const [estado, marca] of [['DEVUELTO', 'NO'], ['ENTREGADO', 'SI'], ['PERDIDO', 'SI'], ['ROBADO', 'SI'], [null, 'NO']]) {
    test(`Contradicción ${estado}/${marca}: indica REVISAR y conserva los datos`, async () => {
        const acta = (await entorno([fila({ estado_detalle: estado, devolvio_equipo: marca })]).detalle()).body.data;
        assert.equal(acta.estado_devolucion, 'REVISAR');
        assert.equal(acta.cantidad_por_revisar, 1);
        assert.equal(acta.cantidad_devueltos, 0);
        assert.equal(acta.equipos[0].estado, estado);
        assert.equal(acta.equipos[0].devolvio_equipo, marca);
    });
}

test('Una contradicción tiene prioridad sobre el resumen parcial', async () => {
    const acta = (await entorno([
        fila({ estado_detalle: 'DEVUELTO', devolvio_equipo: 'SI' }),
        fila({ detalle_id: 102, estado_detalle: 'DEVUELTO', devolvio_equipo: 'NO' })
    ]).detalle()).body.data;
    assert.equal(acta.estado_devolucion, 'REVISAR');
    assert.equal(acta.cantidad_devueltos, 1);
    assert.equal(acta.cantidad_por_revisar, 1);
});

test('Anuladas se conservan con su propio estado y detalles, sin reinterpretarlas', async () => {
    const acta = (await entorno([fila({ estado: 'ANULADA', estado_detalle: 'DEVUELTO', devolvio_equipo: 'SI' })]).detalle()).body.data;
    assert.equal(acta.estado, 'ANULADA');
    assert.equal(acta.estado_devolucion, 'TOTAL');
});

test('Un acta de muchos equipos no se trunca con GROUP_CONCAT ni dispara consultas por equipo', async () => {
    const filas = Array.from({ length: 150 }, (_, i) => fila({ detalle_id: i + 1, equipo_id: i + 1, imei: String(i).padStart(15, '0') }));
    const app = entorno(filas);
    const acta = (await app.listar()).body.data[0];
    assert.equal(acta.cantidad_equipos, 150);
    assert.equal(acta.equipos[149].imei, '000000000000149');
    assert.equal(app.consultas.length, 1);
    assert.doesNotMatch(app.consultas[0].sql, /GROUP_CONCAT|JOIN asignacion/);
    assert.match(app.consultas[0].sql, /LEFT JOIN detalle_acta/);
    assert.match(app.consultas[0].sql, /LEFT JOIN equipo/);
});

for (const id of ['0', '-1', '1.5', '10 OR 1=1', '2147483648']) {
    test(`ID inválido ${id}: 400 sin consultar`, async () => {
        const app = entorno([fila()]);
        assert.equal((await app.detalle(id)).statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('Fallo de lectura devuelve error controlado para ambos endpoints', async () => {
    const app = entorno([], true);
    assert.equal((await app.listar()).statusCode, 500);
    assert.equal((await app.detalle()).statusCode, 500);
});
