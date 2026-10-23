const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Linter } = require('eslint');

// Ejecuta lógica real del componente/servicio con hooks y HTTP simulados.
// No abre un navegador y no reemplaza una prueba integrada con MySQL.
const archivo = path.join(process.env.INVENTARIO_PAGES_DIR || path.join(__dirname, '../src/pages'), 'AsignacionesPage.jsx');
const source = fs.readFileSync(archivo, 'utf8');
const linter = new Linter();
const mensajes = linter.verify(source, [{
    files: ['**/*.jsx'],
    languageOptions: {
        ecmaVersion: 'latest', sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } }
    }
}], { filename: 'AsignacionesPage.jsx' });
assert.equal(mensajes.filter((m) => m.fatal).length, 0, 'JSX válido');
const ast = linter.getSourceCode().ast;
const componente = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'AsignacionesPage');
const retorno = componente.body.body.find((n) => n.type === 'ReturnStatement');
const clonar = (valor) => JSON.parse(JSON.stringify(valor));

function diferida() {
    let resolve;
    let reject;
    const promise = new Promise((ok, fallo) => { resolve = ok; reject = fallo; });
    return { promise, resolve, reject };
}

function montar(opciones = {}) {
    const slots = [];
    const peticiones = [];
    const consultasActas = [];
    const consultasCatalogos = [];
    let efecto;
    let limpieza;
    let indice = 0;
    function useState(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { valor: inicial };
        return [slots[posicion].valor, (valor) => {
            slots[posicion].valor = typeof valor === 'function' ? valor(slots[posicion].valor) : valor;
        }];
    }
    function useRef(inicial) {
        const posicion = indice++;
        if (!(posicion in slots)) slots[posicion] = { current: inicial };
        return slots[posicion];
    }
    const servicioSource = fs.readFileSync(path.join(__dirname, '../src/services/asignacionService.js'), 'utf8');
    const servicioEjecutable = servicioSource.replace(
        /^import \{ obtenerApiUrl \} from '\.\/apiClient';\r?\n/m,
        ''
    );
    const servicios = vm.runInNewContext(`${servicioEjecutable.replace(/^export /gm, '')}
        ({ listarAsignaciones, listarActasDisponibles, obtenerAsignacionPorId, registrarAsignacion, devolverAsignacion });`, {
        obtenerApiUrl: (ruta = '') =>
            `http://localhost:3000/api/${String(ruta).replace(/^\/+/, '')}`,
        async fetch(url, opciones = {}) {
            if (url.includes('/actas-disponibles?')) {
                const consulta = { url, ...diferida() };
                consultasActas.push(consulta);
                return consulta.promise;
            }
            if (!opciones.method) return {
                ok: true, headers: { get: () => 'application/json' }, json: async () => ({ data: [] })
            };
            const peticion = { url, metodo: opciones.method, datos: JSON.parse(opciones.body), ...diferida() };
            peticiones.push(peticion);
            return peticion.promise;
        }
    });
    const render = vm.runInNewContext(`${source.slice(componente.range[0], retorno.range[0])}
        return {
            abrirModal, cerrarModal, actualizarFormulario, guardarAsignacion,
            cargarActasRegistro,
            abrirDevolucion, cerrarDevolucion, actualizarDevolucion, guardarDevolucion,
            obtenerEstadoAsignacion,
            estado: {
                formulario, formularioDevolucion, guardando, devolviendo, error, mensaje,
                modalAbierto, devolucionAbierta, asignacionDevolucion,
                actasDisponibles, cargandoActas, errorActas, cargandoRegistro, catalogosRegistroListos
            }
        };
    }
    AsignacionesPage;`, {
        useState, useRef, useEffect(fn) { efecto = fn; }, console: { error() { } }, setTimeout() { },
        ...servicios,
        listarColaboradores: async () => {
            if (opciones.diferirCatalogos) {
                const consulta = diferida();
                consultasCatalogos.push(consulta);
                return consulta.promise;
            }
            return [{ id: 8, nombres: 'PERSONA', apellidos: 'PRUEBA', estado: 'ACTIVO' }];
        },
        listarEquipos: async () => [{ id: 20, estado_actual: 'LIBRE' }]
    });
    function vista() { indice = 0; return render(); }
    return {
        vista, peticiones, consultasActas, consultasCatalogos, estado: () => clonar(vista().estado),
        montarEfecto() { vista(); limpieza = efecto(); },
        salir() { limpieza?.(); },
        terminarActas(posicion = 0, datos = [], opcionesRespuesta = {}) {
            consultasActas[posicion].resolve({
                ok: true, headers: { get: () => 'application/json' },
                json: async () => ({ success: true, data: datos }), ...opcionesRespuesta
            });
        },
        terminar(posicion = 0, ok = true, respuesta = {}, status = ok ? 200 : 400) {
            peticiones[posicion].resolve({
                ok, status, headers: { get: () => 'application/json' },
                json: async () => ({ success: ok, mensaje: ok ? 'Guardado' : 'Fallo de prueba', ...respuesta })
            });
        }
    };
}

