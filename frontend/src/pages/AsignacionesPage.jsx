import { useEffect, useRef, useState } from 'react';

import {
    Plus,
    RefreshCw,
    ClipboardList,
    X,
    Save,
    RotateCcw,
    FileText
} from 'lucide-react';

import {
    listarAsignaciones,
    listarActasDisponibles,
    registrarAsignacion,
    obtenerAsignacionPorId,
    devolverAsignacion,
    enviarActaPorCorreo
} from '../services/asignacionService';

import {
    listarColaboradores
} from '../services/colaboradorService';

import {
    listarEquipos
} from '../services/equipoService';
import DialogoAccesible from '../components/DialogoAccesible';
import CampoBusqueda from '../components/CampoBusqueda';
import BotonAccionTabla from '../components/BotonAccionTabla';
import './AsignacionesPage.css';


function SelectorBusqueda({
    id,
    name,
    value,
    options,
    placeholder,
    disabled = false,
    onChange,
    getLabel,
    getSearchText
}) {
    const selectorRef = useRef(null);
    const [busquedaLocal, setBusquedaLocal] = useState('');
    const [abierto, setAbierto] = useState(false);

    useEffect(() => {
        if (!abierto) return undefined;

        const cerrarSiClickFuera = (evento) => {
            if (selectorRef.current && !selectorRef.current.contains(evento.target)) {
                setAbierto(false);
            }
        };

        // pointerdown en fase de captura detecta clics fuera incluso dentro del modal.
        document.addEventListener('pointerdown', cerrarSiClickFuera, true);

        return () => {
            document.removeEventListener('pointerdown', cerrarSiClickFuera, true);
        };
    }, [abierto]);
    const seleccionado = options.find((opcion) => String(opcion.id) === String(value));
    const consulta = busquedaLocal.trim().toLocaleLowerCase('es');
    const resultados = options.filter((opcion) =>
        !consulta || getSearchText(opcion).toLocaleLowerCase('es').includes(consulta)
    ).slice(0, 100);

    useEffect(() => {
        if (!abierto) setBusquedaLocal(seleccionado ? getLabel(seleccionado) : '');
    }, [value, abierto]);

    return (
        <div className="selector-busqueda" ref={selectorRef}>
            <input
                id={id}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={abierto}
                aria-controls={`${id}-resultados`}
                autoComplete="off"
                value={abierto ? busquedaLocal : (seleccionado ? getLabel(seleccionado) : '')}
                placeholder={seleccionado && !abierto ? getLabel(seleccionado) : placeholder}
                disabled={disabled}
                onFocus={() => { setBusquedaLocal(''); setAbierto(true); }}
                onBlur={() => setAbierto(false)}
                onChange={(evento) => { setBusquedaLocal(evento.target.value); setAbierto(true); }}
                onKeyDown={(evento) => {
                    if (evento.key === 'Escape') setAbierto(false);
                    if (evento.key === 'Enter' && resultados.length === 1) {
                        evento.preventDefault();
                        onChange(name, String(resultados[0].id));
                        setBusquedaLocal(getLabel(resultados[0]));
                        setAbierto(false);
                    }
                }}
            />
            {abierto && !disabled && (
                <div className="selector-busqueda-resultados" id={`${id}-resultados`} role="listbox">
                    {value && (
                        <button type="button" className="selector-busqueda-opcion selector-busqueda-limpiar" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(name, ''); setBusquedaLocal(''); setAbierto(true); }}>
                            Quitar selección
                        </button>
                    )}
                    {resultados.length ? resultados.map((opcion) => (
                        <button
                            type="button"
                            role="option"
                            aria-selected={String(opcion.id) === String(value)}
                            className="selector-busqueda-opcion"
                            key={opcion.id}
                            onMouseDown={(evento) => evento.preventDefault()}
                            onClick={() => { onChange(name, String(opcion.id)); setBusquedaLocal(getLabel(opcion)); setAbierto(false); }}
                        >
                            {getLabel(opcion)}
                        </button>
                    )) : <div className="selector-busqueda-vacio">No se encontraron coincidencias.</div>}
                    {resultados.length === 100 && <div className="selector-busqueda-vacio">Se muestran las primeras 100 coincidencias. Escribe más para filtrar.</div>}
                </div>
            )}
        </div>
    );
}

