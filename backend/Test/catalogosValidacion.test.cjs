const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllersDir = process.env.INVENTARIO_CONTROLLERS_DIR ||
    path.join(__dirname, '../src/controllers');
const validacionesPath = process.env.INVENTARIO_VALIDACIONES_PATH ||
    path.join(__dirname, '../src/utils/validacionCatalogos.js');
const validaciones = require(validacionesPath);

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

function cargarControlador(archivo, opciones = {}) {
    const ruta = path.join(controllersDir, archivo);
    const source = fs.readFileSync(ruta, 'utf8');
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
                return [{ insertId: 25 }];
            }
            if (/^UPDATE/.test(sql.trim())) {
                return [{ affectedRows: opciones.affectedRows ?? 1 }];
            }
            throw new Error('SQL inesperado en la prueba');
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
        console: { error() { } }
    }, { filename: ruta });

    return { controlador: modulo.exports, consultas };
}

async function ejecutar(funcion, { body = {}, id = '1' } = {}) {
    const res = respuesta();
    await funcion({ body, params: { id } }, res);
    return res;
}

test('la utilidad valida IDs enteros positivos', () => {
    assert.deepEqual(
        validaciones.validarIdPositivo('12'),
        { valido: true, valor: 12 }
    );

    for (const valor of [
        0,
        -1,
        1.5,
        '',
        ' 1 ',
        'abc',
        null,
        true,
        [1],
        2147483648,
        Infinity
    ]) {
        assert.equal(
            validaciones.validarIdPositivo(valor).valido,
            false,
            String(valor)
        );
    }
});

test('la utilidad recorta nombres y aplica el límite indicado', () => {
    assert.equal(
        validaciones.validarNombre('  Claro  ', 50, 'Nombre').valor,
        'Claro'
    );
    assert.equal(
        validaciones.validarNombre(' '.repeat(5), 50, 'Nombre').valido,
        false
    );
    assert.equal(
        validaciones.validarNombre('A'.repeat(51), 50, 'Nombre').valido,
        false
    );
    assert.equal(
        validaciones.validarNombre(123, 50, 'Nombre').valido,
        false
    );
});

test('la utilidad solo admite estados del catálogo', () => {
    assert.equal(validaciones.validarEstado(' activo ').valor, 'ACTIVO');
    assert.equal(validaciones.validarEstado('inactivo').valor, 'INACTIVO');

    for (const valor of ['BAJA', '', null, 1]) {
        assert.equal(validaciones.validarEstado(valor).valido, false);
    }
});

test('la utilidad conserva el RUC como texto de once dígitos', () => {
    assert.equal(validaciones.validarRuc(' 20467534026 ').valor, '20467534026');
    assert.equal(validaciones.validarRuc('').valor, null);
    assert.equal(validaciones.validarRuc(null).valor, null);

    for (const valor of ['123', '1234567890A', 20467534026, true]) {
        assert.equal(validaciones.validarRuc(valor).valido, false);
    }
});

test('la utilidad distingue cero, null y entradas inválidas de GB', () => {
    assert.equal(validaciones.validarGb(0).valor, 0);
    assert.equal(validaciones.validarGb(20.5).valor, 20.5);
    assert.equal(validaciones.validarGb(null).valor, null);

    for (const valor of ['0', '', -1, 1.234, 100000000, NaN, Infinity]) {
        assert.equal(
            validaciones.validarGb(valor).valido,
            false,
            String(valor)
        );
    }
});

test('registrar operador recorta datos y aplica valores por defecto', async () => {
    const app = cargarControlador('operadorController.js');
    const res = await ejecutar(app.controlador.registrarOperador, {
        body: { nombre: '  Entel  ', ruc: ' 20600040158 ' }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        ['Entel', '20600040158', 'ACTIVO']
    );
});

test('registrar operador permite RUC vacío como null', async () => {
    const app = cargarControlador('operadorController.js');
    const res = await ejecutar(app.controlador.registrarOperador, {
        body: { nombre: 'Operador sin RUC', ruc: '' }
    });

    assert.equal(res.statusCode, 201);
    assert.equal(app.consultas[0].parametros[1], null);
});

for (const body of [
    { nombre: '   ' },
    { nombre: 'A'.repeat(51) },
    { nombre: 'Claro', ruc: '123' },
    { nombre: 'Claro', ruc: 20467534026 },
    { nombre: 'Claro', estado: 'BAJA' }
]) {
    test(`registrar operador rechaza ${JSON.stringify(body)}`, async () => {
        const app = cargarControlador('operadorController.js');
        const res = await ejecutar(app.controlador.registrarOperador, { body });

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(app.consultas.length, 0);
    });
}

test('registrar operador traduce duplicados a conflicto 409', async () => {
    const app = cargarControlador('operadorController.js', {
        error: { code: 'ER_DUP_ENTRY' }
    });
    const res = await ejecutar(app.controlador.registrarOperador, {
        body: { nombre: 'Claro' }
    });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensaje, /registrado/i);
});

