import { useEffect, useMemo, useState } from 'react';
import {
    Camera,
    FileSpreadsheet,
    Download,
    Headphones,
    Keyboard,
    ListPlus,
    Monitor,
    MonitorSmartphone,
    Mouse,
    PackagePlus,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Search,
    Trash2,
    Volume2,
    History,
    X
} from 'lucide-react';

import {
    actualizarEquipo,
    desvincularPerifericoEquipo,
    listarEquipos,
    listarPerifericosEquipo,
    listarPerifericosDisponibles,
    listarTiposEquipo,
    obtenerEquipoPorId,
    reemplazarPerifericoEquipo,
    registrarEquipo,
    registrarEquiposLote,
    importarEquipos,
    validarImportacionEquipos
} from '../services/equipoService';
import { listarContratoGamas } from '../services/contratoGamaService';
import { listarMovimientosPorEquipo } from '../services/movimientoService';
import DialogoAccesible from '../components/DialogoAccesible';
import BotonAccionTabla from '../components/BotonAccionTabla';
import EtiquetaEstado from '../components/EtiquetaEstado';
import CampoDetalle from '../components/CampoDetalle';
import ImportacionExcelModal from '../components/ImportacionExcelModal';
import { leerImportacionEquipos } from '../utils/importacionExcel';

const FORMULARIO_INICIAL = {
    tipo: '',
    marca: '',
    modelo: '',
    codigo_patrimonial: '',
    imei: '',
    serie: '',
    contrato_id: '',
    contrato_gama_id: '',
    observaciones: '',
    especificaciones: {}
};

const TIPOS_PRINCIPALES_PERIFERICOS = new Set([
    'COMPUTADOR',
    'LAPTOP'
]);
const TIPOS_PERIFERICO = [
    'MONITOR',
    'TECLADO',
    'MOUSE',
    'PARLANTES',
    'CAMARA WEB',
    'AUDIFONOS'
];
const ICONOS_PERIFERICO = {
    MONITOR: Monitor,
    TECLADO: Keyboard,
    MOUSE: Mouse,
    PARLANTES: Volume2,
    'CAMARA WEB': Camera,
    AUDIFONOS: Headphones
};
const TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR = [
    'MONITOR',
    'TECLADO',
    'MOUSE'
];

const crearPerifericoVacio = (tipo, habilitado = false) => ({
    tipo,
    habilitado,
    marca: '',
    modelo: '',
    codigo_patrimonial: '',
    serie: '',
    observaciones: '',
    especificaciones: {}
});

const crearPerifericosFormulario = (tipoPrincipal = '') => {
    const tipoNormalizado = String(tipoPrincipal || '').trim().toUpperCase();
    const obligatorios = new Set(
        tipoNormalizado === 'COMPUTADOR'
            ? TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR
            : []
    );

    return Object.fromEntries(
        TIPOS_PERIFERICO.map((tipo) => [
            tipo,
            [crearPerifericoVacio(tipo, obligatorios.has(tipo))]
        ])
    );
};

let siguienteFilaId = 1;
const crearFilaLote = () => ({
    idLocal: siguienteFilaId++,
    codigo_patrimonial: '',
    imei: '',
    serie: '',
    especificaciones: {},
    perifericos: crearPerifericosFormulario()
});

function leerEspecificaciones(valor) {
    if (!valor) return {};
    if (typeof valor === 'object' && !Array.isArray(valor)) return valor;

    try {
        const resultado = JSON.parse(valor);
        return resultado && typeof resultado === 'object' &&
            !Array.isArray(resultado)
            ? resultado
            : {};
    } catch {
        return {};
    }
}

function prepararEspecificaciones(definicion, valores, porUnidad = null) {
    const salida = {};

    for (const campo of definicion?.campos || []) {
        if (porUnidad !== null && campo.por_unidad !== porUnidad) continue;

        const original = valores?.[campo.clave];
        if (original === '' || original === null || original === undefined) {
            continue;
        }

        if (campo.tipo === 'number') {
            const numero = Number(original);

            if (
                !Number.isFinite(numero) ||
                numero < campo.min ||
                numero > campo.max ||
                (campo.entero && !Number.isInteger(numero))
            ) {
                return {
                    error: `${campo.etiqueta} no tiene un valor válido`
                };
            }

            salida[campo.clave] = numero;
        } else {
            const valor = String(original).trim();

            if (!valor) continue;

            if (campo.opciones && !campo.opciones.includes(valor)) {
                return {
                    error: `${campo.etiqueta} no tiene una opción válida`
                };
            }

            if (campo.max_length && valor.length > campo.max_length) {
                return {
                    error: `${campo.etiqueta} supera ${campo.max_length} caracteres`
                };
            }

            if (
                campo.formato === 'mac' &&
                !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(valor)
            ) {
                return {
                    error: `${campo.etiqueta} debe usar el formato AA:BB:CC:DD:EE:FF`
                };
            }

            salida[campo.clave] = valor;
        }
    }

    return { valor: salida };
}

function prepararPerifericos(catalogo, valores, tipoPrincipal = '') {
    const perifericos = [];

    for (const tipo of TIPOS_PERIFERICO) {
        const entradas = Array.isArray(valores?.[tipo])
            ? valores[tipo]
            : (valores?.[tipo] ? [valores[tipo]] : []);

        for (const periferico of entradas) {
            if (!periferico?.habilitado) continue;

            if (!periferico.marca.trim() || !periferico.modelo.trim()) {
                return {
                    error: `Marca y modelo son obligatorios para el ${tipo}`
                };
            }

            if (
                !periferico.codigo_patrimonial.trim() &&
                !periferico.serie.trim()
            ) {
                return {
                    error: `Indica la serie o el código patrimonial del ${tipo}`
                };
            }

            const definicion = catalogo.find(({ codigo }) => codigo === tipo);
            const especificaciones = definicion
                ? prepararEspecificaciones(
                    definicion,
                    periferico.especificaciones
                )
                : { valor: {} };

            if (especificaciones.error) {
                return { error: `${tipo}: ${especificaciones.error}` };
            }

            perifericos.push({
                tipo,
                marca: periferico.marca.trim(),
                modelo: periferico.modelo.trim(),
                codigo_patrimonial:
                    periferico.codigo_patrimonial.trim() || null,
                serie: periferico.serie.trim() || null,
                observaciones: periferico.observaciones.trim() || null,
                especificaciones: especificaciones.valor
            });
        }
    }

    if (String(tipoPrincipal || '').trim().toUpperCase() === 'COMPUTADOR') {
        const tiposIncluidos = new Set(perifericos.map(({ tipo }) => tipo));
        const faltantes = TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR.filter(
            (tipo) => !tiposIncluidos.has(tipo)
        );

        if (faltantes.length > 0) {
            return {
                error: `Para registrar un COMPUTADOR debes agregar ${faltantes.join(', ')}`
            };
        }
    }

    return { valor: perifericos };
}

function mostrarValorEspecificacion(campo, valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    return campo.unidad ? `${valor} ${campo.unidad}` : String(valor);
}

function fechaCalendario(valor) {
    return valor ? String(valor).slice(0, 10) : null;
}

function estaDisponible(relacion) {
    const hoy = new Date().toISOString().slice(0, 10);
    const inicio = fechaCalendario(relacion.fecha_inicio_contrato);
    const fin = fechaCalendario(relacion.fecha_fin_contrato);

    return relacion.estado_contrato === 'VIGENTE' &&
        (!inicio || inicio <= hoy) &&
        (!fin || fin >= hoy);
}

function fechaIsoHistorial(valor) {
    if (!valor) return undefined;
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
}

function formatearTipoMovimiento(valor) {
    return String(valor || 'MOVIMIENTO')
        .replaceAll('_', ' ')
        .toLocaleLowerCase('es-PE')
        .replace(/\b\p{L}/gu, (letra) => letra.toLocaleUpperCase('es-PE'));
}

