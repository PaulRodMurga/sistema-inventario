const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Carga el controlador real, pero nunca importa database.js ni abre MySQL.
const controllerPath = path.join(__dirname, '../src/controllers/equipoController.js');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');

const equipoInicial = Object.freeze({
    id: 101,
    tipo: 'CELULAR',
    marca: 'Marca de prueba',
    modelo: 'Modelo inicial',
    imei: '356789012345678',
    serie: 'SERIE-PRUEBA-101',
    contrato_gama_id: 3,
    estado_actual: 'ASIGNADO',
    fecha_inicio_alquiler: '2026-01-01',
    fecha_fin_alquiler: '2028-12-31',
    observaciones: 'Conservar esta observacion'
});

const camposOpcionales = [
    'imei',
    'serie',
    'fecha_inicio_alquiler',
    'fecha_fin_alquiler',
    'observaciones'
];

function datosObligatorios() {
    return {
        tipo: 'CELULAR',
        marca: 'Marca editada',
        modelo: 'Modelo editado',
        contrato_gama_id: 3
    };
}

function datosDelFormularioActual() {
    return {
        ...datosObligatorios(),
        imei: equipoInicial.imei,
        serie: equipoInicial.serie,
        estado_actual: 'ASIGNADO'
    };
}

function prepararControlador({ resultado, error } = {}) {
    const consultas = [];
    const equipo = { ...equipoInicial };
    const poolSimulado = {
        async query(sql, parametros) {
            const valores = Array.from(parametros);
            consultas.push({ sql, valores });

            if (error) throw error;
            if (resultado) return [resultado];

            // Interpreta solo el UPDATE parametrizado de esta prueba.
            // Si cambia su estructura, falla en lugar de simular un exito.
            const coincidencia = sql.trim().match(
                /^UPDATE\s+equipo\s+SET\s+([\s\S]+?)\s+WHERE\s+id\s*=\s*\?$/i
            );
            assert.ok(coincidencia, 'Se esperaba un UPDATE parametrizado por ID');

            const columnas = coincidencia[1].split(',').map((asignacion) => {
                const columna = asignacion.trim().match(/^([a-z_]+)\s*=\s*\?$/i);
                assert.ok(columna, 'No debe interpolarse contenido del usuario en SQL');
                assert.ok(Object.hasOwn(equipoInicial, columna[1]));
                return columna[1];
            });
            const tieneTipoEnCondicion = /AND\\s+tipo\\s*=\\s*\\?$/i.test(sql.trim());
            assert.equal(valores.length, columnas.length + (tieneTipoEnCondicion ? 2 : 1));
            assert.equal(new Set(columnas).size, columnas.length);

            const idObjetivo = valores[columnas.length];
            const tipoObjetivo = tieneTipoEnCondicion ? valores[columnas.length + 1] : null;
            if (String(idObjetivo) !== String(equipo.id) ||
                (tipoObjetivo !== null && tipoObjetivo !== equipo.tipo)) {
                return [{ affectedRows: 0 }];
            }

            columnas.forEach((columna, indice) => {
                equipo[columna] = valores[indice];
            });
            return [{ affectedRows: 1 }];
        }
    };

    const modulo = { exports: {} };
    vm.runInNewContext(controllerSource, {
        module: modulo,
        exports: modulo.exports,
        require(nombre) {
            if (nombre === '../config/database') return poolSimulado;
            if (nombre === '../config/tiposEquipo') {
                return {
                    TIPOS: ['CELULAR', 'MODEM'],
                    TIPOS_EQUIPO: new Set(['CELULAR', 'MODEM']),
                    normalizarEspecificaciones() {
                        return { ok: true, valor: {} };
                    }
                };
            }
            if (nombre === '../utils/perifericosEquipo') {
                return {
                    normalizarPerifericos() {
                        return { ok: true, valor: [] };
                    },
                    async registrarPerifericos() {
                        return [];
                    }
                };
            }
            throw new Error(`Módulo inesperado: ${nombre}`);
        },
        console: { error() {} }
    }, { filename: controllerPath });

    return {
        consultas,
        equipo,
        async editar(body, id = '101') {
            const res = {
                statusCode: 200,
                body: undefined,
                status(codigo) {
                    this.statusCode = codigo;
                    return this;
                },
                json(datos) {
                    this.body = datos;
                    return this;
                }
            };
            await modulo.exports.editarEquipo({ params: { id }, body }, res);
            return res;
        }
    };
}

test('el formulario actual conserva fechas y observaciones omitidas', async () => {
    const caso = prepararControlador();
    const res = await caso.editar(datosDelFormularioActual());

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(caso.equipo.marca, 'Marca editada');
    assert.equal(caso.equipo.modelo, 'Modelo editado');
    for (const campo of camposOpcionales) {
        assert.equal(caso.equipo[campo], equipoInicial[campo], campo);
    }
    assert.equal(caso.consultas.length, 1, 'No debe hacer un SELECT previo');
    assert.doesNotMatch(caso.consultas[0].sql, /fecha_inicio_alquiler|fecha_fin_alquiler|observaciones/);
});

test('tambien conserva IMEI y serie cuando el cliente los omite', async () => {
    const caso = prepararControlador();
    const res = await caso.editar(datosObligatorios());

    assert.equal(res.statusCode, 200);
    for (const campo of camposOpcionales) {
        assert.equal(caso.equipo[campo], equipoInicial[campo], campo);
        assert.doesNotMatch(caso.consultas[0].sql, new RegExp(`\\b${campo}\\b`));
    }
});