const submit = () => ({ preventDefault() { } });
const cambiar = (funcion, name, value) => funcion({ target: { name, value } });
const asignacion = { id: 7, estado_asignacion: 'ACTIVA', fecha_asignacion: '2026-08-19' };

async function prepararRegistro(app) {
    await app.vista().abrirModal();
    for (const [name, value] of Object.entries({ colaborador_id: '8', equipo_id: '20', fecha_asignacion: '2026-09-03' })) {
        cambiar(app.vista().actualizarFormulario, name, value);
    }
    app.terminarActas(app.consultasActas.length - 1);
    await new Promise(setImmediate);
}

function prepararDevolucion(app) {
    app.vista().abrirDevolucion(asignacion);
    cambiar(app.vista().actualizarDevolucion, 'fecha_devolucion', '2026-09-03');
}

test('Registro: envía campos separados al POST real del servicio', async () => {
    const app = montar();
    await prepararRegistro(app);
    cambiar(app.vista().actualizarFormulario, 'descripcion_equipo_anterior', '  Equipo viejo  ');
    cambiar(app.vista().actualizarFormulario, 'observaciones', '  Entrega con cable\nSin daños  ');
    const guardado = app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones.length, 1);
    const peticion = app.peticiones[0];
    assert.equal(peticion.url, 'http://localhost:3000/api/asignaciones');
    assert.equal(peticion.metodo, 'POST');
    assert.equal(peticion.datos.colaborador_id, 8);
    assert.equal(peticion.datos.equipo_id, 20);
    assert.equal(peticion.datos.descripcion_equipo_anterior, 'Equipo viejo');
    assert.equal(peticion.datos.observaciones, 'Entrega con cable\nSin daños');
    app.terminar();
    await guardado;
    assert.equal(app.estado().formulario.observaciones, '');
    assert.equal(app.estado().formulario.descripcion_equipo_anterior, '');
    assert.equal(app.estado().modalAbierto, false);
});

test('Registro: textos vacíos viajan como NULL', async () => {
    const app = montar();
    await prepararRegistro(app);
    const guardado = app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones[0].datos.observaciones, null);
    assert.equal(app.peticiones[0].datos.descripcion_equipo_anterior, null);
    app.terminar();
    await guardado;
});

test('Registro: doble envío antes de rerender emite una sola petición', async () => {
    const app = montar();
    await prepararRegistro(app);
    const vista = app.vista();
    const uno = vista.guardarAsignacion(submit());
    await vista.guardarAsignacion(submit());
    vista.cerrarModal();
    assert.equal(app.peticiones.length, 1);
    assert.equal(app.estado().modalAbierto, true);
    app.terminar();
    await uno;
});

test('Registro: un error conserva campos y permite reintentar', async () => {
    const app = montar();
    await prepararRegistro(app);
    cambiar(app.vista().actualizarFormulario, 'observaciones', 'No perder esta nota');
    const guardado = app.vista().guardarAsignacion(submit());
    app.terminar(0, false);
    await guardado;
    assert.equal(app.estado().guardando, false);
    assert.equal(app.estado().modalAbierto, true);
    assert.equal(app.estado().formulario.observaciones, 'No perder esta nota');
    const reintento = app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones.length, 2);
    app.terminar(1);
    await reintento;
});

