import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    KeyRound,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    UserCheck,
    UsersRound,
    UserX,
    X
} from 'lucide-react';

import {
    actualizarUsuario,
    listarUsuarios,
    registrarUsuario,
    restablecerClaveUsuario
} from '../services/usuarioService';

const ROLES = [
    ['ADMINISTRADOR', 'Administrador'],
    ['OPERADOR', 'Operador'],
    ['CONSULTA', 'Consulta']
];

function UsuariosPanel({ usuarioActual, onSesionRevocada }) {
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [revision, setRevision] = useState(0);
    const [usuarioEditando, setUsuarioEditando] = useState(null);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [usuarioClave, setUsuarioClave] = useState(null);

    useEffect(() => {
        let activo = true;

        const cargar = async () => {
            setCargando(true);
            setError('');

            try {
                const datos = await listarUsuarios();
                if (activo) setUsuarios(datos);
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

    const actualizarListado = () =>
        setRevision((anterior) => anterior + 1);

    const filtrados = useMemo(() => {
        const texto = normalizar(busqueda);

        return usuarios.filter((usuario) => normalizar([
            usuario.nombre,
            usuario.usuario,
            usuario.rol,
            usuario.estado
        ].join(' ')).includes(texto));
    }, [busqueda, usuarios]);

    const resumen = useMemo(() => ({
        total: usuarios.length,
        administradores: usuarios.filter(
            (usuario) => usuario.rol === 'ADMINISTRADOR'
        ).length,
        activos: usuarios.filter(
            (usuario) => usuario.estado === 'ACTIVO'
        ).length,
        inactivos: usuarios.filter(
            (usuario) => usuario.estado === 'INACTIVO'
        ).length
    }), [usuarios]);

    const abrirRegistro = () => {
        setMensaje('');
        setUsuarioEditando(null);
        setFormularioAbierto(true);
    };

    const abrirEdicion = (usuario) => {
        setMensaje('');
        setUsuarioEditando({ ...usuario });
        setFormularioAbierto(true);
    };

    return (
        <section className="usuarios-panel">
            <div className="config-encabezado">
                <div>
                    <h3>Usuarios del sistema</h3>
                    <p>Administración de cuentas y niveles de acceso</p>
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
                            className={cargando ? 'config-icono-girando' : ''}
                            aria-hidden="true"
                        />
                        {cargando ? 'Cargando...' : 'Actualizar'}
                    </button>

                    <button
                        type="button"
                        className="config-boton-primario"
                        onClick={abrirRegistro}
                    >
                        <Plus size={18} aria-hidden="true" />
                        Registrar usuario
                    </button>
                </div>
            </div>

            {mensaje && (
                <div className="config-exito" role="status">{mensaje}</div>
            )}

            <div className="config-resumen usuarios-resumen">
                <ResumenUsuario titulo="Total" valor={resumen.total} icono={UsersRound} tipo="total" />
                <ResumenUsuario titulo="Administradores" valor={resumen.administradores} icono={ShieldCheck} tipo="admin" />
                <ResumenUsuario titulo="Activos" valor={resumen.activos} icono={UserCheck} tipo="activo" />
                <ResumenUsuario titulo="Inactivos" valor={resumen.inactivos} icono={UserX} tipo="inactivo" />
            </div>

            <div className="config-filtros">
                <div className="config-buscador">
                    <Search size={18} aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Buscar usuario"
                        placeholder="Buscar por nombre, usuario, rol o estado..."
                        value={busqueda}
                        onChange={(evento) => setBusqueda(evento.target.value)}
                    />
                </div>
            </div>

            {cargando ? (
                <div className="config-mensaje" role="status">Cargando usuarios...</div>
            ) : error ? (
                <div className="config-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={actualizarListado}>Reintentar</button>
                </div>
            ) : filtrados.length === 0 ? (
                <div className="config-mensaje">
                    {usuarios.length === 0
                        ? 'No hay usuarios registrados.'
                        : 'No se encontraron usuarios con esa búsqueda.'}
                </div>
            ) : (
                <>
                    <div className="config-tabla-contenedor">
                        <table className="config-tabla usuarios-tabla">
                            <thead>
                                <tr>
                                    <th scope="col">Nombre</th>
                                    <th scope="col">Usuario</th>
                                    <th scope="col">Rol</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">Último acceso</th>
                                    <th scope="col">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtrados.map((usuario) => (
                                    <tr key={usuario.id}>
                                        <td>
                                            <strong>{usuario.nombre}</strong>
                                            {Number(usuario.id) === Number(usuarioActual?.id) && (
                                                <small className="usuario-actual">Tu cuenta</small>
                                            )}
                                        </td>
                                        <td className="usuario-cuenta">{usuario.usuario}</td>
                                        <td><RolUsuario rol={usuario.rol} /></td>
                                        <td>
                                            <EstadoUsuario usuario={usuario} />
                                        </td>
                                        <td>{formatearFechaHora(usuario.ultimo_acceso)}</td>
                                        <td>
                                            <div className="config-acciones-fila">
                                                <button
                                                    type="button"
                                                    className="config-accion-editar"
                                                    title="Editar usuario"
                                                    aria-label={`Editar ${usuario.usuario}`}
                                                    onClick={() => abrirEdicion(usuario)}
                                                >
                                                    <Pencil size={18} aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="usuario-accion-clave"
                                                    title="Restablecer contraseña"
                                                    aria-label={`Restablecer contraseña de ${usuario.usuario}`}
                                                    onClick={() => setUsuarioClave(usuario)}
                                                >
                                                    <KeyRound size={18} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="config-resultados">
                        Mostrando {filtrados.length} de {usuarios.length} usuarios
                    </p>
                </>
            )}

            {formularioAbierto && (
                <FormularioUsuario
                    key={usuarioEditando?.id ?? 'nuevo'}
                    usuarioInicial={usuarioEditando}
                    esCuentaActual={
                        Number(usuarioEditando?.id) === Number(usuarioActual?.id)
                    }
                    onCerrar={() => {
                        setFormularioAbierto(false);
                        setUsuarioEditando(null);
                    }}
                    onGuardado={() => {
                        setFormularioAbierto(false);
                        setUsuarioEditando(null);
                        setMensaje(
                            usuarioEditando
                                ? 'Usuario actualizado correctamente'
                                : 'Usuario registrado correctamente'
                        );
                        actualizarListado();
                    }}
                />
            )}

            {usuarioClave && (
                <FormularioClave
                    key={usuarioClave.id}
                    usuario={usuarioClave}
                    onCerrar={() => setUsuarioClave(null)}
                    onGuardado={(resultado) => {
                        setUsuarioClave(null);

                        if (resultado.sesion_actual_revocada) {
                            onSesionRevocada?.();
                            return;
                        }

                        setMensaje('Contraseña actualizada y sesiones anteriores cerradas');
                        actualizarListado();
                    }}
                />
            )}
        </section>
    );
}

function ResumenUsuario({ titulo, valor, icono: Icono, tipo }) {
    return (
        <article className={`config-tarjeta usuario-tarjeta-${tipo}`}>
            <div><span>{titulo}</span><strong>{valor}</strong></div>
            <Icono size={24} aria-hidden="true" />
        </article>
    );
}

function RolUsuario({ rol }) {
    const etiqueta = Object.fromEntries(ROLES)[rol] || rol;
    return (
        <span className={`usuario-rol usuario-rol-${String(rol).toLowerCase()}`}>
            {etiqueta}
        </span>
    );
}

function EstadoUsuario({ usuario }) {
    const bloqueado = usuario.bloqueado_hasta &&
        new Date(usuario.bloqueado_hasta) > new Date();

    if (bloqueado) {
        return (
            <span
                className="config-estado usuario-estado-bloqueado"
                title={`Hasta ${formatearFechaHora(usuario.bloqueado_hasta)}`}
            >
                Bloqueado
            </span>
        );
    }

    const activo = usuario.estado === 'ACTIVO';
    return (
        <span className={`config-estado ${activo ? 'config-estado-activo' : 'config-estado-inactivo'}`}>
            {activo ? 'Activo' : 'Inactivo'}
        </span>
    );
}

function FormularioUsuario({
    usuarioInicial,
    esCuentaActual,
    onCerrar,
    onGuardado
}) {
    const dialogoRef = useRef(null);
    const guardandoRef = useRef(false);
    const esEdicion = usuarioInicial?.id != null;
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [formulario, setFormulario] = useState({
        nombre: usuarioInicial?.nombre || '',
        usuario: usuarioInicial?.usuario || '',
        rol: usuarioInicial?.rol || 'OPERADOR',
        estado: usuarioInicial?.estado || 'ACTIVO',
        clave: '',
        confirmarClave: ''
    });

    useEffect(() => {
        const dialogo = dialogoRef.current;

        if (dialogo && !dialogo.open) {
            dialogo.showModal();
        }

        return () => {
            if (dialogo?.open) {
                dialogo.close();
            }
        };
    }, []);

    const actualizar = (evento) => {
        const { name, value } = evento.target;
        setFormulario((anterior) => ({ ...anterior, [name]: value }));
    };

    const cerrar = () => {
        if (!guardandoRef.current) dialogoRef.current?.close();
    };

    const guardar = async (evento) => {
        evento.preventDefault();
        if (guardandoRef.current) return;

        const nombre = formulario.nombre.trim();
        const usuario = formulario.usuario.trim().toLowerCase();

        setError('');

        if (!nombre) {
            setError('El nombre es obligatorio');
            return;
        }

        if (!esEdicion && !/^[a-z0-9._-]{3,60}$/.test(usuario)) {
            setError('El usuario debe tener de 3 a 60 caracteres válidos');
            return;
        }

        if (!esEdicion) {
            if (formulario.clave !== formulario.confirmarClave) {
                setError('Las contraseñas no coinciden');
                return;
            }

            if (
                formulario.clave.length < 10 ||
                !/[a-z]/.test(formulario.clave) ||
                !/[A-Z]/.test(formulario.clave) ||
                !/\d/.test(formulario.clave)
            ) {
                setError('La contraseña debe tener al menos 10 caracteres, mayúscula, minúscula y número');
                return;
            }
        }

        guardandoRef.current = true;
        setGuardando(true);

        try {
            if (esEdicion) {
                await actualizarUsuario(usuarioInicial.id, {
                    nombre,
                    rol: formulario.rol,
                    estado: formulario.estado
                });
            } else {
                await registrarUsuario({
                    nombre,
                    usuario,
                    rol: formulario.rol,
                    estado: formulario.estado,
                    clave: formulario.clave
                });
            }

            onGuardado();
        } catch (error) {
            setError(error.message || 'No se pudo guardar el usuario');
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
    };

    return (
        <dialog
            ref={dialogoRef}
            className="config-modal"
            aria-labelledby="usuario-formulario-titulo"
            onClose={(evento) => {
                if (
                    !evento.currentTarget.open &&
                    !guardandoRef.current
                ) {
                    onCerrar();
                }
            }}
            onCancel={(evento) => guardandoRef.current && evento.preventDefault()}
            onClick={(evento) => evento.target === evento.currentTarget && cerrar()}
        >
            <div className="config-modal-contenido">
                <div className="config-modal-encabezado">
                    <h3 id="usuario-formulario-titulo">
                        {esEdicion ? 'Editar usuario' : 'Registrar usuario'}
                    </h3>
                    <button
                        type="button"
                        className="config-modal-cerrar"
                        aria-label="Cerrar formulario"
                        onClick={cerrar}
                        disabled={guardando}
                    ><X size={20} aria-hidden="true" /></button>
                </div>

                <form onSubmit={guardar}>
                    {error && <div className="config-error" role="alert">{error}</div>}

                    <div className="config-formulario-campos">
                        <div className="config-campo config-campo-completo">
                            <label htmlFor="usuario-nombre">Nombre completo *</label>
                            <input
                                id="usuario-nombre"
                                name="nombre"
                                type="text"
                                maxLength={120}
                                value={formulario.nombre}
                                onChange={actualizar}
                                disabled={guardando}
                                autoFocus
                                required
                            />
                        </div>

                        <div className="config-campo config-campo-completo">
                            <label htmlFor="usuario-cuenta">Usuario *</label>
                            <input
                                id="usuario-cuenta"
                                name="usuario"
                                type="text"
                                minLength={3}
                                maxLength={60}
                                value={formulario.usuario}
                                onChange={actualizar}
                                disabled={guardando || esEdicion}
                                required
                            />
                            {esEdicion && <small>El identificador de acceso no se modifica.</small>}
                        </div>

                        <div className="config-campo">
                            <label htmlFor="usuario-rol">Rol</label>
                            <select
                                id="usuario-rol"
                                name="rol"
                                value={formulario.rol}
                                onChange={actualizar}
                                disabled={guardando || esCuentaActual}
                            >
                                {ROLES.map(([valor, etiqueta]) => (
                                    <option key={valor} value={valor}>{etiqueta}</option>
                                ))}
                            </select>
                            {esCuentaActual && <small>No puedes quitar tu propio acceso.</small>}
                        </div>

                        <div className="config-campo">
                            <label htmlFor="usuario-estado">Estado</label>
                            <select
                                id="usuario-estado"
                                name="estado"
                                value={formulario.estado}
                                onChange={actualizar}
                                disabled={guardando || esCuentaActual}
                            >
                                <option value="ACTIVO">Activo</option>
                                <option value="INACTIVO">Inactivo</option>
                            </select>
                        </div>

                        {!esEdicion && (
                            <>
                                <div className="config-campo">
                                    <label htmlFor="usuario-clave">Contraseña *</label>
                                    <input
                                        id="usuario-clave"
                                        name="clave"
                                        type="password"
                                        minLength={10}
                                        maxLength={128}
                                        autoComplete="new-password"
                                        value={formulario.clave}
                                        onChange={actualizar}
                                        disabled={guardando}
                                        required
                                    />
                                </div>
                                <div className="config-campo">
                                    <label htmlFor="usuario-confirmar-clave">Repetir contraseña *</label>
                                    <input
                                        id="usuario-confirmar-clave"
                                        name="confirmarClave"
                                        type="password"
                                        minLength={10}
                                        maxLength={128}
                                        autoComplete="new-password"
                                        value={formulario.confirmarClave}
                                        onChange={actualizar}
                                        disabled={guardando}
                                        required
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="config-modal-acciones">
                        <button type="button" className="config-boton-cerrar" onClick={cerrar} disabled={guardando}>Cancelar</button>
                        <button type="submit" className="config-boton-primario" disabled={guardando}>
                            <Save size={18} aria-hidden="true" />
                            {guardando ? 'Guardando...' : 'Guardar usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

function FormularioClave({ usuario, onCerrar, onGuardado }) {
    const dialogoRef = useRef(null);
    const guardandoRef = useRef(false);
    const [clave, setClave] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const dialogo = dialogoRef.current;

        if (dialogo && !dialogo.open) {
            dialogo.showModal();
        }

        return () => {
            if (dialogo?.open) {
                dialogo.close();
            }
        };
    }, []);

    const cerrar = () => {
        if (!guardandoRef.current) dialogoRef.current?.close();
    };

    const guardar = async (evento) => {
        evento.preventDefault();
        if (guardandoRef.current) return;
        setError('');

        if (clave !== confirmacion) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (
            clave.length < 10 ||
            !/[a-z]/.test(clave) ||
            !/[A-Z]/.test(clave) ||
            !/\d/.test(clave)
        ) {
            setError('La contraseña debe tener al menos 10 caracteres, mayúscula, minúscula y número');
            return;
        }

        guardandoRef.current = true;
        setGuardando(true);

        try {
            const resultado = await restablecerClaveUsuario(usuario.id, clave);
            onGuardado(resultado);
        } catch (error) {
            setError(error.message || 'No se pudo actualizar la contraseña');
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
    };

    return (
        <dialog
            ref={dialogoRef}
            className="config-modal"
            aria-labelledby="usuario-clave-titulo"
            onClose={(evento) => {
                if (
                    !evento.currentTarget.open &&
                    !guardandoRef.current
                ) {
                    onCerrar();
                }
            }}
            onCancel={(evento) => guardandoRef.current && evento.preventDefault()}
            onClick={(evento) => evento.target === evento.currentTarget && cerrar()}
        >
            <div className="config-modal-contenido">
                <div className="config-modal-encabezado">
                    <h3 id="usuario-clave-titulo">Restablecer contraseña</h3>
                    <button type="button" className="config-modal-cerrar" aria-label="Cerrar" onClick={cerrar} disabled={guardando}>
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <form onSubmit={guardar}>
                    {error && <div className="config-error" role="alert">{error}</div>}
                    <div className="config-formulario-campos">
                        <p className="usuario-clave-aviso config-campo-completo">
                            Cuenta: <strong>{usuario.usuario}</strong>. Al guardar se cerrarán todas sus sesiones activas.
                        </p>
                        <div className="config-campo">
                            <label htmlFor="usuario-nueva-clave">Nueva contraseña *</label>
                            <input
                                id="usuario-nueva-clave"
                                type="password"
                                minLength={10}
                                maxLength={128}
                                autoComplete="new-password"
                                value={clave}
                                onChange={(evento) => setClave(evento.target.value)}
                                disabled={guardando}
                                autoFocus
                                required
                            />
                        </div>
                        <div className="config-campo">
                            <label htmlFor="usuario-repetir-clave">Repetir contraseña *</label>
                            <input
                                id="usuario-repetir-clave"
                                type="password"
                                minLength={10}
                                maxLength={128}
                                autoComplete="new-password"
                                value={confirmacion}
                                onChange={(evento) => setConfirmacion(evento.target.value)}
                                disabled={guardando}
                                required
                            />
                        </div>
                    </div>
                    <div className="config-modal-acciones">
                        <button type="button" className="config-boton-cerrar" onClick={cerrar} disabled={guardando}>Cancelar</button>
                        <button type="submit" className="config-boton-primario" disabled={guardando}>
                            <KeyRound size={18} aria-hidden="true" />
                            {guardando ? 'Actualizando...' : 'Actualizar contraseña'}
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

function formatearFechaHora(valor) {
    if (!valor) return 'Sin acceso';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return 'Sin acceso';

    return fecha.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default UsuariosPanel;