function formatearFechaHistorial(valor) {
    if (!valor) return 'Fecha no disponible';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function EquiposPage({ soloLectura = false } = {}) {
    const [equipos, setEquipos] = useState([]);
    const [tiposEquipo, setTiposEquipo] = useState([]);
    const [tipoEquipoActivo, setTipoEquipoActivo] = useState('');
    const [busquedaTipo, setBusquedaTipo] = useState('');
    const [mostrarSugerenciasTipo, setMostrarSugerenciasTipo] = useState(false);
    const [filtroContrato, setFiltroContrato] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroUsuario, setFiltroUsuario] = useState('');
    const [filtroAsignacion, setFiltroAsignacion] = useState('TODOS');
    const [contratoGamas, setContratoGamas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [errorFormulario, setErrorFormulario] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [modoRegistro, setModoRegistro] = useState('UNIDAD');
    const [filasLote, setFilasLote] = useState([crearFilaLote()]);
    const [detalleAbierto, setDetalleAbierto] = useState(false);
    const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [historialEquipo, setHistorialEquipo] = useState([]);
    const [historialPerifericos, setHistorialPerifericos] = useState({});
    const [erroresHistorialPerifericos, setErroresHistorialPerifericos] = useState({});
    const [perifericoHistorialActivo, setPerifericoHistorialActivo] = useState(null);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [errorHistorial, setErrorHistorial] = useState('');
    const [equipoEditandoId, setEquipoEditandoId] = useState(null);
    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
    const [perifericosFormulario, setPerifericosFormulario] = useState(
        crearPerifericosFormulario
    );
    const [gestionPerifericosAbierta, setGestionPerifericosAbierta] =
        useState(false);
    const [equipoPrincipal, setEquipoPrincipal] = useState(null);
    const [perifericosActuales, setPerifericosActuales] = useState([]);
    const [perifericosDisponibles, setPerifericosDisponibles] = useState([]);
    const [modoPerifericoGestion, setModoPerifericoGestion] = useState('NUEVO');
    const [perifericoDisponibleId, setPerifericoDisponibleId] = useState('');
    const [cargandoPerifericos, setCargandoPerifericos] = useState(false);
    const [tipoPerifericoGestion, setTipoPerifericoGestion] = useState('');
    const [vinculoPerifericoGestionId, setVinculoPerifericoGestionId] = useState(null);
    const [perifericoGestion, setPerifericoGestion] = useState(
        crearPerifericoVacio('MONITOR', true)
    );
    const [errorPerifericos, setErrorPerifericos] = useState('');
    const [guardandoPeriferico, setGuardandoPeriferico] = useState(false);
    const [importacionAbierta, setImportacionAbierta] = useState(false);
    const [exportando, setExportando] = useState(false);

    const tipoSeleccionado = useMemo(
        () => tiposEquipo.find(({ codigo }) => codigo === formulario.tipo),
        [formulario.tipo, tiposEquipo]
    );

    const tipoDetalle = useMemo(
        () => tiposEquipo.find(
            ({ codigo }) => codigo === equipoSeleccionado?.tipo
        ),
        [equipoSeleccionado?.tipo, tiposEquipo]
    );

    const relacionesDisponibles = useMemo(
        () => contratoGamas.filter(estaDisponible),
        [contratoGamas]
    );

    const contratasDisponibles = useMemo(() => {
        const porId = new Map();

        for (const relacion of relacionesDisponibles) {
            if (!porId.has(relacion.contrato_id)) {
                porId.set(relacion.contrato_id, {
                    id: relacion.contrato_id,
                    nro_contrato: relacion.nro_contrato,
                    operador: relacion.operador
                });
            }
        }

        return [...porId.values()];
    }, [relacionesDisponibles]);

    const gamasDeContrata = useMemo(() => contratoGamas.filter(
        (relacion) =>
            String(relacion.contrato_id) === String(formulario.contrato_id) &&
            (estaDisponible(relacion) ||
                Number(relacion.id) === Number(formulario.contrato_gama_id))
    ), [contratoGamas, formulario.contrato_gama_id, formulario.contrato_id]);

    const contratasFormulario = useMemo(() => {
        if (!equipoEditandoId || !formulario.contrato_id) {
            return contratasDisponibles;
        }

        if (contratasDisponibles.some(
            ({ id }) => String(id) === String(formulario.contrato_id)
        )) {
            return contratasDisponibles;
        }

        const relacionActual = contratoGamas.find(
            ({ contrato_id }) =>
                String(contrato_id) === String(formulario.contrato_id)
        );

        return relacionActual
            ? [...contratasDisponibles, {
                id: relacionActual.contrato_id,
                nro_contrato: relacionActual.nro_contrato,
                operador: relacionActual.operador
            }]
            : contratasDisponibles;
    }, [contratasDisponibles, contratoGamas, equipoEditandoId, formulario.contrato_id]);

    const cargarDatos = async () => {
        try {
            setCargando(true);
            setError('');
            const [datosEquipos, datosRelaciones, datosTipos] = await Promise.all([
                listarEquipos(),
                listarContratoGamas(),
                listarTiposEquipo()
            ]);
            setEquipos(datosEquipos);
            setContratoGamas(datosRelaciones);
            setTiposEquipo(datosTipos);
        } catch (errorSolicitud) {
            setError(errorSolicitud.message);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        let activo = true;

        Promise.all([
            listarEquipos(),
            listarContratoGamas(),
            listarTiposEquipo()
        ])
            .then(([datosEquipos, datosRelaciones, datosTipos]) => {
                if (!activo) return;
                setEquipos(datosEquipos);
                setContratoGamas(datosRelaciones);
                setTiposEquipo(datosTipos);
            })
            .catch((errorSolicitud) => {
                if (activo) setError(errorSolicitud.message);
            })
            .finally(() => {
                if (activo) setCargando(false);
            });

        return () => {
            activo = false;
        };
    }, []);

    const limpiarFormulario = () => {
        setFormulario(FORMULARIO_INICIAL);
        setPerifericosFormulario(crearPerifericosFormulario());
        setModoRegistro('UNIDAD');
        setFilasLote([crearFilaLote()]);
        setErrorFormulario('');
    };

    const abrirRegistro = () => {
        limpiarFormulario();
        setEquipoEditandoId(null);
        setModalAbierto(true);
    };

    const abrirEdicion = async (id) => {
        try {
            setGuardando(true);
            setError('');
            const equipo = await obtenerEquipoPorId(id);

            setFormulario({
                tipo: equipo.tipo || '',
                marca: equipo.marca || '',
                modelo: equipo.modelo || '',
                codigo_patrimonial: equipo.codigo_patrimonial || '',
                imei: equipo.imei || '',
                serie: equipo.serie || '',
                contrato_id: String(equipo.contrato_id || ''),
                contrato_gama_id: String(equipo.contrato_gama_id || ''),
                observaciones: equipo.observaciones || '',
                especificaciones: leerEspecificaciones(
                    equipo.especificaciones
                )
            });
            setModoRegistro('UNIDAD');
            setEquipoEditandoId(id);
            setErrorFormulario('');
            setModalAbierto(true);
        } catch (errorSolicitud) {
            setError(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    const verEquipo = async (id) => {
        try {
            setCargandoDetalle(true);
            setError('');
            setEquipoSeleccionado(null);
            setDetalleAbierto(true);

            setHistorialEquipo([]);
            setHistorialPerifericos({});
            setErroresHistorialPerifericos({});
            setErrorHistorial('');
            setCargandoHistorial(true);

            const equipo = await obtenerEquipoPorId(id);

            let perifericos = [];
            if (TIPOS_PRINCIPALES_PERIFERICOS.has(equipo.tipo)) {
                try {
                    perifericos = await listarPerifericosEquipo(id);
                } catch (errorPerifericos) {
                    console.error(
                        'Error al cargar periféricos vinculados:',
                        errorPerifericos
                    );
                }
            }

            setEquipoSeleccionado({
                ...equipo,
                perifericos
            });

            try {
                const [historial, ...historialesPerifericos] = await Promise.all([
                    listarMovimientosPorEquipo(id),
                    ...perifericos.map(async (periferico) => {
                        try {
                            const movimientos = await listarMovimientosPorEquipo(periferico.id);
                            return { id: periferico.id, movimientos, error: '' };
                        } catch (errorSolicitud) {
                            return {
                                id: periferico.id,
                                movimientos: [],
                                error: errorSolicitud.message || 'No se pudo cargar el historial.'
                            };
                        }
                    })
                ]);
                setHistorialEquipo(historial);
                setHistorialPerifericos(Object.fromEntries(
                    historialesPerifericos.map(({ id: perifericoId, movimientos }) => [
                        perifericoId,
                        movimientos
                    ])
                ));
                setErroresHistorialPerifericos(Object.fromEntries(
                    historialesPerifericos.filter(({ error }) => error).map(({ id: perifericoId, error }) => [
                        perifericoId,
                        error
                    ])
                ));
            } catch (errorSolicitudHistorial) {
                console.error('Error al cargar historial del equipo:', errorSolicitudHistorial);
                setErrorHistorial(errorSolicitudHistorial.message || 'No se pudo cargar el historial.');
            } finally {
                setCargandoHistorial(false);
            }
        } catch (errorSolicitud) {
            setError(errorSolicitud.message);
            setDetalleAbierto(false);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const actualizarFormulario = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value,
            ...(name === 'contrato_id' ? { contrato_gama_id: '' } : {}),
            ...(name === 'tipo' ? {
                imei: '',
                especificaciones: {}
            } : {})
        }));

        if (name === 'tipo') {
            setPerifericosFormulario(crearPerifericosFormulario(value));
        }
    };

    const actualizarEspecificacion = (clave, valor) => {
        setFormulario((anterior) => ({
            ...anterior,
            especificaciones: {
                ...anterior.especificaciones,
                [clave]: valor
            }
        }));
    };

    const actualizarFilaLote = (idLocal, campo, valor) => {
        setFilasLote((anteriores) => anteriores.map((fila) =>
            fila.idLocal === idLocal ? { ...fila, [campo]: valor } : fila
        ));
    };

    const actualizarEspecificacionLote = (idLocal, clave, valor) => {
        setFilasLote((anteriores) => anteriores.map((fila) =>
            fila.idLocal === idLocal
                ? {
                    ...fila,
                    especificaciones: {
                        ...fila.especificaciones,
                        [clave]: valor
                    }
                }
                : fila
        ));
    };

    const actualizarPerifericoFormulario = (tipo, indice, campo, valor) => {
        setPerifericosFormulario((anteriores) => ({
            ...anteriores,
            [tipo]: anteriores[tipo].map((periferico, posicion) =>
                posicion === indice
                    ? { ...periferico, [campo]: valor }
                    : periferico
            )
        }));
    };

    const actualizarEspecificacionPeriferico = (tipo, indice, clave, valor) => {
        setPerifericosFormulario((anteriores) => ({
            ...anteriores,
            [tipo]: anteriores[tipo].map((periferico, posicion) =>
                posicion === indice
                    ? {
                        ...periferico,
                        especificaciones: {
                            ...periferico.especificaciones,
                            [clave]: valor
                        }
                    }
                    : periferico
            )
        }));
    };

    const agregarPerifericoFormulario = (tipo) => {
        setPerifericosFormulario((anteriores) => ({
            ...anteriores,
            [tipo]: [
                ...anteriores[tipo],
                crearPerifericoVacio(tipo, true)
            ]
        }));
    };

    const eliminarPerifericoFormulario = (tipo, indice) => {
        setPerifericosFormulario((anteriores) => {
            const actuales = anteriores[tipo];
            if (actuales.length === 1) {
                return anteriores;
            }
            return {
                ...anteriores,
                [tipo]: actuales.filter((_, posicion) => posicion !== indice)
            };
        });
    };

    const actualizarPerifericoLote = (
        idLocal,
        tipo,
        indice,
        campo,
        valor
    ) => {
        setFilasLote((anteriores) => anteriores.map((fila) =>
            fila.idLocal === idLocal
                ? {
                    ...fila,
                    perifericos: {
                        ...fila.perifericos,
                        [tipo]: fila.perifericos[tipo].map((periferico, posicion) =>
                            posicion === indice
                                ? { ...periferico, [campo]: valor }
                                : periferico
                        )
                    }
                }
                : fila
        ));
    };

    const actualizarEspecificacionPerifericoLote = (
        idLocal,
        tipo,
        indice,
        clave,
        valor
    ) => {
        setFilasLote((anteriores) => anteriores.map((fila) =>
            fila.idLocal === idLocal
                ? {
                    ...fila,
                    perifericos: {
                        ...fila.perifericos,
                        [tipo]: fila.perifericos[tipo].map((periferico, posicion) =>
                            posicion === indice
                                ? {
                                    ...periferico,
                                    especificaciones: {
                                        ...periferico.especificaciones,
                                        [clave]: valor
                                    }
                                }
                                : periferico
                        )
                    }
                }
                : fila
        ));
    };

    const agregarPerifericoLote = (idLocal, tipo) => {
        setFilasLote((anteriores) => anteriores.map((fila) =>
            fila.idLocal === idLocal
                ? {
                    ...fila,
                    perifericos: {
                        ...fila.perifericos,
                        [tipo]: [
                            ...fila.perifericos[tipo],
                            crearPerifericoVacio(tipo, true)
                        ]
                    }
                }
                : fila
        ));
    };

    const eliminarPerifericoLote = (idLocal, tipo, indice) => {
        setFilasLote((anteriores) => anteriores.map((fila) => {
            if (fila.idLocal !== idLocal) return fila;
            const actuales = fila.perifericos[tipo];
            if (actuales.length === 1) return fila;
            return {
                ...fila,
                perifericos: {
                    ...fila.perifericos,
                    [tipo]: actuales.filter((_, posicion) => posicion !== indice)
                }
            };
        }));
    };

    const agregarFilaLote = () => {
        if (filasLote.length < 100) {
            setFilasLote((anteriores) => [...anteriores, crearFilaLote()]);
        }
    };

    const eliminarFilaLote = (idLocal) => {
        if (filasLote.length > 1) {
            setFilasLote((anteriores) =>
                anteriores.filter((fila) => fila.idLocal !== idLocal)
            );
        }
    };

    const cerrarModal = () => {
        if (guardando) return;
        setModalAbierto(false);
        setEquipoEditandoId(null);
        limpiarFormulario();
    };

    const cargarPerifericosGestion = async (equipoId) => {
        try {
            setCargandoPerifericos(true);
            setErrorPerifericos('');
            setPerifericosActuales(
                await listarPerifericosEquipo(equipoId)
            );
        } catch (errorSolicitud) {
            setErrorPerifericos(errorSolicitud.message);
            setPerifericosActuales([]);
        } finally {
            setCargandoPerifericos(false);
        }
    };

    const abrirGestionPerifericos = async (equipo) => {
        setEquipoPrincipal(equipo);
        setTipoPerifericoGestion('');
        setVinculoPerifericoGestionId(null);
        setErrorPerifericos('');
        setGestionPerifericosAbierta(true);
        await cargarPerifericosGestion(equipo.id);
    };

    const cerrarGestionPerifericos = () => {
        if (guardandoPeriferico) return;
        setGestionPerifericosAbierta(false);
        setEquipoPrincipal(null);
        setPerifericosActuales([]);
        setTipoPerifericoGestion('');
        setVinculoPerifericoGestionId(null);
        setVinculoPerifericoGestionId(null);
        setErrorPerifericos('');
    };

    const iniciarGestionPeriferico = async (tipo, vinculoId = null) => {
        setTipoPerifericoGestion(tipo);
        setVinculoPerifericoGestionId(vinculoId);
        setPerifericoGestion(crearPerifericoVacio(tipo, true));
        setPerifericoDisponibleId('');
        setModoPerifericoGestion('NUEVO');
        setPerifericosDisponibles([]);
        setErrorPerifericos('');
        try {
            const disponibles = await listarPerifericosDisponibles(tipo);
            setPerifericosDisponibles(disponibles);
            if (disponibles.length > 0) {
                setModoPerifericoGestion('EXISTENTE');
                setPerifericoDisponibleId(String(disponibles[0].id));
            }
        } catch (errorSolicitud) {
            setErrorPerifericos(errorSolicitud.message);
        }
    };

    const actualizarGestionPeriferico = (campo, valor) => {
        setPerifericoGestion((anterior) => ({
            ...anterior,
            [campo]: valor
        }));
    };

    const actualizarEspecificacionGestion = (clave, valor) => {
        setPerifericoGestion((anterior) => ({
            ...anterior,
            especificaciones: {
                ...anterior.especificaciones,
                [clave]: valor
            }
        }));
    };

    const guardarGestionPeriferico = async (evento) => {
        evento.preventDefault();

        let datosParaGuardar;
        if (modoPerifericoGestion === 'EXISTENTE') {
            if (!perifericoDisponibleId) {
                setErrorPerifericos('Selecciona un periférico libre');
                return;
            }
            datosParaGuardar = { periferico_id: Number(perifericoDisponibleId) };
        } else {
            const perifericos = prepararPerifericos(tiposEquipo, {
                [tipoPerifericoGestion]: perifericoGestion
            });
            if (perifericos.error) {
                setErrorPerifericos(perifericos.error);
                return;
            }
            datosParaGuardar = perifericos.valor[0];
        }

        try {
            setGuardandoPeriferico(true);
            setErrorPerifericos('');
            await reemplazarPerifericoEquipo(
                equipoPrincipal.id,
                tipoPerifericoGestion,
                datosParaGuardar,
                vinculoPerifericoGestionId
            );
            setMensaje(`${tipoPerifericoGestion} guardado correctamente`);
            setTipoPerifericoGestion('');
            setVinculoPerifericoGestionId(null);
            await Promise.all([
                cargarPerifericosGestion(equipoPrincipal.id),
                cargarDatos()
            ]);
            window.setTimeout(() => setMensaje(''), 4000);
        } catch (errorSolicitud) {
            setErrorPerifericos(errorSolicitud.message);
        } finally {
            setGuardandoPeriferico(false);
        }
    };

    const desvincularPeriferico = async (tipo, vinculoId) => {
        if (!window.confirm(
            `¿Desvincular el ${tipo}? El registro quedará disponible como LIBRE.`
        )) return;

        try {
            setGuardandoPeriferico(true);
            setErrorPerifericos('');
            await desvincularPerifericoEquipo(equipoPrincipal.id, tipo, vinculoId);
            setMensaje(`${tipo} desvinculado correctamente`);
            setTipoPerifericoGestion('');
            setVinculoPerifericoGestionId(null);
            await Promise.all([
                cargarPerifericosGestion(equipoPrincipal.id),
                cargarDatos()
            ]);
            window.setTimeout(() => setMensaje(''), 4000);
        } catch (errorSolicitud) {
            setErrorPerifericos(errorSolicitud.message);
        } finally {
            setGuardandoPeriferico(false);
        }
    };

    const guardarEquipo = async (evento) => {
        evento.preventDefault();

        if (!tipoSeleccionado) {
            setErrorFormulario('Selecciona un tipo de equipo válido');
            return;
        }

        if (
            !formulario.marca.trim() ||
            !formulario.modelo.trim() ||
            !formulario.contrato_id ||
            !formulario.contrato_gama_id
        ) {
            setErrorFormulario('Tipo, marca, modelo, contrato y gama son obligatorios');
            return;
        }

        const especificacionesFormulario = prepararEspecificaciones(
            tipoSeleccionado,
            formulario.especificaciones,
            modoRegistro === 'LOTE' && !equipoEditandoId ? false : null
        );

        if (especificacionesFormulario.error) {
            setErrorFormulario(especificacionesFormulario.error);
            return;
        }

        const perifericosUnidad =
            !equipoEditandoId && modoRegistro === 'UNIDAD'
                ? prepararPerifericos(
                    tiposEquipo,
                    perifericosFormulario,
                    tipoSeleccionado?.codigo
                )
                : { valor: [] };

        if (perifericosUnidad.error) {
            setErrorFormulario(perifericosUnidad.error);
            return;
        }

        const datosComunes = {
            tipo: formulario.tipo,
            marca: formulario.marca.trim(),
            modelo: formulario.modelo.trim(),
            contrato_id: Number(formulario.contrato_id),
            contrato_gama_id: Number(formulario.contrato_gama_id),
            observaciones: formulario.observaciones.trim() || null,
            especificaciones: especificacionesFormulario.valor
        };

        try {
            setGuardando(true);
            setErrorFormulario('');
            setMensaje('');

            if (equipoEditandoId) {
                await actualizarEquipo(equipoEditandoId, {
                    ...datosComunes,
                    codigo_patrimonial:
                        formulario.codigo_patrimonial.trim() || null,
                    imei: formulario.imei.trim() || null,
                    serie: formulario.serie.trim() || null
                });
                setMensaje('Equipo actualizado correctamente');
            } else if (modoRegistro === 'LOTE') {
                const equiposLote = [];

                for (const fila of filasLote) {
                    const especificacionesUnidad = prepararEspecificaciones(
                        tipoSeleccionado,
                        fila.especificaciones,
                        true
                    );

                    if (especificacionesUnidad.error) {
                        setErrorFormulario(especificacionesUnidad.error);
                        return;
                    }

                    equiposLote.push({
                        codigo_patrimonial:
                            fila.codigo_patrimonial.trim() || null,
                        imei: fila.imei.trim() || null,
                        serie: fila.serie.trim() || null,
                        especificaciones: especificacionesUnidad.valor,
                        perifericos: prepararPerifericos(
                            tiposEquipo,
                            fila.perifericos
                        )
                    });
                }

                const perifericoInvalido = equiposLote.find(
                    ({ perifericos }) => perifericos.error
                );

                if (perifericoInvalido) {
                    setErrorFormulario(perifericoInvalido.perifericos.error);
                    return;
                }

                if (equiposLote.some((equipo) =>
                    !equipo.imei &&
                    !equipo.serie &&
                    !equipo.codigo_patrimonial
                )) {
                    setErrorFormulario(
                        'Cada equipo del lote debe tener IMEI, serie o código patrimonial'
                    );
                    return;
                }

                await registrarEquiposLote({
                    ...datosComunes,
                    equipos: equiposLote.map((equipo) => ({
                        ...equipo,
                        perifericos: equipo.perifericos.valor
                    }))
                });
                setMensaje(`${equiposLote.length} equipos registrados correctamente`);
            } else {
                await registrarEquipo({
                    ...datosComunes,
                    codigo_patrimonial:
                        formulario.codigo_patrimonial.trim() || null,
                    imei: formulario.imei.trim() || null,
                    serie: formulario.serie.trim() || null,
                    perifericos: perifericosUnidad.valor
                });
                setMensaje('Equipo registrado correctamente');
            }

            setModalAbierto(false);
            setEquipoEditandoId(null);
            limpiarFormulario();
            await cargarDatos();
            window.setTimeout(() => setMensaje(''), 4000);
        } catch (errorSolicitud) {
            setErrorFormulario(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    const tipoEquipoActivoDefinicion = tiposEquipo.find(
        ({ codigo }) => codigo === tipoEquipoActivo
    );

    const camposCaracteristicosActivos = tipoEquipoActivoDefinicion?.campos || [];
    const consultaFiltro = busquedaTipo.trim().toLowerCase();
    const contratosDisponibles = [...new Set(equipos
        .map(({ nro_contrato }) => String(nro_contrato || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const estadosDisponibles = [...new Set(equipos
        .map(({ estado_actual }) => String(estado_actual || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const sugerenciasFiltro = [
        ...tiposEquipo.map(({ codigo }) => ({ tipo: 'tipo', valor: codigo, etiqueta: codigo })),
        ...contratosDisponibles.map((valor) => ({ tipo: 'contrato', valor, etiqueta: valor })),
        ...estadosDisponibles.map((valor) => ({ tipo: 'estado', valor, etiqueta: valor.replaceAll('_', ' ') }))
    ].filter((opcion) => !consultaFiltro ||
        opcion.etiqueta.toLowerCase().includes(consultaFiltro) ||
        opcion.tipo.includes(consultaFiltro))
        .slice(0, 12);

    const seleccionarSugerenciaFiltro = (opcion) => {
        if (opcion.tipo === 'tipo') setTipoEquipoActivo(opcion.valor);
        if (opcion.tipo === 'contrato') setFiltroContrato(opcion.valor);
        if (opcion.tipo === 'estado') setFiltroEstado(opcion.valor);
        setBusquedaTipo('');
        setBusqueda('');
        setMostrarSugerenciasTipo(false);
    };

    const limpiarFiltrosEquipos = () => {
        setTipoEquipoActivo('');
        setBusquedaTipo('');
        setFiltroContrato('');
        setFiltroEstado('');
        setFiltroUsuario('');
        setFiltroAsignacion('TODOS');
        setBusqueda('');
        setMostrarSugerenciasTipo(false);
    };

    const equiposFiltrados = equipos.filter((equipo) => {
        if (tipoEquipoActivo && equipo.tipo !== tipoEquipoActivo) return false;
        if (filtroContrato && String(equipo.nro_contrato || '').trim() !== filtroContrato) return false;
        if (filtroEstado && String(equipo.estado_actual || '').trim() !== filtroEstado) return false;
        const usuarioAsignado = String(equipo.colaborador_asignado || '').trim();
        if (filtroAsignacion === 'ASIGNADO' && !usuarioAsignado) return false;
        if (filtroAsignacion === 'SIN_ASIGNAR' && usuarioAsignado) return false;
        if (filtroUsuario && !usuarioAsignado.toLocaleLowerCase('es-PE').includes(filtroUsuario.toLocaleLowerCase('es-PE'))) return false;

        const especificaciones = leerEspecificaciones(equipo.especificaciones);
        return [
            equipo.id,
            equipo.tipo,
            equipo.marca,
            equipo.modelo,
            equipo.codigo_patrimonial,
            equipo.imei,
            equipo.serie,
            equipo.nro_contrato,
            equipo.operador,
            equipo.colaborador_asignado,
            equipo.estado_actual,
            ...Object.values(especificaciones)
        ].join(' ').toLowerCase().includes(busqueda.toLowerCase());
    });

    const exportarEquiposFiltrados = async () => {
        if (equiposFiltrados.length === 0 || exportando) return;

        try {
            setExportando(true);
            setError('');
            const equiposConPerifericos = await Promise.all(
                equiposFiltrados.map(async (equipo) => {
                    let perifericos = [];

                    if (TIPOS_PRINCIPALES_PERIFERICOS.has(equipo.tipo)) {
                        perifericos = await listarPerifericosEquipo(equipo.id);
                    }

                    return { ...equipo, perifericos };
                })
            );

            const columnas = [
                'ID equipo',
                'Tipo',
                'Marca',
                'Modelo',
                'Código patrimonial',
                'IMEI',
                'Serie',
                'Usuario actual asignado',
                'Contrato',
                'Operador',
                'Estado',
                'Periféricos vinculados'
            ];

            const escaparCSV = (valor) => {
                const texto = valor === null || valor === undefined ? '' : String(valor);
                return '"' + texto.replaceAll('"', '""') + '"';
            };

            const filas = equiposConPerifericos.map((equipo) => {
                const perifericos = equipo.perifericos.map((periferico) => [
                    periferico.tipo_periferico || periferico.tipo || 'PERIFÉRICO',
                    periferico.marca,
                    periferico.modelo,
                    periferico.serie ? `Serie: ${periferico.serie}` : '',
                    periferico.codigo_patrimonial
                        ? `Código patrimonial: ${periferico.codigo_patrimonial}`
                        : '',
                    periferico.estado_actual ? `Estado: ${periferico.estado_actual}` : ''
                ].filter(Boolean).join(' - ')).join(' | ');

                return [
                    equipo.id,
                    equipo.tipo,
                    equipo.marca,
                    equipo.modelo,
                    equipo.codigo_patrimonial,
                    equipo.imei,
                    equipo.serie,
                    equipo.colaborador_asignado || 'SIN ASIGNAR',
                    equipo.nro_contrato,
                    equipo.operador,
                    equipo.estado_actual,
                    perifericos || 'Sin periféricos vinculados'
                ].map(escaparCSV).join(';');
            });

            const contenido = '\uFEFF' + [columnas.map(escaparCSV).join(';'), ...filas].join('\r\n');
            const archivo = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(archivo);
            const enlace = document.createElement('a');
            const fecha = new Date().toISOString().slice(0, 10);
            enlace.href = url;
            enlace.download = `equipos_filtrados_${fecha}.csv`;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            URL.revokeObjectURL(url);
            setMensaje(`Se exportaron ${equiposConPerifericos.length} equipos con sus periféricos vinculados.`);
        } catch (errorSolicitud) {
            setError(errorSolicitud.message || 'No se pudieron exportar los equipos y sus periféricos.');
        } finally {
            setExportando(false);
        }
    };

    const formatearEstado = (estado) => estado
        ? estado.replaceAll('_', ' ')
        : 'SIN ESTADO';

    return (
        <section className="pagina">
            <div className="encabezado-pagina">
                <div>
                    <h3>Equipos</h3>
                    <p>Consulta y administra los equipos registrados por contrato</p>
                </div>
                <div className="acciones-encabezado-pagina">
                    <button
                        type="button"
                        className="boton-importar-excel"
                        onClick={exportarEquiposFiltrados}
                        disabled={exportando || equiposFiltrados.length === 0}
                        title={equiposFiltrados.length === 0 ? 'No hay equipos para exportar' : 'Exportar los equipos que coinciden con los filtros actuales'}
                    >
                        <Download size={18} aria-hidden="true" />
                        <span>{exportando ? 'Exportando...' : `Exportar equipos (${equiposFiltrados.length})`}</span>
                    </button>
                    {!soloLectura && (
                        <>
                            <button
                                type="button"
                                className="boton-importar-excel"
                                onClick={() => setImportacionAbierta(true)}
                            >
                                <FileSpreadsheet size={18} aria-hidden="true" />
                                <span>Importar Excel</span>
                            </button>
                            <button type="button" className="boton-primario" onClick={abrirRegistro}>
                                <Plus size={18} aria-hidden="true" />
                                <span>Registrar equipo</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {mensaje && <div className="mensaje-exito" role="status">{mensaje}</div>}

            <ImportacionExcelModal
                abierto={importacionAbierta}
                titulo="Importar equipos desde Excel"
                descripcion="Valida equipos y periféricos antes de incorporarlos al inventario"
                plantilla="/plantillas/plantilla_importacion_equipos.xlsx"
                leerArchivo={leerImportacionEquipos}
                validar={validarImportacionEquipos}
                importar={importarEquipos}
                onCerrar={() => setImportacionAbierta(false)}
                onImportado={async (textoMensaje) => {
                    setImportacionAbierta(false);
                    setMensaje(textoMensaje);
                    await cargarDatos();
                    window.setTimeout(() => setMensaje(''), 5000);
                }}
            />

            <div className="busqueda-unificada-equipos">
                <div className="busqueda-unificada-contenedor">
                    <Search size={18} aria-hidden="true" />
                    <input
                        id="buscar-equipos-unificado"
                        type="text"
                        autoComplete="off"
                        placeholder="Buscar equipos o filtrar por tipo, contrato o estado..."
                        value={busquedaTipo}
                        onFocus={() => setMostrarSugerenciasTipo(true)}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            setBusquedaTipo(valor);
                            setBusqueda(valor);
                            setMostrarSugerenciasTipo(true);
                        }}
                        onKeyDown={(evento) => {
                            if (evento.key === 'Escape') setMostrarSugerenciasTipo(false);
                            if (evento.key === 'Enter' && sugerenciasFiltro.length === 1) {
                                evento.preventDefault();
                                seleccionarSugerenciaFiltro(sugerenciasFiltro[0]);
                            }
                        }}
                        aria-expanded={mostrarSugerenciasTipo && sugerenciasFiltro.length > 0}
                        aria-controls="sugerencias-filtro-equipos"
                    />
                    {(busquedaTipo || tipoEquipoActivo || filtroContrato || filtroEstado) && (
                        <button type="button" className="limpiar-tipo-filtro" aria-label="Limpiar búsqueda" onClick={limpiarFiltrosEquipos}>
                            <X size={16} />
                        </button>
                    )}
                    {mostrarSugerenciasTipo && sugerenciasFiltro.length > 0 && (
                        <div id="sugerencias-filtro-equipos" className="sugerencias-tipo-equipo sugerencias-unificadas-equipos" role="listbox" aria-label="Sugerencias de búsqueda">
                            {sugerenciasFiltro.map((opcion) => (
                                <button
                                    key={`${opcion.tipo}-${opcion.valor}`}
                                    type="button"
                                    role="option"
                                    aria-selected={
                                        (opcion.tipo === 'tipo' && opcion.valor === tipoEquipoActivo) ||
                                        (opcion.tipo === 'contrato' && opcion.valor === filtroContrato) ||
                                        (opcion.tipo === 'estado' && opcion.valor === filtroEstado)
                                    }
                                    onMouseDown={(evento) => evento.preventDefault()}
                                    onClick={() => seleccionarSugerenciaFiltro(opcion)}
                                >
                                    <span>{opcion.etiqueta}</span>
                                    <small>{opcion.tipo === 'tipo' ? 'Tipo de equipo' : opcion.tipo === 'contrato' ? 'Contrato' : 'Estado'}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="filtros-avanzados-equipos" aria-label="Filtros avanzados de equipos">
                <label>
                    <span>Colaborador asignado</span>
                    <input
                        type="search"
                        value={filtroUsuario}
                        onChange={(evento) => setFiltroUsuario(evento.target.value)}
                        placeholder="Nombre del colaborador..."
                    />
                </label>
                <label>
                    <span>Asignación</span>
                    <select value={filtroAsignacion} onChange={(evento) => setFiltroAsignacion(evento.target.value)}>
                        <option value="TODOS">Todos</option>
                        <option value="ASIGNADO">Con colaborador asignado</option>
                        <option value="SIN_ASIGNAR">Sin colaborador asignado</option>
                    </select>
                </label>
            </div>
            <div className="filtros-activos-equipos">
                    {tipoEquipoActivo && <button type="button" onClick={() => setTipoEquipoActivo('')} title="Quitar tipo">Tipo: {tipoEquipoActivo} <X size={13} /></button>}
                    {filtroContrato && <button type="button" onClick={() => setFiltroContrato('')} title="Quitar contrato">Contrato: {filtroContrato} <X size={13} /></button>}
                    {filtroEstado && <button type="button" onClick={() => setFiltroEstado('')} title="Quitar estado">Estado: {filtroEstado.replaceAll('_', ' ')} <X size={13} /></button>}
                    {(tipoEquipoActivo || filtroContrato || filtroEstado || filtroUsuario || filtroAsignacion !== 'TODOS' || busquedaTipo || busqueda) && <button type="button" className="limpiar-todos-filtros-equipos" onClick={limpiarFiltrosEquipos}>Limpiar</button>}
                </div>
            </div>

            <div className="barra-tabla">
                <button type="button" className="boton-actualizar" onClick={cargarDatos} disabled={cargando}>
                    <RefreshCw size={18} className={cargando ? 'girando' : ''} aria-hidden="true" />
                    Actualizar
                </button>
            </div>

            {error && (
                <div className="mensaje-conexion mensaje-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={cargarDatos}>Reintentar</button>
                </div>
            )}

            <div className="contenedor-tabla">
                {cargando ? (
                    <div className="estado-tabla">Cargando equipos...</div>
                ) : equiposFiltrados.length === 0 ? (
                    <div className="estado-tabla">No se encontraron equipos</div>
                ) : (
                    <div className="tabla-scroll">
                        <table className="tabla-equipos">
                            <thead>
                                <tr>
                                    <th>N.°</th>
                                    <th>Equipo</th>
                                    <th>Código patrimonial</th>
                                    {tipoEquipoActivoDefinicion?.acepta_imei && <th>IMEI</th>}
                                    <th>Serie</th>
                                    {camposCaracteristicosActivos.map((campo) => (
                                        <th key={campo.clave}>{campo.etiqueta}</th>
                                    ))}
                                    <th>Contrato</th>
                                    <th>Usuario actual</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {equiposFiltrados.map((equipo, index) => {
                                    const especificaciones = leerEspecificaciones(equipo.especificaciones);

                                    return (
                                        <tr key={equipo.id}>
                                            <td>{index + 1}</td>

                                            <td>
                                                <strong>
                                                    {equipo.marca || '-'} {equipo.modelo || ''}
                                                </strong>

                                                {equipo.colaborador_asignado && (
                                                    <small className="colaborador-equipo">
                                                        Asignado a: {equipo.colaborador_asignado}
                                                    </small>
                                                )}

                                                {equipo.equipo_principal_id && (
                                                    <small className="equipo-vinculo">
                                                        Vinculado a {equipo.serie_equipo_principal || '-'}
                                                    </small>
                                                )}
                                            </td>

                                            <td>{equipo.codigo_patrimonial || '-'}</td>
                                            {tipoEquipoActivoDefinicion?.acepta_imei && <td>{equipo.imei || '-'}</td>}
                                            <td>{equipo.serie || '-'}</td>
                                            {camposCaracteristicosActivos.map((campo) => (
                                                <td key={campo.clave}>
                                                    {Object.hasOwn(especificaciones, campo.clave)
                                                        ? mostrarValorEspecificacion(campo, especificaciones[campo.clave])
                                                        : '-'}
                                                </td>
                                            ))}
                                            <td>
                                                <strong>{equipo.nro_contrato || '-'}</strong>
                                                <small className="equipo-operador">{equipo.operador || ''}</small>
                                            </td>
                                            <td>{equipo.colaborador_asignado || 'SIN ASIGNAR'}</td>
                                            <td>
                                                <EtiquetaEstado className="estado-equipo" estado={equipo.estado_actual} texto={formatearEstado(equipo.estado_actual)} />
                                            </td>
                                            <td>
                                                <div className="acciones-tabla">
                                                    <BotonAccionTabla etiqueta={`Ver equipo ${equipo.marca} ${equipo.modelo}`} onClick={() => verEquipo(equipo.id)} />
                                                    {!soloLectura && (
                                                        <BotonAccionTabla tipo="editar" etiqueta={`Editar equipo ${equipo.marca} ${equipo.modelo}`} onClick={() => abrirEdicion(equipo.id)} />
                                                    )}
                                                    {!soloLectura &&
                                                        TIPOS_PRINCIPALES_PERIFERICOS.has(equipo.tipo) && (
                                                            <BotonAccionTabla
                                                                tipo="perifericos"
                                                                etiqueta={`Gestionar periféricos de ${equipo.marca} ${equipo.modelo}`}
                                                                onClick={() => abrirGestionPerifericos(equipo)}
                                                            />
                                                        )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {!cargando && <div className="pie-tabla">Mostrando {equiposFiltrados.length} de {equipos.length} equipos</div>}
            </div>

            {modalAbierto && (
                <DialogoAccesible
                    className="modal-equipo-registro"
                    tituloId="equipo-formulario-titulo"
                    descripcionId="equipo-formulario-descripcion"
                    onCerrar={cerrarModal}
                    bloqueado={guardando}
                    ocupado={guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="equipo-formulario-titulo">{equipoEditandoId ? 'Editar equipo' : 'Registrar equipos'}</h3>
                            <p id="equipo-formulario-descripcion">
                                {equipoEditandoId ? 'Modifica los datos del equipo seleccionado' : 'Registra una unidad o un paquete bajo un contrato vigente'}
                            </p>
                        </div>
                        <button type="button" className="modal-cerrar" onClick={cerrarModal} disabled={guardando} aria-label="Cerrar formulario de equipo">
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    <form onSubmit={guardarEquipo}>
                        {errorFormulario && <div className="error-formulario" role="alert">{errorFormulario}</div>}

                        {!equipoEditandoId && (
                            <div className="selector-modo-registro" role="group" aria-label="Forma de registro">
                                <button type="button" className={modoRegistro === 'UNIDAD' ? 'activo' : ''} aria-pressed={modoRegistro === 'UNIDAD'} onClick={() => setModoRegistro('UNIDAD')}>
                                    <ListPlus size={18} aria-hidden="true" /> Por unidad
                                </button>
                                <button type="button" className={modoRegistro === 'LOTE' ? 'activo' : ''} aria-pressed={modoRegistro === 'LOTE'} onClick={() => setModoRegistro('LOTE')}>
                                    <PackagePlus size={18} aria-hidden="true" /> Por lote
                                </button>
                            </div>
                        )}

                        <div className="formulario-grid">
                            <div className="campo-formulario">
                                <label htmlFor="tipo">Tipo de equipo *</label>
                                <select id="tipo" name="tipo" value={formulario.tipo} onChange={actualizarFormulario} disabled={guardando} required>
                                    <option value="">Seleccionar tipo</option>
                                    {tiposEquipo.map((tipo) => (
                                        <option key={tipo.codigo} value={tipo.codigo}>
                                            {tipo.codigo}
                                        </option>
                                    ))}
                                </select>
                                <small className="ayuda-campo">
                                    {equipoEditandoId
                                        ? 'El estado cambia desde asignaciones, devoluciones o movimientos.'
                                        : 'El equipo nuevo se registrará como Libre.'}
                                </small>
                            </div>
                            <div className="campo-formulario">
                                <label htmlFor="marca">Marca *</label>
                                <input id="marca" name="marca" maxLength="50" placeholder="Ejemplo: Samsung" value={formulario.marca} onChange={actualizarFormulario} disabled={guardando} required />
                            </div>
                            <div className="campo-formulario">
                                <label htmlFor="modelo">Modelo *</label>
                                <input id="modelo" name="modelo" maxLength="100" placeholder="Ejemplo: Galaxy A55" value={formulario.modelo} onChange={actualizarFormulario} disabled={guardando} required />
                            </div>
                            <div className="campo-formulario">
                                <label htmlFor="contrato_id">Contrato *</label>
                                <select id="contrato_id" name="contrato_id" value={formulario.contrato_id} onChange={actualizarFormulario} disabled={guardando || Boolean(equipoEditandoId)} required>
                                    <option value="">Seleccionar contrato vigente</option>
                                    {contratasFormulario.map((contrata) => (
                                        <option key={contrata.id} value={contrata.id}>{contrata.nro_contrato} — {contrata.operador}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="campo-formulario campo-completo">
                                <label htmlFor="contrato_gama_id">Gama del contrato *</label>
                                <select id="contrato_gama_id" name="contrato_gama_id" value={formulario.contrato_gama_id} onChange={actualizarFormulario} disabled={guardando || !formulario.contrato_id} required>
                                    <option value="">Seleccionar gama</option>
                                    {gamasDeContrata.map((relacion) => (
                                        <option key={relacion.id} value={relacion.id}>{relacion.codigo_gama} — {relacion.gama}</option>
                                    ))}
                                </select>
                                {contratasDisponibles.length === 0 && !equipoEditandoId && (
                                    <small className="ayuda-campo">Primero registra un contrato vigente con al menos una gama.</small>
                                )}
                            </div>
                        </div>

                        {tipoSeleccionado &&
                            (equipoEditandoId || modoRegistro === 'UNIDAD') && (
                                <fieldset className="seccion-formulario-dinamico">
                                    <legend>
                                        Identificación y especificaciones de {tipoSeleccionado.codigo}
                                    </legend>
                                    <div className="formulario-tecnico-grid">
                                        <div className="campo-formulario">
                                            <label htmlFor="codigo_patrimonial">Código patrimonial</label>
                                            <input id="codigo_patrimonial" name="codigo_patrimonial" maxLength="50" placeholder="Código interno del activo" value={formulario.codigo_patrimonial} onChange={actualizarFormulario} disabled={guardando} />
                                        </div>
                                        <div className="campo-formulario">
                                            <label htmlFor="serie">Número de serie</label>
                                            <input id="serie" name="serie" maxLength="30" placeholder="Ejemplo: EQ-SER-0102" value={formulario.serie} onChange={actualizarFormulario} disabled={guardando} />
                                        </div>
                                        {tipoSeleccionado.acepta_imei && (
                                            <div className="campo-formulario">
                                                <label htmlFor="imei">IMEI</label>
                                                <input id="imei" name="imei" inputMode="numeric" maxLength="30" placeholder="IMEI del equipo" value={formulario.imei} onChange={actualizarFormulario} disabled={guardando} />
                                            </div>
                                        )}
                                        {tipoSeleccionado.campos.map((campo) => (
                                            <CampoTecnico
                                                key={campo.clave}
                                                id={`especificacion-${campo.clave}`}
                                                campo={campo}
                                                valor={formulario.especificaciones[campo.clave] ?? ''}
                                                onChange={(valor) => actualizarEspecificacion(campo.clave, valor)}
                                                disabled={guardando}
                                            />
                                        ))}
                                        <div className="campo-formulario campo-completo">
                                            <label htmlFor="observaciones">Observaciones</label>
                                            <textarea id="observaciones" name="observaciones" maxLength="5000" rows="3" placeholder="Datos adicionales del equipo" value={formulario.observaciones} onChange={actualizarFormulario} disabled={guardando} />
                                        </div>
                                    </div>
                                </fieldset>
                            )}

                        {tipoSeleccionado &&
                            !equipoEditandoId &&
                            modoRegistro === 'UNIDAD' &&
                            TIPOS_PRINCIPALES_PERIFERICOS.has(
                                tipoSeleccionado.codigo
                            ) && (
                                <EditorPerifericos
                                    catalogo={tiposEquipo}
                                    valores={perifericosFormulario}
                                    prefijo="unidad"
                                    disabled={guardando}
                                    onCambiar={actualizarPerifericoFormulario}
                                    onCambiarEspecificacion={actualizarEspecificacionPeriferico}
                                    onAgregar={agregarPerifericoFormulario}
                                    onEliminar={eliminarPerifericoFormulario}
                                />
                            )}

                        {tipoSeleccionado &&
                            !equipoEditandoId &&
                            modoRegistro === 'LOTE' && (
                                <fieldset className="seccion-formulario-dinamico">
                                    <legend>Especificaciones comunes del lote</legend>
                                    <p className="ayuda-seccion">
                                        Estos valores se aplicarán a todas las unidades del lote.
                                    </p>
                                    <div className="formulario-tecnico-grid">
                                        {tipoSeleccionado.campos
                                            .filter((campo) => !campo.por_unidad)
                                            .map((campo) => (
                                                <CampoTecnico
                                                    key={campo.clave}
                                                    id={`especificacion-comun-${campo.clave}`}
                                                    campo={campo}
                                                    valor={formulario.especificaciones[campo.clave] ?? ''}
                                                    onChange={(valor) => actualizarEspecificacion(campo.clave, valor)}
                                                    disabled={guardando}
                                                />
                                            ))}
                                        <div className="campo-formulario campo-completo">
                                            <label htmlFor="observaciones">Observaciones comunes</label>
                                            <textarea id="observaciones" name="observaciones" maxLength="5000" rows="3" placeholder="Datos aplicables a todo el lote" value={formulario.observaciones} onChange={actualizarFormulario} disabled={guardando} />
                                        </div>
                                    </div>
                                </fieldset>
                            )}

                        {!equipoEditandoId &&
                            modoRegistro === 'LOTE' &&
                            tipoSeleccionado && (
                                <div className="editor-lote">
                                    <div className="editor-lote-encabezado">
                                        <div><strong>Equipos del lote</strong><span>{filasLote.length} de 100</span></div>
                                        <button type="button" onClick={agregarFilaLote} disabled={guardando || filasLote.length >= 100}>
                                            <Plus size={17} aria-hidden="true" /> Agregar fila
                                        </button>
                                    </div>
                                    <div className="editor-lote-lista">
                                        {filasLote.map((fila, indice) => (
                                            <article className="editor-lote-fila" key={fila.idLocal}>
                                                <div className="editor-lote-fila-encabezado">
                                                    <span className="editor-lote-numero">{indice + 1}</span>
                                                    <strong>Unidad {indice + 1}</strong>
                                                    <button type="button" aria-label={`Quitar equipo ${indice + 1}`} onClick={() => eliminarFilaLote(fila.idLocal)} disabled={guardando || filasLote.length === 1}>
                                                        <Trash2 size={17} aria-hidden="true" />
                                                    </button>
                                                </div>
                                                <div className="editor-lote-campos">
                                                    <div className="campo-formulario">
                                                        <label htmlFor={`patrimonio-${fila.idLocal}`}>Código patrimonial</label>
                                                        <input id={`patrimonio-${fila.idLocal}`} maxLength="50" value={fila.codigo_patrimonial} onChange={(evento) => actualizarFilaLote(fila.idLocal, 'codigo_patrimonial', evento.target.value)} disabled={guardando} />
                                                    </div>
                                                    <div className="campo-formulario">
                                                        <label htmlFor={`serie-${fila.idLocal}`}>Serie</label>
                                                        <input id={`serie-${fila.idLocal}`} maxLength="30" value={fila.serie} onChange={(evento) => actualizarFilaLote(fila.idLocal, 'serie', evento.target.value)} disabled={guardando} />
                                                    </div>
                                                    {tipoSeleccionado.acepta_imei && (
                                                        <div className="campo-formulario">
                                                            <label htmlFor={`imei-${fila.idLocal}`}>IMEI</label>
                                                            <input id={`imei-${fila.idLocal}`} inputMode="numeric" maxLength="30" value={fila.imei} onChange={(evento) => actualizarFilaLote(fila.idLocal, 'imei', evento.target.value)} disabled={guardando} />
                                                        </div>
                                                    )}
                                                    {tipoSeleccionado.campos
                                                        .filter((campo) => campo.por_unidad)
                                                        .map((campo) => (
                                                            <CampoTecnico
                                                                key={campo.clave}
                                                                id={`${campo.clave}-${fila.idLocal}`}
                                                                campo={campo}
                                                                valor={fila.especificaciones[campo.clave] ?? ''}
                                                                onChange={(valor) => actualizarEspecificacionLote(fila.idLocal, campo.clave, valor)}
                                                                disabled={guardando}
                                                            />
                                                        ))}
                                                    {TIPOS_PRINCIPALES_PERIFERICOS.has(
                                                        tipoSeleccionado.codigo
                                                    ) && (
                                                            <EditorPerifericos
                                                                catalogo={tiposEquipo}
                                                                valores={fila.perifericos}
                                                                prefijo={`lote-${fila.idLocal}`}
                                                                disabled={guardando}
                                                                compacto
                                                                onCambiar={(tipo, indicePeriferico, campo, valor) =>
                                                                    actualizarPerifericoLote(fila.idLocal, tipo, indicePeriferico, campo, valor)
                                                                }
                                                                onCambiarEspecificacion={(tipo, indicePeriferico, clave, valor) =>
                                                                    actualizarEspecificacionPerifericoLote(fila.idLocal, tipo, indicePeriferico, clave, valor)
                                                                }
                                                                onAgregar={(tipo) => agregarPerifericoLote(fila.idLocal, tipo)}
                                                                onEliminar={(tipo, indicePeriferico) => eliminarPerifericoLote(fila.idLocal, tipo, indicePeriferico)}
                                                            />
                                                        )}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            )}

                        <div className="modal-acciones">
                            <button type="button" className="boton-cancelar" onClick={cerrarModal} disabled={guardando}>Cancelar</button>
                            <button type="submit" className="boton-guardar" disabled={guardando || (!equipoEditandoId && contratasDisponibles.length === 0)}>
                                <Save size={18} aria-hidden="true" />
                                {guardando ? 'Guardando...' : equipoEditandoId ? 'Actualizar equipo' : modoRegistro === 'LOTE' ? 'Guardar lote' : 'Guardar equipo'}
                            </button>
                        </div>
                    </form>
                </DialogoAccesible>
            )}

            {gestionPerifericosAbierta && equipoPrincipal && (
                <DialogoAccesible
                    className="modal-equipo-registro modal-gestion-perifericos"
                    tituloId="gestion-perifericos-titulo"
                    descripcionId="gestion-perifericos-descripcion"
                    onCerrar={cerrarGestionPerifericos}
                    bloqueado={guardandoPeriferico}
                    ocupado={guardandoPeriferico}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="gestion-perifericos-titulo">
                                Periféricos del equipo
                            </h3>
                            <p id="gestion-perifericos-descripcion">
                                {equipoPrincipal.marca} {equipoPrincipal.modelo}
                                {' · '}ID {equipoPrincipal.id}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarGestionPerifericos}
                            disabled={guardandoPeriferico}
                            aria-label="Cerrar gestión de periféricos"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="gestion-perifericos-contenido">
                        {errorPerifericos && (
                            <div className="error-formulario" role="alert">
                                {errorPerifericos}
                            </div>
                        )}

                        {cargandoPerifericos ? (
                            <div className="detalle-cargando">
                                Cargando periféricos...
                            </div>
                        ) : (
                            <div className="tarjetas-perifericos-actuales">
                                {TIPOS_PERIFERICO.map((tipo) => {
                                    const actuales = perifericosActuales.filter(
                                        (periferico) => periferico.tipo === tipo
                                    );
                                    const vinculado = actuales.length > 0;
                                    const IconoTipo = ICONOS_PERIFERICO[tipo] ?? Monitor;

                                    return (
                                        <article
                                            className={`tarjeta-periferico-actual${vinculado ? '' : ' sin-vincular'}`}
                                            key={tipo}
                                        >
                                            <div className="tarjeta-periferico-cabecera">
                                                <span className="icono-tipo-periferico" aria-hidden="true">
                                                    <IconoTipo size={16} />
                                                </span>
                                                <strong>{tipo}</strong>
                                            </div>

                                            {vinculado ? (
                                                <div className="lista-perifericos-vinculados">
                                                    {actuales.map((actual, indice) => (
                                                        <div
                                                            className="item-periferico-vinculado"
                                                            key={actual.vinculo_id || actual.id || `${tipo}-${indice}`}
                                                        >
                                                            <span>
                                                                {actuales.length > 1 && <b>#{indice + 1} </b>}
                                                                {actual.marca} {actual.modelo}
                                                            </span>
                                                            <small>
                                                                {actual.codigo_patrimonial ||
                                                                    actual.serie ||
                                                                    `ID ${actual.id}`}
                                                            </small>

                                                            <small>
                                                                Serie: {actual.serie || '-'}
                                                            </small>

                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="texto-sin-vincular">Sin periférico vinculado</span>
                                            )}

                                            <div className="acciones-periferico-actual">
                                                {actuales.map((actual, indice) => (
                                                    <div
                                                        className="acciones-periferico-individual"
                                                        key={`acciones-${actual.vinculo_id || actual.id || indice}`}
                                                    >
                                                        <span className="etiqueta-periferico-individual">
                                                            {actuales.length > 1 ? `${tipo} #${indice + 1}` : tipo}
                                                        </span>
                                                        <span className="botones-periferico-individual">
                                                            <button
                                                                type="button"
                                                                className="boton-icono-periferico boton-reemplazar-icono"
                                                                onClick={() => iniciarGestionPeriferico(tipo, actual.vinculo_id)}
                                                                disabled={guardandoPeriferico}
                                                                aria-label={`Reemplazar ${tipo}${actuales.length > 1 ? ` #${indice + 1}` : ''}`}
                                                                title="Reemplazar"
                                                            >
                                                                <Pencil size={13} aria-hidden="true" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="boton-icono-periferico boton-desvincular-icono"
                                                                onClick={() => desvincularPeriferico(tipo, actual.vinculo_id)}
                                                                disabled={guardandoPeriferico}
                                                                aria-label={`Desvincular ${tipo}${actuales.length > 1 ? ` #${indice + 1}` : ''}`}
                                                                title="Desvincular"
                                                            >
                                                                <X size={14} aria-hidden="true" />
                                                            </button>
                                                        </span>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    className="boton-agregar-periferico-tipo"
                                                    onClick={() => iniciarGestionPeriferico(tipo)}
                                                    disabled={guardandoPeriferico}
                                                >
                                                    <Plus size={13} aria-hidden="true" />
                                                    {vinculado ? `Agregar otro ${tipo}` : `Agregar ${tipo}`}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {tipoPerifericoGestion && (
                            <form
                                className="formulario-gestion-periferico"
                                onSubmit={guardarGestionPeriferico}
                            >
                                <div className="encabezado-formulario-periferico">
                                    <div>
                                        <h4>
                                            {vinculoPerifericoGestionId
                                                ? `Reemplazar ${tipoPerifericoGestion}`
                                                : `Agregar ${tipoPerifericoGestion}`}
                                        </h4>
                                        <p>
                                            Selecciona un periférico libre ya registrado o registra uno nuevo.
                                        </p>
                                    </div>
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="gestion-periferico-modo">Origen del periférico</label>
                                    <select id="gestion-periferico-modo" value={modoPerifericoGestion}
                                        onChange={(evento) => setModoPerifericoGestion(evento.target.value)}
                                        disabled={guardandoPeriferico}>
                                        {perifericosDisponibles.length > 0 && <option value="EXISTENTE">Seleccionar periférico libre existente</option>}
                                        <option value="NUEVO">Registrar un periférico nuevo</option>
                                    </select>
                                </div>
                                {modoPerifericoGestion === 'EXISTENTE' ? (
                                    <div className="campo-formulario campo-completo">
                                        <label htmlFor="gestion-periferico-existente">Periféricos libres</label>
                                        <select id="gestion-periferico-existente" value={perifericoDisponibleId}
                                            onChange={(evento) => setPerifericoDisponibleId(evento.target.value)}
                                            disabled={guardandoPeriferico || perifericosDisponibles.length === 0} required>
                                            {perifericosDisponibles.map((periferico) => (
                                                <option key={periferico.id} value={String(periferico.id)}>
                                                    {periferico.marca} {periferico.modelo}
                                                    {periferico.serie ? ` · Serie: ${periferico.serie}` : ''}
                                                    {periferico.codigo_patrimonial ? ` · Código: ${periferico.codigo_patrimonial}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <small>Se reutilizará el registro seleccionado; no se creará un duplicado.</small>
                                    </div>
                                ) : (
                                    <div className="formulario-tecnico-grid">
                                        <div className="campo-formulario">
                                            <label htmlFor="gestion-periferico-marca">
                                                Marca *
                                            </label>
                                            <input
                                                id="gestion-periferico-marca"
                                                value={perifericoGestion.marca}
                                                maxLength="50"
                                                onChange={(evento) => actualizarGestionPeriferico('marca', evento.target.value)}
                                                disabled={guardandoPeriferico}
                                                required
                                            />
                                        </div>
                                        <div className="campo-formulario">
                                            <label htmlFor="gestion-periferico-modelo">
                                                Modelo *
                                            </label>
                                            <input
                                                id="gestion-periferico-modelo"
                                                value={perifericoGestion.modelo}
                                                maxLength="100"
                                                onChange={(evento) => actualizarGestionPeriferico('modelo', evento.target.value)}
                                                disabled={guardandoPeriferico}
                                                required
                                            />
                                        </div>
                                        <div className="campo-formulario">
                                            <label htmlFor="gestion-periferico-patrimonio">
                                                Código patrimonial
                                            </label>
                                            <input
                                                id="gestion-periferico-patrimonio"
                                                value={perifericoGestion.codigo_patrimonial}
                                                maxLength="50"
                                                onChange={(evento) => actualizarGestionPeriferico('codigo_patrimonial', evento.target.value)}
                                                disabled={guardandoPeriferico}
                                            />
                                        </div>
                                        <div className="campo-formulario">
                                            <label htmlFor="gestion-periferico-serie">
                                                Serie
                                            </label>
                                            <input
                                                id="gestion-periferico-serie"
                                                value={perifericoGestion.serie}
                                                maxLength="30"
                                                onChange={(evento) => actualizarGestionPeriferico('serie', evento.target.value)}
                                                disabled={guardandoPeriferico}
                                            />
                                        </div>
                                        {tiposEquipo
                                            .find(({ codigo }) => codigo === tipoPerifericoGestion)
                                            ?.campos.map((campo) => (
                                                <CampoTecnico
                                                    key={campo.clave}
                                                    id={`gestion-${tipoPerifericoGestion}-${campo.clave}`}
                                                    campo={campo}
                                                    valor={perifericoGestion.especificaciones[campo.clave] ?? ''}
                                                    onChange={(valor) => actualizarEspecificacionGestion(campo.clave, valor)}
                                                    disabled={guardandoPeriferico}
                                                />
                                            ))}
                                        <div className="campo-formulario campo-completo">
                                            <label htmlFor="gestion-periferico-observaciones">
                                                Observaciones
                                            </label>
                                            <textarea
                                                id="gestion-periferico-observaciones"
                                                value={perifericoGestion.observaciones}
                                                maxLength="5000"
                                                rows="3"
                                                onChange={(evento) => actualizarGestionPeriferico('observaciones', evento.target.value)}
                                                disabled={guardandoPeriferico}
                                            />
                                        </div>
                                    </div>

                                )}

                                <div className="acciones-formulario-periferico">
                                    <button
                                        type="button"
                                        className="boton-cancelar"
                                        onClick={() => { setTipoPerifericoGestion(''); setVinculoPerifericoGestionId(null); }}
                                        disabled={guardandoPeriferico}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="boton-guardar"
                                        disabled={guardandoPeriferico}
                                    >
                                        <Save size={18} aria-hidden="true" />
                                        {guardandoPeriferico
                                            ? 'Guardando...'
                                            : 'Guardar periférico'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </DialogoAccesible>
            )}

            {perifericoHistorialActivo && (
                <DialogoAccesible
                    className="modal-detalle modal-historial-periferico"
                    tituloId="historial-periferico-titulo"
                    descripcionId="historial-periferico-descripcion"
                    onCerrar={() => setPerifericoHistorialActivo(null)}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="historial-periferico-titulo">Historial del periférico</h3>
                            <p id="historial-periferico-descripcion">
                                {perifericoHistorialActivo.tipo}: {perifericoHistorialActivo.marca} {perifericoHistorialActivo.modelo}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={() => setPerifericoHistorialActivo(null)}
                            aria-label="Cerrar historial del periférico"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="contenido-historial-periferico">
                        <div className="historial-periferico-identificacion">
                            <span>Serie</span>
                            <strong>{perifericoHistorialActivo.serie || 'Sin serie registrada'}</strong>
                        </div>
                        {erroresHistorialPerifericos[perifericoHistorialActivo.id] ? (
                            <p className="historial-equipo-error" role="alert">
                                {erroresHistorialPerifericos[perifericoHistorialActivo.id]}
                            </p>
                        ) : (historialPerifericos[perifericoHistorialActivo.id] || []).length ? (
                            <ol className="historial-equipo-lista">
                                {(historialPerifericos[perifericoHistorialActivo.id] || []).map((movimiento) => (
                                    <li key={movimiento.id} className="historial-equipo-item">
                                        <span className="historial-equipo-icono"><History size={16} aria-hidden="true" /></span>
                                        <div className="historial-equipo-contenido">
                                            <div className="historial-equipo-linea">
                                                <strong>{formatearTipoMovimiento(movimiento.tipo_movimiento)}</strong>
                                                <time dateTime={fechaIsoHistorial(movimiento.fecha)}>
                                                    {formatearFechaHistorial(movimiento.fecha)}
                                                </time>
                                            </div>
                                            <p>{movimiento.descripcion || 'Sin descripción adicional.'}</p>
                                            <div className="historial-equipo-meta">
                                                <span>Colaborador: {movimiento.colaborador || 'No indicado'}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="historial-equipo-estado">No hay movimientos registrados para este periférico.</p>
                        )}
                    </div>
                </DialogoAccesible>
            )}

            {detalleAbierto && (
                <DialogoAccesible className="modal-detalle" tituloId="equipo-detalle-titulo" descripcionId="equipo-detalle-descripcion" onCerrar={() => setDetalleAbierto(false)}>
                    <div className="modal-encabezado">
                        <div><h3 id="equipo-detalle-titulo">Detalle del equipo</h3><p id="equipo-detalle-descripcion">Información completa del registro</p></div>
                        <button type="button" className="modal-cerrar" onClick={() => setDetalleAbierto(false)} aria-label="Cerrar detalle del equipo"><X size={20} aria-hidden="true" /></button>
                    </div>
                    {cargandoDetalle ? (
                        <div className="detalle-cargando">Cargando información...</div>
                    ) : equipoSeleccionado ? (
                        <div className="detalle-equipo">
                            <div className="detalle-destacado">
                                <div className="detalle-icono"><MonitorSmartphone size={28} aria-hidden="true" /></div>
                                <div>
                                    <h4>{equipoSeleccionado.marca} {equipoSeleccionado.modelo}</h4>
                                    <EtiquetaEstado className="estado-equipo" estado={equipoSeleccionado.estado_actual} texto={formatearEstado(equipoSeleccionado.estado_actual)} />
                                </div>
                            </div>
                            <div className="detalle-grid">
                                <CampoDetalle etiqueta="ID" valor={equipoSeleccionado.id} />
                                <CampoDetalle etiqueta="Tipo" valor={equipoSeleccionado.tipo} />
                                <CampoDetalle etiqueta="Código patrimonial" valor={equipoSeleccionado.codigo_patrimonial} />
                                {tipoDetalle?.acepta_imei && (
                                    <CampoDetalle etiqueta="IMEI" valor={equipoSeleccionado.imei} />
                                )}
                                <CampoDetalle etiqueta="Serie" valor={equipoSeleccionado.serie} />
                                <CampoDetalle etiqueta="Operador" valor={equipoSeleccionado.operador} />
                                <CampoDetalle etiqueta="Gama" valor={equipoSeleccionado.gama || equipoSeleccionado.codigo_gama} />
                                <CampoDetalle etiqueta="Contrato" valor={equipoSeleccionado.nro_contrato} completo claseCompleto="detalle-ancho-completo" />
                                {tipoDetalle?.campos
                                    .filter((campo) => Object.hasOwn(
                                        leerEspecificaciones(equipoSeleccionado.especificaciones),
                                        campo.clave
                                    ))
                                    .map((campo) => (
                                        <CampoDetalle
                                            key={campo.clave}
                                            etiqueta={campo.etiqueta}
                                            valor={mostrarValorEspecificacion(
                                                campo,
                                                leerEspecificaciones(equipoSeleccionado.especificaciones)[campo.clave]
                                            )}
                                        />
                                    ))}
                                <CampoDetalle etiqueta="Observaciones" valor={equipoSeleccionado.observaciones} completo claseCompleto="detalle-ancho-completo" />
                            </div>
                            {TIPOS_PRINCIPALES_PERIFERICOS.has(
                                equipoSeleccionado.tipo
                            ) && (
                                    <section className="detalle-perifericos">
                                        <h5>Periféricos vinculados</h5>
                                        {equipoSeleccionado.perifericos.length > 0 ? (
                                            <div className="detalle-perifericos-grid">
                                                {equipoSeleccionado.perifericos.map(
                                                    (periferico) => (
                                                        <article key={periferico.id}>
                                                            <strong>{periferico.tipo}</strong>
                                                            <span>
                                                                {periferico.marca} {periferico.modelo}
                                                            </span>
                                                            <small>
                                                                {periferico.serie || `ID ${periferico.id}`}
                                                            </small>
                                                            <button
                                                                type="button"
                                                                className="boton-historial-periferico"
                                                                onClick={() => setPerifericoHistorialActivo(periferico)}
                                                            >
                                                                <History size={14} aria-hidden="true" />
                                                                Ver historial ({(historialPerifericos[periferico.id] || []).length})
                                                            </button>
                                                        </article>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p>Este equipo no tiene periféricos vinculados.</p>
                                        )}
                                    </section>
                                )}

                            <section className="historial-equipo" aria-labelledby="historial-equipo-titulo">
                                <div className="historial-equipo-encabezado">
                                    <div>
                                        <h5 id="historial-equipo-titulo">Historial del equipo</h5>
                                        <p>Registro cronológico de movimientos y responsables.</p>
                                    </div>
                                    <span className="historial-equipo-contador">{historialEquipo.length}</span>
                                </div>

                                {cargandoHistorial ? (
                                    <p className="historial-equipo-estado" role="status">Cargando historial...</p>
                                ) : errorHistorial ? (
                                    <p className="historial-equipo-error" role="alert">{errorHistorial}</p>
                                ) : historialEquipo.length === 0 ? (
                                    <p className="historial-equipo-estado">No hay movimientos registrados para este equipo.</p>
                                ) : (
                                    <ol className="historial-equipo-lista">
                                        {historialEquipo.map((movimiento) => (
                                            <li key={movimiento.id} className="historial-equipo-item">
                                                <span className="historial-equipo-icono"><History size={16} aria-hidden="true" /></span>
                                                <div className="historial-equipo-contenido">
                                                    <div className="historial-equipo-linea">
                                                        <strong>{formatearTipoMovimiento(movimiento.tipo_movimiento)}</strong>
                                                        <time dateTime={fechaIsoHistorial(movimiento.fecha)}>
                                                            {formatearFechaHistorial(movimiento.fecha)}
                                                        </time>
                                                    </div>
                                                    <p>{movimiento.descripcion || 'Sin descripción adicional.'}</p>
                                                    <div className="historial-equipo-meta">
                                                        <span>Colaborador: {movimiento.colaborador || 'No indicado'}</span>
                                                        <span>Autorizado por: {movimiento.autorizado_por || 'No indicado'}</span>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </section>
                        </div>
                    ) : null}
                </DialogoAccesible>
            )}
        </section>
    );
}

function EditorPerifericos({
    catalogo,
    valores,
    prefijo,
    disabled,
    compacto = false,
    onCambiar,
    onCambiarEspecificacion,
    onAgregar,
    onEliminar
}) {
    return (
        <fieldset className={`editor-perifericos ${compacto ? 'compacto' : ''}`}>
            <legend>Periféricos del equipo</legend>
            <div className="ayuda-perifericos">
                <div className="ayuda-perifericos-icono"><ListPlus size={16} aria-hidden="true" /></div>
                <div>
                    <strong>Configuración de periféricos</strong>
                    <p>Para un COMPUTADOR son obligatorios un MONITOR, un TECLADO y un MOUSE. También puedes agregar periféricos adicionales, incluso más de uno del mismo tipo.</p>
                </div>
            </div>

            <div className="lista-editores-periferico">
                {TIPOS_PERIFERICO.map((tipo) => {
                    const perifericos = Array.isArray(valores[tipo])
                        ? valores[tipo]
                        : [valores[tipo]];
                    const definicion = catalogo.find(
                        ({ codigo }) => codigo === tipo
                    );

                    return (
                        <article className="editor-periferico" key={tipo}>
                            <div className="encabezado-editor-periferico">
                                <div className="titulo-editor-periferico">
                                    <strong>{tipo}</strong>
                                    {TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR.includes(tipo) && (
                                        <span className="badge-obligatorio">Obligatorio</span>
                                    )}
                                </div>
                                <span className="contador-editor-periferico">
                                    {perifericos.filter(({ habilitado }) => habilitado).length} incluido(s)
                                </span>
                            </div>

                            {perifericos.map((periferico, indice) => {
                                const idBase = `${prefijo}-${tipo.toLowerCase().replaceAll(' ', '-')}-${indice}`;
                                return (
                                    <div className="bloque-periferico" key={`${tipo}-${indice}`}>
                                        <label className="selector-periferico" htmlFor={`${idBase}-habilitado`}>
                                            <input
                                                id={`${idBase}-habilitado`}
                                                type="checkbox"
                                                checked={periferico.habilitado}
                                                onChange={(evento) => onCambiar(tipo, indice, 'habilitado', evento.target.checked)}
                                                disabled={disabled}
                                            />
                                            <span>{tipo} {perifericos.length > 1 ? `#${indice + 1}` : ''}</span>
                                            <small className={periferico.habilitado ? 'estado-incluido' : ''}>{periferico.habilitado ? 'Se registrará y vinculará' : 'No incluido'}</small>
                                        </label>

                                        {periferico.habilitado && (
                                            <div className="campos-periferico">
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-marca`}>Marca *</label>
                                                    <input id={`${idBase}-marca`} value={periferico.marca} maxLength="50" onChange={(evento) => onCambiar(tipo, indice, 'marca', evento.target.value)} disabled={disabled} required />
                                                </div>
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-modelo`}>Modelo *</label>
                                                    <input id={`${idBase}-modelo`} value={periferico.modelo} maxLength="100" onChange={(evento) => onCambiar(tipo, indice, 'modelo', evento.target.value)} disabled={disabled} required />
                                                </div>
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-patrimonio`}>Código patrimonial</label>
                                                    <input id={`${idBase}-patrimonio`} value={periferico.codigo_patrimonial} maxLength="50" onChange={(evento) => onCambiar(tipo, indice, 'codigo_patrimonial', evento.target.value)} disabled={disabled} />
                                                </div>
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-serie`}>Serie</label>
                                                    <input id={`${idBase}-serie`} value={periferico.serie} maxLength="30" onChange={(evento) => onCambiar(tipo, indice, 'serie', evento.target.value)} disabled={disabled} />
                                                </div>
                                                {definicion?.campos.map((campo) => (
                                                    <CampoTecnico
                                                        key={campo.clave}
                                                        id={`${idBase}-${campo.clave}`}
                                                        campo={campo}
                                                        valor={periferico.especificaciones[campo.clave] ?? ''}
                                                        onChange={(valor) => onCambiarEspecificacion(tipo, indice, campo.clave, valor)}
                                                        disabled={disabled}
                                                    />
                                                ))}
                                                <div className="campo-formulario campo-completo">
                                                    <label htmlFor={`${idBase}-observaciones`}>Observaciones</label>
                                                    <textarea id={`${idBase}-observaciones`} value={periferico.observaciones} maxLength="5000" rows="2" onChange={(evento) => onCambiar(tipo, indice, 'observaciones', evento.target.value)} disabled={disabled} />
                                                </div>
                                                {perifericos.length > 1 && (
                                                    <button type="button" className="boton-quitar-periferico" onClick={() => onEliminar(tipo, indice)} disabled={disabled}>
                                                        <Trash2 size={15} aria-hidden="true" /> Quitar este periférico
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <button type="button" className="boton-agregar-periferico" onClick={() => onAgregar(tipo)} disabled={disabled}>
                                <Plus size={15} aria-hidden="true" />
                                Agregar otro {tipo}
                            </button>
                        </article>
                    );
                })}
            </div>
        </fieldset>
    );
}

function CampoTecnico({
    id,
    campo,
    valor,
    onChange,
    disabled
}) {
    const etiqueta = campo.unidad
        ? `${campo.etiqueta} (${campo.unidad})`
        : campo.etiqueta;

    return (
        <div className="campo-formulario campo-tecnico">
            <label htmlFor={id}>
                {etiqueta}{campo.requerido ? ' *' : ''}
            </label>

            {campo.tipo === 'select' ? (
                <select
                    id={id}
                    value={valor}
                    onChange={(evento) => onChange(evento.target.value)}
                    disabled={disabled}
                    required={campo.requerido}
                >
                    <option value="">Seleccionar</option>
                    {campo.opciones.map((opcion) => (
                        <option key={opcion} value={opcion}>
                            {opcion.replaceAll('_', ' ')}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    id={id}
                    type={campo.tipo}
                    value={valor}
                    min={campo.min}
                    max={campo.max}
                    step={campo.step}
                    maxLength={campo.max_length}
                    placeholder={campo.placeholder || ''}
                    onChange={(evento) => onChange(evento.target.value)}
                    disabled={disabled}
                    required={campo.requerido}
                />
            )}
        </div>
    );
}

export default EquiposPage;
