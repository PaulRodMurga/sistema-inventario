const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllersDir = process.env.INVENTARIO_CONTROLLERS_DIR ||
    path.join(__dirname, '../src/controllers');
const validationPath = process.env.INVENTARIO_VALIDACIONES_PATH ||
    path.join(__dirname, '../src/utils/validacionCatalogos.js');
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

function cargarControlador(archivo, opciones = {}) {
    const ruta = path.join(controllersDir, archivo);
    const source = fs.readFileSync(ruta, 'utf8');
    const consultas = [];
    const pool = {
        async query(sql, parametros = []) {
            const consulta = {
                sql: sql.replace(/\s+/g, ' ').trim(),
                parametros: Array.from(parametros)
            };
            consultas.push(consulta);

            if (opciones.error) throw opciones.error;

            if (/^SELECT id FROM/.test(consulta.sql)) {
                return [opciones.existentes ?? []];
            }
            if (/^SELECT/.test(consulta.sql)) {
                return [opciones.filas ?? []];
            }
            if (/^INSERT/.test(consulta.sql)) {
                return [{ insertId: opciones.insertId ?? 40 }];
            }
            if (/^UPDATE/.test(consulta.sql)) {
                return [{
                    affectedRows: opciones.affectedRows ?? 1,
                    changedRows: opciones.changedRows ?? 1
                }];
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
        console: { error() { } },
        Set
    }, { filename: ruta });

    return { controlador: modulo.exports, consultas };
}

async function ejecutar(funcion, { body = {}, id = '1' } = {}) {
    const res = respuesta();
    await funcion({ body, params: { id } }, res);
    return res;
}

const contratoValido = (cambios = {}) => ({
    operador_id: 1,
    nro_contrato: 'CTR-PRUEBA-01',
    fecha_inicio: '2026-01-01',
    ...cambios
});

const contratoGamaValido = (cambios = {}) => ({
    contrato_id: 1,
    gama_id: 2,
    ...cambios
});

test('la utilidad normaliza textos opcionales sin inventar contenido', () => {
    assert.deepEqual(
        validaciones.validarTextoOpcional('  Texto  ', 20, 'Texto'),
        { valido: true, valor: 'Texto' }
    );
    assert.equal(
        validaciones.validarTextoOpcional('', 20, 'Texto').valor,
        null
    );
    assert.equal(
        validaciones.validarTextoOpcional(null, 20, 'Texto').valor,
        null
    );
    assert.equal(
        validaciones.validarTextoOpcional(5, 20, 'Texto').valido,
        false
    );
});

test('la utilidad valida fechas reales y conserva fechas de calendario', () => {
    assert.equal(
        validaciones.validarFecha('2028-02-29', {
            etiqueta: 'La fecha'
        }).valor,
        '2028-02-29'
    );
    assert.equal(
        validaciones.validarFecha(null, {
            etiqueta: 'La fecha',
            opcional: true
        }).valor,
        null
    );

    for (const valor of [
        '2026-02-29',
        '2026-13-01',
        '2026-01-32',
        '26-01-01',
        '0000-01-01',
        20260101
    ]) {
        assert.equal(
            validaciones.validarFecha(valor, {
                etiqueta: 'La fecha'
            }).valido,
            false,
            String(valor)
        );
    }
});

test('la utilidad distingue cero, null y decimales inválidos', () => {
    const base = {
        etiqueta: 'El importe',
        maximo: 99999999.99
    };

    assert.equal(
        validaciones.validarDecimalNoNegativo(0, base).valor,
        0
    );
    assert.equal(
        validaciones.validarDecimalNoNegativo(10.25, base).valor,
        10.25
    );
    assert.equal(
        validaciones.validarDecimalNoNegativo(null, {
            ...base,
            opcional: true
        }).valor,
        null
    );

    for (const valor of ['0', -1, 1.234, 100000000, NaN, Infinity]) {
        assert.equal(
            validaciones.validarDecimalNoNegativo(valor, base).valido,
            false,
            String(valor)
        );
    }
});

test('la utilidad exige enteros positivos JSON para campos del cuerpo', () => {
    assert.equal(
        validaciones.validarEnteroPositivo(12, 'El plazo').valor,
        12
    );

    for (const valor of [0, -1, 1.5, '12', null, true, 2147483648]) {
        assert.equal(
            validaciones.validarEnteroPositivo(valor, 'El plazo').valido,
            false,
            String(valor)
        );
    }
});

test('registrar contrato recorta campos y conserva el monto cero', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.registrarContrato, {
        body: contratoValido({
            nro_contrato: ' CTR-PRUEBA-01 ',
            descripcion: ' Contrato de prueba ',
            fecha_fin: '2028-12-31',
            monto_contractual: 0,
            moneda: ' usd ',
            estado: ' vigente '
        })
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        [
            1,
            'CTR-PRUEBA-01',
            'Contrato de prueba',
            '2026-01-01',
            '2028-12-31',
            0,
            'USD',
            'VIGENTE'
        ]
    );
});