test('Devolución: sin selección envía NULL, nunca Administrador', async () => {
    const app = montar();
    prepararDevolucion(app);
    assert.equal(app.estado().formularioDevolucion.autorizado_por, '');
    const guardado = app.vista().guardarDevolucion(submit());
    assert.deepEqual(app.peticiones[0].datos, {
        fecha_devolucion: '2026-09-03', observaciones: null, autorizado_por: null
    });
    assert.equal(app.peticiones[0].metodo, 'PUT');
    assert.equal(app.peticiones[0].url, 'http://localhost:3000/api/asignaciones/7/devolver');
    app.terminar();
    await guardado;
});

test('Devolución: notas y autorizador seleccionado llegan como texto e ID numérico', async () => {
    const app = montar();
    prepararDevolucion(app);
    cambiar(app.vista().actualizarDevolucion, 'autorizado_por', '8');
    cambiar(app.vista().actualizarDevolucion, 'observaciones', '  Recepción con cable\nSin cargador  ');
    const guardado = app.vista().guardarDevolucion(submit());
    assert.equal(app.peticiones[0].datos.autorizado_por, 8);
    assert.equal(app.peticiones[0].datos.observaciones, 'Recepción con cable\nSin cargador');
    assert.equal(app.peticiones[0].datos.descripcion_equipo_anterior, undefined);
    app.terminar();
    await guardado;
    assert.equal(app.estado().devolucionAbierta, false);
});

test('Devolución: doble envío y cambio de asignación durante guardado quedan bloqueados', async () => {
    const app = montar();
    prepararDevolucion(app);
    const vista = app.vista();
    const uno = vista.guardarDevolucion(submit());
    await vista.guardarDevolucion(submit());
    vista.cerrarDevolucion();
    vista.abrirDevolucion({ ...asignacion, id: 9 });
    assert.equal(app.peticiones.length, 1);
    assert.equal(app.estado().asignacionDevolucion.id, 7);
    assert.equal(app.estado().devolucionAbierta, true);
    app.terminar();
    await uno;
});

test('Devolución: error HTTP conserva notas y selección para reintentar', async () => {
    const app = montar();
    prepararDevolucion(app);
    cambiar(app.vista().actualizarDevolucion, 'observaciones', 'Nota pendiente');
    const uno = app.vista().guardarDevolucion(submit());
    app.terminar(0, false);
    await uno;
    assert.equal(app.estado().devolviendo, false);
    assert.equal(app.estado().devolucionAbierta, true);
    assert.equal(app.estado().formularioDevolucion.observaciones, 'Nota pendiente');
    assert.equal(app.estado().error, 'Fallo de prueba');
    const dos = app.vista().guardarDevolucion(submit());
    app.terminar(1);
    await dos;
});

test('Devolución: error de red libera el bloqueo sin borrar el formulario', async () => {
    const app = montar();
    prepararDevolucion(app);
    const pendiente = app.vista().guardarDevolucion(submit());
    app.peticiones[0].reject(new Error('Sin conexión'));
    await pendiente;
    assert.equal(app.estado().error, 'Sin conexión');
    assert.equal(app.estado().devolviendo, false);
    assert.equal(app.estado().asignacionDevolucion.id, 7);
});

for (const estado of ['FINALIZADA', 'CANCELADA']) {
    test(`Devolución: no abre formulario para ${estado}`, () => {
        const app = montar();
        app.vista().abrirDevolucion({ ...asignacion, estado_asignacion: estado });
        assert.equal(app.estado().devolucionAbierta, false);
        assert.equal(app.estado().asignacionDevolucion, null);
    });
}

