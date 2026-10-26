const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const archivo = path.join(process.env.INVENTARIO_CONTROLLERS_DIR || path.join(__dirname, '../src/controllers'), 'equipoController.js');
const source = fs.readFileSync(archivo, 'utf8');

function entorno(opciones = {}) {
    const consultas = [];
    const pool = {
        async query(sql, parametros = []) {
            consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros: [...parametros] });
            if (opciones.error) throw opciones.error;
            if (/^SELECT\s+cg\.id,/.test(sql.trim())) return [[{ id: 3, contrato_id: 1, nro_contrato: 'CONTRATO-TEST' }]];
            if (/^INSERT INTO equipo/.test(sql.trim())) return [{ insertId: 140 }];
            if (/^UPDATE equipo/.test(sql.trim())) return [{ affectedRows: 1 }];
            throw new Error('SQL inesperado');
        }
    };
    const modulo = { exports: {} };
    vm.runInNewContext(source, {
        module: modulo, exports: modulo.exports,
        require(nombre) {
            if (nombre === '../config/database') return pool;
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
        console: { error() { } }
    }, { filename: archivo });
    const respuesta = () => ({
        statusCode: 200,
        status(codigo) { this.statusCode = codigo; return this; },
        json(cuerpo) { this.body = JSON.parse(JSON.stringify(cuerpo)); return this; }
    });
    return {
        consultas,
        async registrar(body = {}) {
            const res = respuesta();
            await modulo.exports.registrarEquipo({
                body: {
                    tipo: 'CELULAR', marca: 'Samsung', modelo: 'Galaxy de prueba', contrato_gama_id: 3, ...body
                }
            }, res);
            return res;
        },
        async editar(body = {}) {
            const res = respuesta();
            await modulo.exports.editarEquipo({
                params: { id: '140' }, body: {
                    tipo: 'CELULAR', marca: 'Samsung', modelo: 'Galaxy de prueba', contrato_gama_id: 3, ...body
                }
            }, res);
            return res;
        }
    };
}

for (const tipo of ['CELULAR', 'MODEM']) {
    test(`Registro admite ${tipo} y fija LIBRE en SQL`, async () => {
        const app = entorno();
        const res = await app.registrar({ tipo, estado_actual: 'BAJA' });
        assert.equal(res.statusCode, 201);
        assert.equal(app.consultas.length, 2);
        assert.match(app.consultas[1].sql, /estado_actual/);
        assert.match(app.consultas[1].sql, /VALUES \(\?, \?, \?, \?, \?, \?, 'LIBRE', \?/);
        assert.equal(app.consultas[1].parametros[0], tipo);
        assert.equal(app.consultas[1].parametros.includes('BAJA'), false);
    });
    test(`Edición admite ${tipo} sin escribir estado_actual`, async () => {
        const app = entorno();
        const res = await app.editar({ tipo, estado_actual: 'LIBRE' });
        assert.equal(res.statusCode, 200);
        assert.doesNotMatch(app.consultas[0].sql, /estado_actual/);
        assert.equal(app.consultas[0].parametros.includes('LIBRE'), false);
    });
}

for (const tipo of ['TABLET', 'ROUTER', 'LAPTOP', 'PC', 'MONITOR', ' celular ', '', null, 1, true]) {
    test(`Registro rechaza el tipo no soportado ${String(tipo)}`, async () => {
        const app = entorno();
        const res = await app.registrar({ tipo });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(app.consultas.length, 0);
    });
    test(`Edición rechaza el tipo no soportado ${String(tipo)}`, async () => {
        const app = entorno();
        const res = await app.editar({ tipo });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(app.consultas.length, 0);
    });
}

test('Los estados de negocio no forman parte del contrato de alta o edición general', () => {
    const registrar = source.slice(source.indexOf('const registrarEquipo'), source.indexOf('// ==========================================\n// EDITAR EQUIPO'));
    const editar = source.slice(source.indexOf('const editarEquipo'), source.indexOf('module.exports'));
    assert.match(source, /VALUES \(\?, \?, \?, \?, \?, \?, 'LIBRE', \?/);
    assert.doesNotMatch(registrar.slice(0, registrar.indexOf('const resultado = await insertarEquipoPrincipal')), /\bestado_actual\b/);
    assert.doesNotMatch(editar.slice(0, editar.indexOf('/*')), /\bestado_actual\b/);
    assert.match(editar, /No modificamos estado_actual/);
});
