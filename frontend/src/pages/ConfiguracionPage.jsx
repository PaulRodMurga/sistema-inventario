import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import {
    Building2,
    Search,
    RefreshCw,
    Eye,
    X,
    Plus,
    Save,
    Pencil
} from 'lucide-react';

import './ConfiguracionPage.css';


import {
    listarOperadores,
    obtenerOperadorPorId,
    registrarOperador,
    actualizarOperador
} from '../services/operadorService';
import EtiquetaEstado from '../components/EtiquetaEstado';

import PlanesPanel from './PlanesPanel';
import ContratasPanel from './ContratasPanel';
import GamasPanel from './GamasPanel';
import UsuariosPanel from './UsuariosPanel';
import AuditoriaPanel from './AuditoriaPanel';

function OperadoresPanel() {
    const [operadores, setOperadores] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [revision, setRevision] = useState(0);
    const [operadorSeleccionadoId, setOperadorSeleccionadoId] =
        useState(null);
    const [registroAbierto, setRegistroAbierto] =
        useState(false);

    const [operadorEditando, setOperadorEditando] =
        useState(null);

    const [mensaje, setMensaje] =
        useState('');


    // Cargar el listado al entrar o presionar Actualizar.
    useEffect(() => {
        let activo = true;

        const cargarOperadores = async () => {
            setCargando(true);
            setError('');

            try {
                const datos = await listarOperadores();

                if (activo) {
                    setOperadores(datos);
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

        cargarOperadores();

        return () => {
            activo = false;
        };
    }, [revision]);

    const actualizarListado = () => {
        setRevision((anterior) => anterior + 1);
    };

    const operadoresFiltrados = useMemo(() => {
        const texto = normalizar(busqueda);

        return operadores.filter((operador) => {
            const contenido = [
                operador.id,
                operador.nombre,
                operador.ruc,
                operador.estado
            ]
                .filter((valor) => valor != null)
                .join(' ');

            return normalizar(contenido).includes(texto);
        });
    }, [operadores, busqueda]);

    const resumen = useMemo(() => ({
        total: operadores.length,

        activos: operadores.filter(
            (operador) =>
                normalizar(operador.estado) === 'ACTIVO'
        ).length,

        inactivos: operadores.filter(
            (operador) =>
                normalizar(operador.estado) === 'INACTIVO'
        ).length
    }), [operadores]);

    return (
        <section className="config-panel-operadores">
            <div className="config-encabezado">
                <div>
                    <h3>Proveedores</h3>
                    <p>Gestión de los proveedores registrados</p>
                </div>

                <div className="config-acciones-encabezado">
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

                    <button
                        type="button"
                        className="config-boton-primario"
                        onClick={() => {
                            setMensaje('');
                            setOperadorEditando(null);
                            setRegistroAbierto(true);
                        }}
                    >
                        <Plus size={18} aria-hidden="true" />
                        Registrar proveedor
                    </button>
                </div>
            </div>

            {mensaje && (
                <div className="config-exito" role="status">
                    {mensaje}
                </div>
            )}


            <div className="config-resumen">
                <TarjetaResumen
                    titulo="Total de proveedores"
                    valor={resumen.total}
                    cargando={cargando}
                    tipo="total"
                />

                <TarjetaResumen
                    titulo="Activos"
                    valor={resumen.activos}
                    cargando={cargando}
                    tipo="activo"
                />

                <TarjetaResumen
                    titulo="Inactivos"
                    valor={resumen.inactivos}
                    cargando={cargando}
                    tipo="inactivo"
                />
            </div>

            <div className="config-filtros">
                <div className="config-buscador">
                    <Search size={18} aria-hidden="true" />

                    <input
                        type="search"
                        aria-label="Buscar proveedor por nombre, RUC o estado"
                        placeholder="Buscar por nombre, RUC o estado..."
                        value={busqueda}
                        onChange={(evento) =>
                            setBusqueda(evento.target.value)
                        }
                    />
                </div>
            </div>

            {cargando ? (
                <div className="config-mensaje" role="status">
                    Cargando proveedores...
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
            ) : operadoresFiltrados.length === 0 ? (
                <div className="config-mensaje">
                    {operadores.length === 0
                        ? 'No hay proveedores registrados.'
                        : 'No se encontraron proveedores con esa búsqueda.'}
                </div>
            ) : (
                <>
                    <div className="config-tabla-contenedor">
                        <table className="config-tabla">
                            <thead>
                                <tr>
                                    <th scope="col">Proveedor</th>
                                    <th scope="col">RUC</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">Acción</th>
                                </tr>
                            </thead>

                            <tbody>
                                {operadoresFiltrados.map(
                                    (operador) => (
                                        <tr key={operador.id}>
                                            <td>
                                                <strong>
                                                    {operador.nombre ||
                                                        'Sin nombre'}
                                                </strong>
                                            </td>

                                            <td>
                                                {operador.ruc || '-'}
                                            </td>

                                            <td>
                                                <EstadoOperador
                                                    estado={operador.estado}
                                                />
                                            </td>

                                            <td>
                                                <div className="config-acciones-fila">
                                                    <button
                                                        type="button"
                                                        className="config-accion-ver"
                                                        title="Ver proveedor"
                                                        aria-label={`Ver ${operador.nombre || 'proveedor'}`}
                                                        onClick={() =>
                                                            setOperadorSeleccionadoId(operador.id)
                                                        }
                                                    >
                                                        <Eye size={18} aria-hidden="true" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="config-accion-editar"
                                                        title="Editar proveedor"
                                                        aria-label={`Editar ${operador.nombre || 'proveedor'}`}
                                                        onClick={() => {
                                                            setMensaje('');
                                                            setOperadorEditando({ ...operador });
                                                            setRegistroAbierto(true);
                                                        }}
                                                    >
                                                        <Pencil size={18} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="config-resultados">
                        Mostrando {operadoresFiltrados.length}
                        {' de '}
                        {operadores.length} proveedores
                    </p>
                </>
            )}

            {registroAbierto && (
                <RegistroOperador
                    key={operadorEditando?.id ?? 'nuevo'}
                    operadorInicial={operadorEditando}
                    onCerrar={() => {
                        setRegistroAbierto(false);
                        setOperadorEditando(null);
                    }}
                    onGuardado={() => {
                        setMensaje(
                            operadorEditando
                                ? 'Proveedor actualizado correctamente'
                                : 'Proveedor registrado correctamente'
                        );

                        setRegistroAbierto(false);
                        setOperadorEditando(null);
                        setBusqueda('');
                        actualizarListado();
                    }}
                />
            )}

            {operadorSeleccionadoId !== null && (
                <DetalleOperador
                    key={operadorSeleccionadoId}
                    id={operadorSeleccionadoId}
                    onCerrar={() =>
                        setOperadorSeleccionadoId(null)
                    }
                />
            )}
        </section>
    );
}

function TarjetaResumen({
    titulo,
    valor,
    cargando,
    tipo
}) {
    return (
        <article
            className={`config-tarjeta config-tarjeta-${tipo}`}
        >
            <div>
                <span>{titulo}</span>
                <strong>{cargando ? '—' : valor}</strong>
            </div>

            <Building2 size={24} aria-hidden="true" />
        </article>
    );
}

function EstadoOperador({ estado }) {
    const valor = normalizar(estado);

    const clase =
        valor === 'ACTIVO'
            ? 'activo'
            : valor === 'INACTIVO'
                ? 'inactivo'
                : 'neutro';

    return (
        <EtiquetaEstado
            className="config-estado"
            prefijo="config-estado-"
            estado={clase}
            texto={String(estado ?? '').trim() || 'Sin estado'}
        />
    );
}

function DetalleOperador({ id, onCerrar }) {
    const dialogoRef = useRef(null);

    const [operador, setOperador] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    // El diálogo nativo permite cerrar con Escape
    // y mantiene el foco del teclado dentro del modal.
    useEffect(() => {
        const dialogo = dialogoRef.current;

        dialogo.showModal();

        return () => {
            dialogo.close();
        };
    }, []);

    useEffect(() => {
        let activo = true;

        const cargarDetalle = async () => {
            setCargando(true);
            setError('');

            try {
                const datos = await obtenerOperadorPorId(id);

                if (activo) {
                    setOperador(datos);
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

        cargarDetalle();

        return () => {
            activo = false;
        };
    }, [id]);

    const cerrarDialogo = () => {
        dialogoRef.current?.close();
    };

    return (
        <dialog
            ref={dialogoRef}
            className="config-modal"
            aria-labelledby="config-titulo-detalle"
            onClose={(evento) => {
                if (!evento.currentTarget.open) {
                    onCerrar();
                }
            }}
        >
            <div className="config-modal-contenido">
                <div className="config-modal-encabezado">
                    <h3 id="config-titulo-detalle">
                        Detalle del proveedor
                    </h3>

                    <button
                        type="button"
                        className="config-modal-cerrar"
                        aria-label="Cerrar detalle"
                        onClick={cerrarDialogo}
                        autoFocus
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {cargando ? (
                    <div className="config-mensaje" role="status">
                        Cargando información...
                    </div>
                ) : error ? (
                    <div className="config-error" role="alert">
                        {error}
                    </div>
                ) : operador ? (
                    <div className="config-detalle">
                        <div className="config-detalle-principal">
                            <Building2
                                size={28}
                                aria-hidden="true"
                            />

                            <div>
                                <span>Proveedor</span>
                                <h4>
                                    {operador.nombre || 'Sin nombre'}
                                </h4>
                            </div>
                        </div>

                        <dl className="config-detalle-grid">
                            <div>
                                <dt>ID</dt>
                                <dd>{operador.id ?? '-'}</dd>
                            </div>

                            <div>
                                <dt>RUC</dt>
                                <dd>{operador.ruc || '-'}</dd>
                            </div>

                            <div>
                                <dt>Estado</dt>
                                <dd>
                                    <EstadoOperador
                                        estado={operador.estado}
                                    />
                                </dd>
                            </div>
                        </dl>
                    </div>
                ) : null}

                <div className="config-modal-acciones">
                    <button
                        type="button"
                        className="config-boton-cerrar"
                        onClick={cerrarDialogo}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </dialog>
    );
}

function RegistroOperador({
    operadorInicial = null,
    onCerrar,
    onGuardado
}) {
    const esEdicion = operadorInicial?.id != null;
    const dialogoRef = useRef(null);
    const guardandoRef = useRef(false);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const [formulario, setFormulario] = useState(() => ({
        nombre: String(operadorInicial?.nombre ?? ''),
        ruc: String(operadorInicial?.ruc ?? ''),
        estado: normalizar(
            operadorInicial?.estado || 'ACTIVO'
        )
    }));

    useEffect(() => {
        const dialogo = dialogoRef.current;

        dialogo.showModal();

        return () => {
            dialogo.close();
        };
    }, []);

    const actualizarFormulario = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value
        }));
    };

    const cerrarDialogo = () => {
        if (guardandoRef.current) return;

        dialogoRef.current?.close();
    };

    const guardarOperador = async (evento) => {
        evento.preventDefault();

        if (guardandoRef.current) return;

        const nombre = formulario.nombre.trim();
        const ruc = formulario.ruc.trim();

        setError('');

        if (!nombre) {
            setError('El nombre del proveedor es obligatorio');
            return;
        }

        if (ruc && !/^\d{11}$/.test(ruc)) {
            setError(
                'El RUC debe contener 11 dígitos o quedar vacío'
            );
            return;
        }

        guardandoRef.current = true;
        setGuardando(true);

        try {
            const datos = {
                nombre,
                ruc: ruc || null,
                estado: formulario.estado
            };

            if (esEdicion) {
                await actualizarOperador(
                    operadorInicial.id,
                    datos
                );
            } else {
                await registrarOperador(datos);
            }
        } catch (error) {
            setError(
                error.message ||
                'No se pudo guardar el proveedor'
            );
            return;
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
        onGuardado();
    };

    return (
        <dialog
            ref={dialogoRef}
            className="config-modal"
            aria-labelledby="config-titulo-registro"
            onClose={(evento) => {
                if (
                    !evento.currentTarget.open &&
                    !guardandoRef.current
                ) {
                    onCerrar();
                }
            }}
            onCancel={(evento) => {
                if (guardandoRef.current) {
                    evento.preventDefault();
                }
            }}
            onClick={(evento) => {
                if (evento.target === evento.currentTarget) {
                    cerrarDialogo();
                }
            }}
        >
            <div className="config-modal-contenido">
                <div className="config-modal-encabezado">
                    <h3 id="config-titulo-registro">
                        {esEdicion
                            ? 'Editar proveedor'
                            : 'Registrar proveedor'}
                    </h3>

                    <button
                        type="button"
                        className="config-modal-cerrar"
                        aria-label="Cerrar formulario"
                        onClick={cerrarDialogo}
                        disabled={guardando}
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <form onSubmit={guardarOperador}>
                    {error && (
                        <div className="config-error" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="config-formulario-campos">
                        <div className="config-campo config-campo-completo">
                            <label htmlFor="operador-nombre">
                                Nombre del proveedor *
                            </label>

                            <input
                                id="operador-nombre"
                                name="nombre"
                                type="text"
                                maxLength={50}
                                placeholder="Nombre del proveedor"
                                value={formulario.nombre}
                                onChange={actualizarFormulario}
                                disabled={guardando}
                                autoFocus
                                required
                            />
                        </div>

                        <div className="config-campo">
                            <label htmlFor="operador-ruc">
                                RUC
                            </label>

                            <input
                                id="operador-ruc"
                                name="ruc"
                                type="text"
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="11 dígitos"
                                value={formulario.ruc}
                                onChange={actualizarFormulario}
                                disabled={guardando}
                                aria-describedby="operador-ruc-ayuda"
                            />

                            <small id="operador-ruc-ayuda">
                                Opcional. Puedes dejarlo vacío.
                            </small>
                        </div>

                        <div className="config-campo">
                            <label htmlFor="operador-estado">
                                Estado
                            </label>

                            <select
                                id="operador-estado"
                                name="estado"
                                value={formulario.estado}
                                onChange={actualizarFormulario}
                                disabled={guardando}
                            >
                                <option value="ACTIVO">
                                    Activo
                                </option>

                                <option value="INACTIVO">
                                    Inactivo
                                </option>
                            </select>
                        </div>
                    </div>

                    <div className="config-modal-acciones">
                        <button
                            type="button"
                            className="config-boton-cerrar"
                            onClick={cerrarDialogo}
                            disabled={guardando}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            className="config-boton-primario"
                            disabled={guardando}
                        >
                            <Save size={18} aria-hidden="true" />

                            {guardando
                                ? 'Guardando...'
                                : esEdicion
                                    ? 'Guardar cambios'
                                    : 'Guardar proveedor'}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

function normalizar(valor) {
    return String(valor ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function ConfiguracionPage({ usuarioActual, onSesionRevocada, pestanaInicial = 'proveedores', contratosSoloPorVencer = false }) {
    const [pestanaActiva, setPestanaActiva] =
        useState(pestanaInicial);

    useEffect(() => {
        setPestanaActiva(pestanaInicial);
    }, [pestanaInicial]);

    const botonesRef = useRef([]);

    const pestanas = [
        { id: 'proveedores', nombre: 'Proveedores' },
        { id: 'contratas', nombre: 'Contratos' },
        { id: 'gamas', nombre: 'Gamas de equipos' },
        { id: 'planes', nombre: 'Planes móviles' },
        { id: 'usuarios', nombre: 'Usuarios' },
        { id: 'auditoria', nombre: 'Auditoría' }
    ];

    const navegarPestanas = (evento, indice) => {
        let siguiente;

        switch (evento.key) {
            case 'ArrowRight':
                siguiente = (indice + 1) % pestanas.length;
                break;

            case 'ArrowLeft':
                siguiente =
                    (indice - 1 + pestanas.length) %
                    pestanas.length;
                break;

            case 'Home':
                siguiente = 0;
                break;

            case 'End':
                siguiente = pestanas.length - 1;
                break;

            default:
                return;
        }

        evento.preventDefault();
        setPestanaActiva(pestanas[siguiente].id);
        botonesRef.current[siguiente]?.focus();
    };

    return (
        <section className="pagina configuracion-pagina">
            <div className="config-encabezado">
                <div>
                    <h2>Configuración</h2>
                    <p>Catálogos, usuarios y trazabilidad del sistema</p>
                </div>
            </div>

            <div
                className="config-pestanas"
                role="tablist"
                aria-label="Configuración del sistema"
            >
                {pestanas.map((pestana, indice) => (
                    <button
                        key={pestana.id}
                        ref={(elemento) => {
                            botonesRef.current[indice] = elemento;
                        }}
                        type="button"
                        role="tab"
                        id={`config-tab-${pestana.id}`}
                        aria-controls={`config-panel-${pestana.id}`}
                        aria-selected={pestanaActiva === pestana.id}
                        tabIndex={
                            pestanaActiva === pestana.id ? 0 : -1
                        }
                        className={`config-pestana ${pestanaActiva === pestana.id
                            ? 'config-pestana-activa'
                            : ''
                            }`}
                        onClick={() => setPestanaActiva(pestana.id)}
                        onKeyDown={(evento) =>
                            navegarPestanas(evento, indice)
                        }
                    >
                        {pestana.nombre}
                    </button>
                ))}
            </div>

            {pestanas.map((pestana) => (
                <div
                    key={pestana.id}
                    className="config-panel"
                    role="tabpanel"
                    id={`config-panel-${pestana.id}`}
                    aria-labelledby={`config-tab-${pestana.id}`}
                    hidden={pestanaActiva !== pestana.id}
                    tabIndex={0}
                >
                    {pestanaActiva === pestana.id && (
                        pestana.id === 'proveedores'
                            ? <OperadoresPanel />
                            : pestana.id === 'contratas'
                                ? <ContratasPanel soloPorVencer={contratosSoloPorVencer} />
                                : pestana.id === 'gamas'
                                    ? <GamasPanel />
                                    : pestana.id === 'planes'
                                        ? <PlanesPanel />
                                        : pestana.id === 'usuarios'
                                            ? (
                                                <UsuariosPanel
                                                    usuarioActual={usuarioActual}
                                                    onSesionRevocada={onSesionRevocada}
                                                />
                                            )
                                            : <AuditoriaPanel />
                    )}
                </div>
            ))}
        </section>
    );
}

export default ConfiguracionPage;