test('registrar contrato aplica solo los valores opcionales por defecto', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.registrarContrato, {
        body: contratoValido()
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        [
            1,
            'CTR-PRUEBA-01',
            null,
            '2026-01-01',
            null,
            0,
            'PEN',
            'VIGENTE'
        ]
    );
});

for (const cambios of [
    { operador_id: 0 },
    { operador_id: '1' },
    { nro_contrato: '' },
    { nro_contrato: 123 },
    { nro_contrato: 'C'.repeat(51) },
    { descripcion: 123 },
    { descripcion: 'D'.repeat(201) },
    { fecha_inicio: '2026-02-30' },
    { fecha_inicio: null },
    { fecha_fin: '31/12/2028' },
    { fecha_fin: '2025-12-31' },
    { monto_contractual: '100' },
    { monto_contractual: -1 },
    { monto_contractual: 1.234 },
    { monto_contractual: 1000000000000 },
    { moneda: 'EUR' },
    { estado: 'ACTIVO' }
]) {
    test(`registrar contrato rechaza ${JSON.stringify(cambios)}`, async () => {
        const app = cargarControlador('contratoController.js');
        const res = await ejecutar(app.controlador.registrarContrato, {
            body: contratoValido(cambios)
        });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

for (const body of [null, [], 'texto']) {
    test(`registrar contrato rechaza cuerpo ${JSON.stringify(body)}`, async () => {
        const app = cargarControlador('contratoController.js');
        const res = await ejecutar(app.controlador.registrarContrato, { body });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('registrar contrato traduce duplicados a 409', async () => {
    const app = cargarControlador('contratoController.js', {
        error: { code: 'ER_DUP_ENTRY' }
    });
    const res = await ejecutar(app.controlador.registrarContrato, {
        body: contratoValido()
    });

    assert.equal(res.statusCode, 409);
});

test('registrar contrato traduce operador inexistente a 400', async () => {
    const app = cargarControlador('contratoController.js', {
        error: { code: 'ER_NO_REFERENCED_ROW_2' }
    });
    const res = await ejecutar(app.controlador.registrarContrato, {
        body: contratoValido()
    });

    assert.equal(res.statusCode, 400);
});

test('editar contrato actualiza solo la descripción enviada', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: { descripcion: ' Nueva descripción ' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(
        app.consultas[0].sql,
        /SET descripcion = \? WHERE id = \?$/
    );
    assert.deepEqual(
        app.consultas[0].parametros,
        ['Nueva descripción', 3]
    );
});

test('editar contrato permite borrar descripción y fecha final con null', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: { descripcion: null, fecha_fin: null }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [null, null, 3]);
    assert.doesNotMatch(app.consultas[0].sql, /AND fecha_inicio/);
});

test('editar contrato conserva un monto cero en vez de reemplazarlo', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: { monto_contractual: 0 }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [0, 3]);
});

test('editar ambas fechas rechaza un intervalo invertido sin consultar', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: {
            fecha_inicio: '2028-01-01',
            fecha_fin: '2027-12-31'
        }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(app.consultas.length, 0);
});

test('editar solo fecha inicial la compara atómicamente con la fecha final actual', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: { fecha_inicio: '2027-01-01' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(
        app.consultas[0].sql,
        /fecha_fin IS NULL OR fecha_fin >= \?/
    );
    assert.deepEqual(
        app.consultas[0].parametros,
        ['2027-01-01', 3, '2027-01-01']
    );
});

test('editar solo fecha final la compara atómicamente con la fecha inicial actual', async () => {
    const app = cargarControlador('contratoController.js');
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: { fecha_fin: '2029-01-01' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /AND fecha_inicio <= \?/);
    assert.deepEqual(
        app.consultas[0].parametros,
        ['2029-01-01', 3, '2029-01-01']
    );
});

test('editar una fecha incompatible distingue validación de registro inexistente', async () => {
    const app = cargarControlador('contratoController.js', {
        affectedRows: 0,
        existentes: [{ id: 3 }]
    });
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '3',
        body: { fecha_fin: '2025-01-01' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(app.consultas.length, 2);
    assert.match(app.consultas[1].sql, /^SELECT id/);
});

for (const caso of [
    { id: '0', body: { estado: 'VIGENTE' } },
    { id: 'abc', body: { estado: 'VIGENTE' } },
    { id: '3', body: {} },
    { id: '3', body: { desconocido: true } },
    { id: '3', body: { operador_id: '1' } },
    { id: '3', body: { fecha_inicio: '2026-02-30' } },
    { id: '3', body: { monto_contractual: null } },
    { id: '3', body: { moneda: 'SOLES' } },
    { id: '3', body: { estado: 'ACTIVO' } }
]) {
    test(`editar contrato rechaza ${JSON.stringify(caso)}`, async () => {
        const app = cargarControlador('contratoController.js');
        const res = await ejecutar(app.controlador.editarContrato, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('editar contrato devuelve 404 cuando no existe', async () => {
    const app = cargarControlador('contratoController.js', {
        affectedRows: 0
    });
    const res = await ejecutar(app.controlador.editarContrato, {
        id: '99',
        body: { estado: 'VENCIDO' }
    });

    assert.equal(res.statusCode, 404);
});

for (const error of ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2']) {
    test(`editar contrato controla ${error}`, async () => {
        const app = cargarControlador('contratoController.js', {
            error: { code: error }
        });
        const res = await ejecutar(app.controlador.editarContrato, {
            id: '3',
            body: {
                operador_id: 2,
                nro_contrato: 'CTR-EDITADO'
            }
        });

        assert.equal(
            res.statusCode,
            error === 'ER_DUP_ENTRY' ? 409 : 400
        );
    });
}

test('obtener contrato valida y convierte el ID', async () => {
    const app = cargarControlador('contratoController.js', {
        filas: [{ id: 3 }]
    });
    const res = await ejecutar(app.controlador.obtenerContrato, {
        id: '3'
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [3]);
});

for (const id of ['abc', '0', '1.5', '2147483648']) {
    test(`obtener contrato rechaza ID ${id} antes del SQL`, async () => {
        const app = cargarControlador('contratoController.js');
        const res = await ejecutar(app.controlador.obtenerContrato, { id });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('registrar gama recorta campos y aplica estado por defecto', async () => {
    const app = cargarControlador('gamaController.js');
    const res = await ejecutar(app.controlador.registrarGama, {
        body: {
            codigo: ' GAM05 ',
            descripcion: ' Gama de prueba '
        }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        ['GAM05', 'Gama de prueba', 'ACTIVO']
    );
});

for (const body of [
    { codigo: '', descripcion: 'Gama' },
    { codigo: 'G'.repeat(11), descripcion: 'Gama' },
    { codigo: 5, descripcion: 'Gama' },
    { codigo: 'GAM05', descripcion: '' },
    { codigo: 'GAM05', descripcion: 'D'.repeat(101) },
    { codigo: 'GAM05', descripcion: 5 },
    { codigo: 'GAM05', descripcion: 'Gama', estado: 'BAJA' },
    null,
    []
]) {
    test(`registrar gama rechaza ${JSON.stringify(body)}`, async () => {
        const app = cargarControlador('gamaController.js');
        const res = await ejecutar(app.controlador.registrarGama, { body });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('registrar gama informa código duplicado con 409', async () => {
    const app = cargarControlador('gamaController.js', {
        error: { code: 'ER_DUP_ENTRY' }
    });
    const res = await ejecutar(app.controlador.registrarGama, {
        body: { codigo: 'GAM05', descripcion: 'Gama' }
    });

    assert.equal(res.statusCode, 409);
});

test('editar gama cambia únicamente los campos enviados', async () => {
    const app = cargarControlador('gamaController.js');
    const res = await ejecutar(app.controlador.editarGama, {
        id: '4',
        body: { descripcion: ' Módem 5G ' }
    });

    assert.equal(res.statusCode, 200);
    assert.match(
        app.consultas[0].sql,
        /SET descripcion = \? WHERE id = \?$/
    );
    assert.deepEqual(app.consultas[0].parametros, ['Módem 5G', 4]);
});

for (const caso of [
    { id: '0', body: { estado: 'ACTIVO' } },
    { id: '4', body: {} },
    { id: '4', body: { desconocido: true } },
    { id: '4', body: { codigo: '' } },
    { id: '4', body: { descripcion: null } },
    { id: '4', body: { estado: 'VIGENTE' } }
]) {
    test(`editar gama rechaza ${JSON.stringify(caso)}`, async () => {
        const app = cargarControlador('gamaController.js');
        const res = await ejecutar(app.controlador.editarGama, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('editar gama mantiene 404 y conflicto 409', async () => {
    const ausente = cargarControlador('gamaController.js', {
        affectedRows: 0
    });
    const resAusente = await ejecutar(ausente.controlador.editarGama, {
        id: '99',
        body: { estado: 'INACTIVO' }
    });
    assert.equal(resAusente.statusCode, 404);

    const duplicada = cargarControlador('gamaController.js', {
        error: { code: 'ER_DUP_ENTRY' }
    });
    const resDuplicada = await ejecutar(duplicada.controlador.editarGama, {
        id: '4',
        body: { codigo: 'GAM01' }
    });
    assert.equal(resDuplicada.statusCode, 409);
});

test('registrar contrato-gama conserva ceros y valores opcionales', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.registrarContratoGama, {
        body: contratoGamaValido({
            costo_alquiler_mensual: 0,
            costo_servicio_mensual: 0,
            meses_contrato: 24,
            mes_renovacion_equipo: 12,
            precio_prepago: 0,
            precio_venta_18m: null
        })
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        [1, 2, 0, 0, 24, 12, 0, null]
    );
});

test('registrar contrato-gama aplica sus valores por defecto', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.registrarContratoGama, {
        body: contratoGamaValido()
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(
        app.consultas[0].parametros,
        [1, 2, 0, 0, 36, 18, null, null]
    );
});

for (const cambios of [
    { contrato_id: 0 },
    { contrato_id: '1' },
    { gama_id: -1 },
    { gama_id: 1.5 },
    { costo_alquiler_mensual: '0' },
    { costo_alquiler_mensual: -1 },
    { costo_servicio_mensual: 1.234 },
    { meses_contrato: 0 },
    { meses_contrato: '36' },
    { mes_renovacion_equipo: 0 },
    { meses_contrato: 12, mes_renovacion_equipo: 18 },
    { precio_prepago: '100' },
    { precio_prepago: -1 },
    { precio_venta_18m: 1.234 }
]) {
    test(`registrar contrato-gama rechaza ${JSON.stringify(cambios)}`, async () => {
        const app = cargarControlador('contratoGamaController.js');
        const res = await ejecutar(app.controlador.registrarContratoGama, {
            body: contratoGamaValido(cambios)
        });

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

for (const body of [null, [], 'texto']) {
    test(`registrar contrato-gama rechaza cuerpo ${JSON.stringify(body)}`, async () => {
        const app = cargarControlador('contratoGamaController.js');
        const res = await ejecutar(
            app.controlador.registrarContratoGama,
            { body }
        );

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

for (const error of ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2']) {
    test(`registrar contrato-gama controla ${error}`, async () => {
        const app = cargarControlador('contratoGamaController.js', {
            error: { code: error }
        });
        const res = await ejecutar(
            app.controlador.registrarContratoGama,
            { body: contratoGamaValido() }
        );

        assert.equal(
            res.statusCode,
            error === 'ER_DUP_ENTRY' ? 409 : 400
        );
    });
}

test('editar contrato-gama conserva campos omitidos y un costo cero', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '7',
        body: { costo_alquiler_mensual: 0 }
    });

    assert.equal(res.statusCode, 200);
    assert.match(
        app.consultas[0].sql,
        /SET costo_alquiler_mensual = \? WHERE id = \?$/
    );
    assert.deepEqual(app.consultas[0].parametros, [0, 7]);
});

test('editar contrato-gama permite borrar un precio opcional', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '7',
        body: { precio_prepago: null }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(app.consultas[0].parametros, [null, 7]);
});

test('editar solo la duración la compara con la renovación actual', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '7',
        body: { meses_contrato: 24 }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /mes_renovacion_equipo <= \?/);
    assert.deepEqual(app.consultas[0].parametros, [24, 7, 24]);
});

test('editar solo la renovación la compara con la duración actual', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '7',
        body: { mes_renovacion_equipo: 20 }
    });

    assert.equal(res.statusCode, 200);
    assert.match(app.consultas[0].sql, /\? <= meses_contrato/);
    assert.deepEqual(app.consultas[0].parametros, [20, 7, 20]);
});

test('editar plazos incompatibles rechaza antes de SQL', async () => {
    const app = cargarControlador('contratoGamaController.js');
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '7',
        body: {
            meses_contrato: 12,
            mes_renovacion_equipo: 18
        }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(app.consultas.length, 0);
});

test('editar un plazo incompatible con el actual devuelve 400', async () => {
    const app = cargarControlador('contratoGamaController.js', {
        affectedRows: 0,
        existentes: [{ id: 7 }]
    });
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '7',
        body: { meses_contrato: 12 }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(app.consultas.length, 2);
});

for (const caso of [
    { id: '0', body: { costo_alquiler_mensual: 10 } },
    { id: 'abc', body: { costo_alquiler_mensual: 10 } },
    { id: '7', body: {} },
    { id: '7', body: { desconocido: true } },
    { id: '7', body: { contrato_id: '1' } },
    { id: '7', body: { gama_id: null } },
    { id: '7', body: { costo_servicio_mensual: null } },
    { id: '7', body: { meses_contrato: 1.5 } },
    { id: '7', body: { precio_venta_18m: '100' } }
]) {
    test(`editar contrato-gama rechaza ${JSON.stringify(caso)}`, async () => {
        const app = cargarControlador('contratoGamaController.js');
        const res = await ejecutar(app.controlador.editarContratoGama, caso);

        assert.equal(res.statusCode, 400);
        assert.equal(app.consultas.length, 0);
    });
}

test('editar contrato-gama devuelve 404 cuando no existe', async () => {
    const app = cargarControlador('contratoGamaController.js', {
        affectedRows: 0
    });
    const res = await ejecutar(app.controlador.editarContratoGama, {
        id: '99',
        body: { costo_servicio_mensual: 15 }
    });

    assert.equal(res.statusCode, 404);
});

for (const error of ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2']) {
    test(`editar contrato-gama controla ${error}`, async () => {
        const app = cargarControlador('contratoGamaController.js', {
            error: { code: error }
        });
        const res = await ejecutar(app.controlador.editarContratoGama, {
            id: '7',
            body: { contrato_id: 2 }
        });

        assert.equal(
            res.statusCode,
            error === 'ER_DUP_ENTRY' ? 409 : 400
        );
    });
}
