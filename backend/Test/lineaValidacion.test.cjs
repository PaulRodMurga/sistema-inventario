const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllerPath = path.join(
    process.env.INVENTARIO_CONTROLLERS_DIR ||
    path.join(__dirname, '../src/controllers'),
    'lineaController.js'
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
                return [{ insertId: 120 }];
            }
            if (/^UPDATE/.test(sql.trim())) {
                return [{ affectedRows: opciones.affectedRows ?? 1 }];
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

async function ejecutar(funcion, { id = '1', numero = '987654321', body = {} } = {}) {
    const res = respuesta();
    await funcion({ params: { id, numero }, body }, res);
    return res;
}

test('la utilidad acepta IDs opcionales positivos o null', () => {
    assert.deepEqual(
        validaciones.validarIdOpcional(5, 'El plan_id'),
        { valido: true, valor: 5 }
    );
    assert.deepEqual(
        validaciones.validarIdOpcional(null, 'El plan_id'),
        { valido: true, valor: null }
    );

    for (const valor of [0, -1, 1.5, '5', true, 2147483648]) {
        assert.equal(
            validaciones.validarIdOpcional(valor, 'El plan_id').valido,
            false,
            String(valor)
        );
    }
});

test('la utilidad conserva códigos numéricos como texto', () => {
    const opciones = {
        etiqueta: 'El código',
        maximo: 5
    };

    assert.equal(
        validaciones.validarDigitos(' 00123 ', opciones).valor,
        '00123'
    );
    assert.equal(
        validaciones.validarDigitos('12A', opciones).valido,
        false
    );
    assert.equal(
        validaciones.validarDigitos('123456', opciones).valido,
        false
    );
    assert.equal(
        validaciones.validarDigitos(123, opciones).valido,
        false
    );
});

test('la utilidad distingue un código opcional vacío de uno inválido', () => {
    const opciones = {
        etiqueta: 'El código',
        maximo: 5,
        opcional: true
    };

    assert.equal(validaciones.validarDigitos('', opciones).valor, null);
    assert.equal(validaciones.validarDigitos(null, opciones).valor, null);
    assert.equal(validaciones.validarDigitos('123', opciones).valor, '123');
    assert.equal(validaciones.validarDigitos(undefined, opciones).valido, false);
});

test('registrar línea recorta textos, normaliza estado y conserva relaciones', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.registrarLinea, {
        body: {
            numero: ' 987654321 ',
            codigo_chip: ' 895101000000000001 ',
            plan_id: 2,
            estado: ' activa ',
            equipo_id: 8
        }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        ['987654321', '895101000000000001', 2, 'ACTIVA', 8]
    );
});

test('registrar línea aplica únicamente los valores opcionales por defecto', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.registrarLinea, {
        body: { numero: '987654322' }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        ['987654322', null, null, 'ACTIVA', null]
    );
});

