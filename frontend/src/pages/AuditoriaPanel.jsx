import {
    useEffect,
    useMemo,
    useState
} from 'react';
import {
    CircleCheck,
    CircleX,
    History,
    RefreshCw,
    Search,
    TriangleAlert
} from 'lucide-react';

import { listarAuditoria } from '../services/auditoriaService';

const ETIQUETAS_ACCION = Object.freeze({
    ACTIVAR_USUARIO: 'Activar usuario',
    ACTUALIZAR: 'Actualizar',
    ASIGNAR: 'Asignar',
    CERRAR_SESION: 'Cerrar sesión',
    CREAR: 'Crear',
    DESACTIVAR_USUARIO: 'Desactivar usuario',
    DEVOLVER: 'Devolver',
    ELIMINAR: 'Eliminar',
    RESTABLECER_CLAVE: 'Restablecer contraseña'
});

function AuditoriaPanel() {
    const [eventos, setEventos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [resultadoSeleccionado, setResultadoSeleccionado] =
        useState('TODOS');
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        let activo = true;

        const cargar = async () => {
            setCargando(true);
            setError('');

            try {
                const datos = await listarAuditoria(100);
                if (activo) setEventos(datos);
            } catch (error) {
                if (activo) setError(error.message);
            } finally {
                if (activo) setCargando(false);
            }
        };

        cargar();

        return () => {
            activo = false;
        };
    }, [revision]);

    const resumen = useMemo(() => ({
        total: eventos.length,
        exitos: eventos.filter(
            (evento) => evento.resultado === 'EXITO'
        ).length,
        rechazados: eventos.filter(
            (evento) => evento.resultado === 'RECHAZADO'
        ).length,
        errores: eventos.filter(
            (evento) => evento.resultado === 'ERROR'
        ).length
    }), [eventos]);

    const eventosFiltrados = useMemo(() => {
        const texto = normalizar(busqueda);

        return eventos.filter((evento) => {
            const coincideResultado =
                resultadoSeleccionado === 'TODOS' ||
                evento.resultado === resultadoSeleccionado;
            const contenido = [
                evento.cuenta_usuario,
                evento.nombre_usuario,
                evento.rol_usuario,
                evento.accion,
                evento.recurso,
                evento.recurso_id,
                evento.metodo,
                evento.ruta,
                evento.resultado,
                evento.estado_http,
                evento.ip
            ].join(' ');

            return coincideResultado &&
                normalizar(contenido).includes(texto);
        });
    }, [busqueda, eventos, resultadoSeleccionado]);

    const actualizar = () =>
        setRevision((anterior) => anterior + 1);

    return (
        <section className="auditoria-panel">
            <div className="config-encabezado">
                <div>
                    <h3>Auditoría del sistema</h3>
                    <p>Últimas 100 operaciones autenticadas registradas</p>
                </div>

                <button
                    type="button"
                    className="config-boton-actualizar"
                    onClick={actualizar}
                    disabled={cargando}
                >
                    <RefreshCw
                        size={18}
                        className={cargando ? 'config-icono-girando' : ''}
                        aria-hidden="true"
                    />
                    {cargando ? 'Cargando...' : 'Actualizar'}
                </button>
            </div>

            <div className="config-resumen auditoria-resumen">
                <ResumenAuditoria
                    titulo="Eventos"
                    valor={resumen.total}
                    icono={History}
                    tipo="total"
                />
                <ResumenAuditoria
                    titulo="Exitosos"
                    valor={resumen.exitos}
                    icono={CircleCheck}
                    tipo="exito"
                />
                <ResumenAuditoria
                    titulo="Rechazados"
                    valor={resumen.rechazados}
                    icono={CircleX}
                    tipo="rechazado"
                />
                <ResumenAuditoria
                    titulo="Errores"
                    valor={resumen.errores}
                    icono={TriangleAlert}
                    tipo="error"
                />
            </div>

            <div className="config-filtros auditoria-filtros">
                <div className="config-buscador">
                    <Search size={18} aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Buscar en auditoría"
                        placeholder="Buscar por usuario, acción, recurso, ruta o IP..."
                        value={busqueda}
                        onChange={(evento) =>
                            setBusqueda(evento.target.value)
                        }
                    />
                </div>

                <select
                    className="auditoria-filtro-resultado"
                    aria-label="Filtrar por resultado"
                    value={resultadoSeleccionado}
                    onChange={(evento) =>
                        setResultadoSeleccionado(evento.target.value)
                    }
                >
                    <option value="TODOS">Todos los resultados</option>
                    <option value="EXITO">Exitosos</option>
                    <option value="RECHAZADO">Rechazados</option>
                    <option value="ERROR">Errores</option>
                </select>
            </div>

            {cargando ? (
                <div className="config-mensaje" role="status">
                    Cargando auditoría...
                </div>
            ) : error ? (
                <div className="config-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={actualizar}>
                        Reintentar
                    </button>
                </div>
            ) : eventosFiltrados.length === 0 ? (
                <div className="config-mensaje">
                    {eventos.length === 0
                        ? 'Todavía no existen operaciones auditadas.'
                        : 'No se encontraron eventos con esos filtros.'}
                </div>
            ) : (
                <>
                    <div className="config-tabla-contenedor">
                        <table className="config-tabla auditoria-tabla">
                            <thead>
                                <tr>
                                    <th scope="col">Fecha</th>
                                    <th scope="col">Usuario</th>
                                    <th scope="col">Acción</th>
                                    <th scope="col">Recurso</th>
                                    <th scope="col">Resultado</th>
                                    <th scope="col">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventosFiltrados.map((evento) => {
                                    const fecha = formatearFecha(evento.creado_en);

                                    return (
                                        <tr key={evento.id}>
                                            <td className="auditoria-fecha">
                                                <strong>{fecha.fecha}</strong>
                                                <small>{fecha.hora}</small>
                                            </td>
                                            <td>
                                                <strong>{evento.nombre_usuario}</strong>
                                                <small className="auditoria-secundario">
                                                    {evento.cuenta_usuario} · {formatearTexto(evento.rol_usuario)}
                                                </small>
                                            </td>
                                            <td>
                                                <strong>{formatearAccion(evento.accion)}</strong>
                                                <small className="auditoria-secundario auditoria-ruta">
                                                    {evento.metodo} {evento.ruta}
                                                </small>
                                            </td>
                                            <td>
                                                {formatearTexto(evento.recurso)}
                                                {evento.recurso_id != null && (
                                                    <small className="auditoria-secundario">
                                                        ID {evento.recurso_id}
                                                    </small>
                                                )}
                                            </td>
                                            <td>
                                                <ResultadoAuditoria evento={evento} />
                                            </td>
                                            <td className="auditoria-ip">
                                                {evento.ip || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p className="config-resultados">
                        Mostrando {eventosFiltrados.length} de {eventos.length} eventos cargados
                    </p>
                </>
            )}
        </section>
    );
}

function ResumenAuditoria({ titulo, valor, icono: Icono, tipo }) {
    return (
        <article className={`config-tarjeta auditoria-tarjeta-${tipo}`}>
            <div><span>{titulo}</span><strong>{valor}</strong></div>
            <Icono size={24} aria-hidden="true" />
        </article>
    );
}

function ResultadoAuditoria({ evento }) {
    const tipo = String(evento.resultado || 'ERROR').toLowerCase();

    return (
        <span
            className={`auditoria-resultado auditoria-resultado-${tipo}`}
            title={`Estado HTTP ${evento.estado_http}`}
        >
            {formatearTexto(evento.resultado)} · {evento.estado_http}
        </span>
    );
}

function formatearFecha(valor) {
    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return { fecha: 'Fecha inválida', hora: '—' };
    }

    return {
        fecha: fecha.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }),
        hora: fecha.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    };
}

function formatearAccion(valor) {
    return ETIQUETAS_ACCION[valor] || formatearTexto(valor);
}

function formatearTexto(valor) {
    const texto = String(valor || '—')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .toLowerCase();

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizar(valor) {
    return String(valor ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

export default AuditoriaPanel;