test('editar operador cambia solo los campos enviados', async () => {
    const app = cargarControlador('operadorController.js');
    const res = await ejecutar(app.controlador.editarOperador, {
        id: '7',
        body: { nombre: '  Nuevo nombre  ' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /SET nombre = \? WHERE id = \?/);
    assert.doesNotMatch(app.consultas[0].sql, /ruc =|estado =/);
    assert.deepEqual(app.consultas[0].parametros, ['Nuevo nombre', 7]);
});

test('editar operador permite borrar únicamente el RUC', async () => {
    const app = cargarControlador('operadorController.js');
    const res = await ejecutar(app.controlador.editarOperador, {
        id: '7',
        body: { ruc: null }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [null, 7]);
});

for (const caso of [
    { id: 'abc', body: { nombre: 'Válido' } },
    { id: '0', body: { nombre: 'Válido' } },
    { id: '7', body: {} },
    { id: '7', body: { desconocido: true } },
    { id: '7', body: { estado: 'SUSPENDIDO' } }
]) {
    test(`editar operador rechaza ID o cuerpo inválido ${JSON.stringify(caso)}`, async () => {
        const app = cargarControlador('operadorController.js');
        const res = await ejecutar(app.controlador.editarOperador, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('editar operador devuelve 404 cuando el ID válido no existe', async () => {
    const app = cargarControlador('operadorController.js', {
        affectedRows: 0
    });
    const res = await ejecutar(app.controlador.editarOperador, {
        id: '99', body: { estado: 'INACTIVO' }
    });

    assert.equal(res.statusCode, 404);
});

test('editar operador también traduce duplicados a 409', async () => {
    const app = cargarControlador('operadorController.js', {
        error: { code: 'ER_DUP_ENTRY' }
    });
    const res = await ejecutar(app.controlador.editarOperador, {
        id: '4', body: { nombre: 'Claro' }
    });

    assert.equal(res.statusCode, 409);
});

test('consultar operador rechaza un ID inválido antes de SQL', async () => {
    const app = cargarControlador('operadorController.js');
    const res = await ejecutar(app.controlador.obtenerOperadorPorId, {
        id: '../1'
    });

    assert.equal(res.statusCode, 400);
    assert.equal(app.consultas.length, 0);
});

test('registrar plan conserva cero GB en vez de convertirlo a null', async () => {
    const app = cargarControlador('planController.js');
    const res = await ejecutar(app.controlador.registrarPlan, {
        body: { nombre: '  Plan voz  ', gb: 0 }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        ['Plan voz', 0, 'ACTIVO']
    );
});

test('registrar plan distingue GB omitidos como null', async () => {
    const app = cargarControlador('planController.js');
    const res = await ejecutar(app.controlador.registrarPlan, {
        body: { nombre: 'Plan sin datos' }
    });

    assert.equal(res.statusCode, 201);
    assert.equal(app.consultas[0].parametros[1], null);
});

for (const body of [
    { nombre: '   ', gb: 20 },
    { nombre: 'A'.repeat(101), gb: 20 },
    { nombre: 'Plan', gb: '20' },
    { nombre: 'Plan', gb: -1 },
    { nombre: 'Plan', gb: 1.234 },
    { nombre: 'Plan', gb: 100000000 },
    { nombre: 'Plan', estado: 'BAJA' }
]) {
    test(`registrar plan rechaza ${JSON.stringify(body)}`, async () => {
        const app = cargarControlador('planController.js');
        const res = await ejecutar(app.controlador.registrarPlan, { body });

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(app.consultas.length, 0);
    });
}

test('editar plan conserva campos omitidos y acepta cero', async () => {
    const app = cargarControlador('planController.js');
    const res = await ejecutar(app.controlador.editarPlan, {
        id: '3', body: { gb: 0 }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /SET gb = \? WHERE id = \?/);
    assert.doesNotMatch(app.consultas[0].sql, /nombre =|estado =/);
    assert.deepEqual(app.consultas[0].parametros, [0, 3]);
});

test('editar plan permite borrar GB explícitamente con null', async () => {
    const app = cargarControlador('planController.js');
    const res = await ejecutar(app.controlador.editarPlan, {
        id: '3', body: { gb: null }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [null, 3]);
});

for (const caso of [
    { id: '-1', body: { gb: 20 } },
    { id: '3.5', body: { gb: 20 } },
    { id: '3', body: {} },
    { id: '3', body: { gb: '0' } },
    { id: '3', body: { estado: 'ELIMINADO' } }
]) {
    test(`editar plan rechaza ID o cuerpo inválido ${JSON.stringify(caso)}`, async () => {
        const app = cargarControlador('planController.js');
        const res = await ejecutar(app.controlador.editarPlan, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('editar plan devuelve 404 para un ID válido inexistente', async () => {
    const app = cargarControlador('planController.js', {
        affectedRows: 0
    });
    const res = await ejecutar(app.controlador.editarPlan, {
        id: '50', body: { estado: 'INACTIVO' }
    });

    assert.equal(res.statusCode, 404);
});

test('registrar y editar plan informan nombres duplicados con 409', async () => {
    const error = { code: 'ER_DUP_ENTRY' };
    const alta = cargarControlador('planController.js', { error });
    const edicion = cargarControlador('planController.js', { error });

    const resAlta = await ejecutar(alta.controlador.registrarPlan, {
        body: { nombre: 'Plan repetido', gb: 20 }
    });
    const resEdicion = await ejecutar(edicion.controlador.editarPlan, {
        id: '1', body: { nombre: 'Plan repetido' }
    });

    assert.equal(resAlta.statusCode, 409);
    assert.equal(resEdicion.statusCode, 409);
});