for (const body of [
    { numero: '   ' },
    { numero: 'ABC123' },
    { numero: 987654321 },
    { numero: '1'.repeat(21) },
    { numero: '987654321', codigo_chip: 'CHIP-01' },
    { numero: '987654321', codigo_chip: '1'.repeat(41) },
    { numero: '987654321', plan_id: 0 },
    { numero: '987654321', plan_id: '2' },
    { numero: '987654321', plan_id: 1.5 },
    { numero: '987654321', equipo_id: 0 },
    { numero: '987654321', equipo_id: '8' },
    { numero: '987654321', estado: 'INACTIVA' },
    { numero: '987654321', estado: null }
]) {
    test(`registrar línea rechaza ${JSON.stringify(body)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.registrarLinea, { body });

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(app.consultas.length, 0);
    });
}

for (const body of [null, [], 'texto']) {
    test(`registrar línea rechaza un cuerpo ${JSON.stringify(body)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.registrarLinea, { body });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('registrar línea devuelve 409 para número o chip duplicado', async () => {
    const app = prepararControlador({
        error: { code: 'ER_DUP_ENTRY' }
    });
    const res = await ejecutar(app.controlador.registrarLinea, {
        body: { numero: '987654321' }
    });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensaje, /registrado/i);
});

test('registrar línea devuelve 400 para relaciones inexistentes', async () => {
    const app = prepararControlador({
        error: { code: 'ER_NO_REFERENCED_ROW_2' }
    });
    const res = await ejecutar(app.controlador.registrarLinea, {
        body: { numero: '987654321', plan_id: 999 }
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /no existe/i);
});

test('actualizar línea modifica solo el estado enviado', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.actualizarLinea, {
        id: '15', body: { estado: ' suspendida ' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /SET estado = \? WHERE id = \?/);
    assert.doesNotMatch(app.consultas[0].sql, /plan_id =|equipo_id =/);
    assert.deepEqual(app.consultas[0].parametros, ['SUSPENDIDA', 15]);
});

test('actualizar línea permite quitar explícitamente plan y equipo', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.actualizarLinea, {
        id: '15', body: { plan_id: null, equipo_id: null }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [null, null, 15]);
});

test('actualizar línea conserva número y chip aunque el cliente los envíe', async () => {
    const app = prepararControlador();
    const res = await ejecutar(app.controlador.actualizarLinea, {
        id: '15',
        body: {
            numero: '999999999',
            codigo_chip: '895199999999999999',
            estado: 'BAJA'
        }
    });

    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(app.consultas[0].sql, /numero =|codigo_chip =/);
    assert.equal(app.consultas[0].parametros.includes('999999999'), false);
    assert.deepEqual(app.consultas[0].parametros, ['BAJA', 15]);
});

for (const caso of [
    { id: '0', body: { estado: 'ACTIVA' } },
    { id: '-1', body: { estado: 'ACTIVA' } },
    { id: '1.5', body: { estado: 'ACTIVA' } },
    { id: '15', body: {} },
    { id: '15', body: { numero: '999999999' } },
    { id: '15', body: { desconocido: true } },
    { id: '15', body: { plan_id: 0 } },
    { id: '15', body: { equipo_id: '4' } },
    { id: '15', body: { estado: 'ACTIVO' } }
]) {
    test(`actualizar línea rechaza ${JSON.stringify(caso)}`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.actualizarLinea, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('actualizar línea devuelve 404 cuando el ID válido no existe', async () => {
    const app = prepararControlador({ affectedRows: 0 });
    const res = await ejecutar(app.controlador.actualizarLinea, {
        id: '200', body: { estado: 'BAJA' }
    });

    assert.equal(res.statusCode, 404);
});

test('actualizar línea conserva el error de relación inexistente', async () => {
    const app = prepararControlador({
        error: { code: 'ER_NO_REFERENCED_ROW_2' }
    });
    const res = await ejecutar(app.controlador.actualizarLinea, {
        id: '15', body: { equipo_id: 999 }
    });

    assert.equal(res.statusCode, 400);
});

test('obtener línea valida y convierte el ID antes de consultar', async () => {
    const app = prepararControlador({
        filas: [{ id: 15, numero: '987654321' }]
    });
    const res = await ejecutar(app.controlador.obtenerLineaPorId, {
        id: '15'
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [15]);
});

for (const id of ['abc', '0', '1.5', '2147483648']) {
    test(`obtener línea rechaza ID inválido ${id} sin consultar`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.obtenerLineaPorId, { id });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('buscar por número usa el valor numérico recortado como parámetro', async () => {
    const app = prepararControlador({
        filas: [{ id: 15, numero: '987654321' }]
    });
    const res = await ejecutar(app.controlador.buscarPorNumero, {
        numero: ' 987654321 '
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, ['987654321']);
});

for (const numero of ['', 'ABC123', '1'.repeat(21)]) {
    test(`buscar por número rechaza ${JSON.stringify(numero)} sin SQL`, async () => {
        const app = prepararControlador();
        const res = await ejecutar(app.controlador.buscarPorNumero, { numero });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('buscar por número válido inexistente mantiene 404', async () => {
    const app = prepararControlador({ filas: [] });
    const res = await ejecutar(app.controlador.buscarPorNumero, {
        numero: '987654399'
    });

    assert.equal(res.statusCode, 404);
});
