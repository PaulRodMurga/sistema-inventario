const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllerPath = path.join(
    process.env.INVENTARIO_CONTROLLERS_DIR ||
    path.join(__dirname, '../src/controllers'),
    'colaboradorController.js'
);
const validationPath = process.env.INVENTARIO_VALIDACIONES_PATH ||
    path.join(__dirname, '../src/utils/validacionCatalogos.js');
const source = fs.readFileSync(controllerPath, 'utf8');
const validaciones = require(validationPath);

function respuesta() {
    return {
        statusCode: 200,
        body: undefined,
        status(codigo) {
            this.statusCode = codigo;
            return this;
        },
        json(cuerpo) {
            this.body = JSON.parse(JSON.stringify(cuerpo));
            return this;
        }
    };
}

function prepararControlador(opciones = {}) {
    const consultas = [];
    const pool = {
        async query(sql, parametros = []) {
            consultas.push({
                sql: sql.replace(/\s+/g, ' ').trim(),
                parametros: Array.from(parametros)
            });

            if (opciones.error) throw opciones.error;
            if (/^SELECT/.test(sql.trim())) {
                return [opciones.filas ?? []];
            }
            if (/^INSERT/.test(sql.trim())) {
                return [{ insertId: 130 }];
            }
            if (/^UPDATE/.test(sql.trim())) {
                return [{
                    affectedRows: opciones.affectedRows ?? 1,
                    changedRows: opciones.changedRows ?? 1
                }];
            }
            throw new Error('SQL inesperado');
        }
    };
    const modulo = { exports: {} };

    vm.runInNewContext(source, {
        module: modulo,
        exports: modulo.exports,
        require(nombre) {
            if (nombre === '../config/database') return pool;
            if (nombre === '../utils/validacionCatalogos') {
                return validaciones;
            }
            throw new Error(`Módulo inesperado: ${nombre}`);
        },
        console: { error() { } },
        Set
    }, { filename: controllerPath });

    return {
        controlador: modulo.exports,
        consultas
    };
}

async function ejecutar(
    funcion,
    { id = '1', dni = '12345678', body = {} } = {}
) {
    const res = respuesta();
    await funcion({ params: { id, dni }, body }, res);
    return res;
}

const colaboradorValido = (cambios = {}) => ({
    codigo: 'COL-101',
    apellidos: 'PÉREZ GARCÍA',
    nombres: 'ANA MARÍA',
    dni: '01234567',
    ...cambios
});

test('registrar colaborador recorta textos, conserva DNI y normaliza estado', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.registrarColaborador, {
        body: colaboradorValido({
            codigo: ' COL-101 ',
            apellidos: ' PÉREZ GARCÍA ',
            nombres: ' ANA MARÍA ',
            dni: ' 01234567 ',
            cargo_id: 2,
            area_id: 3,
            centro_costos_id: 4,
            unidad_empresarial_id: 5,
            estado: ' externo '
        })
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        [
            'COL-101',
            'PÉREZ GARCÍA',
            'ANA MARÍA',
            '01234567',
            2,
            3,
            4,
            5,
            'EXTERNO'
        ]
    );
});

test('registrar colaborador aplica solo los valores opcionales por defecto', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.registrarColaborador, {
        body: colaboradorValido()
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        [
            'COL-101',
            'PÉREZ GARCÍA',
            'ANA MARÍA',
            '01234567',
            null,
            null,
            null,
            null,
            'ACTIVO'
        ]
    );
});

