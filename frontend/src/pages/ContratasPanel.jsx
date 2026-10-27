import { useEffect, useMemo, useState } from 'react';
import {
    Ban,
    Boxes,
    Eye,
    FileSignature,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Search,
    X
} from 'lucide-react';

import {
    actualizarContrato,
    actualizarGamasContrato,
    inhabilitarContrato,
    listarContratos,
    obtenerContratoPorId,
    registrarContrato
} from '../services/contratoService';
import { listarOperadores } from '../services/operadorService';
import { listarGamas } from '../services/gamaService';
import DialogoAccesible from '../components/DialogoAccesible';
import EtiquetaEstado from '../components/EtiquetaEstado';

const TARIFA_INICIAL = {
    costo_alquiler_mensual: '0',
    costo_servicio_mensual: '0',
    meses_contrato: '36',
    mes_renovacion_equipo: '18',
    precio_prepago: '',
    precio_venta_18m: ''
};

const FORMULARIO_INICIAL = {
    operador_id: '',
    nro_contrato: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    monto_contractual: '0',
    moneda: 'PEN',
    estado: 'VIGENTE',
    gamas: []
};

function tarifaParaFormulario(gama, existente = false) {
    return {
        gama_id: Number(gama.gama_id ?? gama.id),
        costo_alquiler_mensual: String(gama.costo_alquiler_mensual ?? 0),
        costo_servicio_mensual: String(gama.costo_servicio_mensual ?? 0),
        meses_contrato: String(gama.meses_contrato ?? 36),
        mes_renovacion_equipo: String(gama.mes_renovacion_equipo ?? 18),
        precio_prepago: gama.precio_prepago == null ? '' : String(gama.precio_prepago),
        precio_venta_18m: gama.precio_venta_18m == null ? '' : String(gama.precio_venta_18m),
        existente
    };
}

function tarifaParaApi(tarifa) {
    return {
        gama_id: Number(tarifa.gama_id),
        costo_alquiler_mensual: Number(tarifa.costo_alquiler_mensual || 0),
        costo_servicio_mensual: Number(tarifa.costo_servicio_mensual || 0),
        meses_contrato: Number(tarifa.meses_contrato),
        mes_renovacion_equipo: Number(tarifa.mes_renovacion_equipo),
        precio_prepago: tarifa.precio_prepago === ''
            ? null
            : Number(tarifa.precio_prepago),
        precio_venta_18m: tarifa.precio_venta_18m === ''
            ? null
            : Number(tarifa.precio_venta_18m)
    };
}

function fechaParaInput(valor) {
    if (!valor) return '';
    return String(valor).slice(0, 10);
}

function formatearFecha(valor) {
    const fecha = fechaParaInput(valor);
    if (!fecha) return 'Sin fecha';

    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
}

function textoEstado(estado) {
    if (estado === 'CANCELADO') return 'INHABILITADA';
    if (estado === 'VENCIDO') return 'VENCIDA';
    return estado || 'SIN ESTADO';
}

function claseEstado(estado) {
    return estado === 'VIGENTE' ? 'activo' : 'inactivo';
}