test('permite editar solo una fecha opcional y conserva las restantes', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({
        ...datosObligatorios(),
        fecha_fin_alquiler: '2029-01-31'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.fecha_fin_alquiler, '2029-01-31');
    assert.equal(caso.equipo.fecha_inicio_alquiler, equipoInicial.fecha_inicio_alquiler);
    assert.equal(caso.equipo.observaciones, equipoInicial.observaciones);
});

test('permite editar observaciones sin alterar las fechas', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({ ...datosObligatorios(), observaciones: 'Nota nueva' });

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.observaciones, 'Nota nueva');
    assert.equal(caso.equipo.fecha_inicio_alquiler, equipoInicial.fecha_inicio_alquiler);
    assert.equal(caso.equipo.fecha_fin_alquiler, equipoInicial.fecha_fin_alquiler);
});

test('un null explicito vacia los campos opcionales enviados', async () => {
    const caso = prepararControlador();
    const body = datosObligatorios();
    camposOpcionales.forEach((campo) => { body[campo] = null; });
    const res = await caso.editar(body);

    assert.equal(res.statusCode, 200);
    camposOpcionales.forEach((campo) => assert.equal(caso.equipo[campo], null));
});

test('conserva la compatibilidad: cadena vacia explicita se guarda como null', async () => {
    const caso = prepararControlador();
    const body = datosObligatorios();
    camposOpcionales.forEach((campo) => { body[campo] = ''; });
    const res = await caso.editar(body);

    assert.equal(res.statusCode, 200);
    camposOpcionales.forEach((campo) => assert.equal(caso.equipo[campo], null));
});

test('vaciar una sola observacion no vacia los demas campos opcionales', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({ ...datosObligatorios(), observaciones: null });

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.observaciones, null);
    assert.equal(caso.equipo.fecha_inicio_alquiler, equipoInicial.fecha_inicio_alquiler);
    assert.equal(caso.equipo.fecha_fin_alquiler, equipoInicial.fecha_fin_alquiler);
    assert.equal(caso.equipo.imei, equipoInicial.imei);
});

test('no cambia estado_actual ni acepta columnas arbitrarias', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({
        ...datosDelFormularioActual(),
        estado_actual: 'BAJA',
        id: 999,
        columna_inventada: 'valor',
        'observaciones = NULL WHERE id > 0 --': 'valor'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.estado_actual, 'ASIGNADO');
    assert.equal(caso.equipo.id, 101);
    assert.doesNotMatch(caso.consultas[0].sql, /estado_actual|columna_inventada|--/);
});

test('los textos se envian como parametros, no se interpolan en SQL', async () => {
    const caso = prepararControlador();
    const texto = "Nota O'Brien, observaciones = NULL; -- texto de prueba";
    const res = await caso.editar({ ...datosObligatorios(), observaciones: texto });

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.observaciones, texto);
    assert.equal(caso.consultas[0].sql.includes(texto), false);
    assert.ok(caso.consultas[0].valores.includes(texto));
    assert.equal(caso.consultas[0].valores.at(-1), '101');
});

test('undefined se trata como omitido, sin pasar undefined a SQL', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({ ...datosObligatorios(), observaciones: undefined });

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.observaciones, equipoInicial.observaciones);
    assert.equal(caso.consultas[0].valores.includes(undefined), false);
});

test('no toma campos opcionales heredados del prototipo', async () => {
    const caso = prepararControlador();
    const body = Object.assign(Object.create({ observaciones: 'No usar' }), datosObligatorios());
    const res = await caso.editar(body);

    assert.equal(res.statusCode, 200);
    assert.equal(caso.equipo.observaciones, equipoInicial.observaciones);
});

test('un equipo inexistente mantiene la respuesta 404', async () => {
    const caso = prepararControlador();
    const res = await caso.editar(datosDelFormularioActual(), '999');

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.mensaje, 'Equipo no encontrado');
    assert.deepEqual(caso.equipo, equipoInicial);
});

test('campos obligatorios incompletos se rechazan sin consultar SQL', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({ tipo: 'CELULAR', marca: 'Marca' });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(caso.consultas.length, 0);
});

test('el tipo no admitido mantiene la respuesta 400', async () => {
    const caso = prepararControlador();
    const res = await caso.editar({ ...datosObligatorios(), tipo: 'LAPTOP' });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(caso.consultas.length, 0);
});

test('IMEI o serie duplicados mantienen la respuesta 409', async () => {
    const caso = prepararControlador({ error: { code: 'ER_DUP_ENTRY' } });
    const res = await caso.editar(datosDelFormularioActual());

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.mensaje, /IMEI, la serie o el código patrimonial/);
    assert.deepEqual(caso.equipo, equipoInicial);
});

test('contrato/gama inexistente mantiene la respuesta 400', async () => {
    const caso = prepararControlador({ error: { code: 'ER_NO_REFERENCED_ROW_2' } });
    const res = await caso.editar(datosDelFormularioActual());

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.mensaje, /contrato\/gama/);
});

test('un fallo inesperado mantiene la respuesta 500', async () => {
    const caso = prepararControlador({ error: new Error('Fallo simulado') });
    const res = await caso.editar(datosDelFormularioActual());

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.mensaje, 'Error al actualizar el equipo');
});
