const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Linter } = require('eslint');

const archivo = path.join(process.env.INVENTARIO_PAGES_DIR || path.join(__dirname, '../src/pages'), 'EquiposPage.jsx');
const source = fs.readFileSync(archivo, 'utf8');
const linter = new Linter();
const errores = linter.verify(source, [{
    files: ['**/*.jsx'], languageOptions: {
        ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }
    }
}], { filename: 'EquiposPage.jsx' });
assert.equal(errores.filter((e) => e.fatal).length, 0, 'JSX válido');
const ast = linter.getSourceCode().ast;
const componente = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'EquiposPage');
const retorno = componente.body.body.find((n) => n.type === 'ReturnStatement');

function buscar(nodo, predicado, encontrados = []) {
    if (!nodo || typeof nodo !== 'object') return encontrados;
    if (predicado(nodo)) encontrados.push(nodo);
    for (const [clave, valor] of Object.entries(nodo)) {
        if (['parent', 'tokens', 'comments', 'loc', 'range'].includes(clave)) continue;
        if (Array.isArray(valor)) valor.forEach((hijo) => buscar(hijo, predicado, encontrados));
        else if (valor && typeof valor === 'object') buscar(valor, predicado, encontrados);
    }
    return encontrados;
}
function atributo(elemento, nombre) {
    return elemento.openingElement.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === nombre)?.value;
}
function porId(id) {
    const elementos = buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'id')?.value === id);
    assert.equal(elementos.length, 1, `Un único control con id ${id}`);
    return elementos[0];
}

test('Tipo ofrece exactamente vacío, CELULAR y MODEM', () => {
    const tipo = porId('tipo');
    assert.equal(tipo.openingElement.name.name, 'select');
    const valores = buscar(tipo, (n) => n.type === 'JSXElement' && n.openingElement.name.name === 'option')
        .map((opcion) => atributo(opcion, 'value')?.value);
    assert.deepEqual(valores, ['', 'CELULAR', 'MODEM']);
});

test('No presenta un editor de estado ni tipos ajenos al esquema', () => {
    assert.equal(buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'id')?.value === 'estado_actual').length, 0);
    assert.doesNotMatch(source, /formulario\.estado_actual|value="(?:TABLET|ROUTER|LAPTOP|PC|MONITOR)"/);
    assert.doesNotMatch(source, /Estado inicial/);
    assert.match(source, /El equipo nuevo se registrará como Libre/);
    assert.match(source, /cambia desde asignaciones, devoluciones o movimientos/);
});

test('Tipo, marca y contrato son campos directos de la cuadrícula, sin formularios anidados', () => {
    const grids = buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'className')?.value === 'formulario-grid');
    assert.equal(grids.length, 1);
    const campos = grids[0].children.filter((n) => n.type === 'JSXElement');
    assert.equal(campos.length, 6);
    for (const campo of campos) {
        assert.equal(atributo(campo, 'className')?.value?.includes('campo-formulario'), true);
        const anidados = campo.children.filter((n) => n.type === 'JSXElement' &&
            atributo(n, 'className')?.value?.includes('campo-formulario'));
        assert.equal(anidados.length, 0);
    }
    for (const id of ['tipo', 'marca', 'modelo', 'imei', 'serie', 'contrato_gama_id']) porId(id);
});

function montar() {
    const slots = [];
    const envios = [];
    let indice = 0;
    function useState(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { valor: inicial };
        return [slots[posicion].valor, (valor) => {
            slots[posicion].valor = typeof valor === 'function' ? valor(slots[posicion].valor) : valor;
        }];
    }
    const render = vm.runInNewContext(`${source.slice(componente.range[0], retorno.range[0])}
        return { abrirRegistro, abrirEdicion, actualizarFormulario, guardarEquipo,
            estado: { formulario, equipoEditandoId, modalAbierto, error } };
    }
    EquiposPage;`, {
        useState, useEffect() { }, console: { error() { } }, setTimeout() { },
        listarEquipos: async () => [], listarContratoGamas: async () => [],
        obtenerEquipoPorId: async () => ({
            id: 5, tipo: 'MODEM', marca: 'Marca', modelo: 'Modelo',
            imei: null, serie: 'SER-5', contrato_gama_id: 2, estado_actual: 'BAJA'
        }),
        registrarEquipo: async (datos) => { envios.push({ metodo: 'POST', datos: JSON.parse(JSON.stringify(datos)) }); },
        actualizarEquipo: async (id, datos) => { envios.push({ metodo: 'PUT', id, datos: JSON.parse(JSON.stringify(datos)) }); }
    });
    const vista = () => { indice = 0; return render(); };
    return { vista, envios, estado: () => JSON.parse(JSON.stringify(vista().estado)) };
}
const cambiar = (fn, name, value) => fn({ target: { name, value } });
const submit = () => ({ preventDefault() { } });
async function completar(app, tipo = 'CELULAR') {
    app.vista().abrirRegistro();
    for (const [name, value] of Object.entries({
        tipo, marca: ' Samsung ', modelo: ' A55 ', imei: ' 123 ',
        serie: ' SER ', contrato_gama_id: '3'
    })) cambiar(app.vista().actualizarFormulario, name, value);
}

for (const tipo of ['CELULAR', 'MODEM']) {
    test(`Alta envía ${tipo} sin estado_actual`, async () => {
        const app = montar(); await completar(app, tipo);
        await app.vista().guardarEquipo(submit());
        assert.equal(app.envios.length, 1);
        assert.equal(app.envios[0].datos.tipo, tipo);
        assert.equal(app.envios[0].datos.estado_actual, undefined);
        assert.deepEqual(Object.keys(app.envios[0].datos).sort(),
            ['contrato_gama_id', 'imei', 'marca', 'modelo', 'serie', 'tipo'].sort());
    });
}

test('Edición carga un equipo no libre sin reenviar ni permitir cambiar su estado', async () => {
    const app = montar(); await app.vista().abrirEdicion(5);
    assert.equal(app.estado().formulario.tipo, 'MODEM');
    assert.equal(app.estado().formulario.estado_actual, undefined);
    await app.vista().guardarEquipo(submit());
    assert.equal(app.envios[0].metodo, 'PUT');
    assert.equal(app.envios[0].id, 5);
    assert.equal(app.envios[0].datos.estado_actual, undefined);
});

for (const tipo of ['TABLET', 'ROUTER', 'LAPTOP', 'PC', 'MONITOR']) {
    test(`El tipo manipulado ${tipo} no se envía porque el formulario lo rechaza`, async () => {
        const app = montar(); await completar(app, tipo);
        await app.vista().guardarEquipo(submit());
        assert.equal(app.envios.length, 0);
        assert.equal(app.estado().error, 'Selecciona un tipo de equipo válido');
    });
}

test('La tabla y el detalle conservan el estado como información de solo lectura', () => {
    assert.match(source, /equipo\.estado_actual/);
    assert.match(source, /equipoSeleccionado\.estado_actual/);
});