function AsignacionesPage({ soloLectura = false } = {}) {
    const [asignaciones, setAsignaciones] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [filtroEstado, setFiltroEstado] =
        useState('ACTIVA');

    const [detalleAbierto, setDetalleAbierto] =
        useState(false);

    const [asignacionSeleccionada, setAsignacionSeleccionada] =
        useState(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const registroEnCurso = useRef(false);
    const devolucionEnCurso = useRef(false);
    const contextoRegistro = useRef({ abierto: false, version: 0, listo: false });
    const contextoActas = useRef({ version: 0, colaborador: '', equipo: '', estado: 'INICIAL', datos: [] });
    const solicitudCatalogos = useRef(0);
    const [cargandoRegistro, setCargandoRegistro] = useState(false);
    const [catalogosRegistroListos, setCatalogosRegistroListos] = useState(false);
    const [actasDisponibles, setActasDisponibles] = useState([]);
    const [cargandoActas, setCargandoActas] = useState(false);
    const [errorActas, setErrorActas] = useState('');

    const [colaboradores, setColaboradores] = useState([]);
    const [equipos, setEquipos] = useState([]);

    const [formulario, setFormulario] = useState({
        colaborador_id: '',
        equipo_id: '',
        acta_id: '',
        fecha_asignacion: new Date()
            .toLocaleDateString('en-CA'),
        modalidad: '',
        ubicacion: '',
        unidad_empresarial: '',
        observaciones: ''
    });

    const [devolucionAbierta, setDevolucionAbierta] =
        useState(false);

    const [asignacionDevolucion, setAsignacionDevolucion] =
        useState(null);

    const [devolviendo, setDevolviendo] =
        useState(false);

    const [formularioDevolucion, setFormularioDevolucion] =
        useState({
            fecha_devolucion: new Date()
                .toLocaleDateString('en-CA'),
            observaciones: '',
            autorizado_por: ''
        });

    const verAsignacion = async (id) => {
        try {
            setCargandoDetalle(true);
            setAsignacionSeleccionada(null);
            setError('');
            setDetalleAbierto(true);

            const datos = await obtenerAsignacionPorId(id);

            setAsignacionSeleccionada(datos);
        } catch (error) {
            console.error(error);
            setError(error.message);
            setDetalleAbierto(false);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cargarAsignaciones = async () => {
        try {
            setCargando(true);
            setError('');

            const datos = await listarAsignaciones();
            setAsignaciones(datos);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setCargando(false);
        }
    };

    const cargarCatalogos = async () => {
        const solicitud = ++solicitudCatalogos.current;
        try {
            const [
                datosColaboradores,
                datosEquipos
            ] = await Promise.all([
                listarColaboradores(),
                listarEquipos()
            ]);

            if (solicitud !== solicitudCatalogos.current) return false;
            if (!Array.isArray(datosColaboradores) || !Array.isArray(datosEquipos)) {
                throw new Error('Los catálogos de colaboradores y equipos no tienen un formato válido');
            }
            setColaboradores(datosColaboradores);
            setEquipos(datosEquipos);
            return true;
        } catch (error) {
            if (solicitud !== solicitudCatalogos.current) return false;
            console.error(error);
            setError(error.message);
            return false;
        }
    };

    useEffect(() => {
        let activo = true;
        const registro = contextoRegistro.current;
        const actas = contextoActas.current;
        const catalogosRef = solicitudCatalogos;
        const solicitudCatalogosActual = ++catalogosRef.current;
        const solicitudAsignaciones = listarAsignaciones();
        const solicitudDatosCatalogos = Promise.all([
            listarColaboradores(),
            listarEquipos()
        ]);

        solicitudAsignaciones
            .then((datos) => {
                if (activo) setAsignaciones(datos);
            })
            .catch((error) => {
                if (!activo) return;
                console.error(error);
                setError(error.message);
            })
            .finally(() => {
                if (activo) setCargando(false);
            });

        solicitudDatosCatalogos
            .then(([datosColaboradores, datosEquipos]) => {
                if (
                    !activo ||
                    solicitudCatalogosActual !== catalogosRef.current
                ) return;

                if (
                    !Array.isArray(datosColaboradores) ||
                    !Array.isArray(datosEquipos)
                ) {
                    throw new Error(
                        'Los catálogos de colaboradores y equipos no tienen un formato válido'
                    );
                }

                setColaboradores(datosColaboradores);
                setEquipos(datosEquipos);
            })
            .catch((error) => {
                if (
                    !activo ||
                    solicitudCatalogosActual !== catalogosRef.current
                ) return;

                console.error(error);
                setError(error.message);
            });

        return () => {
            activo = false;
            registro.abierto = false;
            registro.version += 1;
            actas.version += 1;
            catalogosRef.current += 1;
        };
    }, []);

    const colaboradoresActivos = colaboradores.filter(
        (colaborador) =>
            !colaborador.estado ||
            colaborador.estado === 'ACTIVO'
    );

    const equiposDisponibles = equipos.filter(
        (equipo) => equipo.estado_actual === 'LIBRE'
    );

    const cargarActasRegistro = async () => {
        if (!contextoRegistro.current.abierto || registroEnCurso.current) return;
        const contexto = contextoActas.current;
        const version = ++contexto.version;
        const { colaborador, equipo } = contexto;
        contexto.datos = [];
        contexto.estado = 'INICIAL';
        setActasDisponibles([]);
        setErrorActas('');
        setError('');
        setFormulario((anterior) => ({ ...anterior, acta_id: '' }));
        if (!colaborador || !equipo) {
            setCargandoActas(false);
            return;
        }
        contexto.estado = 'CARGANDO';
        setCargandoActas(true);
        try {
            const datos = await listarActasDisponibles(colaborador, equipo);
            if (!contextoRegistro.current.abierto || version !== contextoActas.current.version) return;
            contexto.datos = datos;
            contexto.estado = 'LISTO';
            setActasDisponibles(datos);
        } catch (error) {
            if (!contextoRegistro.current.abierto || version !== contextoActas.current.version) return;
            contexto.estado = 'ERROR';
            setErrorActas(error.message);
        } finally {
            if (contextoRegistro.current.abierto && version === contextoActas.current.version) {
                setCargandoActas(false);
            }
        }
    };

    const actualizarCampoFormulario = (name, value) => {
        if (registroEnCurso.current || !contextoRegistro.current.abierto || !contextoRegistro.current.listo) return;

        if (name === 'colaborador_id') {
            const colaboradorSeleccionado = colaboradores.find(
                (colaborador) => String(colaborador.id) === String(value)
            );
            setFormulario((anterior) => ({
                ...anterior,
                colaborador_id: value,
                ubicacion: colaboradorSeleccionado?.area || '',
                unidad_empresarial: colaboradorSeleccionado?.unidad_empresarial || ''
            }));
        } else {
            setFormulario((anterior) => ({ ...anterior, [name]: value }));
        }
        if (name === 'colaborador_id' || name === 'equipo_id') {
            contextoActas.current[name === 'colaborador_id' ? 'colaborador' : 'equipo'] = value;
            cargarActasRegistro();
        }
    };

    const actualizarFormulario = (evento) => {
        actualizarCampoFormulario(evento.target.name, evento.target.value);
    };

    const limpiarFormulario = () => {
        setFormulario({
            colaborador_id: '',
            equipo_id: '',
            acta_id: '',
            fecha_asignacion: new Date()
                .toLocaleDateString('en-CA'),
            modalidad: '',
            ubicacion: '',
            unidad_empresarial: '',
            observaciones: ''
        });
    };

    const abrirDevolucion = (asignacion) => {
        if (devolucionEnCurso.current || obtenerEstadoAsignacion(asignacion) !== 'ACTIVA') return;
        setError('');
        setAsignacionDevolucion(asignacion);

        setFormularioDevolucion({
            fecha_devolucion: new Date()
                .toLocaleDateString('en-CA'),
            observaciones: '',
            autorizado_por: ''
        });

        setDevolucionAbierta(true);
    };

    const cerrarDevolucion = () => {
        if (devolucionEnCurso.current) return;

        setDevolucionAbierta(false);
        setAsignacionDevolucion(null);
        setError('');
    };

    const actualizarDevolucion = (evento) => {
        const { name, value } = evento.target;

        setFormularioDevolucion((anterior) => ({
            ...anterior,
            [name]: value
        }));
    };

    const guardarDevolucion = async (evento) => {
        evento.preventDefault();
        if (devolucionEnCurso.current || !devolucionAbierta) return;

        if (
            !asignacionDevolucion?.id ||
            !formularioDevolucion.fecha_devolucion
        ) {
            setError(
                'La asignación y la fecha de devolución son obligatorias'
            );
            return;
        }

        if (obtenerEstadoAsignacion(asignacionDevolucion) !== 'ACTIVA') {
            setError('Solo se pueden devolver asignaciones activas');
            return;
        }

        devolucionEnCurso.current = true;
        let ventanaActaDevolucion = null;
        try {
            // Abrir durante el evento del usuario para evitar el bloqueo de ventanas emergentes.
            ventanaActaDevolucion = window.open('', '_blank');
            if (ventanaActaDevolucion) {
                ventanaActaDevolucion.document.write('<!doctype html><html lang="es"><head><title>Generando cargo de devolución...</title></head><body style="font-family:Arial;padding:32px">Generando el cargo de devolución...</body></html>');
                ventanaActaDevolucion.document.close();
            }
            setDevolviendo(true);
            setError('');
            setMensaje('');

            const resultado = await devolverAsignacion(
                asignacionDevolucion.id,
                {
                    fecha_devolucion:
                        formularioDevolucion.fecha_devolucion,

                    observaciones:
                        formularioDevolucion.observaciones.trim() ||
                        null,

                    autorizado_por:
                        formularioDevolucion.autorizado_por === ''
                            ? null : Number(formularioDevolucion.autorizado_por)
                }
            );

            setDevolucionAbierta(false);
            setAsignacionDevolucion(null);

            if (ventanaActaDevolucion) {
                setMensaje('Devolución registrada correctamente. Se generó el cargo de devolución.');
                await generarActaDevolucionPDF(
                    asignacionDevolucion,
                    formularioDevolucion,
                    ventanaActaDevolucion
                );
            } else {
                setMensaje('Devolución registrada correctamente.');
                setError('El navegador bloqueó la ventana del cargo de devolución. Permite las ventanas emergentes y vuelve a generar el documento desde la asignación.');
            }

            await Promise.all([
                cargarAsignaciones(),
                cargarCatalogos()
            ]);

            setTimeout(() => {
                setMensaje('');
            }, 4000);
        } catch (error) {
            if (ventanaActaDevolucion && !ventanaActaDevolucion.closed) ventanaActaDevolucion.close();
            console.error(error);
            setError(error.message);
        } finally {
            devolucionEnCurso.current = false;
            setDevolviendo(false);
        }
    };

    const abrirModal = async () => {
        if (registroEnCurso.current) return;
        const version = ++contextoRegistro.current.version;
        contextoRegistro.current.abierto = true;
        contextoRegistro.current.listo = false;
        setCatalogosRegistroListos(false);
        contextoActas.current = {
            version: contextoActas.current.version + 1,
            colaborador: '', equipo: '', estado: 'INICIAL', datos: []
        };
        setActasDisponibles([]);
        setErrorActas('');
        setCargandoActas(false);
        setCargandoRegistro(true);
        setModalAbierto(true);
        setError('');
        limpiarFormulario();
        const listo = await cargarCatalogos();
        if (!contextoRegistro.current.abierto || version !== contextoRegistro.current.version) return;
        contextoRegistro.current.listo = listo;
        setCatalogosRegistroListos(listo);
        setCargandoRegistro(false);
    };

    const cerrarModal = () => {
        if (registroEnCurso.current) return;
        contextoRegistro.current.abierto = false;
        contextoRegistro.current.version++;
        contextoActas.current.version++;
        solicitudCatalogos.current++;

        setModalAbierto(false);
        setError('');
        limpiarFormulario();
    };

    const guardarAsignacion = async (evento) => {
        evento.preventDefault();
        if (registroEnCurso.current || !modalAbierto || !contextoRegistro.current.abierto) return;
        if (!contextoRegistro.current.listo) {
            setError('Espera a que carguen los catálogos. Si fallaron, cierra y vuelve a abrir el formulario.');
            return;
        }

        if (
            !formulario.colaborador_id ||
            !formulario.equipo_id ||
            !formulario.fecha_asignacion
        ) {
            setError(
                'Colaborador, equipo y fecha son obligatorios'
            );
            return;
        }


        registroEnCurso.current = true;
        try {
            setGuardando(true);
            setError('');
            setMensaje('');

            await registrarAsignacion({
                colaborador_id: Number(
                    formulario.colaborador_id
                ),
                equipo_id: Number(formulario.equipo_id),
                acta_id: null,
                fecha_asignacion: formulario.fecha_asignacion,
                modalidad: formulario.modalidad || null,
                ubicacion: formulario.ubicacion.trim() || null,
                observaciones: formulario.observaciones.trim() || null
            });

            contextoRegistro.current.abierto = false;
            contextoActas.current.version++;
            setModalAbierto(false);
            limpiarFormulario();

            setMensaje('Asignación registrada correctamente');

            await Promise.all([
                cargarAsignaciones(),
                cargarCatalogos()
            ]);

            setTimeout(() => {
                setMensaje('');
            }, 4000);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            registroEnCurso.current = false;
            setGuardando(false);
        }
    };

    const generarActaPDF = async (asignacion) => {
        const escapar = (valor) => String(valor ?? '-').replace(/[&<>"']/g, (caracter) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[caracter]);
        const fecha = (valor) => {
            if (!valor) return '-';
            const soloFecha = String(valor).slice(0, 10);
            const partes = soloFecha.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : soloFecha;
        };

        const ventana = window.open('', '_blank');

        if (!ventana) {
            setError(
                'El navegador bloqueó la ventana del acta. Permite las ventanas emergentes e inténtalo nuevamente.'
            );
            return;
        }

        try {
            // Obtener la asignación completa, incluidos sus periféricos.
            const detalle = await obtenerAsignacionPorId(asignacion.id);

            if (!detalle) {
                throw new Error('No se encontró el detalle de la asignación.');
            }

            // Combinar los datos del listado y los del detalle.
            asignacion = { ...asignacion, ...detalle };

        } catch (error) {
            console.error('Error al obtener el detalle para el acta:', error);
            ventana.close();
            setError('No se pudo cargar la información completa del acta.');
            return;
        }

        const nombre = obtenerColaborador(asignacion);
        const equipo = obtenerEquipo(asignacion);

        const observaciones =
            asignacion.observaciones ||
            asignacion.descripcion_equipo_anterior ||
            'Sin observaciones';

        const nro = `ASG-${String(asignacion.id).padStart(6, '0')}`;

        // Fila del equipo principal.
        const filasEquipo = [{
            tipo: asignacion.tipo_equipo || asignacion.tipo || 'Equipo principal',
            marca: asignacion.marca,
            modelo: asignacion.modelo,
            serie: asignacion.serie,
            imei: asignacion.imei,
            estado: 'Entregado'
        }];

        // Agregar los periféricos vinculados al equipo.
        const perifericos = Array.isArray(asignacion.perifericos)
            ? asignacion.perifericos
            : [];

        perifericos.forEach((periferico) => {
            filasEquipo.push({
                tipo:
                    periferico.tipo_periferico ||
                    periferico.tipo ||
                    'Periférico',
                marca: periferico.marca,
                modelo: periferico.modelo,
                serie: periferico.serie,
                imei: periferico.imei,
                estado:
                    periferico.estado_actual ||
                    periferico.estado ||
                    'Entregado'
            });
        });

        // Crear una fila HTML por cada equipo y periférico.
        const filasActa = filasEquipo.map((item) => `
    <tr>
        <td>${escapar(item.tipo)}</td>
        <td>${escapar(
            [item.marca, item.modelo].filter(Boolean).join(' ') || '-'
        )}</td>
        <td>${escapar(
            [
                item.serie ? `Serie: ${item.serie}` : '',
                item.imei ? `IMEI: ${item.imei}` : ''
            ].filter(Boolean).join(' / ') || '-'
        )}</td>
        <td>${escapar(item.estado)}</td>
    </tr>
`).join('');

        const htmlDocumento = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta ${nro}</title>
<style>
@page{size:A4;margin:17mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:11px;line-height:1.5}.top{background:#102a43;color:white;padding:22px 26px;border-radius:10px 10px 0 0}.eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9ed5ff;font-weight:bold}.top h1{font-size:21px;margin:7px 0 4px}.top p{margin:0;color:#d8e6f3}.meta{display:flex;justify-content:space-between;background:#f0f6fb;border:1px solid #d7e4ef;padding:12px 16px;margin-bottom:20px}.section{font-size:12px;font-weight:bold;color:#0b4778;border-bottom:2px solid #d9e8f4;padding-bottom:6px;margin:19px 0 10px;text-transform:uppercase;letter-spacing:.5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border:1px solid #dce5ed;border-radius:6px;padding:9px 11px;min-height:48px}.label{font-size:9px;color:#63758a;text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:3px}.value{font-size:12px;font-weight:600;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#eaf2f8;color:#244761;text-align:left;font-size:9px;text-transform:uppercase;padding:10px 8px}td{border-bottom:1px solid #dce5ed;padding:11px 8px;vertical-align:top}.notice{background:#f7fafc;border-left:3px solid #1e6a9e;padding:12px 14px;margin-top:10px;text-align:justify}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:55px;margin-top:65px;text-align:center}.line{border-top:1px solid #66788a;padding-top:8px;font-weight:bold}.muted{font-size:9px;color:#66788a;font-weight:normal}.footer{border-top:1px solid #dce5ed;margin-top:32px;padding-top:9px;display:flex;justify-content:space-between;color:#738195;font-size:9px}@media print{.no-print{display:none}}
</style></head><body>
<div class="top"><div class="eyebrow">Tecnología de la información</div><h1>Acta de entrega de equipo informático</h1><p>Constancia de asignación y recepción de activo tecnológico</p></div>
<div class="meta"><div><span class="label">N.º de acta</span><strong>${escapar(nro)}</strong></div><div style="text-align:right"><span class="label">Fecha de entrega</span><strong>${escapar(fecha(asignacion.fecha_asignacion))}</strong></div></div>
<div class="section">Datos del colaborador</div><div class="grid"><div class="field"><span class="label">Colaborador</span><div class="value">${escapar(nombre)}</div></div><div class="field"><span class="label">Código de colaborador</span><div class="value">${escapar(asignacion.codigo_colaborador || asignacion.codigo || '-')}</div></div><div class="field"><span class="label">Ubicación</span><div class="value">${escapar(asignacion.ubicacion || '-')}</div></div><div class="field"><span class="label">Modalidad</span><div class="value">${escapar(asignacion.modalidad || '-')}</div></div></div>
<div class="section">Detalle del equipo entregado</div><table><thead><tr><th>Tipo / descripción</th><th>Marca y modelo</th><th>Serie / IMEI</th><th>Estado</th></tr></thead><tbody>${filasActa}</tbody></table>
<div class="section">Condiciones de entrega</div><div class="notice">Por medio de la presente, el colaborador declara recibir el equipo descrito para el desempeño de sus funciones y se compromete a conservarlo, cuidarlo y restituirlo en buen estado, salvo el deterioro propio del uso normal. Asimismo, se responsabiliza por su custodia y salvaguarda, y se compromete a no realizar préstamos, transferencias, disposición o uso no autorizado del activo.</div>
<div class="section">Observaciones</div><div class="field">${escapar(observaciones)}</div>
<div class="signatures"><div class="line">Tecnologías de la Información y Comunicaciones<br><span class="muted">Responsable de entrega</span></div><div class="line">${escapar(nombre)}<br><span class="muted">Usuario receptor</span></div></div>
<div class="footer"><span>Documento generado desde el Sistema de Inventario</span><span>${escapar(nro)}</span></div>
<div class="no-print" style="text-align:center;margin-top:24px"><button onclick="window.print()" style="background:#155e91;color:white;border:0;padding:12px 22px;border-radius:7px;font-weight:bold;cursor:pointer">Imprimir / Guardar como PDF</button></div>
<script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body></html>`;
        ventana.document.write(htmlDocumento);
        ventana.document.close();
        try {
            const respuestaCorreo = await enviarActaPorCorreo(asignacion.id, 'ENTREGA', htmlDocumento);
            setMensaje(respuestaCorreo.mensaje || 'Acta enviada al correo del colaborador.');
        } catch (errorCorreo) {
            console.error('No se pudo enviar el acta de entrega por correo:', errorCorreo);
            setError(`El acta se generó, pero no se pudo enviar por correo: ${errorCorreo.message}`);
        }
    };

    const generarActaDevolucionPDF = async (asignacionBase, datosDevolucion, ventana) => {
        const escapar = (valor) => String(valor ?? '-').replace(/[&<>"']/g, (caracter) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[caracter]);
        const fecha = (valor) => {
            if (!valor) return '-';
            const soloFecha = String(valor).slice(0, 10);
            const partes = soloFecha.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : soloFecha;
        };

        try {
            const detalle = await obtenerAsignacionPorId(asignacionBase.id);
            const asignacion = { ...asignacionBase, ...(detalle || {}) };
            const nombre = obtenerColaborador(asignacion);
            const equipo = {
                tipo: asignacion.tipo_equipo || asignacion.tipo || 'Equipo informático',
                marca: asignacion.marca || '-',
                modelo: asignacion.modelo || '-',
                serie: asignacion.serie || '-',
                caracteristicas: asignacion.caracteristicas || asignacion.descripcion_equipo || '-',
                estado: asignacion.estado_actual || asignacion.estado_equipo || '-'
            };
            const accesorios = Array.isArray(asignacion.perifericos) ? asignacion.perifericos : [];
            const filasAccesorios = accesorios.length
                ? accesorios.map((item) => `<tr><td>${escapar(item.tipo_periferico || item.tipo || 'Accesorio')}</td><td>${escapar(item.marca || '-')}</td><td>${escapar(item.modelo || '-')}</td><td>${escapar(item.serie || '-')}</td><td>${escapar(item.estado_actual || item.estado || '-')}</td></tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center">Sin accesorios registrados</td></tr>';
            const nro = `DEV-${String(asignacion.id).padStart(6, '0')}`;
            const observaciones = datosDevolucion.observaciones?.trim() || 'Sin observaciones';
            const division = asignacion.division || asignacion.sede || asignacion.ubicacion || '-';
            const gerencia = asignacion.gerencia || '-';
            const unidad = asignacion.unidad_org || asignacion.unidad_organizacional || '-';
            const centroCosto = asignacion.centro_costo || '-';
            const dni = asignacion.dni || asignacion.dni_colaborador || '-';

            ventana.document.open();
            const htmlDocumento = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cargo de devolución ${escapar(nro)}</title>
<style>
@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;font-size:10px;line-height:1.45}.cabecera{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f3e55;padding-bottom:12px}.marca{font-weight:bold;font-size:12px;color:#1f3e55}.fecha{text-align:right}.titulo{text-align:center;font-size:18px;margin:24px 0 20px;font-weight:bold}.datos{display:grid;grid-template-columns:1fr 1fr;gap:7px 20px;margin-bottom:18px}.dato{padding:4px 0;border-bottom:1px solid #ddd}.etiqueta{font-weight:bold;display:inline-block;min-width:105px}.seccion{font-size:11px;font-weight:bold;margin:18px 0 8px;border-bottom:1px solid #777;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th{background:#edf1f4;text-align:left;font-size:9px}th,td{border:1px solid #777;padding:7px 6px;vertical-align:top}.normativa{margin-top:24px;text-align:justify;font-size:9px}.observaciones{min-height:38px;margin-top:8px}.firmas{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:65px;text-align:center}.firma{border-top:1px solid #333;padding-top:7px}.pie{text-align:center;border-top:1px solid #bbb;margin-top:30px;padding-top:8px;font-size:8px}@media print{.no-print{display:none}}
</style></head><body>
<div class="cabecera"><div class="marca">Tecnología de la información - Hdna</div><div class="fecha"><b>Fecha:</b> ${escapar(fecha(datosDevolucion.fecha_devolucion))}<br><b>Documento:</b> ${escapar(nro)}</div></div>
<div class="titulo">Cargo de devolución de equipo informático</div>
<div class="datos">
<div class="dato"><span class="etiqueta">División:</span> ${escapar(division)}</div><div class="dato"><span class="etiqueta">Centro de costo:</span> ${escapar(centroCosto)}</div>
<div class="dato"><span class="etiqueta">Gerencia:</span> ${escapar(gerencia)}</div><div class="dato"><span class="etiqueta">Unidad Org:</span> ${escapar(unidad)}</div>
<div class="dato" style="grid-column:1/-1"><span class="etiqueta">Usuario:</span> ${escapar(asignacion.codigo_colaborador || asignacion.codigo || '')} ${escapar(nombre)}</div>
</div>
<div class="seccion">Detalle del equipo devuelto</div>
<table><thead><tr><th>Descripción</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Características</th></tr></thead>
<tbody><tr><td>${escapar(equipo.tipo)}</td><td>${escapar(equipo.marca)}</td><td>${escapar(equipo.modelo)}</td><td>${escapar(equipo.serie)}</td><td>${escapar(equipo.caracteristicas)}</td></tr></tbody></table>
<div class="seccion">Accesorios</div>
<table><thead><tr><th>Descripción</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Estado</th></tr></thead><tbody>${filasAccesorios}</tbody></table>
<div class="normativa"><b>Artículos del Reglamento Interno del Trabajo (RIT) y Código de Ética y Conducta (CEC) que validan el presente documento:</b><p><b>RIT Cap. III:</b> Obligaciones y prohibiciones de los trabajadores, Artículo 10, Inciso k). Conservar, cuidar y restituir en buen estado, salvo deterioro y desgaste natural, los instrumentos y útiles de trabajo que se les proporcione para el desempeño de sus labores.</p><p><b>CEC Cap. 14:</b> Protección de Activos, Inciso 14.1 Custodia y salvaguarda de activos. El personal de la empresa es responsable de la custodia y salvaguarda de los activos que se encuentran bajo su control. En ningún caso debe participar, influir o permitir situaciones o acciones vinculadas con el robo, mal uso, préstamo, desecho o venta de activos en forma no autorizada.</p></div>
<div class="seccion">Observaciones</div><div class="observaciones">${escapar(observaciones)}</div>
<div class="firmas"><div class="firma">Tecnologías de la Información y Comunicaciones</div><div class="firma">${escapar(nombre)}<br>Usuario<br><span style="font-size:9px">DNI: ${escapar(dni)}</span></div></div>
<div class="pie">Documento generado desde el Sistema de Inventario · ${escapar(nro)}</div>
<div class="no-print" style="text-align:center;margin-top:22px"><button onclick="window.print()" style="padding:10px 20px;cursor:pointer">Imprimir / Guardar como PDF</button></div>
<script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body></html>`;
            ventana.document.write(htmlDocumento);
            ventana.document.close();
            try {
                const respuestaCorreo = await enviarActaPorCorreo(asignacionBase.id, 'DEVOLUCION', htmlDocumento);
                setMensaje(respuestaCorreo.mensaje || 'Cargo de devolución enviado al correo del colaborador.');
            } catch (errorCorreo) {
                console.error('No se pudo enviar el cargo de devolución por correo:', errorCorreo);
                setError(`La devolución se registró y el documento se generó, pero no se pudo enviar por correo: ${errorCorreo.message}`);
            }
        } catch (error) {
            console.error('No se pudo generar el cargo de devolución:', error);
            if (ventana && !ventana.closed) {
                ventana.document.body.innerHTML = '<p style="font-family:Arial;padding:24px">La devolución se registró, pero no se pudo generar el documento. Cierra esta ventana e intenta generar el cargo nuevamente.</p>';
            }
            setError('La devolución se registró, pero no se pudo generar el cargo de devolución.');
        }
    };

    const obtenerColaborador = (asignacion) => {
        if (asignacion.colaborador) {
            return asignacion.colaborador;
        }

        const nombreCompleto = `
      ${asignacion.apellidos || ''}
      ${asignacion.nombres || ''}
    `.trim();

        return nombreCompleto || '-';
    };

    const obtenerEquipo = (asignacion) => {
        const equipo = `
      ${asignacion.marca || ''}
      ${asignacion.modelo || ''}
    `.trim();

        return equipo || '-';
    };

    const formatearFecha = (fecha) => {
        if (!fecha) return '-';

        return new Date(fecha).toLocaleDateString('es-PE', {
            timeZone: 'UTC'
        });
    };

    const obtenerEstadoAsignacion = (asignacion) => {
        return (
            asignacion.estado_asignacion ||
            asignacion.estado ||
            ''
        );
    };


    const asignacionesActivas = asignaciones.filter(
        (asignacion) =>
            obtenerEstadoAsignacion(asignacion) ===
            'ACTIVA'
    );

    const asignacionesFinalizadas = asignaciones.filter(
        (asignacion) =>
            obtenerEstadoAsignacion(asignacion) ===
            'FINALIZADA'
    );

    const asignacionesPorEstado =
        filtroEstado === 'TODAS'
            ? asignaciones
            : asignaciones.filter(
                (asignacion) =>
                    obtenerEstadoAsignacion(asignacion) ===
                    filtroEstado
            );

    const asignacionesFiltradas =
        asignacionesPorEstado.filter((asignacion) => {
            const texto = `
            ${asignacion.id || ''}
            ${obtenerColaborador(asignacion)}
            ${obtenerEquipo(asignacion)}
            ${asignacion.imei || ''}
            ${asignacion.serie || ''}
            ${asignacion.numero_linea || ''}
            ${asignacion.numero || ''}
            ${asignacion.modalidad || ''}
            ${asignacion.ubicacion || ''}
            ${obtenerEstadoAsignacion(asignacion)}
        `.toLowerCase();

            return texto.includes(
                busqueda.toLowerCase()
            );
        });

    const tituloContador = {
        ACTIVA: 'Asignaciones activas',
        FINALIZADA: 'Asignaciones finalizadas',
        TODAS: 'Total de asignaciones'
    };

    const cantidadContador = {
        ACTIVA: asignacionesActivas.length,
        FINALIZADA: asignacionesFinalizadas.length,
        TODAS: asignaciones.length
    };

    return (
        <section className="pagina">
            <div className="encabezado-pagina">
                <div>
                    <h3>Asignaciones</h3>
                    <p>
                        Control de equipos y líneas entregados a colaboradores
                    </p>
                </div>

                {!soloLectura && (
                    <button
                        type="button"
                        className="boton-primario"
                        onClick={abrirModal}
                    >
                        <Plus size={18} aria-hidden="true" />
                        <span>Nueva asignación</span>
                    </button>
                )}
            </div>

            {mensaje && (
                <div className="mensaje-exito">
                    {mensaje}
                </div>
            )}

            <div className="resumen-asignaciones">
                <div className="resumen-asignacion-icono">
                    <ClipboardList size={24} />
                </div>

                <div>
                    <span>{tituloContador[filtroEstado]}</span>

                    <strong>
                        {cantidadContador[filtroEstado]}
                    </strong>
                </div>
            </div>

            <div className="pestanas-asignaciones">
                <button
                    type="button"
                    aria-pressed={filtroEstado === 'ACTIVA'}
                    className={
                        filtroEstado === 'ACTIVA'
                            ? 'pestana-asignacion activa'
                            : 'pestana-asignacion'
                    }
                    onClick={() => setFiltroEstado('ACTIVA')}
                >
                    Activas

                    <span>{asignacionesActivas.length}</span>
                </button>

                <button
                    type="button"
                    aria-pressed={filtroEstado === 'FINALIZADA'}
                    className={
                        filtroEstado === 'FINALIZADA'
                            ? 'pestana-asignacion activa'
                            : 'pestana-asignacion'
                    }
                    onClick={() =>
                        setFiltroEstado('FINALIZADA')
                    }
                >
                    Finalizadas

                    <span>{asignacionesFinalizadas.length}</span>
                </button>

                <button
                    type="button"
                    aria-pressed={filtroEstado === 'TODAS'}
                    className={
                        filtroEstado === 'TODAS'
                            ? 'pestana-asignacion activa'
                            : 'pestana-asignacion'
                    }
                    onClick={() => setFiltroEstado('TODAS')}
                >
                    Todas

                    <span>{asignaciones.length}</span>
                </button>
            </div>

            <div className="barra-tabla">
                <CampoBusqueda
                    className="buscador-tabla"
                    etiqueta="Buscar asignaciones"
                    placeholder="Buscar colaborador, equipo, IMEI o línea..."
                    value={busqueda}
                    onChange={(evento) =>
                        setBusqueda(evento.target.value)
                    }
                />

                <button
                    type="button"
                    className="boton-actualizar"
                    onClick={cargarAsignaciones}
                    disabled={cargando}
                >
                    <RefreshCw
                        size={18}
                        className={cargando ? 'girando' : ''}
                    />

                    Actualizar
                </button>
            </div>

            {error && (
                <div className="mensaje-conexion mensaje-error">
                    <span>{error}</span>

                    <button type="button" onClick={cargarAsignaciones}>
                        Reintentar
                    </button>
                </div>
            )}

            <div className="contenedor-tabla">
                {cargando ? (
                    <div className="estado-tabla">
                        Cargando asignaciones...
                    </div>
                ) : asignacionesFiltradas.length === 0 ? (
                    <div className="estado-tabla">
                        No se encontraron asignaciones
                    </div>
                ) : (
                    <div className="tabla-scroll">
                        <table className="tabla-equipos tabla-asignaciones">
                            <thead>
                                <tr>
                                    <th>N.º</th>
                                    <th>Colaborador</th>
                                    <th>Equipo</th>
                                    <th>Serie</th>
                                    <th>Modalidad</th>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                    <th>Ubicación</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>

                            <tbody>
                                {asignacionesFiltradas.map(
                                    (asignacion, index) => (
                                        <tr key={asignacion.id}>
                                            <td>{index + 1}</td>

                                            <td>
                                                <div className="celda-principal">
                                                    <strong>
                                                        {obtenerColaborador(asignacion)}
                                                    </strong>

                                                    <span>
                                                        {asignacion.codigo_colaborador ||
                                                            asignacion.codigo ||
                                                            ''}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>{obtenerEquipo(asignacion)}</td>

                                            <td>
                                                {asignacion.serie || '-'}
                                            </td>

                                            <td>
                                                <span className="etiqueta-modalidad">
                                                    {asignacion.modalidad || '-'}
                                                </span>
                                            </td>

                                            <td>
                                                {formatearFecha(
                                                    asignacion.fecha_asignacion
                                                )}
                                            </td>

                                            <td>
                                                <span
                                                    className={`estado-asignacion estado-${obtenerEstadoAsignacion(
                                                        asignacion
                                                    ).toLowerCase()}`}
                                                >
                                                    {obtenerEstadoAsignacion(asignacion) || '-'}
                                                </span>
                                            </td>

                                            <td>
                                                {asignacion.ubicacion || '-'}
                                            </td>

                                            <td>
                                                <div className="acciones-asignacion">
                                                    <button type="button" className="boton-generar-acta" title="Generar acta en PDF" aria-label={`Generar acta de la asignación ${asignacion.id}`} onClick={() => generarActaPDF(asignacion)}>
                                                        <FileText size={17} aria-hidden="true" />
                                                        <span>Generar acta</span>
                                                    </button>
                                                    <BotonAccionTabla
                                                        className="boton-ver-asignacion"
                                                        etiqueta={`Ver asignación ${asignacion.id}`}
                                                        onClick={() =>
                                                            verAsignacion(asignacion.id)
                                                        }
                                                    />

                                                    {!soloLectura && (
                                                        <>
                                                            {obtenerEstadoAsignacion(asignacion) === 'ACTIVA' && (
                                                                <button
                                                                    type="button"
                                                                    className="boton-devolver"
                                                                    title="Registrar devolución"
                                                                    aria-label="Registrar devolución"
                                                                    disabled={devolviendo}
                                                                    onClick={() => abrirDevolucion(asignacion)}
                                                                >
                                                                    <RotateCcw size={17} aria-hidden="true" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!cargando && (
                    <div className="pie-tabla">
                        Mostrando {asignacionesFiltradas.length} de{' '}
                        {asignacionesPorEstado.length} asignaciones
                    </div>
                )}
            </div>

            {modalAbierto && (
                <DialogoAccesible
                    className="modal-asignacion"
                    tituloId="asignacion-formulario-titulo"
                    descripcionId="asignacion-formulario-descripcion"
                    onCerrar={cerrarModal}
                    bloqueado={guardando}
                    ocupado={cargandoRegistro || guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="asignacion-formulario-titulo">Nueva asignación</h3>
                            <p id="asignacion-formulario-descripcion">
                                Entrega un equipo disponible a un colaborador
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarModal}
                            disabled={guardando}
                            aria-label="Cerrar formulario de asignación"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    <form onSubmit={guardarAsignacion}>
                        {cargandoRegistro && <p role="status">Cargando colaboradores y equipos...</p>}
                        {error && (
                            <div className="error-formulario">
                                {error}
                            </div>
                        )}

                        <fieldset className="asignacion-campos" disabled={guardando || cargandoRegistro || !catalogosRegistroListos}>
                            <div className="formulario-grid">
                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="colaborador_id">
                                        Colaborador *
                                    </label>

                                    <SelectorBusqueda
                                        id="colaborador_id"
                                        name="colaborador_id"
                                        value={formulario.colaborador_id}
                                        options={colaboradoresActivos}
                                        placeholder="Buscar por nombre, apellido, DNI o código..."
                                        disabled={guardando}
                                        onChange={actualizarCampoFormulario}
                                        getLabel={(colaborador) => `${colaborador.codigo ? `${colaborador.codigo} — ` : ''}${colaborador.apellidos}, ${colaborador.nombres}`}
                                        getSearchText={(colaborador) => `${colaborador.codigo || ''} ${colaborador.apellidos || ''} ${colaborador.nombres || ''} ${colaborador.dni || ''}`}
                                    />
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="equipo_id">
                                        Equipo disponible *
                                    </label>

                                    <SelectorBusqueda
                                        id="equipo_id"
                                        name="equipo_id"
                                        value={formulario.equipo_id}
                                        options={equiposDisponibles}
                                        placeholder="Buscar por marca, modelo, serie, IMEI o código patrimonial..."
                                        disabled={guardando}
                                        onChange={actualizarCampoFormulario}
                                        getLabel={(equipo) => `${equipo.marca || ''} ${equipo.modelo || ''} — ${equipo.serie || equipo.imei || equipo.codigo_patrimonial || `ID ${equipo.id}`}`}
                                        getSearchText={(equipo) => `${equipo.marca || ''} ${equipo.modelo || ''} ${equipo.serie || ''} ${equipo.imei || ''} ${equipo.codigo_patrimonial || ''} ${equipo.tipo || ''} ${equipo.id}`}
                                    />

                                    <small className="ayuda-campo">
                                        {equiposDisponibles.length}{' '}
                                        equipo(s) disponible(s)
                                    </small>
                                </div>

                                <div className="campo-formulario campo-completo bloque-acta-info">
                                    <div className="bloque-acta-icono"><FileText size={22} aria-hidden="true" /></div>
                                    <div>
                                        <strong>Acta de entrega</strong>
                                        <p>Registra la asignación y luego podrás generar el acta en PDF desde las acciones de la tabla. El documento se prepara con los datos de esta asignación.</p>
                                    </div>
                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="fecha_asignacion">
                                        Fecha de asignación *
                                    </label>

                                    <input
                                        id="fecha_asignacion"
                                        name="fecha_asignacion"
                                        type="date"
                                        value={formulario.fecha_asignacion}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                        required
                                    />
                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="modalidad">
                                        Modalidad
                                    </label>

                                    <select
                                        id="modalidad"
                                        name="modalidad"
                                        value={formulario.modalidad}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="ASIGNACION">Asignación</option>
                                        <option value="PRESTAMO">Préstamo</option>
                                        <option value="RENOVACION">Renovación</option>
                                        <option value="REPOSICION">Reposición</option>
                                    </select>
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="ubicacion">
                                        Ubicación
                                    </label>

                                    <input
                                        id="ubicacion"
                                        name="ubicacion"
                                        type="text"
                                        placeholder="Se completa con el área del colaborador"
                                        value={formulario.ubicacion}
                                        readOnly
                                        disabled={guardando}
                                    />
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="unidad_empresarial">
                                        Unidad Empresarial
                                    </label>

                                    <input
                                        id="unidad_empresarial"
                                        name="unidad_empresarial"
                                        type="text"
                                        placeholder="Se completa con la unidad empresarial del colaborador"
                                        value={formulario.unidad_empresarial}
                                        readOnly
                                        disabled={guardando}
                                    />
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="observaciones_asignacion">
                                        Observaciones de entrega (opcional)
                                    </label>
                                    <textarea
                                        id="observaciones_asignacion"
                                        name="observaciones"
                                        rows="3"
                                        maxLength={15000}
                                        placeholder="Estado del equipo y accesorios entregados"
                                        value={formulario.observaciones}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    />
                                </div>
                            </div>
                        </fieldset>

                        <div className="modal-acciones">
                            <button
                                type="button"
                                className="boton-cancelar"
                                onClick={cerrarModal}
                                disabled={guardando}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                className="boton-guardar"
                                disabled={
                                    guardando || cargandoRegistro || !catalogosRegistroListos || cargandoActas || !!errorActas ||
                                    equiposDisponibles.length === 0
                                }
                            >
                                <Save size={18} />

                                {guardando
                                    ? 'Asignando...'
                                    : 'Registrar asignación'}
                            </button>
                        </div>
                    </form>
                </DialogoAccesible>
            )}

            {detalleAbierto && (
                <DialogoAccesible
                    className="modal-detalle-asignacion"
                    tituloId="asignacion-detalle-titulo"
                    descripcionId="asignacion-detalle-descripcion"
                    onCerrar={() => setDetalleAbierto(false)}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="asignacion-detalle-titulo">Detalle de asignación</h3>
                            <p id="asignacion-detalle-descripcion">Información de la entrega registrada</p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={() => setDetalleAbierto(false)}
                            aria-label="Cerrar detalle de la asignación"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoDetalle ? (
                        <div className="detalle-cargando">
                            Cargando información...
                        </div>
                    ) : asignacionSeleccionada ? (
                        <div className="detalle-asignacion">
                            <div className="detalle-seccion">
                                <h4>Colaborador</h4>

                                <div className="detalle-grid">
                                    <div className="detalle-campo">
                                        <span>Nombre</span>
                                        <strong>
                                            {asignacionSeleccionada.colaborador ||
                                                `${asignacionSeleccionada.apellidos || ''}, ${asignacionSeleccionada.nombres || ''
                                                }`}
                                        </strong>
                                    </div>

                                    <div className="detalle-campo">
                                        <span>Código</span>
                                        <strong>
                                            {asignacionSeleccionada.codigo_colaborador ||
                                                asignacionSeleccionada.codigo ||
                                                '-'}
                                        </strong>
                                    </div>
                                    <div className="detalle-campo">
                                        <span>Correo</span>
                                        <strong>{asignacionSeleccionada.correo_colaborador || asignacionSeleccionada.correo || 'Sin registrar'}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="detalle-seccion">
                                <h4>Equipo</h4>

                                <div className="detalle-grid">
                                    <div className="detalle-campo">
                                        <span>Tipo</span>
                                        <strong>{asignacionSeleccionada.tipo_equipo || asignacionSeleccionada.tipo || '-'}</strong>
                                    </div>
                                    <div className="detalle-campo">
                                        <span>Marca y modelo</span>
                                        <strong>{asignacionSeleccionada.marca || '-'}{' '}{asignacionSeleccionada.modelo || ''}</strong>
                                    </div>
                                    <div className="detalle-campo">
                                        <span>Código patrimonial</span>
                                        <strong>{asignacionSeleccionada.codigo_patrimonial || '-'}</strong>
                                    </div>
                                    {['CELULAR', 'MODEM'].includes(
                                        String(asignacionSeleccionada.tipo_equipo || asignacionSeleccionada.tipo || '').toUpperCase()
                                    ) && (
                                            <div className="detalle-campo">
                                                <span>IMEI</span>
                                                <strong>{asignacionSeleccionada.imei || '-'}</strong>
                                            </div>
                                        )}
                                    <div className="detalle-campo">
                                        <span>Serie</span>
                                        <strong>{asignacionSeleccionada.serie || '-'}</strong>
                                    </div>
                                    <div className="detalle-campo">
                                        <span>Estado del equipo</span>
                                        <strong>{asignacionSeleccionada.estado_actual || '-'}</strong>
                                    </div>

                                    <div className="detalle-campo">
                                        <span>Estado de asignación</span>
                                        <strong>
                                            {obtenerEstadoAsignacion(
                                                asignacionSeleccionada
                                            ) || '-'}
                                        </strong>
                                    </div>
                                </div>
                                {asignacionSeleccionada.observaciones_equipo && (
                                    <div className="detalle-campo">
                                        <span>Observaciones del equipo</span>
                                        <p className="nota-asignacion">{asignacionSeleccionada.observaciones_equipo}</p>
                                    </div>
                                )}
                                <div className="detalle-campo">
                                    <span>Periféricos del equipo</span>
                                    {Array.isArray(asignacionSeleccionada.perifericos) && asignacionSeleccionada.perifericos.length > 0 ? (
                                        <div className="detalle-grid">
                                            {asignacionSeleccionada.perifericos.map((periferico) => (
                                                <div className="detalle-campo" key={periferico.vinculo_id || periferico.id}>
                                                    <span>{periferico.tipo_periferico || periferico.tipo || 'Periférico'}</span>
                                                    <strong style={{ color: '#000' }}>{[periferico.marca, periferico.modelo].filter(Boolean).join(' ') || '-'}</strong>
                                                    <small style={{ color: '#000' }}> {periferico.serie || '-'}</small>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="nota-asignacion">Este equipo no tiene periféricos vinculados.</p>
                                    )}
                                </div>
                            </div>

                            <div className="detalle-seccion">
                                <h4>Datos de la asignación</h4>

                                <div className="detalle-grid">
                                    <div className="detalle-campo">
                                        <span>Fecha</span>
                                        <strong>
                                            {formatearFecha(
                                                asignacionSeleccionada.fecha_asignacion
                                            )}
                                        </strong>
                                    </div>

                                    <div className="detalle-campo">
                                        <span>Modalidad</span>
                                        <strong>
                                            {asignacionSeleccionada.modalidad || '-'}
                                        </strong>
                                    </div>

                                    <div className="detalle-campo">
                                        <span>Ubicación</span>
                                        <strong>
                                            {asignacionSeleccionada.ubicacion || '-'}
                                        </strong>
                                    </div>

                                    <div className="detalle-campo">
                                        <span>Contrato del equipo</span>
                                        <strong>{asignacionSeleccionada.nro_contrato || asignacionSeleccionada.descripcion_contrato || 'Sin contrato registrado'}</strong>
                                    </div>
                                </div>
                            </div>
                            <div className="detalle-seccion">
                                <h4>Información registrada</h4>
                                <div className="detalle-campo">
                                    <span>Equipo anterior</span>
                                    <p className="nota-asignacion">
                                        {asignacionSeleccionada.descripcion_equipo_anterior || 'Sin registrar'}
                                    </p>
                                </div>
                                <div className="detalle-campo">
                                    <span>Observaciones registradas</span>
                                    <p className="nota-asignacion">
                                        {asignacionSeleccionada.observaciones || 'Sin observaciones'}
                                    </p>
                                </div>
                            </div>
                            {(asignacionSeleccionada.fecha_devolucion ||
                                asignacionSeleccionada.descripcion_devolucion) && (
                                    <div className="detalle-seccion">
                                        <h4>Devolución</h4>
                                        <div className="detalle-grid">
                                            <div className="detalle-campo">
                                                <span>Fecha de devolución</span>
                                                <strong>{formatearFecha(asignacionSeleccionada.fecha_devolucion)}</strong>
                                            </div>
                                            <div className="detalle-campo">
                                                <span>Autorizador declarado</span>
                                                <strong>
                                                    {asignacionSeleccionada.devolucion_autorizado_por_nombre || 'Sin registrar'}
                                                </strong>
                                            </div>
                                        </div>
                                        <div className="detalle-campo">
                                            <span>Detalle de devolución</span>
                                            <p className="nota-asignacion">
                                                {asignacionSeleccionada.descripcion_devolucion || 'Sin detalle registrado'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>
                    ) : null}
                </DialogoAccesible>
            )}

            {devolucionAbierta && asignacionDevolucion && (
                <DialogoAccesible
                    className="modal-devolucion"
                    tituloId="devolucion-formulario-titulo"
                    descripcionId="devolucion-formulario-descripcion"
                    onCerrar={cerrarDevolucion}
                    bloqueado={devolviendo}
                    ocupado={devolviendo}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="devolucion-formulario-titulo">Devolver equipo</h3>
                            <p id="devolucion-formulario-descripcion">
                                Registra la recepción del equipo asignado
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarDevolucion}
                            disabled={devolviendo}
                            aria-label="Cerrar formulario de devolución"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    <form onSubmit={guardarDevolucion}>
                        {error && (
                            <div className="error-formulario">
                                {error}
                            </div>
                        )}

                        <div className="resumen-devolucion">
                            <div>
                                <span>Colaborador</span>
                                <strong>
                                    {obtenerColaborador(
                                        asignacionDevolucion
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Equipo</span>
                                <strong>
                                    {obtenerEquipo(
                                        asignacionDevolucion
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>IMEI / Serie</span>
                                <strong>
                                    {asignacionDevolucion.imei ||
                                        asignacionDevolucion.serie ||
                                        '-'}
                                </strong>
                            </div>
                        </div>

                        <div className="formulario-grid">
                            <div className="campo-formulario">
                                <label htmlFor="fecha_devolucion">
                                    Fecha de devolución *
                                </label>

                                <input
                                    id="fecha_devolucion"
                                    name="fecha_devolucion"
                                    type="date"
                                    value={
                                        formularioDevolucion.fecha_devolucion
                                    }
                                    onChange={actualizarDevolucion}
                                    disabled={devolviendo}
                                    required
                                />
                            </div>

                            <div className="campo-formulario">
                                <label htmlFor="autorizado_por">
                                    Autorizador declarado (opcional)
                                </label>

                                <select
                                    id="autorizado_por"
                                    name="autorizado_por"
                                    value={
                                        formularioDevolucion.autorizado_por
                                    }
                                    onChange={actualizarDevolucion}
                                    disabled={devolviendo}
                                >
                                    <option value="">Sin registrar</option>
                                    {colaboradoresActivos.map((colaborador) => (
                                        <option key={colaborador.id} value={colaborador.id}>
                                            {colaborador.apellidos}, {colaborador.nombres}
                                            {colaborador.codigo ? ` (${colaborador.codigo})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <small className="campo-ayuda">
                                    Selección manual; no valida identidad ni permisos.
                                </small>
                            </div>

                            <div className="campo-formulario campo-completo">
                                <label htmlFor="observaciones_devolucion">
                                    Observaciones
                                </label>

                                <textarea
                                    id="observaciones_devolucion"
                                    name="observaciones"
                                    rows="4"
                                    maxLength={15000}
                                    placeholder="Estado físico del equipo al momento de recibirlo"
                                    value={
                                        formularioDevolucion.observaciones
                                    }
                                    onChange={actualizarDevolucion}
                                    disabled={devolviendo}
                                />
                            </div>
                        </div>

                        <div className="advertencia-devolucion">
                            El equipo cambiará de ASIGNADO a LIBRE y volverá a estar disponible para otra asignación. Al confirmar, se generará el cargo de devolución para imprimirlo o guardarlo como PDF.
                        </div>

                        <div className="modal-acciones">
                            <button
                                type="button"
                                className="boton-cancelar"
                                onClick={cerrarDevolucion}
                                disabled={devolviendo}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                className="boton-confirmar-devolucion"
                                disabled={devolviendo}
                            >
                                <RotateCcw size={18} />

                                {devolviendo
                                    ? 'Procesando...'
                                    : 'Confirmar devolución'}
                            </button>
                        </div>
                    </form>
                </DialogoAccesible>
            )}


        </section>
    );
}

export default AsignacionesPage;
