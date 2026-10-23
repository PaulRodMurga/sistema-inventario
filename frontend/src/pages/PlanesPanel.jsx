import {
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    Smartphone,
    Search,
    RefreshCw
} from 'lucide-react';

import { listarPlanes } from '../services/planService';

function PlanesPanel() {
    const [planes, setPlanes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        let activo = true;

        const cargarPlanes = async () => {
            setCargando(true);
            setError('');

            try {
                const datos = await listarPlanes();

                if (activo) {
                    setPlanes(datos);
                }
            } catch (error) {
                if (activo) {
                    setError(error.message);
                }
            } finally {
                if (activo) {
                    setCargando(false);
                }
            }
        };

        cargarPlanes();

        return () => {
            activo = false;
        };
    }, [revision]);

    const actualizarListado = () => {
        setRevision((anterior) => anterior + 1);
    };

    const planesFiltrados = useMemo(() => {
        const texto = normalizar(busqueda);

        return planes.filter((plan) => {
            const contenido = [
                plan.id,
                plan.nombre,
                plan.gb,
                formatearCapacidad(plan.gb),
                plan.estado
            ]
                .filter((valor) => valor != null)
                .join(' ');

            return normalizar(contenido).includes(texto);
        });
    }, [planes, busqueda]);

    const resumen = useMemo(() => [
        {
            titulo: 'Total de planes',
            cantidad: planes.length,
            tipo: 'total'
        },
        {
            titulo: 'Activos',
            cantidad: planes.filter(
                (plan) =>
                    normalizar(plan.estado) === 'ACTIVO'
            ).length,
            tipo: 'activo'
        },
        {
            titulo: 'Inactivos',
            cantidad: planes.filter(
                (plan) =>
                    normalizar(plan.estado) === 'INACTIVO'
            ).length,
            tipo: 'inactivo'
        }
    ], [planes]);

    return (
        <section
            className="config-planes-panel"
            aria-labelledby="config-planes-titulo"
        >
            <div className="config-encabezado">
                <div>
                    <h3 id="config-planes-titulo">
                        Planes móviles
                    </h3>

                    <p>Capacidad y estado de los planes registrados</p>
                </div>

                <button
                    type="button"
                    className="config-boton-actualizar"
                    onClick={actualizarListado}
                    disabled={cargando}
                >
                    <RefreshCw
                        size={18}
                        aria-hidden="true"
                        className={
                            cargando ? 'config-icono-girando' : ''
                        }
                    />

                    {cargando ? 'Cargando...' : 'Actualizar'}
                </button>
            </div>

            <div className="config-resumen">
                {resumen.map((tarjeta) => (
                    <article
                        key={tarjeta.tipo}
                        className={`config-tarjeta config-tarjeta-${tarjeta.tipo}`}
                    >
                        <div>
                            <span>{tarjeta.titulo}</span>

                            <strong>
                                {cargando || error
                                    ? '—'
                                    : tarjeta.cantidad}
                            </strong>
                        </div>

                        <Smartphone
                            size={24}
                            aria-hidden="true"
                        />
                    </article>
                ))}
            </div>

            <div className="config-filtros">
                <div className="config-buscador">
                    <Search size={18} aria-hidden="true" />

                    <input
                        type="search"
                        aria-label="Buscar plan por nombre, capacidad o estado"
                        placeholder="Buscar por nombre, capacidad o estado..."
                        value={busqueda}
                        onChange={(evento) =>
                            setBusqueda(evento.target.value)
                        }
                    />
                </div>
            </div>

            {cargando ? (
                <div className="config-mensaje" role="status">
                    Cargando planes...
                </div>
            ) : error ? (
                <div className="config-error" role="alert">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={actualizarListado}
                    >
                        Reintentar
                    </button>
                </div>
            ) : planesFiltrados.length === 0 ? (
                <div className="config-mensaje">
                    {planes.length === 0
                        ? 'No hay planes registrados.'
                        : 'No se encontraron planes con esa búsqueda.'}
                </div>
            ) : (
                <>
                    <div className="config-tabla-contenedor">
                        <table className="config-tabla config-tabla-planes">
                            <thead>
                                <tr>
                                    <th scope="col">Plan</th>
                                    <th scope="col">Capacidad</th>
                                    <th scope="col">Estado</th>
                                </tr>
                            </thead>

                            <tbody>
                                {planesFiltrados.map((plan) => (
                                    <tr key={plan.id}>
                                        <td>
                                            <strong>
                                                {plan.nombre || 'Sin nombre'}
                                            </strong>
                                        </td>

                                        <td>
                                            {formatearCapacidad(plan.gb)}
                                        </td>

                                        <td>
                                            <EstadoPlan
                                                estado={plan.estado}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="config-resultados">
                        Mostrando {planesFiltrados.length}
                        {' de '}
                        {planes.length} planes
                    </p>
                </>
            )}
        </section>
    );
}

function EstadoPlan({ estado }) {
    const valor = normalizar(estado);

    const clase =
        valor === 'ACTIVO'
            ? 'config-estado-activo'
            : valor === 'INACTIVO'
                ? 'config-estado-inactivo'
                : 'config-estado-neutro';

    return (
        <span className={`config-estado ${clase}`}>
            {String(estado ?? '').trim() || 'Sin estado'}
        </span>
    );
}

function formatearCapacidad(gb) {
    if (gb == null || String(gb).trim() === '') {
        return '-';
    }

    const capacidad = Number(gb);

    if (!Number.isFinite(capacidad)) {
        return '-';
    }

    return `${capacidad.toLocaleString('es-PE', {
        maximumFractionDigits: 2
    })} GB`;
}

function normalizar(valor) {
    return String(valor ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

export default PlanesPanel;
