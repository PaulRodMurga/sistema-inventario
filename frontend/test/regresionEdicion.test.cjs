const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Linter } = require('eslint');

// Usa el analizador ya declarado por el proyecto. Ejecuta la logica real
// anterior al JSX con hooks y servicios simulados: no abre navegador ni API.
const paginas = [
    {
        nombre: 'Lineas', componente: 'LineasPage', archivo: 'LineasPage.jsx',
        editar: 'abrirEdicion', registrar: 'abrirRegistro', cerrar: 'cerrarRegistro',
        guardar: 'guardarLinea', id: 'lineaEditandoId', modal: 'modalRegistroAbierto',
        listar: 'listarLineas', detalle: 'obtenerLineaPorId', catalogos: 'obtenerCatalogosLinea',
        put: 'actualizarLinea', post: 'registrarLinea', campoVisible: 'numero',
        datos: (id) => ({
            id, numero: String(900000000 + id), codigo_chip: `CHIP-${id}`,
            plan_id: id, equipo_id: id + 100, estado: 'ACTIVA'
        }),
        opciones: (etiqueta) => ({ etiqueta, planes: [], equipos: [] }),
        privadosEnEdicion: ['numero', 'codigo_chip'], campoEditable: 'plan_id'
    },
    {
        nombre: 'Colaboradores', componente: 'ColaboradoresPage', archivo: 'ColaboradoresPage.jsx',
        editar: 'abrirModalEdicion', registrar: 'abrirModalRegistro', cerrar: 'cerrarModal',
        guardar: 'guardarColaborador', id: 'colaboradorEditandoId', modal: 'modalAbierto',
        listar: 'listarColaboradores', detalle: 'obtenerColaboradorPorId', catalogos: 'obtenerCatalogosColaborador',
        put: 'actualizarColaborador', post: 'registrarColaborador', campoVisible: 'codigo',
        datos: (id) => ({
            id, codigo: `C${id}`, apellidos: `APELLIDO${id}`, nombres: `PERSONA${id}`,
            dni: String(40000000 + id), cargo_id: id, area_id: id + 1,
            centro_costos_id: id + 2, unidad_empresarial_id: id + 3, estado: 'ACTIVO'
        }),
        opciones: (etiqueta) => ({
            etiqueta, cargos: [], areas: [], centros_costos: [], unidades_empresariales: []
        }),
        privadosEnEdicion: ['codigo', 'apellidos', 'nombres', 'dni'], campoEditable: 'cargo_id'
    }
];

function diferida() {
    let resolve;
    let reject;
    const promise = new Promise((resolver, rechazar) => {
        resolve = resolver;
        reject = rechazar;
    });
    return { promise, resolve, reject };
}

function leerPagina(config) {
    const directorio = process.env.INVENTARIO_PAGES_DIR || path.join(__dirname, '../src/pages');
    const filename = path.join(directorio, config.archivo);
    const source = fs.readFileSync(filename, 'utf8');
    const linter = new Linter();
    const mensajes = linter.verify(source, [{
        files: ['**/*.jsx'],
        languageOptions: {
            ecmaVersion: 'latest', sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } }
        }
    }], { filename: config.archivo });
    assert.equal(mensajes.filter((mensaje) => mensaje.fatal).length, 0, 'JSX valido');
    const ast = linter.getSourceCode().ast;
    const componente = ast.body.find((nodo) =>
        nodo.type === 'FunctionDeclaration' && nodo.id.name === config.componente
    );
    assert.ok(componente);
    const retorno = componente.body.body.find((nodo) => nodo.type === 'ReturnStatement');
    assert.ok(retorno);
    return { source, componente, retorno, ast };
}

