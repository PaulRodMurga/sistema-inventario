import { useEffect, useMemo, useState } from 'react';
import {
    Ban,
    Boxes,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Search,
    X
} from 'lucide-react';

import DialogoAccesible from '../components/DialogoAccesible';
import EtiquetaEstado from '../components/EtiquetaEstado';
import {
    actualizarGama,
    inhabilitarGama,
    listarGamas,
    registrarGama
} from '../services/gamaService';

const FORMULARIO_INICIAL = {
    codigo: '',
    descripcion: '',
    estado: 'ACTIVO'
};

function GamasPanel() {
    const [gamas, setGamas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [errorFormulario, setErrorFormulario] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [revision, setRevision] = useState(0);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [gamaEditandoId, setGamaEditandoId] = useState(null);
    const [gamaInhabilitar, setGamaInhabilitar] = useState(null);
    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);

    useEffect(() => {
        let activo = true;

        listarGamas()
            .then((datos) => {
                if (activo) setGamas(datos);
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
    }, [revision]);

    const resumen = useMemo(() => ({
        total: gamas.length,
        activas: gamas.filter(({ estado }) => estado === 'ACTIVO').length,
        inactivas: gamas.filter(({ estado }) => estado === 'INACTIVO').length,
        equipos: gamas.reduce(
            (total, gama) => total + Number(gama.cantidad_equipos || 0),
            0
        )
    }), [gamas]);

    const gamasFiltradas = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        return gamas.filter((gama) => [
            gama.id,
            gama.codigo,
            gama.descripcion,
            gama.estado
        ].join(' ').toLowerCase().includes(texto));
    }, [busqueda, gamas]);

    const recargar = () => {
        setCargando(true);
        setError('');
        setRevision((anterior) => anterior + 1);
    };

    const mostrarMensaje = (texto) => {
        setMensaje(texto);
        window.setTimeout(() => setMensaje(''), 4000);
    };

    const abrirRegistro = () => {
        setGamaEditandoId(null);
        setFormulario(FORMULARIO_INICIAL);
        setErrorFormulario('');
        setFormularioAbierto(true);
    };

    const abrirEdicion = (gama) => {
        setGamaEditandoId(gama.id);
        setFormulario({
            codigo: gama.codigo || '',
            descripcion: gama.descripcion || '',
            estado: gama.estado || 'ACTIVO'
        });
        setErrorFormulario('');
        setFormularioAbierto(true);
    };

    const guardarGama = async (evento) => {
        evento.preventDefault();

        if (!formulario.codigo.trim() || !formulario.descripcion.trim()) {
            setErrorFormulario('El código y la descripción son obligatorios');
            return;
        }

        try {
            setGuardando(true);
            setErrorFormulario('');
            const datos = {
                codigo: formulario.codigo.trim().toUpperCase(),
                descripcion: formulario.descripcion.trim()
            };

            if (gamaEditandoId) {
                await actualizarGama(gamaEditandoId, datos);
                mostrarMensaje('Gama actualizada correctamente');
            } else {
                await registrarGama({ ...datos, estado: 'ACTIVO' });
                mostrarMensaje('Gama registrada correctamente');
            }

            setFormularioAbierto(false);
            setGamaEditandoId(null);
            recargar();
        } catch (errorSolicitud) {
            setErrorFormulario(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    const confirmarInhabilitacion = async () => {
        if (!gamaInhabilitar) return;

        try {
            setGuardando(true);
            setError('');
            await inhabilitarGama(gamaInhabilitar.id);
            setGamaInhabilitar(null);
            mostrarMensaje('Gama inhabilitada correctamente');
            recargar();
        } catch (errorSolicitud) {
            setGamaInhabilitar(null);
            setError(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="config-gamas-panel">
            <div className="config-encabezado">
                <div>
                    <h3>Gamas de equipos</h3>
                    <p>Catálogo utilizado para clasificar equipos y tarifas</p>
                </div>
                <div className="config-acciones-encabezado">
                    <button type="button" className="config-boton-actualizar" onClick={recargar} disabled={cargando}>
                        <RefreshCw size={18} aria-hidden="true" /> Actualizar
                    </button>
                    <button type="button" className="config-boton-primario" onClick={abrirRegistro}>
                        <Plus size={18} aria-hidden="true" /> Registrar gama
                    </button>
                </div>
            </div>

            {mensaje && <div className="config-exito" role="status">{mensaje}</div>}
            {error && <div className="config-error" role="alert">{error}</div>}

            <div className="config-resumen config-resumen-gamas">
                <ResumenGama titulo="Total" valor={resumen.total} tipo="total" />
                <ResumenGama titulo="Activas" valor={resumen.activas} tipo="activo" />
                <ResumenGama titulo="Inactivas" valor={resumen.inactivas} tipo="inactivo" />
                <ResumenGama titulo="Equipos asociados" valor={resumen.equipos} tipo="total" />
            </div>

            <div className="config-filtros">
                <div className="config-buscador">
                    <Search size={18} aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Buscar gama"
                        placeholder="Buscar por código, descripción o estado..."
                        value={busqueda}
                        onChange={(evento) => setBusqueda(evento.target.value)}
                    />
                </div>
            </div>

            {cargando ? (
                <div className="config-mensaje" role="status">Cargando gamas...</div>
            ) : gamasFiltradas.length === 0 ? (
                <div className="config-mensaje">No se encontraron gamas.</div>
            ) : (
                <>
                    <div className="config-tabla-contenedor">
                        <table className="config-tabla config-tabla-gamas">
                            <thead><tr><th>ID</th><th>Código</th><th>Descripción</th><th>Contratos</th><th>Equipos</th><th>Estado</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {gamasFiltradas.map((gama) => (
                                    <tr key={gama.id}>
                                        <td>#{gama.id}</td>
                                        <td><strong>{gama.codigo}</strong></td>
                                        <td>{gama.descripcion}</td>
                                        <td>{Number(gama.cantidad_contratas || 0)}</td>
                                        <td>{Number(gama.cantidad_equipos || 0)}</td>
                                        <td>
                                            <EtiquetaEstado className="config-estado" prefijo="config-estado-" estado={gama.estado.toLowerCase()} texto={gama.estado} />
                                        </td>
                                        <td>
                                            <div className="config-acciones-fila">
                                                <button type="button" className="config-accion-editar" aria-label={`Editar gama ${gama.codigo}`} title="Editar" onClick={() => abrirEdicion(gama)}>
                                                    <Pencil size={17} aria-hidden="true" />
                                                </button>
                                                {gama.estado === 'ACTIVO' && (
                                                    <button type="button" className="config-accion-inhabilitar" aria-label={`Inhabilitar gama ${gama.codigo}`} title="Inhabilitar" onClick={() => setGamaInhabilitar(gama)}>
                                                        <Ban size={17} aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="config-resultados">Mostrando {gamasFiltradas.length} de {gamas.length} gamas</p>
                </>
            )}

            {formularioAbierto && (
                <DialogoAccesible
                    className="config-modal-gama"
                    tituloId="gama-formulario-titulo"
                    descripcionId="gama-formulario-descripcion"
                    onCerrar={() => !guardando && setFormularioAbierto(false)}
                    bloqueado={guardando}
                    ocupado={guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="gama-formulario-titulo">{gamaEditandoId ? 'Modificar gama' : 'Registrar gama'}</h3>
                            <p id="gama-formulario-descripcion">Define el código y la descripción de la categoría</p>
                        </div>
                        <button type="button" className="modal-cerrar" aria-label="Cerrar formulario de gama" onClick={() => setFormularioAbierto(false)} disabled={guardando}>
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>
                    <form onSubmit={guardarGama}>
                        {errorFormulario && <div className="error-formulario" role="alert">{errorFormulario}</div>}
                        <div className="config-formulario-campos">
                            <Campo etiqueta="Código *" htmlFor="gama-codigo">
                                <input id="gama-codigo" maxLength="10" value={formulario.codigo} onChange={(evento) => setFormulario((anterior) => ({ ...anterior, codigo: evento.target.value }))} disabled={guardando} required />
                            </Campo>
                            <Campo etiqueta="Descripción *" htmlFor="gama-descripcion" completo>
                                <input id="gama-descripcion" maxLength="100" value={formulario.descripcion} onChange={(evento) => setFormulario((anterior) => ({ ...anterior, descripcion: evento.target.value }))} disabled={guardando} required />
                            </Campo>
                        </div>
                        <div className="modal-acciones">
                            <button type="button" className="boton-cancelar" onClick={() => setFormularioAbierto(false)} disabled={guardando}>Cancelar</button>
                            <button type="submit" className="boton-guardar" disabled={guardando}>
                                <Save size={18} aria-hidden="true" /> {guardando ? 'Guardando...' : 'Guardar gama'}
                            </button>
                        </div>
                    </form>
                </DialogoAccesible>
            )}

            {gamaInhabilitar && (
                <DialogoAccesible
                    className="config-modal-confirmacion"
                    tituloId="gama-inhabilitar-titulo"
                    descripcionId="gama-inhabilitar-descripcion"
                    onCerrar={() => setGamaInhabilitar(null)}
                    bloqueado={guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="gama-inhabilitar-titulo">Inhabilitar gama</h3>
                            <p id="gama-inhabilitar-descripcion">Solo se permitirá si ningun contrato vigente utiliza esta gama.</p>
                        </div>
                    </div>
                    <div className="config-confirmacion-contenido">¿Confirmas inhabilitar <strong>{gamaInhabilitar.codigo}</strong>?</div>
                    <div className="modal-acciones">
                        <button type="button" className="boton-cancelar" onClick={() => setGamaInhabilitar(null)} disabled={guardando}>Cancelar</button>
                        <button type="button" className="config-boton-peligro" onClick={confirmarInhabilitacion} disabled={guardando}>
                            <Ban size={18} aria-hidden="true" /> {guardando ? 'Inhabilitando...' : 'Inhabilitar'}
                        </button>
                    </div>
                </DialogoAccesible>
            )}
        </section>
    );
}

function ResumenGama({ titulo, valor, tipo }) {
    return (
        <div className={`config-tarjeta config-tarjeta-${tipo}`}>
            <div><span>{titulo}</span><strong>{valor}</strong></div>
            <Boxes size={23} aria-hidden="true" />
        </div>
    );
}

function Campo({ etiqueta, htmlFor, completo = false, children }) {
    return (
        <div className={`config-campo ${completo ? 'config-campo-completo' : ''}`}>
            <label htmlFor={htmlFor}>{etiqueta}</label>
            {children}
        </div>
    );
}

export default GamasPanel;