test('Devolución: nueva apertura no hereda notas ni autorizador de la anterior', () => {
    const app = montar();
    prepararDevolucion(app);
    cambiar(app.vista().actualizarDevolucion, 'observaciones', 'Vieja');
    cambiar(app.vista().actualizarDevolucion, 'autorizado_por', '8');
    app.vista().cerrarDevolucion();
    app.vista().abrirDevolucion({ ...asignacion, id: 9 });
    assert.equal(app.estado().formularioDevolucion.observaciones, '');
    assert.equal(app.estado().formularioDevolucion.autorizado_por, '');
});

test('Formularios cerrados no emiten solicitudes', async () => {
    const app = montar();
    await app.vista().guardarAsignacion(submit());
    await app.vista().guardarDevolucion(submit());
    assert.equal(app.peticiones.length, 0);
});

function buscar(nodo, predicado, encontrados = []) {
    if (!nodo || typeof nodo !== 'object') return encontrados;
    if (predicado(nodo)) encontrados.push(nodo);
    for (const [key, valor] of Object.entries(nodo)) {
        if (['parent', 'tokens', 'comments', 'loc', 'range'].includes(key)) continue;
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
    assert.equal(elementos.length, 1, `Un único elemento con id ${id}`);
    return elementos[0];
}

test('JSX: equipo anterior y notas tienen controles distintos y límites', () => {
    for (const [id, campo, limite] of [
        ['descripcion_equipo_anterior', 'formulario.descripcion_equipo_anterior', 200],
        ['observaciones_asignacion', 'formulario.observaciones', 15000],
        ['observaciones_devolucion', 'formularioDevolucion.observaciones', 15000]
    ]) {
        const elemento = porId(id);
        assert.equal(elemento.openingElement.name.name, 'textarea');
        assert.equal(atributo(elemento, 'maxLength').expression.value, limite);
        const expresion = atributo(elemento, 'value').expression;
        assert.equal(source.slice(...expresion.range).trim(), campo);
    }
});

test('JSX: autorizador es una selección por ID, no un texto libre', () => {
    const elemento = porId('autorizado_por');
    assert.equal(elemento.openingElement.name.name, 'select');
    const opciones = buscar(elemento, (n) => n.type === 'JSXElement' && n.openingElement.name.name === 'option');
    assert.ok(opciones.some((n) => atributo(n, 'value')?.value === ''));
    assert.ok(opciones.some((n) => {
        const exp = atributo(n, 'value')?.expression;
        return exp && source.slice(...exp.range) === 'colaborador.id';
    }));
    assert.doesNotMatch(source, /Administrador/);
    assert.match(source, /Selección manual; no valida identidad ni permisos/);
});

test('JSX: detalle muestra notas separadas como texto, con valores vacíos seguros', () => {
    for (const campo of ['descripcion_equipo_anterior', 'observaciones', 'descripcion_devolucion', 'devolucion_autorizado_por_nombre']) {
        const expresiones = buscar(retorno, (n) => n.type === 'JSXExpressionContainer' &&
            n.expression.type === 'LogicalExpression' &&
            source.slice(...n.expression.left.range) === `asignacionSeleccionada.${campo}`);
        assert.ok(expresiones.length > 0, `Detalle visible: ${campo}`);
        const expresion = source.slice(...expresiones[0].expression.range);
        const texto = '<script>No ejecutar</script>\nSegunda línea';
        assert.equal(vm.runInNewContext(expresion, { asignacionSeleccionada: { [campo]: texto } }), texto);
        assert.ok(vm.runInNewContext(expresion, { asignacionSeleccionada: {} }));
    }
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test('JSX: botón devolver se renderiza solo si la asignación está activa', () => {
    const condicionales = buscar(retorno, (n) => n.type === 'LogicalExpression' && n.operator === '&&' &&
        n.right.type === 'JSXElement' && atributo(n.right, 'className')?.value === 'boton-devolver');
    assert.equal(condicionales.length, 1);
    const condicion = source.slice(...condicionales[0].left.range);
    const app = montar();
    for (const estado of ['ACTIVA', 'FINALIZADA', 'CANCELADA']) {
        assert.equal(vm.runInNewContext(condicion, {
            asignacion: { estado_asignacion: estado }, obtenerEstadoAsignacion: app.vista().obtenerEstadoAsignacion
        }), estado === 'ACTIVA');
    }
});

test('Actas: informa la sincronización confirmada sin enviar vínculos del navegador', async () => {
    const app = montar();
    app.vista().abrirDevolucion({ ...asignacion, acta_id: 10, detalle_id: 100, equipo_id: 20, colaborador_id: 3 });
    cambiar(app.vista().actualizarDevolucion, 'fecha_devolucion', '2026-09-03');
    const pendiente = app.vista().guardarDevolucion(submit());
    assert.deepEqual(Object.keys(app.peticiones[0].datos).sort(), ['autorizado_por', 'fecha_devolucion', 'observaciones']);
    app.terminar(0, true, { sincronizacion_acta: { estado: 'ACTUALIZADA', acta_id: 10, detalle_id: 100 } });
    await pendiente;
    assert.equal(app.estado().mensaje, 'Devolución registrada y detalle del acta actualizado');
    assert.equal(app.estado().devolucionAbierta, false);
    assert.equal(app.estado().asignacionDevolucion, null);
});

test('Actas: una devolución sin vínculo informa que no actualizó ningún acta', async () => {
    const app = montar();
    prepararDevolucion(app);
    const pendiente = app.vista().guardarDevolucion(submit());
    app.terminar(0, true, { sincronizacion_acta: { estado: 'SIN_ACTA' } });
    await pendiente;
    assert.equal(app.estado().mensaje, 'Devolución registrada. Esta asignación no tiene un acta vinculada');
    assert.equal(app.estado().devolucionAbierta, false);
});

test('Actas: respuesta de backend anterior no afirma una sincronización inexistente', async () => {
    const app = montar();
    app.vista().abrirDevolucion({ ...asignacion, acta_id: 10 });
    cambiar(app.vista().actualizarDevolucion, 'fecha_devolucion', '2026-09-03');
    const pendiente = app.vista().guardarDevolucion(submit());
    app.terminar();
    await pendiente;
    assert.equal(app.estado().mensaje, 'Devolución registrada correctamente');
});

test('Actas: conflicto HTTP 409 conserva formulario y muestra la explicación del servidor', async () => {
    const app = montar();
    app.vista().abrirDevolucion({ ...asignacion, acta_id: 10 });
    cambiar(app.vista().actualizarDevolucion, 'fecha_devolucion', '2026-09-03');
    cambiar(app.vista().actualizarDevolucion, 'observaciones', 'Revisar esta recepción');
    const pendiente = app.vista().guardarDevolucion(submit());
    const mensaje = 'El acta vinculada pertenece a otro colaborador';
    app.terminar(0, false, { mensaje }, 409);
    await pendiente;
    assert.equal(app.estado().error, mensaje);
    assert.equal(app.estado().mensaje, '');
    assert.equal(app.estado().devolucionAbierta, true);
    assert.equal(app.estado().devolviendo, false);
    assert.equal(app.estado().formularioDevolucion.observaciones, 'Revisar esta recepción');
    assert.equal(app.estado().asignacionDevolucion.acta_id, 10);
});

test('Actas: el resultado del servidor prevalece sobre un vínculo desactualizado de la tabla', async () => {
    const app = montar();
    app.vista().abrirDevolucion({ ...asignacion, acta_id: 10 });
    cambiar(app.vista().actualizarDevolucion, 'fecha_devolucion', '2026-09-03');
    const pendiente = app.vista().guardarDevolucion(submit());
    app.terminar(0, true, { sincronizacion_acta: { estado: 'SIN_ACTA' } });
    await pendiente;
    assert.match(app.estado().mensaje, /no tiene un acta vinculada/);
    assert.doesNotMatch(app.estado().mensaje, /actualizado/);
});

test('JSX: muestra el acta vinculada y una advertencia acorde, sin inventar una relación', () => {
    const resumenes = buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'className')?.value === 'resumen-devolucion');
    assert.equal(resumenes.length, 1);
    const resumen = resumenes[0];
    assert.equal(resumen.children.filter((n) => n.type === 'JSXElement').length, 4);
    assert.ok(buscar(resumen, (n) => n.type === 'JSXText' && n.value.trim() === 'Acta vinculada').length);
    const expresiones = buscar(resumen, (n) => n.type === 'ConditionalExpression');
    assert.equal(expresiones.length, 1);
    const expresion = source.slice(...expresiones[0].range);
    for (const [seleccion, esperado] of [
        [{ acta_id: 10, nro_acta: 'ACT-010' }, 'ACT-010'],
        [{ acta_id: 10, nro_acta: null }, 'ID 10'],
        [{ acta_id: null, nro_acta: 'NO USAR' }, 'Sin acta vinculada'],
        [{}, 'Sin acta vinculada']
    ]) {
        assert.equal(vm.runInNewContext(expresion, { asignacionDevolucion: seleccion }), esperado);
    }
    const advertencias = buscar(retorno, (n) => n.type === 'JSXElement' && atributo(n, 'className')?.value === 'advertencia-devolucion');
    assert.equal(advertencias.length, 1);
    const condicionales = buscar(advertencias[0], (n) => n.type === 'ConditionalExpression');
    assert.equal(condicionales.length, 1);
    const texto = source.slice(...condicionales[0].range);
    assert.match(vm.runInNewContext(texto, { asignacionDevolucion: { acta_id: 10 } }), /No cambiarán las firmas ni el estado del acta/);
    assert.match(vm.runInNewContext(texto, { asignacionDevolucion: { acta_id: null } }), /No se actualizará ningún acta/);
});

test('CSS: resumen de cuatro datos en dos columnas y una columna en pantallas pequeñas', () => {
    const postcss = require('postcss');
    const css = fs.readFileSync(path.join(path.dirname(archivo), 'AsignacionesPage.css'), 'utf8');
    const root = postcss.parse(css);
    const columnas = [];
    root.walkRules('.resumen-devolucion', (regla) => {
        regla.walkDecls('grid-template-columns', (declaracion) => {
            columnas.push({ valor: declaracion.value, media: regla.parent.type === 'atrule' ? regla.parent.params : null });
        });
    });
    assert.deepEqual(columnas, [
        { valor: 'repeat(2, minmax(0, 1fr))', media: null },
        { valor: '1fr', media: '(max-width: 600px)' }
    ]);
});

const pausa = () => new Promise(setImmediate);
const actaValida = (extra = {}) => ({
    id: 10, detalle_id: 100, colaborador_id: 8, equipo_id: 20,
    nro_acta: 'ACT-010', estado: 'ACTIVA', fecha_entrega: '2026-09-01', ...extra
});
async function seleccionarEquipo(app) {
    await app.vista().abrirModal();
    cambiar(app.vista().actualizarFormulario, 'colaborador_id', '8');
    cambiar(app.vista().actualizarFormulario, 'equipo_id', '20');
    cambiar(app.vista().actualizarFormulario, 'fecha_asignacion', '2026-09-03');
}

test('Selector: consulta solamente después de elegir colaborador y equipo; no elige acta automáticamente', async () => {
    const app = montar(); await app.vista().abrirModal();
    cambiar(app.vista().actualizarFormulario, 'colaborador_id', '8');
    assert.equal(app.consultasActas.length, 0);
    cambiar(app.vista().actualizarFormulario, 'equipo_id', '20');
    assert.equal(app.consultasActas[0].url, 'http://localhost:3000/api/asignaciones/actas-disponibles?colaborador_id=8&equipo_id=20');
    app.terminarActas(0, [actaValida()]); await pausa();
    assert.equal(app.estado().actasDisponibles[0].id, 10);
    assert.equal(app.estado().formulario.acta_id, '');
});
test('Selector: el POST incluye el ID elegido y no envía detalle_id', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.terminarActas(0, [actaValida()]); await pausa();
    cambiar(app.vista().actualizarFormulario, 'acta_id', '10');
    const pendiente = app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones[0].datos.acta_id, 10);
    assert.equal(app.peticiones[0].datos.detalle_id, undefined);
    app.terminar(); await pendiente;
});
test('Selector: sin vínculo elegido se envía NULL, incluso si existen opciones', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.terminarActas(0, [actaValida()]); await pausa();
    const pendiente = app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones[0].datos.acta_id, null);
    app.terminar(); await pendiente;
});
test('Selector: cambiar equipo borra el vínculo y bloquea guardar mientras carga', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.terminarActas(0, [actaValida()]); await pausa();
    cambiar(app.vista().actualizarFormulario, 'acta_id', '10');
    cambiar(app.vista().actualizarFormulario, 'equipo_id', '21');
    assert.equal(app.estado().formulario.acta_id, '');
    assert.deepEqual(app.estado().actasDisponibles, []);
    await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
    app.terminarActas(1, [actaValida({ id: 11, equipo_id: 21 })]); await pausa();
    assert.equal(app.estado().actasDisponibles[0].id, 11);
});
test('Selector: dos cambios antes de renderizar consultan la pareja más reciente', async () => {
    const app = montar(); await app.vista().abrirModal();
    const vista = app.vista();
    cambiar(vista.actualizarFormulario, 'colaborador_id', '8');
    cambiar(vista.actualizarFormulario, 'equipo_id', '20');
    assert.match(app.consultasActas[0].url, /colaborador_id=8&equipo_id=20$/);
    app.terminarActas(); await pausa();
});
for (const fallo of [false, true]) {
    test(`Selector: respuesta antigua ${fallo ? 'fallida' : 'correcta'} no reemplaza la nueva`, async () => {
        const app = montar(); await seleccionarEquipo(app);
        cambiar(app.vista().actualizarFormulario, 'colaborador_id', '9');
        app.terminarActas(1, [actaValida({ id: 11, colaborador_id: 9 })]); await pausa();
        if (fallo) app.consultasActas[0].reject(new Error('Error antiguo'));
        else app.terminarActas(0, [actaValida()]);
        await pausa();
        assert.equal(app.estado().actasDisponibles[0].id, 11);
        assert.equal(app.estado().errorActas, '');
        assert.equal(app.estado().cargandoActas, false);
    });
}
test('Selector: terminar la petición anterior no habilita la que sigue cargando', async () => {
    const app = montar(); await seleccionarEquipo(app);
    cambiar(app.vista().actualizarFormulario, 'equipo_id', '21');
    app.terminarActas(0, [actaValida()]); await pausa();
    assert.equal(app.estado().cargandoActas, true);
    await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
    app.terminarActas(1); await pausa();
});
test('Selector: limpiar colaborador descarta respuesta pendiente y vínculo', async () => {
    const app = montar(); await seleccionarEquipo(app);
    cambiar(app.vista().actualizarFormulario, 'colaborador_id', '');
    app.terminarActas(0, [actaValida()]); await pausa();
    assert.deepEqual(app.estado().actasDisponibles, []);
    assert.equal(app.estado().cargandoActas, false);
    assert.equal(app.estado().formulario.acta_id, '');
});
test('Selector: cerrar y abrir otro registro no hereda respuesta pendiente', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.vista().cerrarModal(); await app.vista().abrirModal();
    app.terminarActas(0, [actaValida()]); await pausa();
    assert.deepEqual(app.estado().actasDisponibles, []);
    assert.equal(app.estado().formulario.colaborador_id, '');
    assert.equal(app.estado().formulario.acta_id, '');
});
test('Selector: salir de la página invalida respuestas pendientes', async () => {
    const app = montar(); app.montarEfecto(); await seleccionarEquipo(app);
    app.salir(); app.terminarActas(0, [actaValida()]); await pausa();
    assert.deepEqual(app.estado().actasDisponibles, []);
    await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
});
test('Selector: un fallo impide guardar sin acta por accidente; reintentar permite continuar', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.consultasActas[0].reject(new Error('Sin conexión')); await pausa();
    assert.equal(app.estado().errorActas, 'Sin conexión');
    await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
    const consulta = app.vista().cargarActasRegistro(); app.terminarActas(1); await consulta;
    const guardado = app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones[0].datos.acta_id, null); app.terminar(); await guardado;
});
test('Selector: un ID ajeno no puede enviarse aunque se altere el estado del formulario', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.terminarActas(0, [actaValida()]); await pausa();
    cambiar(app.vista().actualizarFormulario, 'acta_id', '999');
    await app.vista().guardarAsignacion(submit());
    assert.equal(app.peticiones.length, 0); assert.match(app.estado().error, /no corresponde/);
});
test('Selector: un conflicto al guardar conserva la elección y no reintenta sin acta', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.terminarActas(0, [actaValida()]); await pausa();
    cambiar(app.vista().actualizarFormulario, 'acta_id', '10');
    const pendiente = app.vista().guardarAsignacion(submit());
    app.terminar(0, false, { mensaje: 'El acta ya fue vinculada' }, 409); await pendiente;
    assert.equal(app.estado().modalAbierto, true);
    assert.equal(app.estado().formulario.acta_id, '10');
    assert.equal(app.peticiones.length, 1);
});
test('Selector: durante el POST no permite cambiar selección ni recargar actas', async () => {
    const app = montar(); await seleccionarEquipo(app);
    app.terminarActas(0, [actaValida()]); await pausa();
    cambiar(app.vista().actualizarFormulario, 'acta_id', '10');
    const pendiente = app.vista().guardarAsignacion(submit());
    cambiar(app.vista().actualizarFormulario, 'equipo_id', '21');
    await app.vista().cargarActasRegistro();
    assert.equal(app.estado().formulario.equipo_id, '20');
    assert.equal(app.consultasActas.length, 1);
    app.terminar(); await pendiente;
});
for (const [nombre, datos, respuesta] of [
    ['otra persona', [actaValida({ colaborador_id: 9 })]],
    ['otro equipo', [actaValida({ equipo_id: 21 })]],
    ['acta cerrada', [actaValida({ estado: 'CERRADA' })]],
    ['detalle ausente', [actaValida({ detalle_id: null })]],
    ['duplicados', [actaValida(), actaValida()]],
    ['formato no array', {}],
    ['HTML', [], { headers: { get: () => 'text/html' } }],
    ['error HTTP', [], { ok: false, json: async () => ({ mensaje: 'Fallo HTTP' }) }],
    ['success false', [], { json: async () => ({ success: false, mensaje: 'Fallo lógico' }) }]
]) {
    test(`Servicio de actas: rechaza ${nombre} sin mostrar lista vacía como éxito`, async () => {
        const app = montar(); await seleccionarEquipo(app);
        app.terminarActas(0, datos, respuesta); await pausa();
        assert.ok(app.estado().errorActas); assert.deepEqual(app.estado().actasDisponibles, []);
        await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
    });
}
test('Registro: fallo de catálogos impide escribir y cerrar durante la carga no reabre el modal', async () => {
    const app = montar({ diferirCatalogos: true });
    const apertura = app.vista().abrirModal();
    assert.equal(app.estado().cargandoRegistro, true);
    await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
    app.consultasCatalogos[0].reject(new Error('Catálogo no disponible')); await apertura;
    assert.equal(app.estado().catalogosRegistroListos, false);
    await app.vista().guardarAsignacion(submit()); assert.equal(app.peticiones.length, 0);
    const segunda = app.vista().abrirModal(); app.vista().cerrarModal();
    app.consultasCatalogos[1].resolve([]); await segunda;
    assert.equal(app.estado().modalAbierto, false);
});
test('JSX: selector opcional y botón actualizar no envía el formulario', () => {
    const selector = porId('acta_id_asignacion');
    assert.equal(selector.openingElement.name.name, 'select');
    assert.equal(atributo(selector, 'name').value, 'acta_id');
    assert.equal(atributo(selector, 'required'), undefined);
    const botones = buscar(retorno, (n) => n.type === 'JSXElement' && n.openingElement.name.name === 'button' &&
        atributo(n, 'onClick')?.expression?.name === 'cargarActasRegistro');
    assert.equal(botones.length, 2);
    assert.ok(botones.every((boton) => atributo(boton, 'type').value === 'button'));
});