async function montar(config) {
    const { source, componente, retorno } = leerPagina(config);
    const slots = [];
    const efectos = [];
    const detalles = [];
    const catalogos = [];
    const escrituras = [];
    let indice = 0;
    let desmontado = false;
    let actualizacionesTrasSalir = 0;

    function useState(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) {
            slots[posicion] = { valor: typeof inicial === 'function' ? inicial() : inicial };
        }
        return [slots[posicion].valor, (valor) => {
            if (desmontado) actualizacionesTrasSalir++;
            slots[posicion].valor = typeof valor === 'function' ? valor(slots[posicion].valor) : valor;
        }];
    }

    function useRef(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { current: inicial };
        return slots[posicion];
    }

    function useEffect(callback, dependencias) {
        assert.equal(dependencias.length, 0, 'Este simulador cubre efectos de montaje');
        const posicion = indice++;
        if (!(posicion in slots)) {
            slots[posicion] = {};
            efectos.push(() => { slots[posicion].limpiar = callback(); });
        }
    }

    const servicios = {
        [config.listar]: async () => [],
        [config.detalle]: (id) => {
            const peticion = { id, ...diferida() };
            detalles.push(peticion);
            return peticion.promise;
        },
        [config.catalogos]: () => {
            const peticion = diferida();
            catalogos.push(peticion);
            return peticion.promise;
        },
        [config.put]: (id, datos) => {
            const peticion = { metodo: 'PUT', id, datos, ...diferida() };
            escrituras.push(peticion);
            return peticion.promise;
        },
        [config.post]: (datos) => {
            const peticion = { metodo: 'POST', datos, ...diferida() };
            escrituras.push(peticion);
            return peticion.promise;
        }
    };

    const script = `${source.slice(componente.range[0], retorno.range[0])}
        return {
            editar: ${config.editar}, registrar: ${config.registrar},
            cerrar: ${config.cerrar}, guardar: ${config.guardar},
            cambiar: actualizarFormulario,
            estado: {
                id: ${config.id}, modal: ${config.modal}, modo: modoFormulario,
                formulario, catalogos, guardando, error,
                errorFormulario: typeof errorFormulario === 'undefined' ? '' : errorFormulario,
                cargandoFormulario: typeof cargandoFormulario === 'undefined' ? false : cargandoFormulario
            }
        };
    }
    ${config.componente};`;

    const renderizar = vm.runInNewContext(script, {
        useState, useRef, useEffect,
        useMemo: (callback) => { indice++; return callback(); },
        console: { error() { } }, setTimeout() { },
        ...servicios
    });

    function vista() {
        assert.equal(desmontado, false, 'No se renderiza una pagina desmontada');
        indice = 0;
        const resultado = renderizar();
        while (efectos.length) efectos.shift()();
        return resultado;
    }

    vista();
    await Promise.resolve();
    await Promise.resolve();

    return {
        vista, detalles, catalogos, escrituras,
        estado: () => JSON.parse(JSON.stringify(vista().estado)),
        completarEdicion: (indiceCatalogo, indiceDetalle, id, etiqueta = String(id)) => {
            catalogos[indiceCatalogo].resolve(config.opciones(etiqueta));
            detalles[indiceDetalle].resolve(config.datos(id));
        },
        salir() {
            for (const slot of slots) {
                if (typeof slot?.limpiar === 'function') slot.limpiar();
            }
            desmontado = true;
        },
        actualizacionesTrasSalir: () => actualizacionesTrasSalir
    };
}

const eventoSubmit = () => ({ preventDefault() { } });

