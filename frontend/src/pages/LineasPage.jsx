import { useEffect, useMemo, useRef, useState } from 'react';

import {
    Smartphone,
    RefreshCw,
    Plus,
    X,
    Save
} from 'lucide-react';

import {
    listarLineas,
    registrarLinea,
    obtenerLineaPorId,
    actualizarLinea,
    obtenerCatalogosLinea
} from '../services/lineaService';

import DialogoAccesible from '../components/DialogoAccesible';
import CampoBusqueda from '../components/CampoBusqueda';
import BotonAccionTabla from '../components/BotonAccionTabla';

import './LineasPage.css';

function LineasPage({ soloLectura = false } = {}) {
    const [lineas, setLineas] = useState([]);
    const [busqueda, setBusqueda] = useState('');

    const [modoFormulario, setModoFormulario] =
        useState('REGISTRAR');

    const [lineaEditandoId, setLineaEditandoId] =
        useState(null);

    const [modalRegistroAbierto, setModalRegistroAbierto] =
        useState(false);

    const [guardando, setGuardando] =
        useState(false);

    const [cargandoFormulario, setCargandoFormulario] =
        useState(false);

    const solicitudFormularioRef = useRef(0);
    const formularioListoRef = useRef(false);
    const guardandoRef = useRef(false);

    const [errorFormulario, setErrorFormulario] =
        useState('');

    const [mensaje, setMensaje] =
        useState('');

    const [catalogos, setCatalogos] = useState({
        planes: [],
        equipos: []
    });

    const [formulario, setFormulario] = useState({
        numero: '',
        codigo_chip: '',
        plan_id: '',
        estado: 'ACTIVA',
        equipo_id: ''
    });

    const [filtroEstado, setFiltroEstado] =
        useState('TODOS');

    const [detalleAbierto, setDetalleAbierto] =
        useState(false);

    const [lineaSeleccionada, setLineaSeleccionada] =
        useState(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [errorDetalle, setErrorDetalle] =
        useState('');

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const cargarLineas = async () => {
        try {
            setCargando(true);
            setError('');

            const datos = await listarLineas();

            setLineas(datos);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setCargando(false);
        }
    };

    const verLinea = async (id) => {
        try {
            setDetalleAbierto(true);
            setCargandoDetalle(true);
            setLineaSeleccionada(null);
            setErrorDetalle('');

            const datos = await obtenerLineaPorId(id);

            setLineaSeleccionada(datos);
        } catch (error) {
            console.error(error);
            setErrorDetalle(error.message);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cerrarDetalle = () => {
        setDetalleAbierto(false);
        setLineaSeleccionada(null);
        setErrorDetalle('');
    };

    const limpiarFormulario = () => {
        setFormulario({
            numero: '',
            codigo_chip: '',
            plan_id: '',
            estado: 'ACTIVA',
            equipo_id: ''
        });
    };

    const actualizarFormulario = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value
        }));
    };

    const iniciarCargaFormulario = (modo) => {
        if (guardandoRef.current) return null;

        solicitudFormularioRef.current += 1;
        const solicitud = solicitudFormularioRef.current;
        formularioListoRef.current = false;
        setModoFormulario(modo);
        setLineaEditandoId(null);
        limpiarFormulario();
        setError('');
        setErrorFormulario('');
        setCargandoFormulario(true);
        setModalRegistroAbierto(true);
        return solicitud;
    };

    const abrirRegistro = async () => {
        const solicitud = iniciarCargaFormulario('REGISTRAR');
        if (solicitud === null) return;

        try {
            const datos = await obtenerCatalogosLinea();

            if (solicitud !== solicitudFormularioRef.current) return;

            setCatalogos(datos);
            formularioListoRef.current = true;
        } catch (error) {
            if (solicitud !== solicitudFormularioRef.current) return;

            console.error(error);
            setError(error.message);
            setModalRegistroAbierto(false);
        } finally {
            if (solicitud === solicitudFormularioRef.current) {
                setCargandoFormulario(false);
            }
        }
    };

    const abrirEdicion = async (id) => {
        const solicitud = iniciarCargaFormulario('EDITAR');
        if (solicitud === null) return;

        try {
            const [catalogosObtenidos, linea] =
                await Promise.all([
                    obtenerCatalogosLinea(),
                    obtenerLineaPorId(id)
                ]);

            if (solicitud !== solicitudFormularioRef.current) return;

            if (!linea || String(linea.id) !== String(id)) {
                throw new Error('La línea recibida no corresponde a la selección');
            }

            setCatalogos(catalogosObtenidos);

            setFormulario({
                numero: linea.numero || '',
                codigo_chip: linea.codigo_chip || '',

                plan_id:
                    linea.plan_id != null
                        ? String(linea.plan_id)
                        : '',

                estado: linea.estado || 'ACTIVA',

                equipo_id:
                    linea.equipo_id != null
                        ? String(linea.equipo_id)
                        : ''
            });

            // ID y datos se aplican juntos, solo para la petición vigente.
            setLineaEditandoId(id);
            formularioListoRef.current = true;
        } catch (error) {
            if (solicitud !== solicitudFormularioRef.current) return;

            console.error(error);
            setError(error.message);
            setModalRegistroAbierto(false);
        } finally {
            if (solicitud === solicitudFormularioRef.current) {
                setCargandoFormulario(false);
            }
        }
    };

    const cerrarRegistro = () => {
        if (guardandoRef.current) return;

        solicitudFormularioRef.current += 1;
        formularioListoRef.current = false;
        setCargandoFormulario(false);
        setModalRegistroAbierto(false);
        setModoFormulario('REGISTRAR');
        setLineaEditandoId(null);
        setErrorFormulario('');
        limpiarFormulario();
    };

    const guardarLinea = async (evento) => {
        evento.preventDefault();

        if (
            guardandoRef.current ||
            !formularioListoRef.current ||
            !modalRegistroAbierto ||
            cargandoFormulario
        ) return;

        if (modoFormulario === 'EDITAR' && lineaEditandoId == null) {
            setErrorFormulario('Vuelve a seleccionar la línea que deseas editar');
            return;
        }

        if (!formulario.numero.trim()) {
            setErrorFormulario(
                'El número de línea es obligatorio'
            );
            return;
        }

        try {
            guardandoRef.current = true;
            setGuardando(true);
            setErrorFormulario('');
            setMensaje('');

            if (modoFormulario === 'EDITAR') {
                await actualizarLinea(
                    lineaEditandoId,
                    {
                        plan_id:
                            Number(formulario.plan_id) || null,

                        estado: formulario.estado,

                        equipo_id:
                            Number(formulario.equipo_id) || null
                    }
                );

                setMensaje(
                    'Línea actualizada correctamente'
                );
            } else {
                await registrarLinea({
                    numero: formulario.numero.trim(),

                    codigo_chip:
                        formulario.codigo_chip.trim() || null,

                    plan_id:
                        Number(formulario.plan_id) || null,

                    estado: formulario.estado,

                    equipo_id:
                        Number(formulario.equipo_id) || null
                });

                setMensaje(
                    'Línea registrada correctamente'
                );
            }

            solicitudFormularioRef.current += 1;
            formularioListoRef.current = false;
            setModalRegistroAbierto(false);
            setModoFormulario('REGISTRAR');
            setLineaEditandoId(null);
            limpiarFormulario();

            await cargarLineas();

            setTimeout(() => {
                setMensaje('');
            }, 4000);
        } catch (error) {
            console.error(error);
            setErrorFormulario(error.message);
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
    };

    useEffect(() => {
        let activo = true;
        const solicitud = listarLineas();

        solicitud
            .then((datos) => {
                if (activo) setLineas(datos);
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

    useEffect(() => {
        return () => {
            // Impide actualizar el formulario después de salir de la página.
            solicitudFormularioRef.current += 1;
            formularioListoRef.current = false;
        };
    }, []);

    const resumen = useMemo(() => {
        return {
            total: lineas.length,

            activas: lineas.filter(
                (linea) => linea.estado === 'ACTIVA'
            ).length,

            suspendidas: lineas.filter(
                (linea) => linea.estado === 'SUSPENDIDA'
            ).length,

            bajas: lineas.filter(
                (linea) => linea.estado === 'BAJA'
            ).length
        };
    }, [lineas]);

    const lineasFiltradas = useMemo(() => {
        return lineas.filter((linea) => {
            const coincideEstado =
                filtroEstado === 'TODOS' ||
                linea.estado === filtroEstado;

            const texto = `
                ${linea.numero || ''}
                ${linea.codigo_chip || ''}
                ${linea.plan || ''}
                ${linea.gb || ''}
                ${linea.marca || ''}
                ${linea.modelo || ''}
                ${linea.imei || ''}
                ${linea.serie || ''}
                ${linea.estado || ''}
            `.toLowerCase();

            const coincideBusqueda = texto.includes(
                busqueda.trim().toLowerCase()
            );

            return coincideEstado && coincideBusqueda;
        });
    }, [lineas, busqueda, filtroEstado]);

    return (
        <section className="pagina">
            <div className="encabezado-pagina">
                <div>
                    <h3>Líneas móviles</h3>

                    <p>
                        Consulta y administra las líneas corporativas
                    </p>

                </div>

                {!soloLectura && (
                    <button
                        type="button"
                        className="boton-primario"
                        onClick={abrirRegistro}
                        disabled={guardando}
                    >
                        <Plus size={18} aria-hidden="true" />
                        <span>Registrar línea</span>
                    </button>
                )}

                {mensaje && (
                    <div className="mensaje-exito">
                        {mensaje}
                    </div>
                )}
            </div>


            <div className="tarjetas-lineas">
                <TarjetaResumen
                    titulo="Total"
                    cantidad={resumen.total}
                    tipo="total"
                />

                <TarjetaResumen
                    titulo="Activas"
                    cantidad={resumen.activas}
                    tipo="activa"
                />

                <TarjetaResumen
                    titulo="Suspendidas"
                    cantidad={resumen.suspendidas}
                    tipo="suspendida"
                />

                <TarjetaResumen
                    titulo="Bajas"
                    cantidad={resumen.bajas}
                    tipo="baja"
                />
            </div>

            <div className="pestanas-lineas">
                {[
                    ['TODOS', 'Todas'],
                    ['ACTIVA', 'Activas'],
                    ['SUSPENDIDA', 'Suspendidas'],
                    ['BAJA', 'Bajas']
                ].map(([valor, etiqueta]) => (
                    <button
                        type="button"
                        key={valor}
                        aria-pressed={filtroEstado === valor}
                        className={
                            filtroEstado === valor
                                ? 'pestana-linea activa'
                                : 'pestana-linea'
                        }
                        onClick={() =>
                            setFiltroEstado(valor)
                        }
                    >
                        {etiqueta}
                    </button>
                ))}
            </div>

            <div className="barra-tabla">
                <CampoBusqueda
                    className="buscador-tabla"
                    etiqueta="Buscar líneas móviles"
                    placeholder="Buscar número, chip, plan o equipo..."
                    value={busqueda}
                    onChange={(evento) =>
                        setBusqueda(evento.target.value)
                    }
                />

                <button
                    type="button"
                    className="boton-actualizar"
                    onClick={cargarLineas}
                    disabled={cargando}
                >
                    <RefreshCw
                        size={18}
                        className={
                            cargando ? 'girando' : ''
                        }
                    />

                    Actualizar
                </button>
            </div>

            {error && (
                <div className="mensaje-conexion mensaje-error">
                    <span>{error}</span>

                    <button type="button" onClick={cargarLineas}>
                        Reintentar
                    </button>
                </div>
            )}

            <div className="contenedor-tabla">
                {cargando ? (
                    <div className="estado-tabla">
                        Cargando líneas...
                    </div>
                ) : lineasFiltradas.length === 0 ? (
                    <div className="estado-tabla">
                        No se encontraron líneas
                    </div>
                ) : (
                    <div className="tabla-scroll">
                        <table className="tabla-equipos">
                            <thead>
                                <tr>
                                    <th>N.º</th>
                                    <th>Número</th>
                                    <th>Código de chip</th>
                                    <th>Plan</th>
                                    <th>GB</th>
                                    <th>Equipo</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>

                            <tbody>
                                {lineasFiltradas.map(
                                    (linea, index) => (
                                        <tr key={linea.id}>
                                            <td>{index + 1}</td>

                                            <td>
                                                <strong>
                                                    {linea.numero || '-'}
                                                </strong>
                                            </td>

                                            <td>
                                                {linea.codigo_chip || '-'}
                                            </td>

                                            <td>
                                                {linea.plan || '-'}
                                            </td>

                                            <td>
                                                {linea.gb != null
                                                    ? `${linea.gb} GB`
                                                    : '-'}
                                            </td>

                                            <td>
                                                <div className="celda-principal">
                                                    <strong>
                                                        {linea.marca ||
                                                            linea.modelo
                                                            ? `${linea.marca || ''} ${linea.modelo || ''}`
                                                            : 'Sin equipo'}
                                                    </strong>

                                                    <span>
                                                        {linea.imei ||
                                                            linea.serie ||
                                                            ''}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <span
                                                    className={`estado-linea estado-${(
                                                        linea.estado ||
                                                        'sin-estado'
                                                    ).toLowerCase()}`}
                                                >
                                                    {linea.estado || '-'}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="acciones-tabla">
                                                    <BotonAccionTabla
                                                        etiqueta={`Ver línea ${linea.numero}`}
                                                        onClick={() => verLinea(linea.id)}
                                                    />

                                                    {!soloLectura && (
                                                        <BotonAccionTabla
                                                            tipo="editar"
                                                            etiqueta={`Editar línea ${linea.numero}`}
                                                            onClick={() => abrirEdicion(linea.id)}
                                                            disabled={guardando}
                                                        />
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
                        Mostrando {lineasFiltradas.length} de{' '}
                        {lineas.length} líneas
                    </div>
                )}
            </div>

            {modalRegistroAbierto && (
                <DialogoAccesible
                    className="modal-linea"
                    tituloId="linea-formulario-titulo"
                    descripcionId="linea-formulario-descripcion"
                    onCerrar={cerrarRegistro}
                    bloqueado={guardando}
                    ocupado={cargandoFormulario || guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="linea-formulario-titulo">
                                {modoFormulario === 'EDITAR'
                                    ? 'Editar línea'
                                    : 'Registrar línea'}
                            </h3>
                            <p id="linea-formulario-descripcion">
                                {modoFormulario === 'EDITAR'
                                    ? 'Modifica el plan, estado o equipo relacionado'
                                    : 'Ingresa la información de la línea móvil'}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarRegistro}
                            disabled={guardando}
                            aria-label="Cerrar formulario de línea"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>

                    </div>

                    {cargandoFormulario ? (
                        <div className="detalle-cargando" role="status">
                            Cargando datos del formulario...
                        </div>
                    ) : (
                        <form onSubmit={guardarLinea}>
                            {errorFormulario && (
                                <div className="error-formulario">
                                    {errorFormulario}
                                </div>
                            )}

                            <div className="formulario-linea-grid">
                                <div className="campo-formulario">
                                    <label htmlFor="numero">
                                        Número de línea *
                                    </label>

                                    <input
                                        id="numero"
                                        name="numero"
                                        type="text"
                                        maxLength="20"
                                        placeholder="Ejemplo: 999888777"
                                        value={formulario.numero}
                                        onChange={actualizarFormulario}
                                        disabled={
                                            guardando ||
                                            modoFormulario === 'EDITAR'
                                        }
                                        required
                                    />

                                    {modoFormulario === 'EDITAR' && (
                                        <small className="campo-ayuda">
                                            Este dato no puede modificarse
                                        </small>
                                    )}

                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="codigo_chip">
                                        Código de chip
                                    </label>

                                    <input
                                        id="codigo_chip"
                                        name="codigo_chip"
                                        type="text"
                                        maxLength="40"
                                        placeholder="Código ICCID"
                                        value={formulario.codigo_chip}
                                        onChange={actualizarFormulario}
                                        disabled={
                                            guardando ||
                                            modoFormulario === 'EDITAR'
                                        }
                                    />

                                    {modoFormulario === 'EDITAR' && (
                                        <small className="campo-ayuda">
                                            Este dato no puede modificarse
                                        </small>
                                    )}

                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="plan_id">
                                        Plan móvil
                                    </label>

                                    <select
                                        id="plan_id"
                                        name="plan_id"
                                        value={formulario.plan_id}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">
                                            Seleccionar plan
                                        </option>

                                        {catalogos.planes.map((plan) => (
                                            <option
                                                key={plan.id}
                                                value={plan.id}
                                            >
                                                {plan.nombre}
                                                {plan.gb != null
                                                    ? ` - ${plan.gb} GB`
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="estado">
                                        Estado
                                    </label>

                                    <select
                                        id="estado"
                                        name="estado"
                                        value={formulario.estado}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="ACTIVA">
                                            Activa
                                        </option>

                                        <option value="SUSPENDIDA">
                                            Suspendida
                                        </option>

                                        <option value="BAJA">
                                            Baja
                                        </option>
                                    </select>
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="equipo_id">
                                        Equipo relacionado
                                    </label>

                                    <select
                                        id="equipo_id"
                                        name="equipo_id"
                                        value={formulario.equipo_id}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">
                                            Sin equipo relacionado
                                        </option>

                                        {catalogos.equipos.map((equipo) => (
                                            <option
                                                key={equipo.id}
                                                value={equipo.id}
                                            >
                                                {equipo.marca} {equipo.modelo}
                                                {' - '}
                                                {equipo.imei ||
                                                    equipo.serie ||
                                                    `ID ${equipo.id}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="modal-acciones">
                                <button
                                    type="button"
                                    className="boton-cancelar"
                                    onClick={cerrarRegistro}
                                    disabled={guardando}
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="boton-guardar"
                                    disabled={guardando}
                                >
                                    <Save size={18} />

                                    {guardando
                                        ? 'Guardando...'
                                        : modoFormulario === 'EDITAR'
                                            ? 'Guardar cambios'
                                            : 'Guardar línea'}
                                </button>
                            </div>
                        </form>
                    )}
                </DialogoAccesible>
            )}

            {detalleAbierto && (
                <DialogoAccesible
                    className="modal-detalle-linea"
                    tituloId="linea-detalle-titulo"
                    descripcionId="linea-detalle-descripcion"
                    onCerrar={cerrarDetalle}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="linea-detalle-titulo">Detalle de la línea</h3>
                            <p id="linea-detalle-descripcion">
                                Información de la línea móvil y su equipo
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarDetalle}
                            aria-label="Cerrar detalle de la línea"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoDetalle ? (
                        <div className="detalle-cargando">
                            Cargando información...
                        </div>
                    ) : errorDetalle ? (
                        <div className="error-formulario">
                            {errorDetalle}
                        </div>
                    ) : lineaSeleccionada ? (
                        <div className="detalle-linea">
                            <div className="cabecera-detalle-linea">
                                <div className="icono-detalle-linea">
                                    <Smartphone size={25} />
                                </div>

                                <div>
                                    <span>Número de línea</span>

                                    <h4>
                                        {lineaSeleccionada.numero || '-'}
                                    </h4>
                                </div>

                                <span
                                    className={`estado-linea estado-${(
                                        lineaSeleccionada.estado ||
                                        'sin-estado'
                                    ).toLowerCase()}`}
                                >
                                    {lineaSeleccionada.estado || '-'}
                                </span>
                            </div>

                            <div className="detalle-grid-linea">
                                <CampoDetalle
                                    etiqueta="Código de chip"
                                    valor={
                                        lineaSeleccionada.codigo_chip
                                    }
                                />

                                <CampoDetalle
                                    etiqueta="Plan"
                                    valor={lineaSeleccionada.plan}
                                />

                                <CampoDetalle
                                    etiqueta="Capacidad"
                                    valor={
                                        lineaSeleccionada.gb != null
                                            ? `${lineaSeleccionada.gb} GB`
                                            : '-'
                                    }
                                />

                                <CampoDetalle
                                    etiqueta="Equipo"
                                    valor={
                                        lineaSeleccionada.marca ||
                                            lineaSeleccionada.modelo
                                            ? `${lineaSeleccionada.marca || ''} ${lineaSeleccionada.modelo || ''}`
                                            : 'Sin equipo relacionado'
                                    }
                                />

                                <CampoDetalle
                                    etiqueta="IMEI"
                                    valor={lineaSeleccionada.imei}
                                />

                                <CampoDetalle
                                    etiqueta="Serie"
                                    valor={lineaSeleccionada.serie}
                                />
                            </div>
                        </div>
                    ) : null}
                </DialogoAccesible>
            )}

        </section>
    );
}

function TarjetaResumen({
    titulo,
    cantidad,
    tipo
}) {
    return (
        <article className="resumen-linea">
            <div className={`resumen-linea-icono ${tipo}`}>
                <Smartphone size={22} />
            </div>

            <div>
                <span>{titulo}</span>
                <strong>{cantidad}</strong>
            </div>
        </article>
    );
}

function CampoDetalle({ etiqueta, valor }) {
    return (
        <div className="campo-detalle-linea">
            <span>{etiqueta}</span>
            <strong>{valor || '-'}</strong>
        </div>
    );
}

export default LineasPage;
