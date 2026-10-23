import {
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    ArrowLeftRight,
    RefreshCw,
    X,
    Smartphone,
    User,
    CalendarDays
} from 'lucide-react';

import './MovimientosPage.css';

import {
    listarMovimientos,
    obtenerMovimientoPorId
} from '../services/movimientoService';

import DialogoAccesible from '../components/DialogoAccesible';
import CampoBusqueda from '../components/CampoBusqueda';
import BotonAccionTabla from '../components/BotonAccionTabla';

function MovimientosPage() {
    const [movimientos, setMovimientos] =
        useState([]);

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState('');

    const [busqueda, setBusqueda] =
        useState('');

    const [tipoSeleccionado, setTipoSeleccionado] =
        useState('TODOS');

    const [detalleAbierto, setDetalleAbierto] =
        useState(false);

    const [movimientoSeleccionado, setMovimientoSeleccionado] =
        useState(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [errorDetalle, setErrorDetalle] =
        useState('');

    const cargarMovimientos = async () => {
        try {
            setCargando(true);
            setError('');

            const datos = await listarMovimientos();

            setMovimientos(datos);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        let activo = true;
        const solicitud = listarMovimientos();

        solicitud
            .then((datos) => {
                if (activo) setMovimientos(datos);
            })
            .catch((error) => {
                if (!activo) return;
                console.error(error);
                setError(error.message);
            })
            .finally(() => {
                if (activo) setCargando(false);
            });

        return () => {
            activo = false;
        };
    }, []);

    const tiposDisponibles = useMemo(() => {
        return [
            ...new Set(
                movimientos
                    .map((movimiento) =>
                        movimiento.tipo_movimiento
                    )
                    .filter(Boolean)
            )
        ];
    }, [movimientos]);

    const movimientosFiltrados = useMemo(() => {
        const texto = busqueda
            .trim()
            .toLowerCase();

        return movimientos.filter((movimiento) => {
            const coincideTipo =
                tipoSeleccionado === 'TODOS' ||
                movimiento.tipo_movimiento ===
                tipoSeleccionado;

            const contenido = [
                movimiento.id,
                movimiento.tipo_movimiento,
                movimiento.descripcion,
                movimiento.marca,
                movimiento.modelo,
                movimiento.imei,
                movimiento.serie,
                movimiento.colaborador,
                movimiento.apellidos,
                movimiento.nombres,
                movimiento.autorizado_por,
                movimiento.autorizado_por_nombre
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

            return coincideTipo && coincideBusqueda;
        });
    }, [
        movimientos,
        busqueda,
        tipoSeleccionado
    ]);

    const resumen = useMemo(() => {
        const incidencias = [
            'PERDIDA',
            'ROBO',
            'BAJA',
            'CUSTODIA'
        ];

        return {
            total: movimientos.length,

            asignaciones: movimientos.filter(
                (movimiento) =>
                    movimiento.tipo_movimiento ===
                    'ASIGNACION'
            ).length,

            devoluciones: movimientos.filter(
                (movimiento) =>
                    movimiento.tipo_movimiento ===
                    'DEVOLUCION'
            ).length,

            incidencias: movimientos.filter(
                (movimiento) =>
                    incidencias.includes(
                        movimiento.tipo_movimiento
                    )
            ).length
        };
    }, [movimientos]);

    const verMovimiento = async (id) => {
        try {
            setDetalleAbierto(true);
            setMovimientoSeleccionado(null);
            setCargandoDetalle(true);
            setErrorDetalle('');

            const datos =
                await obtenerMovimientoPorId(id);

            setMovimientoSeleccionado(datos);
        } catch (error) {
            console.error(error);
            setErrorDetalle(error.message);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cerrarDetalle = () => {
        setDetalleAbierto(false);
        setMovimientoSeleccionado(null);
        setErrorDetalle('');
    };

    return (
        <section className="pagina movimientos-pagina">
            <div className="movimientos-encabezado">
                <div>
                    <h2>Movimientos</h2>

                    <p>
                        Historial de movimientos realizados
                        en el inventario
                    </p>
                </div>

                <button
                    type="button"
                    className="boton-actualizar-movimientos"
                    onClick={cargarMovimientos}
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

            <div className="resumen-movimientos">
                <TarjetaResumen
                    titulo="Total de movimientos"
                    valor={resumen.total}
                    tipo="total"
                />

                <TarjetaResumen
                    titulo="Asignaciones"
                    valor={resumen.asignaciones}
                    tipo="asignacion"
                />

                <TarjetaResumen
                    titulo="Devoluciones"
                    valor={resumen.devoluciones}
                    tipo="devolucion"
                />

                <TarjetaResumen
                    titulo="Incidencias"
                    valor={resumen.incidencias}
                    tipo="incidencia"
                />
            </div>

            <div className="filtros-movimientos">
                <CampoBusqueda
                    className="buscador-movimientos"
                    etiqueta="Buscar movimientos"
                    placeholder="Buscar por colaborador, equipo, IMEI o serie..."
                    value={busqueda}
                    onChange={(evento) =>
                        setBusqueda(evento.target.value)
                    }
                />

                <select
                    aria-label="Filtrar movimientos por tipo"
                    value={tipoSeleccionado}
                    onChange={(evento) =>
                        setTipoSeleccionado(
                            evento.target.value
                        )
                    }
                >
                    <option value="TODOS">
                        Todos los movimientos
                    </option>

                    {tiposDisponibles.map((tipo) => (
                        <option
                            key={tipo}
                            value={tipo}
                        >
                            {formatearTipo(tipo)}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="mensaje-error">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={cargarMovimientos}
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {cargando ? (
                <div className="estado-movimientos">
                    Cargando movimientos...
                </div>
            ) : !error &&
                movimientosFiltrados.length === 0 ? (
                <div className="estado-movimientos">
                    No se encontraron movimientos
                </div>
            ) : !error ? (
                <div className="tabla-movimientos-contenedor">
                    <table className="tabla-movimientos">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Movimiento</th>
                                <th>Equipo</th>
                                <th>Colaborador</th>
                                <th>Descripción</th>
                                <th>Acción</th>
                            </tr>
                        </thead>

                        <tbody>
                            {movimientosFiltrados.map(
                                (movimiento) => (
                                    <tr key={movimiento.id}>

                                        <td className="celda-fecha-movimiento">
                                            <FechaMovimiento
                                                fecha={movimiento.fecha}
                                            />
                                        </td>

                                        <td>
                                            <EtiquetaMovimiento
                                                tipo={
                                                    movimiento.tipo_movimiento
                                                }
                                            />
                                        </td>

                                        <td>
                                            <strong>
                                                {obtenerEquipo(
                                                    movimiento
                                                )}
                                            </strong>

                                            <small>
                                                {movimiento.imei ||
                                                    movimiento.serie ||
                                                    'Sin identificador'}
                                            </small>
                                        </td>

                                        <td>
                                            {obtenerColaborador(
                                                movimiento
                                            )}
                                        </td>

                                        <td>
                                            {movimiento.descripcion ||
                                                '-'}
                                        </td>

                                        <td>
                                            <BotonAccionTabla
                                                etiqueta={`Ver movimiento ${movimiento.id}`}
                                                onClick={() =>
                                                    verMovimiento(
                                                        movimiento.id
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {detalleAbierto && (
                <DialogoAccesible
                    className="modal-movimiento"
                    tituloId="movimiento-detalle-titulo"
                    descripcionId="movimiento-detalle-descripcion"
                    onCerrar={cerrarDetalle}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="movimiento-detalle-titulo">
                                Detalle del movimiento
                            </h3>

                            <p id="movimiento-detalle-descripcion">
                                Información registrada en
                                el historial
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarDetalle}
                            aria-label="Cerrar detalle del movimiento"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoDetalle ? (
                        <div className="estado-movimientos">
                            Cargando información...
                        </div>
                    ) : errorDetalle ? (
                        <div className="error-formulario">
                            {errorDetalle}
                        </div>
                    ) : movimientoSeleccionado ? (
                        <DetalleMovimiento
                            movimiento={
                                movimientoSeleccionado
                            }
                        />
                    ) : null}
                </DialogoAccesible>
            )}
        </section>
    );
}

function TarjetaResumen({ titulo, valor, tipo }) {
    return (
        <article
            className={`tarjeta-resumen-movimiento tarjeta-${tipo}`}
        >
            <div>
                <span>{titulo}</span>
                <strong>{valor}</strong>
            </div>

            <ArrowLeftRight size={22} />
        </article>
    );
}

function EtiquetaMovimiento({ tipo }) {
    const clase = String(tipo || 'sin-tipo')
        .toLowerCase()
        .replaceAll('_', '-');

    return (
        <span
            className={`etiqueta-movimiento movimiento-${clase}`}
        >
            {formatearTipo(tipo)}
        </span>
    );
}

function DetalleMovimiento({ movimiento }) {
    return (
        <div className="detalle-movimiento">
            <div className="detalle-movimiento-principal">
                <ArrowLeftRight size={26} />

                <div>
                    <span>Tipo de movimiento</span>

                    <h4>
                        {formatearTipo(
                            movimiento.tipo_movimiento
                        )}
                    </h4>
                </div>
            </div>

            <div className="detalle-movimiento-grid">
                <CampoDetalle
                    icono={<CalendarDays size={17} />}
                    etiqueta="Fecha"
                    valor={formatearFecha(
                        movimiento.fecha
                    )}
                />

                <CampoDetalle
                    icono={<Smartphone size={17} />}
                    etiqueta="Equipo"
                    valor={obtenerEquipo(movimiento)}
                />

                <CampoDetalle
                    etiqueta="Serie"
                    valor={movimiento.serie}
                />

                <CampoDetalle
                    icono={<User size={17} />}
                    etiqueta="Colaborador"
                    valor={obtenerColaborador(
                        movimiento
                    )}
                />

                <CampoDetalle
                    etiqueta="Unidad empresarial"
                    valor={movimiento.unidad_empresarial}
                />

                <CampoDetalle
                    etiqueta="Descripción"
                    valor={movimiento.descripcion}
                    completo
                />
            </div>
        </div>
    );
}

function CampoDetalle({
    icono,
    etiqueta,
    valor,
    completo = false
}) {
    return (
        <div
            className={`campo-detalle-movimiento ${completo ? 'campo-completo' : ''
                }`}
        >
            <span>
                {icono}
                {etiqueta}
            </span>

            <strong>{valor || '-'}</strong>
        </div>
    );
}

function obtenerEquipo(movimiento) {
    const equipo = [
        movimiento.marca,
        movimiento.modelo
    ]
        .filter(Boolean)
        .join(' ');

    return equipo || 'Sin equipo';
}

function obtenerColaborador(movimiento) {
    if (movimiento.colaborador) {
        return movimiento.colaborador;
    }

    const colaborador = [
        movimiento.apellidos,
        movimiento.nombres
    ]
        .filter(Boolean)
        .join(', ');

    return colaborador || 'Sin colaborador';
}

function formatearTipo(tipo) {
    if (!tipo) return '-';

    return tipo
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letra) =>
            letra.toUpperCase()
        );
}

function FechaMovimiento({ fecha }) {
    if (!fecha) {
        return <span>-</span>;
    }

    const fechaConvertida = new Date(fecha);

    if (Number.isNaN(fechaConvertida.getTime())) {
        return <span>{fecha}</span>;
    }

    const dia = fechaConvertida.toLocaleDateString(
        'es-PE',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }
    );

    const hora = fechaConvertida.toLocaleTimeString(
        'es-PE',
        {
            hour: '2-digit',
            minute: '2-digit'
        }
    );

    return (
        <div className="fecha-movimiento">
            <strong>{dia}</strong>
            <span>{hora}</span>
        </div>
    );
}

function formatearFecha(fecha) {
    if (!fecha) return '-';

    const fechaConvertida = new Date(fecha);

    if (Number.isNaN(fechaConvertida.getTime())) {
        return fecha;
    }

    return fechaConvertida.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default MovimientosPage;