for (const config of paginas) {
    test(`${config.nombre}: B responde antes que A; conserva ID, formulario y catalogos de B`, async () => {
        const app = await montar(config);
        const a = app.vista().editar(11);
        const b = app.vista().editar(22);
        app.completarEdicion(1, 1, 22);
        await b;
        app.completarEdicion(0, 0, 11);
        await a;
        const estado = app.estado();
        assert.equal(estado.id, 22);
        assert.equal(estado.formulario[config.campoVisible], config.datos(22)[config.campoVisible]);
        assert.equal(estado.catalogos.etiqueta, '22');
    });

    test(`${config.nombre}: un error viejo no oculta ni ensucia la seleccion nueva`, async () => {
        const app = await montar(config);
        const a = app.vista().editar(11);
        const b = app.vista().editar(22);
        app.completarEdicion(1, 1, 22);
        await b;
        app.catalogos[0].resolve(config.opciones('viejo'));
        app.detalles[0].reject(new Error('Error de A'));
        await a;
        assert.equal(app.estado().error, '');
        assert.equal(app.estado().modal, true);
        assert.equal(app.estado().id, 22);
    });

    test(`${config.nombre}: terminar A no habilita B mientras B sigue cargando`, async () => {
        const app = await montar(config);
        const a = app.vista().editar(11);
        const b = app.vista().editar(22);
        app.completarEdicion(0, 0, 11);
        await a;
        assert.equal(app.estado().cargandoFormulario, true);
        assert.equal(app.estado().id, null);
        app.completarEdicion(1, 1, 22);
        await b;
        assert.equal(app.estado().cargandoFormulario, false);
        assert.equal(app.estado().id, 22);
    });

    test(`${config.nombre}: cerrar durante la carga impide que el modal se reabra`, async () => {
        const app = await montar(config);
        const pendiente = app.vista().editar(11);
        app.vista().cerrar();
        app.completarEdicion(0, 0, 11);
        await pendiente;
        assert.equal(app.estado().modal, false);
        assert.equal(app.estado().id, null);
        assert.equal(app.estado().cargandoFormulario, false);
    });

    test(`${config.nombre}: salir de la pagina descarta una respuesta pendiente`, async () => {
        const app = await montar(config);
        const pendiente = app.vista().editar(11);
        app.salir();
        app.completarEdicion(0, 0, 11);
        await pendiente;
        assert.equal(app.actualizacionesTrasSalir(), 0);
    });

    test(`${config.nombre}: un error de catalogos impide guardar un formulario incompleto`, async () => {
        const app = await montar(config);
        const pendiente = app.vista().editar(11);
        app.detalles[0].resolve(config.datos(11));
        app.catalogos[0].reject(new Error('Catalogo no disponible'));
        await pendiente;
        assert.equal(app.estado().modal, false);
        assert.equal(app.estado().id, null);
        await app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 0);
        assert.match(app.estado().error, /Catalogo/);
    });

    test(`${config.nombre}: un registro nuevo no recibe datos de una edicion anterior`, async () => {
        const app = await montar(config);
        const editar = app.vista().editar(11);
        const registrar = app.vista().registrar();
        app.catalogos[1].resolve(config.opciones('registro'));
        await registrar;
        app.completarEdicion(0, 0, 11, 'edicion vieja');
        await editar;
        const estado = app.estado();
        assert.equal(estado.modo, 'REGISTRAR');
        assert.equal(estado.id, null);
        assert.equal(estado.formulario[config.campoVisible], '');
        assert.equal(estado.catalogos.etiqueta, 'registro');
    });

    test(`${config.nombre}: una carga de registro vieja no reemplaza catalogos de edicion`, async () => {
        const app = await montar(config);
        const registrar = app.vista().registrar();
        const editar = app.vista().editar(22);
        app.completarEdicion(1, 0, 22, 'edicion');
        await editar;
        app.catalogos[0].resolve(config.opciones('registro viejo'));
        await registrar;
        assert.equal(app.estado().id, 22);
        assert.equal(app.estado().modo, 'EDITAR');
        assert.equal(app.estado().catalogos.etiqueta, 'edicion');
    });

    test(`${config.nombre}: no guarda los datos de A mientras se carga B`, async () => {
        const app = await montar(config);
        const a = app.vista().editar(11);
        app.completarEdicion(0, 0, 11);
        await a;
        const b = app.vista().editar(22);
        const guardar = app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 0);
        await guardar;
        app.completarEdicion(1, 1, 22);
        await b;
    });

    test(`${config.nombre}: el guardado usa la seleccion vigente y respeta los campos protegidos`, async () => {
        const app = await montar(config);
        const a = app.vista().editar(11);
        const b = app.vista().editar(22);
        app.completarEdicion(1, 1, 22);
        await b;
        app.completarEdicion(0, 0, 11);
        await a;
        const guardar = app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 1);
        assert.equal(app.escrituras[0].id, 22);
        assert.equal(app.escrituras[0].datos[config.campoEditable], 22);
        for (const campo of config.privadosEnEdicion) {
            assert.equal(Object.hasOwn(app.escrituras[0].datos, campo), false);
        }
        app.escrituras[0].resolve({ success: true });
        await guardar;
        assert.equal(app.estado().modal, false);
    });

    test(`${config.nombre}: dos submit inmediatos producen una sola escritura`, async () => {
        const app = await montar(config);
        const editar = app.vista().editar(11);
        app.completarEdicion(0, 0, 11);
        await editar;
        const vista = app.vista();
        const primero = vista.guardar(eventoSubmit());
        const segundo = vista.guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 1);
        app.escrituras[0].resolve({ success: true });
        await Promise.all([primero, segundo]);
    });

    test(`${config.nombre}: durante un guardado no abre ni cierra otra edicion`, async () => {
        const app = await montar(config);
        const editar = app.vista().editar(11);
        app.completarEdicion(0, 0, 11);
        await editar;
        const vista = app.vista();
        const guardar = vista.guardar(eventoSubmit());
        const otraEdicion = vista.editar(22);
        vista.cerrar();
        assert.equal(app.detalles.length, 1);
        assert.equal(app.estado().modal, true);
        assert.equal(app.estado().id, 11);
        await otraEdicion;
        app.escrituras[0].resolve({ success: true });
        await guardar;
    });

    test(`${config.nombre}: rechaza un detalle cuyo ID no coincide con lo solicitado`, async () => {
        const app = await montar(config);
        const pendiente = app.vista().editar(11);
        app.completarEdicion(0, 0, 22);
        await pendiente;
        assert.equal(app.estado().modal, false);
        assert.equal(app.estado().id, null);
        await app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 0);
    });

    test(`${config.nombre}: el registro sigue enviando POST con sus datos`, async () => {
        const app = await montar(config);
        const abrir = app.vista().registrar();
        app.catalogos[0].resolve(config.opciones('registro'));
        await abrir;
        for (const [name, value] of Object.entries(config.datos(11))) {
            if (name !== 'id') app.vista().cambiar({ target: { name, value: String(value) } });
        }
        const guardar = app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 1);
        assert.equal(app.escrituras[0].metodo, 'POST');
        assert.equal(app.escrituras[0].datos[config.campoVisible], config.datos(11)[config.campoVisible]);
        app.escrituras[0].resolve({ success: true });
        await guardar;
        assert.equal(app.estado().modal, false);
    });

    test(`${config.nombre}: un guardado fallido permite reintentar el mismo registro`, async () => {
        const app = await montar(config);
        const abrir = app.vista().editar(11);
        app.completarEdicion(0, 0, 11);
        await abrir;
        const guardar = app.vista().guardar(eventoSubmit());
        app.escrituras[0].reject(new Error('Error de guardado'));
        await guardar;
        assert.equal(app.estado().modal, true);
        assert.equal(app.estado().guardando, false);
        assert.equal(app.estado().id, 11);
        assert.match(app.estado().errorFormulario || app.estado().error, /Error de guardado/);

        const reintentar = app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 2);
        assert.equal(app.escrituras[1].id, 11);
        assert.equal(app.escrituras[1].metodo, 'PUT');
        app.escrituras[1].resolve({ success: true });
        await reintentar;
        assert.equal(app.estado().modal, false);
    });

    test(`${config.nombre}: tampoco permite registrar si falla el catalogo`, async () => {
        const app = await montar(config);
        const abrir = app.vista().registrar();
        app.catalogos[0].reject(new Error('Catalogo no disponible'));
        await abrir;
        assert.equal(app.estado().modal, false);
        assert.equal(app.estado().cargandoFormulario, false);
        await app.vista().guardar(eventoSubmit());
        assert.equal(app.escrituras.length, 0);
        assert.match(app.estado().error, /Catalogo/);
    });

    test(`${config.nombre}: salir descarta tambien errores y finalizaciones pendientes`, async () => {
        const app = await montar(config);
        const abrir = app.vista().editar(11);
        app.salir();
        app.catalogos[0].resolve(config.opciones('prueba'));
        app.detalles[0].reject(new Error('Error tras salir'));
        await abrir;
        assert.equal(app.actualizacionesTrasSalir(), 0);
    });

    test(`${config.nombre}: el JSX muestra espera en lugar del formulario durante la carga`, () => {
        const { retorno } = leerPagina(config);
        const visitados = new Set();
        const condicionales = [];
        function visitar(nodo) {
            if (!nodo || typeof nodo !== 'object' || visitados.has(nodo)) return;
            visitados.add(nodo);
            if (
                nodo.type === 'ConditionalExpression' &&
                nodo.test.type === 'Identifier' &&
                nodo.test.name === 'cargandoFormulario'
            ) condicionales.push(nodo);
            for (const [clave, valor] of Object.entries(nodo)) {
                if (clave !== 'parent') visitar(valor);
            }
        }
        visitar(retorno);
        const condicional = condicionales.find((nodo) =>
            nodo.alternate.type === 'JSXElement' &&
            nodo.alternate.openingElement.name.name === 'form'
        );
        assert.ok(condicional, 'El formulario solo debe existir en la rama sin carga');
        const onSubmit = condicional.alternate.openingElement.attributes.find((a) => a.name?.name === 'onSubmit');
        assert.equal(onSubmit.value.expression.name, config.guardar);
        const role = condicional.consequent.openingElement.attributes.find((a) => a.name?.name === 'role');
        assert.equal(role.value.value, 'status');
    });
}
