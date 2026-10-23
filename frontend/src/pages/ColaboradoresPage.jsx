import { useEffect, useRef, useState } from 'react';

import {
    FileSpreadsheet,
    Plus,
    RefreshCw,
    Users,
    X,
    Save
} from 'lucide-react';

import {
    listarColaboradores,
    registrarColaborador,
    obtenerColaboradorPorId,
    actualizarColaborador,
    importarColaboradores,
    validarImportacionColaboradores
} from '../services/colaboradorService';

import {
    obtenerCatalogosColaborador
} from '../services/catalogoService';

import DialogoAccesible from '../components/DialogoAccesible';
import CampoBusqueda from '../components/CampoBusqueda';
import BotonAccionTabla from '../components/BotonAccionTabla';
import ImportacionExcelModal from '../components/ImportacionExcelModal';
import { leerImportacionColaboradores } from '../utils/importacionExcel';

import './ColaboradoresPage.css';

function ColaboradoresPage({ soloLectura = false } = {}) {
    const [colaboradores, setColaboradores] =
        useState([]);

    const [busqueda, setBusqueda] = useState('');


    const [filtroEstado, setFiltroEstado] =
        useState('TODOS');

    const [detalleAbierto, setDetalleAbierto] =
        useState(false);

    const [colaboradorSeleccionado, setColaboradorSeleccionado] =
        useState(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [importacionAbierta, setImportacionAbierta] = useState(false);

    const cargarColaboradores = async () => {
        try {
            setCargando(true);
            setError('');

            const datos = await listarColaboradores();

            setColaboradores(datos);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setCargando(false);
        }
    };

    const [modalAbierto, setModalAbierto] =
        useState(false);

    const [modoFormulario, setModoFormulario] =
        useState('REGISTRAR');

    const [colaboradorEditandoId, setColaboradorEditandoId] =
        useState(null);

    const [guardando, setGuardando] =
        useState(false);

    const [cargandoFormulario, setCargandoFormulario] =
        useState(false);

    const solicitudFormularioRef = useRef(0);
    const formularioListoRef = useRef(false);
    const guardandoRef = useRef(false);

    const [mensaje, setMensaje] =
        useState('');

    const [catalogos, setCatalogos] = useState({
        cargos: [],
        areas: [],
        centros_costos: [],
        unidades_empresariales: []
    });

    const [formulario, setFormulario] = useState({
        codigo: '',
        apellidos: '',
        nombres: '',
        dni: '',
        cargo_id: '',
        area_id: '',
        centro_costos_id: '',
        unidad_empresarial_id: '',
        estado: 'ACTIVO'
    });

    const verColaborador = async (id) => {
        try {
            setCargandoDetalle(true);
            setColaboradorSeleccionado(null);
            setError('');
            setDetalleAbierto(true);

            const datos =
                await obtenerColaboradorPorId(id);

            setColaboradorSeleccionado(datos);
        } catch (error) {
            console.error(error);
            setError(error.message);
            setDetalleAbierto(false);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cerrarDetalle = () => {
        setDetalleAbierto(false);
        setColaboradorSeleccionado(null);
    };

    const actualizarFormulario = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value
        }));
    };

    const limpiarFormulario = () => {
        setFormulario({
            codigo: '',
            apellidos: '',
            nombres: '',
            dni: '',
            cargo_id: '',
            area_id: '',
            centro_costos_id: '',
            unidad_empresarial_id: '',
            estado: 'ACTIVO'
        });
    };

    const iniciarCargaFormulario = (modo) => {
        if (guardandoRef.current) return null;

        solicitudFormularioRef.current += 1;
        const solicitud = solicitudFormularioRef.current;
        formularioListoRef.current = false;
        setModoFormulario(modo);
        setColaboradorEditandoId(null);
        limpiarFormulario();
        setError('');
        setCargandoFormulario(true);
        setModalAbierto(true);
        return solicitud;
    };

    const abrirModalRegistro = async () => {
        const solicitud = iniciarCargaFormulario('REGISTRAR');
        if (solicitud === null) return;

        try {
            const datos = await obtenerCatalogosColaborador();

            if (solicitud !== solicitudFormularioRef.current) return;

            setCatalogos(datos);
            formularioListoRef.current = true;
        } catch (error) {
            if (solicitud !== solicitudFormularioRef.current) return;

            console.error(error);
            setError(error.message);
            setModalAbierto(false);
        } finally {
            if (solicitud === solicitudFormularioRef.current) {
                setCargandoFormulario(false);
            }
        }
    };

    const abrirModalEdicion = async (id) => {
        const solicitud = iniciarCargaFormulario('EDITAR');
        if (solicitud === null) return;

        try {
            const [catalogosObtenidos, colaborador] = await Promise.all([
                obtenerCatalogosColaborador(),
                obtenerColaboradorPorId(id)
            ]);

            if (solicitud !== solicitudFormularioRef.current) return;

            if (!colaborador || String(colaborador.id) !== String(id)) {
                throw new Error('El colaborador recibido no corresponde a la selección');
            }

            setCatalogos(catalogosObtenidos);

            setFormulario({
                codigo: colaborador.codigo || '',
                apellidos: colaborador.apellidos || '',
                nombres: colaborador.nombres || '',
                dni: colaborador.dni || '',

                cargo_id:
                    colaborador.cargo_id != null
                        ? String(colaborador.cargo_id)
                        : '',

                area_id:
                    colaborador.area_id != null
                        ? String(colaborador.area_id)
                        : '',

                centro_costos_id:
                    colaborador.centro_costos_id != null
                        ? String(colaborador.centro_costos_id)
                        : '',

                unidad_empresarial_id:
                    colaborador.unidad_empresarial_id != null
                        ? String(
                            colaborador.unidad_empresarial_id
                        )
                        : '',

                estado: colaborador.estado || 'ACTIVO'
            });

            // ID y datos se aplican juntos, solo para la petición vigente.
            setColaboradorEditandoId(id);
            formularioListoRef.current = true;
        } catch (error) {
            if (solicitud !== solicitudFormularioRef.current) return;

            console.error(error);
            setError(error.message);
            setModalAbierto(false);
        } finally {
            if (solicitud === solicitudFormularioRef.current) {
                setCargandoFormulario(false);
            }
        }
    };

    const cerrarModal = () => {
        if (guardandoRef.current) return;

        solicitudFormularioRef.current += 1;
        formularioListoRef.current = false;
        setCargandoFormulario(false);
        setModalAbierto(false);
        setModoFormulario('REGISTRAR');
        setColaboradorEditandoId(null);
        setError('');
        limpiarFormulario();
    };

    const guardarColaborador = async (evento) => {
        evento.preventDefault();

        if (
            guardandoRef.current ||
            !formularioListoRef.current ||
            !modalAbierto ||
            cargandoFormulario
        ) return;

        if (modoFormulario === 'EDITAR' && colaboradorEditandoId == null) {
            setError('Vuelve a seleccionar el colaborador que deseas editar');
            return;
        }

        if (
            !formulario.codigo.trim() ||
            !formulario.apellidos.trim() ||
            !formulario.nombres.trim() ||
            !formulario.dni.trim()
        ) {
            setError(
                'Código, apellidos, nombres y DNI son obligatorios'
            );
            return;
        }

        try {
            guardandoRef.current = true;
            setGuardando(true);
            setError('');
            setMensaje('');

            if (modoFormulario === 'EDITAR') {
                // En edición solo se envían datos laborales
                await actualizarColaborador(
                    colaboradorEditandoId,
                    {
                        cargo_id:
                            Number(formulario.cargo_id) || null,

                        area_id:
                            Number(formulario.area_id) || null,

                        centro_costos_id:
                            Number(
                                formulario.centro_costos_id
                            ) || null,

                        unidad_empresarial_id:
                            Number(
                                formulario.unidad_empresarial_id
                            ) || null,

                        estado: formulario.estado
                    }
                );

                setMensaje(
                    'Colaborador actualizado correctamente'
                );
            } else {
                // En registro se envían todos los datos
                await registrarColaborador({
                    codigo: formulario.codigo
                        .trim()
                        .toUpperCase(),

                    apellidos: formulario.apellidos
                        .trim()
                        .toUpperCase(),

                    nombres: formulario.nombres
                        .trim()
                        .toUpperCase(),

                    dni: formulario.dni.trim(),

                    cargo_id:
                        Number(formulario.cargo_id) || null,

                    area_id:
                        Number(formulario.area_id) || null,

                    centro_costos_id:
                        Number(
                            formulario.centro_costos_id
                        ) || null,

                    unidad_empresarial_id:
                        Number(
                            formulario.unidad_empresarial_id
                        ) || null,

                    estado: formulario.estado
                });

                setMensaje(
                    'Colaborador registrado correctamente'
                );
            }

            solicitudFormularioRef.current += 1;
            formularioListoRef.current = false;
            setModalAbierto(false);
            setModoFormulario('REGISTRAR');
            setColaboradorEditandoId(null);
            limpiarFormulario();

            await cargarColaboradores();

            setTimeout(() => {
                setMensaje('');
            }, 4000);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
    };


    useEffect(() => {
        let activo = true;
        const solicitud = listarColaboradores();

        solicitud
            .then((datos) => {
                if (activo) setColaboradores(datos);
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

    const obtenerArea = (colaborador) => {
        return (
            colaborador.area_nombre ||
            colaborador.nombre_area ||
            colaborador.area ||
            '-'
        );
    };

    const colaboradoresPorEstado =
        filtroEstado === 'TODOS'
            ? colaboradores
            : colaboradores.filter(
                (colaborador) =>
                    colaborador.estado === filtroEstado
            );

    const colaboradoresFiltrados =
        colaboradoresPorEstado.filter(
            (colaborador) => {
                const texto = `
          ${colaborador.id || ''}
          ${colaborador.codigo || ''}
          ${colaborador.apellidos || ''}
          ${colaborador.nombres || ''}
          ${colaborador.dni || ''}
          ${colaborador.cargo || ''}
          ${obtenerArea(colaborador)}
          ${colaborador.centro_costos || ''}
          ${colaborador.unidad_empresarial || ''}
          ${colaborador.estado || ''}
        `.toLowerCase();

                return texto.includes(
                    busqueda.toLowerCase()
                );
            }
        );

    const activos = colaboradores.filter(
        (colaborador) =>
            colaborador.estado === 'ACTIVO'
    ).length;

    const cesados = colaboradores.filter(
        (colaborador) =>
            colaborador.estado === 'CESADO'
    ).length;

    const externos = colaboradores.filter(
        (colaborador) =>
            colaborador.estado === 'EXTERNO'
    ).length;

    return (
        <section className="pagina">
            <div className="encabezado-pagina">
                <div>
                    <h3>Colaboradores</h3>

                    <p>
                        Consulta y administra el personal registrado
                    </p>
                </div>

                {!soloLectura && (
                    <div className="acciones-encabezado-pagina">
                        <button
                            type="button"
                            className="boton-importar-excel"
                            onClick={() => setImportacionAbierta(true)}
                            disabled={guardando}
                        >
                            <FileSpreadsheet size={18} aria-hidden="true" />
                            <span>Importar Excel</span>
                        </button>
                        <button
                            type="button"
                            className="boton-primario"
                            onClick={abrirModalRegistro}
                            disabled={guardando}
                        >
                            <Plus size={18} aria-hidden="true" />
                            <span>Registrar colaborador</span>
                        </button>
                    </div>
                )}
            </div>

            {mensaje && (
                <div className="mensaje-exito">
                    {mensaje}
                </div>
            )}

            <ImportacionExcelModal
                abierto={importacionAbierta}
                titulo="Importar colaboradores desde Excel"
                descripcion="Valida datos personales y catálogos antes de registrar colaboradores"
                plantilla="/plantillas/plantilla_importacion_colaboradores.xlsx"
                leerArchivo={leerImportacionColaboradores}
                validar={validarImportacionColaboradores}
                importar={importarColaboradores}
                onCerrar={() => setImportacionAbierta(false)}
                onImportado={async (textoMensaje) => {
                    setImportacionAbierta(false);
                    setMensaje(textoMensaje);
                    await cargarColaboradores();
                    window.setTimeout(() => setMensaje(''), 5000);
                }}
            />

            <div className="tarjetas-colaboradores">
                <article className="resumen-colaborador">
                    <div className="resumen-colaborador-icono total">
                        <Users size={22} />
                    </div>

                    <div>
                        <span>Total</span>
                        <strong>{colaboradores.length}</strong>
                    </div>
                </article>

                <article className="resumen-colaborador">
                    <div className="resumen-colaborador-icono activo">
                        <Users size={22} />
                    </div>

                    <div>
                        <span>Activos</span>
                        <strong>{activos}</strong>
                    </div>
                </article>

                <article className="resumen-colaborador">
                    <div className="resumen-colaborador-icono cesado">
                        <Users size={22} />
                    </div>

                    <div>
                        <span>Cesados</span>
                        <strong>{cesados}</strong>
                    </div>
                </article>

                <article className="resumen-colaborador">
                    <div className="resumen-colaborador-icono externo">
                        <Users size={22} />
                    </div>

                    <div>
                        <span>Externos</span>
                        <strong>{externos}</strong>
                    </div>
                </article>
            </div>

            <div className="filtros-colaboradores">
                <div className="pestanas-colaboradores">
                    {[
                        ['TODOS', 'Todos'],
                        ['ACTIVO', 'Activos'],
                        ['CESADO', 'Cesados'],
                        ['EXTERNO', 'Externos']
                    ].map(([valor, etiqueta]) => (
                        <button
                            type="button"
                            key={valor}
                            aria-pressed={filtroEstado === valor}
                            className={
                                filtroEstado === valor
                                    ? 'pestana-colaborador activa'
                                    : 'pestana-colaborador'
                            }
                            onClick={() =>
                                setFiltroEstado(valor)
                            }
                        >
                            {etiqueta}
                        </button>
                    ))}
                </div>

                <div className="barra-tabla barra-colaboradores">
                    <CampoBusqueda
                        className="buscador-tabla"
                        etiqueta="Buscar colaboradores"
                        placeholder="Buscar por nombre, código, DNI, cargo o área..."
                        value={busqueda}
                        onChange={(evento) =>
                            setBusqueda(evento.target.value)
                        }
                    />

                    <button
                        type="button"
                        className="boton-actualizar"
                        onClick={cargarColaboradores}
                        disabled={cargando}
                    >
                        <RefreshCw
                            size={18}
                            className={cargando ? 'girando' : ''}
                        />

                        Actualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="mensaje-conexion mensaje-error">
                    <span>{error}</span>

                    <button type="button" onClick={cargarColaboradores}>
                        Reintentar
                    </button>
                </div>
            )}

            <div className="contenedor-tabla">
                {cargando ? (
                    <div className="estado-tabla">
                        Cargando colaboradores...
                    </div>
                ) : colaboradoresFiltrados.length === 0 ? (
                    <div className="estado-tabla">
                        No se encontraron colaboradores
                    </div>
                ) : (
                    <div className="tabla-scroll">
                        <table className="tabla-equipos tabla-colaboradores">
                            <thead>
                                <tr>
                                    <th>N.º</th>
                                    <th>Código</th>
                                    <th>Colaborador</th>
                                    <th>DNI</th>
                                    <th>Cargo</th>
                                    <th>Área</th>
                                    <th>Centro de costos</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>

                            <tbody>
                                {colaboradoresFiltrados.map(
                                    (colaborador, index) => (
                                        <tr key={colaborador.id}>
                                            <td>{index + 1}</td>

                                            <td>
                                                {colaborador.codigo || '-'}
                                            </td>

                                            <td>
                                                <div className="celda-principal">
                                                    <strong>
                                                        {colaborador.apellidos},{' '}
                                                        {colaborador.nombres}
                                                    </strong>

                                                    <span>
                                                        {colaborador.unidad_empresarial ||
                                                            ''}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>{colaborador.dni || '-'}</td>

                                            <td>
                                                {colaborador.cargo || '-'}
                                            </td>

                                            <td>{obtenerArea(colaborador)}</td>

                                            <td>
                                                {colaborador.centro_costos ||
                                                    '-'}
                                            </td>

                                            <td>
                                                <span
                                                    className={`estado-colaborador estado-${(
                                                        colaborador.estado ||
                                                        'sin-estado'
                                                    ).toLowerCase()}`}
                                                >
                                                    {colaborador.estado || '-'}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="acciones-tabla">
                                                    <BotonAccionTabla
                                                        etiqueta={`Ver colaborador ${colaborador.apellidos}, ${colaborador.nombres}`}
                                                        onClick={() =>
                                                            verColaborador(colaborador.id)
                                                        }
                                                    />

                                                    {!soloLectura && (
                                                        <BotonAccionTabla
                                                            tipo="editar"
                                                            etiqueta={`Editar colaborador ${colaborador.apellidos}, ${colaborador.nombres}`}
                                                            disabled={guardando}
                                                            onClick={() =>
                                                                abrirModalEdicion(colaborador.id)
                                                            }
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
                        Mostrando {colaboradoresFiltrados.length}{' '}
                        de {colaboradoresPorEstado.length}{' '}
                        colaboradores
                    </div>
                )}
            </div>

            {modalAbierto && (
                <DialogoAccesible
                    className="modal-colaborador"
                    tituloId="colaborador-formulario-titulo"
                    descripcionId="colaborador-formulario-descripcion"
                    onCerrar={cerrarModal}
                    bloqueado={guardando}
                    ocupado={cargandoFormulario || guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="colaborador-formulario-titulo">
                                {modoFormulario === 'EDITAR'
                                    ? 'Editar colaborador'
                                    : 'Registrar colaborador'}
                            </h3>
                            <p id="colaborador-formulario-descripcion">
                                {modoFormulario === 'EDITAR'
                                    ? 'Modifica la información del colaborador'
                                    : 'Ingresa la información del colaborador'}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarModal}
                            disabled={guardando}
                            aria-label="Cerrar formulario de colaborador"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoFormulario ? (
                        <div className="detalle-cargando" role="status">
                            Cargando datos del formulario...
                        </div>
                    ) : (
                        <form onSubmit={guardarColaborador}>
                            {error && (
                                <div className="error-formulario">
                                    {error}
                                </div>
                            )}

                            <div className="formulario-grid">
                                <div className="campo-formulario">
                                    <label htmlFor="codigo">
                                        Código *
                                    </label>

                                    <input
                                        id="codigo"
                                        name="codigo"
                                        type="text"
                                        maxLength="20"
                                        placeholder="Ejemplo: COL101"
                                        value={formulario.codigo}
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
                                    <label htmlFor="dni">DNI *</label>

                                    <input
                                        id="dni"
                                        name="dni"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength="15"
                                        pattern="[0-9]+"
                                        title="El DNI solo puede contener dígitos"
                                        placeholder="Número de documento"
                                        value={formulario.dni}
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
                                    <label htmlFor="apellidos">
                                        Apellidos *
                                    </label>

                                    <input
                                        id="apellidos"
                                        name="apellidos"
                                        type="text"
                                        maxLength="100"
                                        placeholder="Apellidos"
                                        value={formulario.apellidos}
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
                                    <label htmlFor="nombres">
                                        Nombres *
                                    </label>

                                    <input
                                        id="nombres"
                                        name="nombres"
                                        type="text"
                                        maxLength="100"
                                        placeholder="Nombres"
                                        value={formulario.nombres}
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
                                    <label htmlFor="cargo_id">
                                        Cargo
                                    </label>

                                    <select
                                        id="cargo_id"
                                        name="cargo_id"
                                        value={formulario.cargo_id}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">
                                            Seleccionar cargo
                                        </option>

                                        {catalogos.cargos.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="area_id">Área</label>

                                    <select
                                        id="area_id"
                                        name="area_id"
                                        value={formulario.area_id}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">
                                            Seleccionar área
                                        </option>

                                        {catalogos.areas.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="centro_costos_id">
                                        Centro de costos
                                    </label>

                                    <select
                                        id="centro_costos_id"
                                        name="centro_costos_id"
                                        value={formulario.centro_costos_id}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">
                                            Seleccionar centro
                                        </option>

                                        {catalogos.centros_costos.map(
                                            (item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.nombre}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div className="campo-formulario">
                                    <label htmlFor="unidad_empresarial_id">
                                        Unidad empresarial
                                    </label>

                                    <select
                                        id="unidad_empresarial_id"
                                        name="unidad_empresarial_id"
                                        value={
                                            formulario.unidad_empresarial_id
                                        }
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="">
                                            Seleccionar unidad
                                        </option>

                                        {catalogos.unidades_empresariales.map(
                                            (item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.nombre}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div className="campo-formulario campo-completo">
                                    <label htmlFor="estado">Estado</label>

                                    <select
                                        id="estado"
                                        name="estado"
                                        value={formulario.estado}
                                        onChange={actualizarFormulario}
                                        disabled={guardando}
                                    >
                                        <option value="ACTIVO">Activo</option>
                                        <option value="CESADO">Cesado</option>
                                        <option value="EXTERNO">Externo</option>
                                    </select>
                                </div>
                            </div>

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
                                    disabled={guardando}
                                >
                                    <Save size={18} />

                                    {guardando
                                        ? 'Guardando...'
                                        : modoFormulario === 'EDITAR'
                                            ? 'Guardar cambios'
                                            : 'Guardar colaborador'}
                                </button>
                            </div>
                        </form>
                    )}
                </DialogoAccesible>
            )}

            {detalleAbierto && (
                <DialogoAccesible
                    className="modal-detalle-colaborador"
                    tituloId="colaborador-detalle-titulo"
                    descripcionId="colaborador-detalle-descripcion"
                    onCerrar={cerrarDetalle}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="colaborador-detalle-titulo">Detalle del colaborador</h3>
                            <p id="colaborador-detalle-descripcion">
                                Información completa del personal registrado
                            </p>
                        </div>

                        <button
                            type="button"
                            className="modal-cerrar"
                            onClick={cerrarDetalle}
                            aria-label="Cerrar detalle del colaborador"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoDetalle ? (
                        <div className="detalle-cargando">
                            Cargando información...
                        </div>
                    ) : colaboradorSeleccionado ? (
                        <div className="detalle-colaborador">
                            <div className="perfil-colaborador">
                                <div className="perfil-colaborador-avatar">
                                    {colaboradorSeleccionado.nombres
                                        ?.charAt(0)
                                        .toUpperCase() || 'C'}

                                    {colaboradorSeleccionado.apellidos
                                        ?.charAt(0)
                                        .toUpperCase() || ''}
                                </div>

                                <div>
                                    <h4>
                                        {colaboradorSeleccionado.apellidos},{' '}
                                        {colaboradorSeleccionado.nombres}
                                    </h4>

                                    <span
                                        className={`estado-colaborador estado-${(
                                            colaboradorSeleccionado.estado ||
                                            'sin-estado'
                                        ).toLowerCase()}`}
                                    >
                                        {colaboradorSeleccionado.estado || '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="detalle-grid">
                                <div className="detalle-campo">
                                    <span>Código</span>
                                    <strong>
                                        {colaboradorSeleccionado.codigo || '-'}
                                    </strong>
                                </div>

                                <div className="detalle-campo">
                                    <span>DNI</span>
                                    <strong>
                                        {colaboradorSeleccionado.dni || '-'}
                                    </strong>
                                </div>

                                <div className="detalle-campo">
                                    <span>Cargo</span>
                                    <strong>
                                        {colaboradorSeleccionado.cargo_nombre ||
                                            colaboradorSeleccionado.cargo ||
                                            '-'}
                                    </strong>
                                </div>

                                <div className="detalle-campo">
                                    <span>Área</span>
                                    <strong>
                                        {colaboradorSeleccionado.area_nombre ||
                                            colaboradorSeleccionado.area ||
                                            '-'}
                                    </strong>
                                </div>

                                <div className="detalle-campo">
                                    <span>Centro de costos</span>
                                    <strong>
                                        {colaboradorSeleccionado
                                            .centro_costos_nombre ||
                                            colaboradorSeleccionado
                                                .centro_costos ||
                                            '-'}
                                    </strong>
                                </div>

                                <div className="detalle-campo">
                                    <span>Unidad empresarial</span>
                                    <strong>
                                        {colaboradorSeleccionado
                                            .unidad_empresarial_nombre ||
                                            colaboradorSeleccionado
                                                .unidad_empresarial ||
                                            '-'}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogoAccesible>
            )}


        </section>
    );
}

export default ColaboradoresPage;
