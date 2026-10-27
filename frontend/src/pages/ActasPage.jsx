import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import {
    FileText,
    RefreshCw,
    X,
    CheckCircle2,
    Clock3,
    Smartphone,
    User,
    CalendarDays
} from 'lucide-react';

import {
    listarActas,
    obtenerActaPorId,
    subirDocumentoActa,
    abrirDocumentoActa
} from '../services/actaService';

import DialogoAccesible from '../components/DialogoAccesible';
import CampoBusqueda from '../components/CampoBusqueda';
import BotonAccionTabla from '../components/BotonAccionTabla';

import './ActasPage.css';

function ActasPage() {
    const [actas, setActas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [estadoSeleccionado, setEstadoSeleccionado] =
        useState('TODOS');

    const [detalleAbierto, setDetalleAbierto] =
        useState(false);

    const [actaSeleccionada, setActaSeleccionada] =
        useState(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [errorDetalle, setErrorDetalle] =
        useState('');

    const peticionLista = useRef(0);
    const peticionDetalle = useRef(0);

    const cargarActas = async () => {
        const peticion = ++peticionLista.current;
        try {
            setCargando(true);
            setError('');

            const datos = await listarActas();
            if (peticion !== peticionLista.current) return;
            setActas(datos);
        } catch (error) {
            if (peticion !== peticionLista.current) return;
            console.error(error);
            setError(error.message);
            setActas([]);
        } finally {
            if (peticion === peticionLista.current) setCargando(false);
        }
    };

    useEffect(() => {
        let activo = true;
        const peticion = ++peticionLista.current;
        const solicitud = listarActas();

        solicitud
            .then((datos) => {
                if (
                    activo &&
                    peticion === peticionLista.current
                ) {
                    setActas(datos);
                }
            })
            .catch((error) => {
                if (
                    !activo ||
                    peticion !== peticionLista.current
                ) return;

                console.error(error);
                setError(error.message);
                setActas([]);
            })
            .finally(() => {
                if (
                    activo &&
                    peticion === peticionLista.current
                ) {
                    setCargando(false);
                }
            });

        return () => {
            activo = false;
            peticionLista.current += 1;
            peticionDetalle.current += 1;
        };
    }, []);

    const estadosDisponibles = useMemo(() => {
        return [
            ...new Set(
                actas
                    .map((acta) => acta.estado)
                    .filter(Boolean)
            )
        ];
    }, [actas]);

    const resumen = useMemo(() => {
        return {
            total: actas.length,

            cerradas: actas.filter(
                (acta) =>
                    normalizar(acta.estado) ===
                    'CERRADA'
            ).length,

            pendientes: actas.filter(
                (acta) =>
                    normalizar(acta.estado) ===
                    'PENDIENTE'
            ).length,

            devueltos: actas.filter(
                (acta) => acta.estado_devolucion === 'TOTAL'
            ).length,
            parciales: actas.filter((acta) => acta.estado_devolucion === 'PARCIAL').length,
            revisar: actas.filter((acta) => acta.estado_devolucion === 'REVISAR').length
        };
    }, [actas]);

    const actasFiltradas = useMemo(() => {
        const texto = busqueda
            .trim()
            .toLowerCase();

        return actas.filter((acta) => {
            const coincideEstado =
                estadoSeleccionado === 'TODOS' ||
                acta.estado === estadoSeleccionado;

            const contenido = [
                acta.id,
                acta.nro_acta,
                acta.numero_acta,
                acta.estado,
                acta.colaborador,
                acta.apellidos,
                acta.nombres,
                acta.codigo_colaborador,
                ...acta.equipos.flatMap((equipo) => [
                    equipo.marca, equipo.modelo, equipo.imei, equipo.serie
                ])
            ]
                .filter((valor) =>
                    valor !== null &&
                    valor !== undefined
                )
                .join(' ')
                .toLowerCase();

            const coincideBusqueda =
                !texto ||
                contenido.includes(texto);

            return (
                coincideEstado &&
                coincideBusqueda
            );
        });
    }, [
        actas,
        busqueda,
        estadoSeleccionado
    ]);

    const verActa = async (id) => {
        const peticion = ++peticionDetalle.current;
        try {
            setDetalleAbierto(true);
            setCargandoDetalle(true);
            setActaSeleccionada(null);
            setErrorDetalle('');

            const datos = await obtenerActaPorId(id);
            if (peticion !== peticionDetalle.current) return;
            setActaSeleccionada(datos);
        } catch (error) {
            if (peticion !== peticionDetalle.current) return;
            console.error(error);
            setErrorDetalle(error.message);
        } finally {
            if (peticion === peticionDetalle.current) setCargandoDetalle(false);
        }
    };

    const cerrarDetalle = () => {
        peticionDetalle.current += 1;
        setDetalleAbierto(false);
        setActaSeleccionada(null);
        setErrorDetalle('');
        setCargandoDetalle(false);
    };

    return (
        <section className="pagina actas-pagina">
            <div className="actas-encabezado">
                <div>
                    <h2>Actas</h2>

                    <p>
                        Control de actas, firmas y devolución
                        de equipos
                    </p>
                </div>

                <button
                    type="button"
                    className="boton-actualizar-actas"
                    onClick={cargarActas}
                    disabled={cargando}
                >
                    <RefreshCw
                        size={18}
                        className={
                            cargando
                                ? 'icono-girando'
                                : ''
                        }
                    />

                    Actualizar
                </button>
            </div>

            <div className="resumen-actas">
                <TarjetaActa
                    titulo="Total de actas"
                    valor={cargando || error ? '—' : resumen.total}
                    tipo="total"
                    icono={<FileText size={22} />}
                />

                <TarjetaActa
                    titulo="Actas cerradas"
                    valor={cargando || error ? '—' : resumen.cerradas}
                    tipo="cerrada"
                    icono={<CheckCircle2 size={22} />}
                />

                <TarjetaActa
                    titulo="Actas pendientes"
                    valor={cargando || error ? '—' : resumen.pendientes}
                    tipo="pendiente"
                    icono={<Clock3 size={22} />}
                />

                <TarjetaActa
                    titulo="Devolución total (actas)"
                    valor={cargando || error ? '—' : resumen.devueltos}
                    tipo="devuelto"
                    icono={<Smartphone size={22} />}
                />
            </div>

            {!cargando && !error && (
                <p className="actas-nota-resumen">
                    Devolución parcial: {resumen.parciales} actas. Datos por revisar: {resumen.revisar} actas.
                    {' '}Los contadores incluyen todas las actas, también las anuladas, sin aplicar los filtros.
                </p>
            )}

            <div className="filtros-actas">
                <CampoBusqueda
                    className="buscador-actas"
                    etiqueta="Buscar actas"
                    placeholder="Buscar por acta, colaborador, equipo, IMEI o serie..."
                    value={busqueda}
                    onChange={(evento) =>
                        setBusqueda(evento.target.value)
                    }
                />

                <select
                    aria-label="Filtrar por estado del acta"
                    value={estadoSeleccionado}
                    onChange={(evento) =>
                        setEstadoSeleccionado(
                            evento.target.value
                        )
                    }
                >
                    <option value="TODOS">
                        Todos los estados
                    </option>

                    {estadosDisponibles.map(
                        (estado) => (
                            <option
                                key={estado}
                                value={estado}
                            >
                                {formatearTexto(estado)}
                            </option>
                        )
                    )}
                </select>
            </div>

            {error && (
                <div className="mensaje-error">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={cargarActas}
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {cargando ? (
                <div className="estado-actas">
                    Cargando actas...
                </div>
            ) : !error &&
                actasFiltradas.length === 0 ? (
                <div className="estado-actas">
                    No se encontraron actas
                </div>
            ) : !error ? (
                <div className="tabla-actas-contenedor">
                    <table className="tabla-actas">
                        <thead>
                            <tr>
                                <th>N.° de acta</th>
                                <th>Fecha</th>
                                <th>Colaborador</th>
                                <th>Equipos</th>
                                <th>Firma AMO</th>
                                <th>Firma DMO</th>
                                <th>Devolución</th>
                                <th>PDF firmas AMO/DMO</th>
                                <th>PDF devolución</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>

                        <tbody>
                            {actasFiltradas.map((acta) => (
                                <tr key={acta.id}>
                                    <td>
                                        <strong>
                                            {obtenerNumeroActa(
                                                acta
                                            )}
                                        </strong>
                                    </td>

                                    <td className="celda-fecha-acta">
                                        {formatearFechaActa(
                                            acta.fecha
                                        )}
                                    </td>

                                    <td>
                                        {obtenerColaborador(
                                            acta
                                        )}
                                    </td>

                                    <td>{acta.cantidad_equipos}</td>

                                    <td>
                                        <IndicadorSiNo
                                            valor={
                                                acta.firmo_amo
                                            }
                                        />
                                    </td>

                                    <td>
                                        <IndicadorSiNo
                                            valor={
                                                acta.firmo_dmo
                                            }
                                        />
                                    </td>

                                    <td>
                                        <DevolucionActa acta={acta} />
                                    </td>

                                    <td>
                                        <SeccionDocumentoActa
                                            actaId={acta.id}
                                            tipo="firmas"
                                            titulo="Firmas AMO y DMO"
                                            compacto
                                        />
                                    </td>

                                    <td>
                                        <SeccionDocumentoActa
                                            actaId={acta.id}
                                            tipo="devolucion"
                                            titulo="Devolución"
                                            compacto
                                        />
                                    </td>

                                    <td>
                                        <EstadoActa
                                            estado={
                                                acta.estado
                                            }
                                        />
                                    </td>

                                    <td>
                                        <BotonAccionTabla
                                            className="accion-ver-acta"
                                            etiqueta={`Ver acta ${obtenerNumeroActa(acta)}`}
                                            onClick={() =>
                                                verActa(
                                                    acta.id
                                                )
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {detalleAbierto && (
                <DialogoAccesible
                    className="modal-acta"
                    tituloId="titulo-detalle-acta"
                    descripcionId="descripcion-detalle-acta"
                    onCerrar={cerrarDetalle}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="titulo-detalle-acta">Detalle del acta</h3>

                            <p id="descripcion-detalle-acta">
                                Información de firmas,
                                colaborador y equipos
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            aria-label="Cerrar detalle del acta"
                            onClick={cerrarDetalle}
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoDetalle ? (
                        <div className="estado-actas">
                            Cargando información...
                        </div>
                    ) : errorDetalle ? (
                        <div className="error-formulario">
                            {errorDetalle}
                        </div>
                    ) : actaSeleccionada ? (
                        <DetalleActa
                            acta={actaSeleccionada}
                        />
                    ) : null}
                </DialogoAccesible>
            )}
        </section>
    );
}

function TarjetaActa({
    titulo,
    valor,
    tipo,
    icono
}) {
    return (
        <article
            className={`tarjeta-resumen-acta tarjeta-acta-${tipo}`}
        >
            <div>
                <span>{titulo}</span>
                <strong>{valor}</strong>
            </div>

            {icono}
        </article>
    );
}

function IndicadorSiNo({
    valor,
    textoSi = 'Sí',
    textoNo = 'No'
}) {
    const esSi = normalizar(valor) === 'SI';

    return (
        <span
            className={`indicador-si-no ${esSi ? 'indicador-si' : 'indicador-no'
                }`}
        >
            {esSi ? textoSi : textoNo}
        </span>
    );
}

function EstadoActa({ estado }) {
    const clase = normalizar(
        estado || 'SIN ESTADO'
    )
        .toLowerCase()
        .replaceAll(' ', '-')
        .replaceAll('_', '-');

    return (
        <span
            className={`estado-acta estado-acta-${clase}`}
        >
            {formatearTexto(estado)}
        </span>
    );
}

function DevolucionActa({ acta }) {
    const etiquetas = {
        SIN_EQUIPOS: 'Sin equipos registrados',
        PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', TOTAL: 'Total', REVISAR: 'Revisar datos'
    };
    return (
        <div className="devolucion-acta-resumen">
            <span className={`devolucion-acta devolucion-acta-${acta.estado_devolucion.toLowerCase()}`}>
                {etiquetas[acta.estado_devolucion]}
            </span>
            {acta.cantidad_equipos > 0 && (
                <small>{acta.cantidad_devueltos} de {acta.cantidad_equipos} devueltos</small>
            )}
            {acta.cantidad_incidencias > 0 && (
                <small>{acta.cantidad_incidencias} con pérdida o robo registrado</small>
            )}
        </div>
    );
}

function DetalleActa({ acta }) {
    return (
        <div className="detalle-acta">
            <div className="detalle-acta-principal">
                <FileText size={26} />

                <div>
                    <span>Número de acta</span>

                    <h4>
                        {obtenerNumeroActa(acta)}
                    </h4>
                </div>

                <EstadoActa estado={acta.estado} />
            </div>

            <div className="detalle-acta-grid">
                <CampoDetalleActa
                    icono={<CalendarDays size={17} />}
                    etiqueta="Fecha"
                    valor={formatearFechaActa(
                        acta.fecha
                    )}
                />

                <CampoDetalleActa
                    icono={<User size={17} />}
                    etiqueta="Colaborador"
                    valor={obtenerColaborador(acta)}
                />

                <CampoDetalleActa
                    etiqueta="Firma AMO"
                    valor={
                        normalizar(
                            acta.firmo_amo
                        ) === 'SI'
                            ? 'Firmado'
                            : 'Pendiente'
                    }
                />

                <CampoDetalleActa
                    etiqueta="Firma DMO"
                    valor={
                        normalizar(
                            acta.firmo_dmo
                        ) === 'SI'
                            ? 'Firmado'
                            : 'Pendiente'
                    }
                />

                <CampoDetalleActa etiqueta="Observaciones del acta" valor={acta.observaciones} completo />
            </div>

            <div className="equipos-acta-encabezado">
                <h4>Equipos del acta ({acta.cantidad_equipos})</h4>
                <DevolucionActa acta={acta} />
            </div>
            <p className="actas-nota-resumen">
                Información registrada en los detalles de esta acta; no se deduce del estado actual del equipo.
            </p>
            {acta.cantidad_por_revisar > 0 && (
                <p className="acta-aviso-datos" role="status">
                    Hay {acta.cantidad_por_revisar} detalles cuyo estado y marca de devolución no coinciden.
                    {' '}Se muestran los valores originales; no se corrigieron automáticamente.
                </p>
            )}
            {acta.equipos.length === 0 ? (
                <p className="acta-sin-equipos">
                    No hay equipos registrados en detalle_acta para este documento.
                    {' '}Esto no confirma si existen asignaciones relacionadas.
                </p>
            ) : (
                <div className="equipos-acta-contenedor" tabIndex={0} role="region" aria-label="Equipos registrados en el acta">
                    <table className="equipos-acta-tabla">
                        <thead>
                            <tr>
                                <th scope="col">Equipo</th>
                                <th scope="col">Identificadores</th>
                                <th scope="col">Fechas</th>
                                <th scope="col">Estado del detalle</th>
                                <th scope="col">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {acta.equipos.map((equipo) => (
                                <tr key={equipo.detalle_id}>
                                    <td>
                                        <strong>{obtenerEquipo(equipo)}</strong>
                                        <small>{equipo.tipo || '-'} · ID {equipo.equipo_id}</small>
                                        {equipo.perifericos?.length > 0 ? (
                                            <div className="acta-perifericos-lista">
                                                {equipo.perifericos.map((periferico) => (
                                                    <small key={periferico.periferico_id}>
                                                        {periferico.tipo_periferico || 'Periférico'}: {[periferico.marca, periferico.modelo].filter(Boolean).join(' ') || 'Sin descripción'}
                                                        {periferico.serie ? ` · Serie: ${periferico.serie}` : ''}
                                                        {periferico.codigo_patrimonial ? ` · Código: ${periferico.codigo_patrimonial}` : ''}
                                                    </small>
                                                ))}
                                            </div>
                                        ) : (
                                            <small>Sin periféricos vinculados</small>
                                        )}
                                    </td>
                                    <td>
                                        <small>IMEI</small><span className="acta-identificador">{equipo.imei || '-'}</span>
                                        <small>Serie</small><span className="acta-identificador">{equipo.serie || '-'}</span>
                                    </td>
                                    <td>
                                        <small>Entrega</small><span className="acta-identificador">{formatearFechaActa(equipo.fecha_entrega)}</span>
                                        <small>Devolución</small><span className="acta-identificador">{formatearFechaActa(equipo.fecha_devolucion)}</span>
                                    </td>
                                    <td>
                                        <strong>{formatearTexto(equipo.estado)}</strong>
                                        <small>Marca devuelto: {equipo.devolvio_equipo || '-'}</small>
                                        {equipo.devolucion_registrada === 'REVISAR' && (
                                            <span className="acta-dato-revisar">Revisar datos</span>
                                        )}
                                    </td>
                                    <td className="acta-notas-equipo">{equipo.observaciones || 'Sin observaciones'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}


function SeccionDocumentoActa({ actaId, tipo, titulo, compacto = false }) {
    const [archivo, setArchivo] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');

    const cargar = async () => {
        if (!archivo) {
            setError('Selecciona un archivo PDF.');
            setMensaje('');
            return;
        }
        if (archivo.type !== 'application/pdf' || !archivo.name.toLowerCase().endsWith('.pdf')) {
            setError('El archivo debe tener formato PDF.');
            setMensaje('');
            return;
        }
        if (archivo.size > 10 * 1024 * 1024) {
            setError('El PDF no debe superar los 10 MB.');
            setMensaje('');
            return;
        }
        try {
            setOcupado(true);
            setError('');
            setMensaje('');
            await subirDocumentoActa(actaId, tipo, archivo);
            setMensaje('PDF guardado correctamente.');
            setArchivo(null);
        } catch (e) {
            setError(e.message || 'No se pudo cargar el PDF.');
        } finally {
            setOcupado(false);
        }
    };

    const abrir = async () => {
        try {
            setOcupado(true);
            setError('');
            await abrirDocumentoActa(actaId, tipo);
        } catch (e) {
            setError(e.message || 'No se pudo abrir el PDF.');
        } finally {
            setOcupado(false);
        }
    };

    return (
        <section className={`acta-documento-pdf ${compacto ? 'acta-documento-pdf-compacto' : ''}`}>
            {!compacto && <h4>{titulo}</h4>}
            <label>
                <span className="acta-documento-label">
                    {compacto ? titulo : 'Seleccionar PDF (máximo 10 MB)'}
                </span>
                <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={ocupado}
                    onChange={(evento) => {
                        setArchivo(evento.target.files?.[0] || null);
                        setMensaje('');
                        setError('');
                    }}
                />
            </label>
            <div className="acta-documento-acciones">
                <button type="button" onClick={cargar} disabled={ocupado || !archivo}>
                    {ocupado ? 'Procesando...' : (compacto ? 'Cargar' : 'Guardar PDF')}
                </button>
                <button type="button" onClick={abrir} disabled={ocupado}>
                    {compacto ? 'Ver PDF' : 'Consultar PDF guardado'}
                </button>
            </div>
            {mensaje && <p role="status" className="acta-documento-exito">{mensaje}</p>}
            {error && <p role="alert" className="acta-documento-error">{error}</p>}
        </section>
    );
}

function CampoDetalleActa({
    icono,
    etiqueta,
    valor,
    completo = false
}) {
    return (
        <div
            className={`campo-detalle-acta ${completo ? 'campo-completo' : ''
                }`}
        >
            <span>
                {icono}
                {etiqueta}
            </span>

            <strong>{valor ?? '-'}</strong>
        </div>
    );
}

function obtenerNumeroActa(acta) {
    return (
        acta.nro_acta ||
        acta.numero_acta ||
        `ACTA-${acta.id}`
    );
}

function obtenerColaborador(acta) {
    if (acta.colaborador) {
        return acta.colaborador;
    }

    return (
        [acta.apellidos, acta.nombres]
            .filter(Boolean)
            .join(', ') ||
        'Sin colaborador'
    );
}

function obtenerEquipo(equipo) {
    return (
        [equipo.marca, equipo.modelo]
            .filter(Boolean)
            .join(' ') ||
        'Equipo sin descripción'
    );
}

function formatearFechaActa(fecha) {
    if (!fecha) return '-';

    const texto = String(fecha);

    const coincidencia = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (coincidencia) {
        const [, anio, mes, dia] = coincidencia;
        return `${dia}/${mes}/${anio}`;
    }

    const fechaConvertida = new Date(fecha);

    if (Number.isNaN(fechaConvertida.getTime())) {
        return fecha;
    }

    return fechaConvertida.toLocaleDateString(
        'es-PE',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }
    );
}

function normalizar(valor) {
    return String(valor || '')
        .trim()
        .toUpperCase();
}

function formatearTexto(texto) {
    if (!texto) return '-';

    return String(texto)
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letra) =>
            letra.toUpperCase()
        );
}

export default ActasPage;