function ContratasPanel({ soloPorVencer = false } = {}) {
    const [contratas, setContratas] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [gamas, setGamas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [errorFormulario, setErrorFormulario] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [revision, setRevision] = useState(0);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [contrataEditandoId, setContrataEditandoId] = useState(null);
    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
    const [detalleAbierto, setDetalleAbierto] = useState(false);
    const [detalle, setDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [contrataInhabilitar, setContrataInhabilitar] = useState(null);

    useEffect(() => {
        let activo = true;

        Promise.all([
            listarContratos(),
            listarOperadores(),
            listarGamas()
        ])
            .then(([datosContratas, datosOperadores, datosGamas]) => {
                if (!activo) return;
                setContratas(datosContratas);
                setOperadores(datosOperadores);
                setGamas(datosGamas);
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
        total: contratas.length,
        vigentes: contratas.filter(({ estado }) => estado === 'VIGENTE').length,
        vencidas: contratas.filter(({ estado }) => estado === 'VENCIDO').length,
        inhabilitadas: contratas.filter(({ estado }) => estado === 'CANCELADO').length,
        equipos: contratas.reduce(
            (total, contrata) => total + Number(contrata.cantidad_equipos || 0),
            0
        )
    }), [contratas]);

    const contratasFiltradas = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        return contratas.filter((contrata) => {
            const fechaFin = contrata.fecha_fin ? new Date(`${String(contrata.fecha_fin).slice(0, 10)}T00:00:00`) : null;
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const limite = new Date(hoy);
            limite.setDate(limite.getDate() + 30);
            const dentroDePlazo = fechaFin && !Number.isNaN(fechaFin.getTime()) && fechaFin >= hoy && fechaFin <= limite && contrata.estado !== 'CANCELADO';
            return (!soloPorVencer || dentroDePlazo) && [
            contrata.id,
            contrata.nro_contrato,
            contrata.operador,
            contrata.estado,
            textoEstado(contrata.estado)
        ].join(' ').toLowerCase().includes(texto);
        });
    }, [busqueda, contratas, soloPorVencer]);

    const mostrarMensaje = (texto) => {
        setMensaje(texto);
        window.setTimeout(() => setMensaje(''), 4000);
    };

    const recargar = () => {
        setCargando(true);
        setError('');
        setRevision((anterior) => anterior + 1);
    };

    const abrirRegistro = () => {
        setContrataEditandoId(null);
        setFormulario(FORMULARIO_INICIAL);
        setErrorFormulario('');
        setFormularioAbierto(true);
    };

    const abrirEdicion = async (id) => {
        try {
            setGuardando(true);
            setError('');
            const contrata = await obtenerContratoPorId(id);

            setFormulario({
                operador_id: String(contrata.operador_id || ''),
                nro_contrato: contrata.nro_contrato || '',
                descripcion: contrata.descripcion || '',
                fecha_inicio: fechaParaInput(contrata.fecha_inicio),
                fecha_fin: fechaParaInput(contrata.fecha_fin),
                monto_contractual: String(contrata.monto_contractual ?? 0),
                moneda: contrata.moneda || 'PEN',
                estado: contrata.estado || 'VIGENTE',
                gamas: (contrata.gamas || []).map((gama) => (
                    tarifaParaFormulario(gama, true)
                ))
            });
            setContrataEditandoId(id);
            setErrorFormulario('');
            setFormularioAbierto(true);
        } catch (errorSolicitud) {
            setError(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    const abrirDetalle = async (id) => {
        try {
            setDetalle(null);
            setCargandoDetalle(true);
            setDetalleAbierto(true);
            setError('');
            setDetalle(await obtenerContratoPorId(id));
        } catch (errorSolicitud) {
            setDetalleAbierto(false);
            setError(errorSolicitud.message);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const actualizarCampo = (evento) => {
        const { name, value } = evento.target;
        setFormulario((anterior) => ({ ...anterior, [name]: value }));
    };

    const alternarGama = (id) => {
        setFormulario((anterior) => ({
            ...anterior,
            gamas: anterior.gamas.some((tarifa) => tarifa.gama_id === id)
                ? anterior.gamas.filter((tarifa) => (
                    tarifa.gama_id !== id || tarifa.existente
                ))
                : [
                    ...anterior.gamas,
                    tarifaParaFormulario({ id, ...TARIFA_INICIAL })
                ]
        }));
    };

    const actualizarTarifa = (gamaId, campo, valor) => {
        setFormulario((anterior) => ({
            ...anterior,
            gamas: anterior.gamas.map((tarifa) => (
                tarifa.gama_id === gamaId
                    ? { ...tarifa, [campo]: valor }
                    : tarifa
            ))
        }));
    };

    const guardarContrata = async (evento) => {
        evento.preventDefault();

        if (!formulario.operador_id || !formulario.nro_contrato.trim() || !formulario.fecha_inicio) {
            setErrorFormulario('Proveedor, número de contrato y fecha de inicio son obligatorios');
            return;
        }

        if (formulario.fecha_fin && formulario.fecha_fin < formulario.fecha_inicio) {
            setErrorFormulario('La fecha de fin no puede ser anterior a la fecha de inicio');
            return;
        }

        if (formulario.gamas.length === 0) {
            setErrorFormulario('Selecciona al menos una gama para registrar equipos en esta contrato');
            return;
        }

        const tarifaInvalida = formulario.gamas.some((tarifa) => (
            Number(tarifa.meses_contrato) <= 0 ||
            Number(tarifa.mes_renovacion_equipo) <= 0 ||
            Number(tarifa.mes_renovacion_equipo) > Number(tarifa.meses_contrato)
        ));

        if (tarifaInvalida) {
            setErrorFormulario('Revisa los plazos: la renovación debe ocurrir dentro de la duración de la contrato');
            return;
        }

        const datos = {
            operador_id: Number(formulario.operador_id),
            nro_contrato: formulario.nro_contrato.trim(),
            descripcion: formulario.descripcion.trim() || null,
            fecha_inicio: formulario.fecha_inicio,
            fecha_fin: formulario.fecha_fin || null,
            monto_contractual: Number(formulario.monto_contractual || 0),
            moneda: formulario.moneda,
            estado: formulario.estado
        };

        try {
            setGuardando(true);
            setErrorFormulario('');
            const tarifas = formulario.gamas.map(tarifaParaApi);

            if (contrataEditandoId) {
                await actualizarContrato(contrataEditandoId, datos);
                await actualizarGamasContrato(contrataEditandoId, tarifas);
                mostrarMensaje('Contrato actualizado correctamente');
            } else {
                await registrarContrato({ ...datos, gamas: tarifas });
                mostrarMensaje('Contrato registrado correctamente');
            }

            setFormularioAbierto(false);
            setContrataEditandoId(null);
            recargar();
        } catch (errorSolicitud) {
            setErrorFormulario(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    const confirmarInhabilitacion = async () => {
        if (!contrataInhabilitar) return;

        try {
            setGuardando(true);
            setError('');
            await inhabilitarContrato(contrataInhabilitar.id);
            setContrataInhabilitar(null);
            mostrarMensaje('Contrato inhabilitado correctamente');
            recargar();
        } catch (errorSolicitud) {
            setError(errorSolicitud.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="config-contratas-panel">
            <div className="config-encabezado">
                <div>
                    <h3>Contratos</h3>
                    <p>Vigencia contractual y equipos asociados</p>
                </div>

                <div className="config-acciones-encabezado">
                    <button
                        type="button"
                        className="config-boton-actualizar"
                        onClick={recargar}
                        disabled={cargando}
                    >
                        <RefreshCw size={18} aria-hidden="true" />
                        Actualizar
                    </button>
                    <button
                        type="button"
                        className="config-boton-primario"
                        onClick={abrirRegistro}
                    >
                        <Plus size={18} aria-hidden="true" />
                        Registrar contrato
                    </button>
                </div>
            </div>

            {mensaje && <div className="config-exito" role="status">{mensaje}</div>}
            {error && <div className="config-error" role="alert">{error}</div>}

            <div className="config-resumen config-resumen-contratas">
                <ResumenContrata titulo="Total" valor={resumen.total} tipo="total" />
                <ResumenContrata titulo="Vigentes" valor={resumen.vigentes} tipo="activo" />
                <ResumenContrata titulo="Vencidas" valor={resumen.vencidas} tipo="inactivo" />
                <ResumenContrata titulo="Inhabilitadas" valor={resumen.inhabilitadas} tipo="inactivo" />
                <ResumenContrata titulo="Equipos asociados" valor={resumen.equipos} tipo="total" />
            </div>

            <div className="config-filtros">
                <div className="config-buscador">
                    <Search size={18} aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Buscar contrato"
                        placeholder="Buscar por ID, número, proveedor o estado..."
                        value={busqueda}
                        onChange={(evento) => setBusqueda(evento.target.value)}
                    />
                </div>
            </div>

            {cargando ? (
                <div className="config-mensaje" role="status">Cargando contratos...</div>
            ) : contratasFiltradas.length === 0 ? (
                <div className="config-mensaje">No se encontraron contratos.</div>
            ) : (
                <>
                    <div className="config-tabla-contenedor">
                        <table className="config-tabla config-tabla-contratas">
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Contrato</th>
                                    <th scope="col">Proveedor</th>
                                    <th scope="col">Inicio</th>
                                    <th scope="col">Fin</th>
                                    <th scope="col">Equipos</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contratasFiltradas.map((contrata) => (
                                    <tr key={contrata.id}>
                                        <td>#{contrata.id}</td>
                                        <td><strong>{contrata.nro_contrato}</strong></td>
                                        <td>{contrata.operador}</td>
                                        <td>{formatearFecha(contrata.fecha_inicio)}</td>
                                        <td>{formatearFecha(contrata.fecha_fin)}</td>
                                        <td>{Number(contrata.cantidad_equipos || 0)}</td>
                                        <td>
                                            <EtiquetaEstado
                                                className="config-estado"
                                                prefijo="config-estado-"
                                                estado={claseEstado(contrata.estado)}
                                                texto={textoEstado(contrata.estado)}
                                            />
                                        </td>
                                        <td>
                                            <div className="config-acciones-fila">
                                                <button
                                                    type="button"
                                                    className="config-accion-ver"
                                                    aria-label={`Ver contrato ${contrata.nro_contrato}`}
                                                    title="Ver detalle"
                                                    onClick={() => abrirDetalle(contrata.id)}
                                                ><Eye size={17} aria-hidden="true" /></button>
                                                <button
                                                    type="button"
                                                    className="config-accion-editar"
                                                    aria-label={`Editar contrato ${contrata.nro_contrato}`}
                                                    title="Editar"
                                                    onClick={() => abrirEdicion(contrata.id)}
                                                ><Pencil size={17} aria-hidden="true" /></button>
                                                {contrata.estado !== 'CANCELADO' && (
                                                    <button
                                                        type="button"
                                                        className="config-accion-inhabilitar"
                                                        aria-label={`Inhabilitar contrato ${contrata.nro_contrato}`}
                                                        title="Inhabilitar"
                                                        onClick={() => setContrataInhabilitar(contrata)}
                                                    ><Ban size={17} aria-hidden="true" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="config-resultados">
                        Mostrando {contratasFiltradas.length} de {contratas.length} contratos
                    </p>
                </>
            )}

            {formularioAbierto && (
                <DialogoAccesible
                    className="config-modal-contrata"
                    tituloId="contrata-formulario-titulo"
                    descripcionId="contrata-formulario-descripcion"
                    onCerrar={() => !guardando && setFormularioAbierto(false)}
                    bloqueado={guardando}
                    ocupado={guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="contrata-formulario-titulo">
                                {contrataEditandoId ? 'Modificar contrato' : 'Registrar contrato'}
                            </h3>
                            <p id="contrata-formulario-descripcion">
                                Define la vigencia y las gamas habilitadas para sus equipos
                            </p>
                        </div>
                        <button
                            type="button"
                            className="modal-cerrar"
                            aria-label="Cerrar formulario de contrato"
                            onClick={() => setFormularioAbierto(false)}
                            disabled={guardando}
                        ><X size={20} aria-hidden="true" /></button>
                    </div>

                    <form onSubmit={guardarContrata}>
                        {errorFormulario && (
                            <div className="error-formulario" role="alert">{errorFormulario}</div>
                        )}

                        <div className="config-formulario-campos">
                            <CampoFormulario etiqueta="Operador *" htmlFor="contrata-operador">
                                <select id="contrata-operador" name="operador_id" value={formulario.operador_id} onChange={actualizarCampo} disabled={guardando} required>
                                    <option value="">Seleccionar proveedor</option>
                                    {operadores.filter((operador) =>
                                        operador.estado === 'ACTIVO' ||
                                        String(operador.id) === String(formulario.operador_id)
                                    ).map((operador) => (
                                        <option key={operador.id} value={operador.id}>{operador.nombre}</option>
                                    ))}
                                </select>
                            </CampoFormulario>
                            <CampoFormulario etiqueta="Número de contrato *" htmlFor="contrata-numero">
                                <input id="contrata-numero" name="nro_contrato" maxLength="50" value={formulario.nro_contrato} onChange={actualizarCampo} disabled={guardando} required />
                            </CampoFormulario>
                            <CampoFormulario etiqueta="Fecha de inicio *" htmlFor="contrata-inicio">
                                <input id="contrata-inicio" name="fecha_inicio" type="date" value={formulario.fecha_inicio} onChange={actualizarCampo} disabled={guardando} required />
                            </CampoFormulario>
                            <CampoFormulario etiqueta="Fecha de fin" htmlFor="contrata-fin">
                                <input id="contrata-fin" name="fecha_fin" type="date" min={formulario.fecha_inicio || undefined} value={formulario.fecha_fin} onChange={actualizarCampo} disabled={guardando} />
                            </CampoFormulario>
                            <CampoFormulario etiqueta="Monto contractual" htmlFor="contrata-monto">
                                <input id="contrata-monto" name="monto_contractual" type="number" min="0" step="0.01" value={formulario.monto_contractual} onChange={actualizarCampo} disabled={guardando} />
                            </CampoFormulario>
                            <CampoFormulario etiqueta="Moneda" htmlFor="contrata-moneda">
                                <select id="contrata-moneda" name="moneda" value={formulario.moneda} onChange={actualizarCampo} disabled={guardando}>
                                    <option value="PEN">Soles (PEN)</option>
                                    <option value="USD">Dólares (USD)</option>
                                </select>
                            </CampoFormulario>
                            {contrataEditandoId && (
                                <CampoFormulario etiqueta="Estado" htmlFor="contrata-estado">
                                    <select id="contrata-estado" name="estado" value={formulario.estado} onChange={actualizarCampo} disabled={guardando}>
                                        <option value="VIGENTE">Vigente</option>
                                        <option value="VENCIDO">Vencida</option>
                                        <option value="CANCELADO">Inhabilitada</option>
                                    </select>
                                </CampoFormulario>
                            )}
                            <CampoFormulario etiqueta="Descripción" htmlFor="contrata-descripcion" completo>
                                <textarea id="contrata-descripcion" name="descripcion" maxLength="200" rows="3" value={formulario.descripcion} onChange={actualizarCampo} disabled={guardando} />
                            </CampoFormulario>

                            <fieldset className="config-gamas-selector config-campo-completo" disabled={guardando}>
                                <legend>Gamas y tarifas *</legend>
                                {gamas.filter((gama) => (
                                    gama.estado === 'ACTIVO' ||
                                    formulario.gamas.some((tarifa) => tarifa.gama_id === gama.id)
                                )).map((gama) => {
                                    const tarifa = formulario.gamas.find(
                                        (elemento) => elemento.gama_id === gama.id
                                    );

                                    return (
                                        <label key={gama.id}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(tarifa)}
                                                disabled={Boolean(tarifa?.existente)}
                                                onChange={() => alternarGama(gama.id)}
                                            />
                                            <span><strong>{gama.codigo}</strong> — {gama.descripcion}</span>
                                        </label>
                                    );
                                })}
                                {contrataEditandoId && (
                                    <small>Las asociaciones existentes no se eliminan porque pueden tener equipos e historial. Sí puedes actualizar sus tarifas y agregar nuevas gamas.</small>
                                )}
                            </fieldset>

                            {formulario.gamas.length > 0 && (
                                <div className="config-tarifas-editor config-campo-completo">
                                    {formulario.gamas.map((tarifa) => {
                                        const gama = gamas.find(({ id }) => id === tarifa.gama_id);

                                        return (
                                            <section className="config-tarifa-card" key={tarifa.gama_id}>
                                                <div className="config-tarifa-titulo">
                                                    <div>
                                                        <strong>{gama?.codigo || `Gama #${tarifa.gama_id}`}</strong>
                                                        <span>{gama?.descripcion || ''}</span>
                                                    </div>
                                                    {tarifa.existente && <small>Asociación existente</small>}
                                                </div>
                                                <div className="config-tarifa-campos">
                                                    <CampoTarifa etiqueta="Alquiler mensual" sufijo={formulario.moneda}>
                                                        <input type="number" min="0" step="0.01" value={tarifa.costo_alquiler_mensual} onChange={(evento) => actualizarTarifa(tarifa.gama_id, 'costo_alquiler_mensual', evento.target.value)} disabled={guardando} required />
                                                    </CampoTarifa>
                                                    <CampoTarifa etiqueta="Servicio mensual" sufijo={formulario.moneda}>
                                                        <input type="number" min="0" step="0.01" value={tarifa.costo_servicio_mensual} onChange={(evento) => actualizarTarifa(tarifa.gama_id, 'costo_servicio_mensual', evento.target.value)} disabled={guardando} required />
                                                    </CampoTarifa>
                                                    <CampoTarifa etiqueta="Duración" sufijo="meses">
                                                        <input type="number" min="1" step="1" value={tarifa.meses_contrato} onChange={(evento) => actualizarTarifa(tarifa.gama_id, 'meses_contrato', evento.target.value)} disabled={guardando} required />
                                                    </CampoTarifa>
                                                    <CampoTarifa etiqueta="Renovación" sufijo="mes">
                                                        <input type="number" min="1" step="1" max={tarifa.meses_contrato || undefined} value={tarifa.mes_renovacion_equipo} onChange={(evento) => actualizarTarifa(tarifa.gama_id, 'mes_renovacion_equipo', evento.target.value)} disabled={guardando} required />
                                                    </CampoTarifa>
                                                    <CampoTarifa etiqueta="Precio prepago" sufijo={formulario.moneda} opcional>
                                                        <input type="number" min="0" step="0.01" value={tarifa.precio_prepago} onChange={(evento) => actualizarTarifa(tarifa.gama_id, 'precio_prepago', evento.target.value)} disabled={guardando} />
                                                    </CampoTarifa>
                                                    <CampoTarifa etiqueta="Venta a 18 meses" sufijo={formulario.moneda} opcional>
                                                        <input type="number" min="0" step="0.01" value={tarifa.precio_venta_18m} onChange={(evento) => actualizarTarifa(tarifa.gama_id, 'precio_venta_18m', evento.target.value)} disabled={guardando} />
                                                    </CampoTarifa>
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="modal-acciones">
                            <button type="button" className="boton-cancelar" onClick={() => setFormularioAbierto(false)} disabled={guardando}>Cancelar</button>
                            <button type="submit" className="boton-guardar" disabled={guardando}>
                                <Save size={18} aria-hidden="true" />
                                {guardando ? 'Guardando...' : 'Guardar contrato'}
                            </button>
                        </div>
                    </form>
                </DialogoAccesible>
            )}

            {detalleAbierto && (
                <DialogoAccesible
                    className="config-modal-contrata config-modal-detalle-contrata"
                    tituloId="contrata-detalle-titulo"
                    descripcionId="contrata-detalle-descripcion"
                    onCerrar={() => setDetalleAbierto(false)}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="contrata-detalle-titulo">Detalle del contrato</h3>
                            <p id="contrata-detalle-descripcion">Información contractual y equipos asociados</p>
                        </div>
                        <button type="button" className="modal-cerrar" aria-label="Cerrar detalle de contrato" onClick={() => setDetalleAbierto(false)}>
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>

                    {cargandoDetalle ? (
                        <div className="config-mensaje">Cargando detalle...</div>
                    ) : detalle && (
                        <div className="config-detalle-contrata">
                            <div className="config-detalle-principal">
                                <FileSignature size={30} aria-hidden="true" />
                                <div>
                                    <span>Contrato #{detalle.id}</span>
                                    <h4>{detalle.nro_contrato}</h4>
                                </div>
                                <EtiquetaEstado className="config-estado" prefijo="config-estado-" estado={claseEstado(detalle.estado)} texto={textoEstado(detalle.estado)} />
                            </div>
                            <div className="config-detalle-grid-contrata">
                                <DatoDetalle etiqueta="Operador" valor={detalle.operador} />
                                <DatoDetalle etiqueta="Vigencia" valor={`${formatearFecha(detalle.fecha_inicio)} — ${formatearFecha(detalle.fecha_fin)}`} />
                                <DatoDetalle etiqueta="Monto" valor={`${detalle.moneda || 'PEN'} ${Number(detalle.monto_contractual || 0).toFixed(2)}`} />
                                <DatoDetalle etiqueta="Gamas" valor={(detalle.gamas || []).map((gama) => gama.codigo).join(', ') || 'Sin gamas'} />
                                <DatoDetalle etiqueta="Descripción" valor={detalle.descripcion || 'Sin descripción'} completo />
                            </div>

                            <div className="config-subtitulo-equipos">
                                <FileSignature size={20} aria-hidden="true" />
                                <h4>Tarifas por gama ({detalle.gamas?.length || 0})</h4>
                            </div>
                            {detalle.gamas?.length ? (
                                <div className="config-tabla-contenedor">
                                    <table className="config-tabla config-tabla-tarifas">
                                        <thead><tr><th>Gama</th><th>Alquiler</th><th>Servicio</th><th>Plazo</th><th>Renovación</th><th>Prepago</th><th>Venta 18 m.</th></tr></thead>
                                        <tbody>
                                            {detalle.gamas.map((gama) => (
                                                <tr key={gama.contrato_gama_id}>
                                                    <td><strong>{gama.codigo}</strong><small>{gama.descripcion}</small></td>
                                                    <td>{formatearImporte(gama.costo_alquiler_mensual, detalle.moneda)}</td>
                                                    <td>{formatearImporte(gama.costo_servicio_mensual, detalle.moneda)}</td>
                                                    <td>{gama.meses_contrato} meses</td>
                                                    <td>Mes {gama.mes_renovacion_equipo}</td>
                                                    <td>{formatearImporte(gama.precio_prepago, detalle.moneda, true)}</td>
                                                    <td>{formatearImporte(gama.precio_venta_18m, detalle.moneda, true)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="config-mensaje config-mensaje-compacto">Este contrato todavía no tiene gamas ni tarifas.</div>}

                            <div className="config-subtitulo-equipos">
                                <Boxes size={20} aria-hidden="true" />
                                <h4>Equipos asociados ({detalle.equipos?.length || 0})</h4>
                            </div>
                            {detalle.equipos?.length ? (
                                <div className="config-tabla-contenedor">
                                    <table className="config-tabla config-tabla-equipos-contrata">
                                        <thead><tr><th>ID</th><th>Equipo</th><th>IMEI / serie</th><th>Gama</th><th>Estado</th></tr></thead>
                                        <tbody>
                                            {detalle.equipos.map((equipo) => (
                                                <tr key={equipo.id}>
                                                    <td>#{equipo.id}</td>
                                                    <td><strong>{equipo.marca} {equipo.modelo}</strong></td>
                                                    <td>{equipo.imei || equipo.serie || '-'}</td>
                                                    <td>{equipo.codigo_gama}</td>
                                                    <td>{equipo.estado_actual}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="config-mensaje config-mensaje-compacto">Este contrato todavía no tiene equipos.</div>}
                        </div>
                    )}
                </DialogoAccesible>
            )}

            {contrataInhabilitar && (
                <DialogoAccesible
                    className="config-modal-confirmacion"
                    tituloId="contrata-inhabilitar-titulo"
                    descripcionId="contrata-inhabilitar-descripcion"
                    onCerrar={() => setContrataInhabilitar(null)}
                    bloqueado={guardando}
                >
                    <div className="modal-encabezado">
                        <div>
                            <h3 id="contrata-inhabilitar-titulo">Inhabilitar contrato</h3>
                            <p id="contrata-inhabilitar-descripcion">Los equipos se conservarán para el historial, pero no podrán registrarse nuevos equipos bajo este contrato.</p>
                        </div>
                    </div>
                    <div className="config-confirmacion-contenido">
                        ¿Confirmas inhabilitar <strong>{contrataInhabilitar.nro_contrato}</strong>?
                    </div>
                    <div className="modal-acciones">
                        <button type="button" className="boton-cancelar" onClick={() => setContrataInhabilitar(null)} disabled={guardando}>Cancelar</button>
                        <button type="button" className="config-boton-peligro" onClick={confirmarInhabilitacion} disabled={guardando}>
                            <Ban size={18} aria-hidden="true" />
                            {guardando ? 'Inhabilitando...' : 'Inhabilitar'}
                        </button>
                    </div>
                </DialogoAccesible>
            )}
        </section>
    );
}

function ResumenContrata({ titulo, valor, tipo }) {
    return (
        <div className={`config-tarjeta config-tarjeta-${tipo}`}>
            <div><span>{titulo}</span><strong>{valor}</strong></div>
            {titulo === 'Equipos asociados'
                ? <Boxes size={23} aria-hidden="true" />
                : <FileSignature size={23} aria-hidden="true" />}
        </div>
    );
}

function CampoFormulario({ etiqueta, htmlFor, completo = false, children }) {
    return (
        <div className={`config-campo ${completo ? 'config-campo-completo' : ''}`}>
            <label htmlFor={htmlFor}>{etiqueta}</label>
            {children}
        </div>
    );
}

function DatoDetalle({ etiqueta, valor, completo = false }) {
    return (
        <div className={completo ? 'config-detalle-ancho' : ''}>
            <span>{etiqueta}</span>
            <strong>{valor || '-'}</strong>
        </div>
    );
}

function CampoTarifa({ etiqueta, sufijo, opcional = false, children }) {
    return (
        <label className="config-tarifa-campo">
            <span>{etiqueta}{opcional ? ' (opcional)' : ''}</span>
            <div>
                {children}
                <small>{sufijo}</small>
            </div>
        </label>
    );
}

function formatearImporte(valor, moneda = 'PEN', opcional = false) {
    if (valor == null && opcional) return 'No definido';
    return `${moneda} ${Number(valor || 0).toFixed(2)}`;
}

export default ContratasPanel;