for (const cambios of [
    { codigo: '' },
    { codigo: ' '.repeat(4) },
    { codigo: 101 },
    { codigo: 'A'.repeat(21) },
    { apellidos: '' },
    { apellidos: 123 },
    { apellidos: 'A'.repeat(101) },
    { nombres: '' },
    { nombres: null },
    { nombres: 'N'.repeat(101) },
    { dni: '' },
    { dni: 12345678 },
    { dni: '1234A678' },
    { dni: '1'.repeat(16) },
    { cargo_id: 0 },
    { cargo_id: '2' },
    { area_id: -1 },
    { area_id: 1.5 },
    { centro_costos_id: true },
    { unidad_empresarial_id: 2147483648 },
    { estado: 'INACTIVO' },
    { estado: null }
]) {
    test(`registrar colaborador rechaza ${JSON.stringify(cambios)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.registrarColaborador, {
            body: colaboradorValido(cambios)
        });

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(app.consultas.length, 0);
    });
}

for (const body of [null, [], 'texto']) {
    test(`registrar colaborador rechaza un cuerpo ${JSON.stringify(body)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.registrarColaborador, {
            body
        });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('registrar colaborador devuelve 409 si código o DNI ya existen', async () => {
    const app = prepararControlador({
        error: { code: 'ER_DUP_ENTRY' }
    });
    const res = await ejecutar(app.controlador.registrarColaborador, {
        body: colaboradorValido()
    });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensaje, /código o DNI/i);
});

test('registrar colaborador devuelve 400 para una relación inexistente', async () => {
    const app = prepararControlador({
        error: { code: 'ER_NO_REFERENCED_ROW_2' }
    });
    const res = await ejecutar(app.controlador.registrarColaborador, {
        body: colaboradorValido({ cargo_id: 999 })
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /no existe/i);
});

test('actualizar colaborador modifica solo el estado enviado', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.actualizarColaborador, {
        id: '15',
        body: { estado: ' cesado ' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /SET estado = \? WHERE id = \?/);
    assert.doesNotMatch(
        app.consultas[0].sql,
        /cargo_id =|area_id =|centro_costos_id =|unidad_empresarial_id =/
    );
    assert.deepEqual(app.consultas[0].parametros, ['CESADO', 15]);
    assert.equal(res.body.data.id, 15);
});

test('actualizar colaborador permite quitar explícitamente sus relaciones', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.actualizarColaborador, {
        id: '15',
        body: {
            cargo_id: null,
            area_id: null,
            centro_costos_id: null,
            unidad_empresarial_id: null
        }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(
        app.consultas[0].parametros,
        [null, null, null, null, 15]
    );
});

test('actualizar colaborador nunca modifica sus datos de identidad', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.actualizarColaborador, {
        id: '15',
        body: {
            codigo: 'CAMBIADO',
            apellidos: 'CAMBIADOS',
            nombres: 'CAMBIADOS',
            dni: '99999999',
            area_id: 8
        }
    });

    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(
        app.consultas[0].sql,
        /codigo =|apellidos =|nombres =|dni =/
    );
    assert.deepEqual(app.consultas[0].parametros, [8, 15]);
});

for (const caso of [
    { id: '0', body: { estado: 'ACTIVO' } },
    { id: '-1', body: { estado: 'ACTIVO' } },
    { id: '1.5', body: { estado: 'ACTIVO' } },
    { id: '2147483648', body: { estado: 'ACTIVO' } },
    { id: '15', body: {} },
    { id: '15', body: { codigo: 'NUEVO' } },
    { id: '15', body: { desconocido: true } },
    { id: '15', body: { cargo_id: 0 } },
    { id: '15', body: { area_id: '4' } },
    { id: '15', body: { centro_costos_id: 2.5 } },
    { id: '15', body: { unidad_empresarial_id: false } },
    { id: '15', body: { estado: 'INACTIVO' } }
]) {
    test(`actualizar colaborador rechaza ${JSON.stringify(caso)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.actualizarColaborador, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

for (const body of [null, [], 'texto']) {
    test(`actualizar colaborador rechaza un cuerpo ${JSON.stringify(body)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.actualizarColaborador, {
            id: '15',
            body
        });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('actualizar colaborador devuelve 404 para un ID válido inexistente', async () => {
    const app = prepararControlador({ affectedRows: 0 });
    const res = await ejecutar(app.controlador.actualizarColaborador, {
        id: '200',
        body: { estado: 'EXTERNO' }
    });

    assert.equal(res.statusCode, 404);
});

test('actualizar colaborador devuelve 400 para una relación inexistente', async () => {
    const app = prepararControlador({
        error: { code: 'ER_NO_REFERENCED_ROW_2' }
    });
    const res = await ejecutar(app.controlador.actualizarColaborador, {
        id: '15',
        body: { unidad_empresarial_id: 999 }
    });

    assert.equal(res.statusCode, 400);
});

test('obtener colaborador valida y convierte el ID antes de consultar', async () => {
    const app = prepararControlador({
        filas: [{ id: 15, codigo: 'COL-101' }]
    });
    const res = await ejecutar(app.controlador.obtenerColaboradorPorId, {
        id: '15'
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [15]);
});

for (const id of ['abc', '0', '1.5', '2147483648']) {
    test(`obtener colaborador rechaza ID inválido ${id} sin consultar`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.obtenerColaboradorPorId, {
            id
        });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('buscar colaborador por DNI recorta y conserva ceros iniciales', async () => {
    const app = prepararControlador({
        filas: [{ id: 15, dni: '01234567' }]
    });
    const res = await ejecutar(app.controlador.buscarPorDni, {
        dni: ' 01234567 '
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, ['01234567']);
});

for (const dni of ['', '1234A678', '1'.repeat(16)]) {
    test(`buscar colaborador por DNI rechaza ${JSON.stringify(dni)} sin SQL`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.buscarPorDni, { dni });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('buscar colaborador por DNI válido inexistente conserva 404', async () => {
    const app = prepararControlador({ filas: [] });
    const res = await ejecutar(app.controlador.buscarPorDni, {
        dni: '12345678'
    });

    assert.equal(res.statusCode, 404);
});
