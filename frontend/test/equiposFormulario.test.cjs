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

test('Tipo de equipo se alimenta del catálogo dinámico del backend', () => {
    const tipo = porId('tipo');
    assert.equal(tipo.openingElement.name.name, 'select');
    const opciones = buscar(tipo, (n) =>
        n.type === 'JSXElement' && n.openingElement.name.name === 'option'
    );
    assert.equal(opciones.length, 2);
    assert.equal(atributo(opciones[0], 'value')?.value, '');
    assert.match(source, /listarTiposEquipo\(\)/);
    assert.match(source, /tiposEquipo\.map\(\(tipo\) =>/);
    assert.match(source, /value=\{tipo\.codigo\}/);
});

test('No presenta un editor de estado ni tipos ajenos al esquema', () => {
    assert.equal(buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'id')?.value === 'estado_actual').length, 0);
    assert.doesNotMatch(source, /formulario\.estado_actual|value="(?:TABLET|ROUTER|LAPTOP|PC|MONITOR)"/);
    assert.doesNotMatch(source, /Estado inicial/);
    assert.match(source, /El equipo nuevo se registrará como Libre/);
    assert.match(source, /cambia desde asignaciones, devoluciones o movimientos/);
});

test('Los campos base son directos de la cuadrícula y los datos técnicos van en su sección', () => {
    const grids = buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'className')?.value === 'formulario-grid');
    assert.equal(grids.length, 1);
    const campos = grids[0].children.filter((n) => n.type === 'JSXElement');
    assert.equal(campos.length, 5);
    for (const campo of campos) {
        assert.equal(atributo(campo, 'className')?.value?.includes('campo-formulario'), true);
        const anidados = campo.children.filter((n) => n.type === 'JSXElement' &&
            atributo(n, 'className')?.value?.includes('campo-formulario'));
        assert.equal(anidados.length, 0);
    }
    for (const id of ['tipo', 'marca', 'modelo', 'contrato_id', 'contrato_gama_id']) porId(id);
    assert.match(source, /Identificación y especificaciones de/);
    assert.match(source, /id="codigo_patrimonial"/);
    assert.match(source, /id="serie"/);
    assert.match(source, /tipoSeleccionado\.acepta_imei/);
});

function montar() {
    const slots = [];
    const envios = [];
    let indice = 0;
    const efectosEjecutados = new Set();

    const tiposMock = [
        { codigo: 'CELULAR', acepta_imei: true, campos: [] },
        { codigo: 'MODEM', acepta_imei: true, campos: [] },
        { codigo: 'COMPUTADOR', acepta_imei: false, campos: [] },
        { codigo: 'LAPTOP', acepta_imei: false, campos: [] }
    ];
    const relacionesMock = [{
        id: 3,
        contrato_id: 1,
        nro_contrato: 'CON-001',
        operador: 'OPERADOR',
        codigo_gama: 'G1',
        gama: 'GAMA 1',
        estado_contrato: 'VIGENTE'
    }];

    function useState(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) {
            slots[posicion] = {
                valor: typeof inicial === 'function' ? inicial() : inicial
            };
        }
        return [slots[posicion].valor, (valor) => {
            slots[posicion].valor =
                typeof valor === 'function' ? valor(slots[posicion].valor) : valor;
        }];
    }

    function useRef(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { current: inicial };
        return slots[posicion];
    }

    function useMemo(callback) {
        indice++;
        return callback();
    }

    function useEffect(callback) {
        const posicion = indice++;
        if (efectosEjecutados.has(posicion)) return;
        efectosEjecutados.add(posicion);
        callback();
    }

    const render = vm.runInNewContext(`${source.slice(componente.range[0], retorno.range[0])}
        return { abrirRegistro, abrirEdicion, actualizarFormulario, guardarEquipo,
            estado: { formulario, equipoEditandoId, modalAbierto, error } };
    }
    EquiposPage;`, {
        useState,
        useRef,
        useMemo,
        useEffect,
        console: { error() { } },
        setTimeout() { },
        window: { setTimeout() { } },
        listarEquipos: async () => [],
        listarContratoGamas: async () => relacionesMock,
        listarTiposEquipo: async () => tiposMock,
        obtenerEquipoPorId: async () => ({
            id: 5,
            tipo: 'MODEM',
            marca: 'Marca',
            modelo: 'Modelo',
            codigo_patrimonial: null,
            contrato_id: 1,
            imei: null,
            serie: 'SER-5',
            contrato_gama_id: 3,
            observaciones: null,
            especificaciones: {},
            estado_actual: 'BAJA'
        }),
        registrarEquipo: async (datos) => {
            envios.push({ metodo: 'POST', datos: JSON.parse(JSON.stringify(datos)) });
        },
        actualizarEquipo: async (id, datos) => {
            envios.push({ metodo: 'PUT', id, datos: JSON.parse(JSON.stringify(datos)) });
        }
    });

    const vista = () => {
        indice = 0;
        return render();
    };
    return { vista, envios, estado: () => JSON.parse(JSON.stringify(vista().estado)) };
}
const cambiar = (fn, name, value) => fn({ target: { name, value } });
const submit = () => ({ preventDefault() { } });
async function completar(app, tipo = 'CELULAR') {
    app.vista().abrirRegistro();
    for (const [name, value] of Object.entries({
        tipo,
        marca: ' Samsung ',
        modelo: ' A55 ',
        contrato_id: '1',
        contrato_gama_id: '3',
        codigo_patrimonial: ' PAT-001 ',
        imei: ' 123 ',
        serie: ' SER '
    })) cambiar(app.vista().actualizarFormulario, name, value);
}

for (const tipo of ['CELULAR', 'MODEM']) {
    test(`Alta envía ${tipo} sin estado_actual`, async () => {
        const app = montar(); await completar(app, tipo);
        await app.vista().guardarEquipo(submit());
        assert.equal(app.envios.length, 1);
        assert.equal(app.envios[0].datos.tipo, tipo);
        assert.equal(app.envios[0].datos.estado_actual, undefined);
        assert.equal(app.envios[0].datos.contrato_id, 1);
        assert.equal(app.envios[0].datos.contrato_gama_id, 3);
        assert.equal(app.envios[0].datos.marca, 'Samsung');
        assert.equal(app.envios[0].datos.modelo, 'A55');
        assert.equal(app.envios[0].datos.codigo_patrimonial, 'PAT-001');
        assert.equal(app.envios[0].datos.imei, '123');
        assert.equal(app.envios[0].datos.serie, 'SER');
        assert.deepEqual(app.envios[0].datos.especificaciones, {});
        assert.ok(Array.isArray(app.envios[0].datos.perifericos));
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

for (const tipo of ['TIPO_DESCONOCIDO', 'TABLET_NO_EXISTE', 'ROUTER_X', 'PC_NO_VALIDO', 'MONITOR_X']) {
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
