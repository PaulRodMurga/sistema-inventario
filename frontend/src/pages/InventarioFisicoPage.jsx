import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, RefreshCw, Search, CheckCircle2, AlertTriangle, MapPin, XCircle } from 'lucide-react';
import { solicitarApi, extraerListaApi, extraerObjetoApi } from '../services/apiClient';
import './InventarioFisicoPage.css';

const estadoTexto = {
  PENDIENTE: 'Pendiente',
  VERIFICADO: 'Verificado',
  UBICACION_DIFERENTE: 'Ubicación diferente',
  CON_OBSERVACIONES: 'Con observaciones'
};

function InventarioFisicoPage({ soloLectura = false }) {
  const [sesiones, setSesiones] = useState([]);
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [observacionesSesion, setObservacionesSesion] = useState('');
  const [opcionesJornada, setOpcionesJornada] = useState({ contratos: [], unidades: [] });
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroId, setFiltroId] = useState('');
  const [filtroUnidadId, setFiltroUnidadId] = useState('');
  const [unidadesContrato, setUnidadesContrato] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [activoSeleccionado, setActivoSeleccionado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarSesiones = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await solicitarApi('/inventario-fisico');
      setSesiones(extraerListaApi(r));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarSesiones();
    solicitarApi('/inventario-fisico/catalogos/opciones').then(extraerObjetoApi).then(data => setOpcionesJornada(data || { contratos: [], unidades: [] })).catch(e => setError(e.message));
  }, [cargarSesiones]);

  useEffect(() => {
    setFiltroUnidadId('');
    setUnidadesContrato([]);
    if (filtroTipo !== 'CONTRATO' || !filtroId) return;
    let vigente = true;
    solicitarApi('/inventario-fisico/catalogos/opciones?contrato_id=' + encodeURIComponent(filtroId))
      .then(extraerObjetoApi)
      .then(data => { if (vigente) setUnidadesContrato(data?.unidades || []); })
      .catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [filtroTipo, filtroId]);

  // Mantiene actualizada la jornada abierta cuando un QR se verifica desde otro dispositivo.
  useEffect(() => {
    if (!sesion?.id || sesion.estado !== 'ABIERTA') return undefined;

    let vigente = true;
    const actualizarJornada = async () => {
      try {
        const r = await solicitarApi(`/inventario-fisico/${sesion.id}`);
        const actualizada = extraerObjetoApi(r);
        if (vigente) setSesion(actualizada);
        if (vigente) {
          const listado = await solicitarApi('/inventario-fisico');
          setSesiones(extraerListaApi(listado));
        }
      } catch {
        // Un fallo temporal de red no debe interrumpir la jornada abierta.
      }
    };

    const intervalo = window.setInterval(actualizarJornada, 4000);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
    };
  }, [sesion?.id, sesion?.estado]);

  const abrirSesion = async (id) => {
    setError('');
    setMensaje('');
    try {
      const r = await solicitarApi(`/inventario-fisico/${id}`);
      const datosSesion = extraerObjetoApi(r);
      setSesion({
        ...datosSesion,
        activos: Array.isArray(datosSesion?.activos) ? datosSesion.activos : []
      });
      setBusqueda('');
      setActivoSeleccionado(null);
      setCodigo('');
      setUbicacion('');
      setObservaciones('');
    } catch (e) { setError(e.message); }
  };

  const crearSesion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const r = await solicitarApi('/inventario-fisico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, observaciones: observacionesSesion, filtro_tipo: filtroTipo, filtro_id: filtroId ? Number(filtroId) : null, filtro_unidad_id: filtroUnidadId ? Number(filtroUnidadId) : null })
      });
      const nueva = extraerObjetoApi(r);
      setNombre('');
      setObservacionesSesion('');
      await cargarSesiones();
      await abrirSesion(nueva.id);
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  const activosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase();
    return (sesion?.activos || []).filter(a =>
      !q || [a.tipo, a.marca, a.modelo, a.serie, a.codigo_patrimonial, a.colaborador, a.area_colaborador, a.estado_revision]
        .some(v => String(v || '').toLocaleLowerCase().includes(q))
    );
  }, [sesion, busqueda]);

  const seleccionarPorCodigo = (e) => {
    e.preventDefault();
    const match = codigo.trim().match(/^(?:https?:\/\/[^/]+)?(?:\/activo\/)?(?:EQ|PF)-(\d+)\/?$/i);
    if (!match) {
      setError('El código no es válido. Ingresa el código del QR, por ejemplo EQ-123 o PF-123.');
      return;
    }
    const id = Number(match[1]);
    const activo = sesion?.activos?.find(a => Number(a.equipo_id) === id);
    if (!activo) {
      setError('El activo no está incluido en esta jornada. Comprueba que se creó después de iniciar el inventario.');
      return;
    }
    setError('');
    setMensaje('');
    setActivoSeleccionado(activo);
    setUbicacion(activo.ubicacion_observada || activo.ubicacion_esperada || '');
    setObservaciones(activo.observaciones_revision || '');
  };

  const guardarVerificacion = async (e) => {
    e.preventDefault();
    if (!sesion || !activoSeleccionado) return;
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await solicitarApi(`/inventario-fisico/${sesion.id}/verificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipo_id: Number(activoSeleccionado.equipo_id),
          ubicacion_observada: ubicacion,
          observaciones
        })
      });
      setMensaje('Verificación guardada correctamente.');
      await abrirSesion(sesion.id);
      await cargarSesiones();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  const cerrarSesion = async () => {
    if (!sesion || !window.confirm('¿Cerrar esta jornada? Los activos pendientes seguirán como pendientes y no se marcarán automáticamente como perdidos.')) return;
    setGuardando(true);
    try {
      await solicitarApi(`/inventario-fisico/${sesion.id}/cerrar`, { method: 'POST' });
      await abrirSesion(sesion.id);
      await cargarSesiones();
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  const resumen = sesion?.activos?.reduce((acc, a) => {
    acc[a.estado_revision] = (acc[a.estado_revision] || 0) + 1;
    return acc;
  }, {}) || {};

  return <section className="pagina inventario-fisico">
    <div className="encabezado-pagina">
      <div><h3>Inventario físico</h3><p>Verifica los activos registrados y documenta diferencias durante la revisión.</p></div>
      <button className="boton-secundario" type="button" onClick={cargarSesiones} disabled={cargando}><RefreshCw size={16}/> Actualizar</button>
    </div>

    {error && <div className="if-alerta if-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Cerrar mensaje"><XCircle size={17}/></button></div>}
    {mensaje && <div className="if-alerta if-ok" role="status"><CheckCircle2 size={17}/>{mensaje}</div>}

    {!sesion && <>
      {!soloLectura && <form className="if-nueva" onSubmit={crearSesion}>
        <div className="if-titulo"><ClipboardCheck size={21}/><div><strong>Nueva jornada</strong><span>Se guardará una lista de los equipos que no estén dados de baja.</span></div></div>
        <label>Nombre de la jornada<input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={150} required placeholder="Ej. Inventario de oficina central"/></label>
        <label>Incluir equipos de
          <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setFiltroId(''); }}>
            <option value="TODOS">Todos los equipos</option>
            <option value="CONTRATO">Un contrato</option>
            <option value="UNIDAD_EMPRESARIAL">Una unidad empresarial</option>
          </select>
        </label>
        {filtroTipo !== 'TODOS' && <label>{filtroTipo === 'CONTRATO' ? 'Contrato' : 'Unidad empresarial'}
          <select value={filtroId} onChange={e => setFiltroId(e.target.value)} required>
            <option value="">Selecciona una opción</option>
            {(filtroTipo === 'CONTRATO' ? opcionesJornada.contratos : opcionesJornada.unidades).map(op => <option key={op.id} value={op.id}>{filtroTipo === 'CONTRATO' ? op.nro_contrato : op.nombre}</option>)}
          </select>
        </label>}
        {filtroTipo === 'CONTRATO' && filtroId && <label>Unidad empresarial (opcional)
          <select value={filtroUnidadId} onChange={e => setFiltroUnidadId(e.target.value)}>
            <option value="">Todas las unidades de este contrato</option>
            {unidadesContrato.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
          </select>
          <small>Si eliges una unidad, solo se incluirán equipos del contrato asignados actualmente a colaboradores de esa unidad.</small>
        </label>}
        <label>Observaciones iniciales<textarea value={observacionesSesion} onChange={e => setObservacionesSesion(e.target.value)} maxLength={5000} rows={2} placeholder="Área, sede o instrucciones (opcional)"/></label>
        <button className="boton-primario" disabled={guardando || (filtroTipo !== 'TODOS' && !filtroId) || (filtroTipo === 'CONTRATO' && Boolean(filtroId) && unidadesContrato.length === 0)}>{guardando ? 'Creando...' : <><Plus size={17}/> Crear jornada</>}</button>
      </form>}
      <div className="if-listado-cabecera"><div><h3>Jornadas registradas</h3><p>Abre una jornada para revisar sus activos.</p></div></div>
      {cargando ? <p>Cargando jornadas...</p> : sesiones.length === 0 ? <div className="if-vacio">Aún no hay jornadas de inventario físico.</div> :
        <div className="if-sesiones">{sesiones.map(s => <button type="button" className="if-sesion" key={s.id} onClick={() => abrirSesion(s.id)}>
          <span className={s.estado === 'ABIERTA' ? 'if-estado abierta' : 'if-estado cerrada'}>{s.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}</span>
          <strong>{s.nombre}</strong><small>Responsable: {s.responsable || 'Sin dato'}</small>
          <div className="if-progreso"><span>{s.revisados}/{s.total_activos} revisados</span><span>{s.incidencias} incidencias</span></div>
        </button>)}</div>}
    </>}

    {sesion && <>
      <button type="button" className="if-volver" onClick={() => { setSesion(null); setError(''); setMensaje(''); cargarSesiones(); }}>← Volver a jornadas</button>
      <div className="if-sesion-detalle">
        <div className="if-detalle-cabecera"><div><span className={sesion.estado === 'ABIERTA' ? 'if-estado abierta' : 'if-estado cerrada'}>{sesion.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}</span><h3>{sesion.nombre}</h3><p>Responsable: {sesion.responsable || 'Sin dato'} · {new Date(sesion.fecha_inicio).toLocaleString('es-PE')}</p></div>
        {sesion.estado === 'ABIERTA' && !soloLectura && <button type="button" className="boton-secundario if-cerrar" onClick={cerrarSesion} disabled={guardando}>Cerrar jornada</button>}</div>
        <div className="if-kpis"><div><strong>{sesion.activos.length}</strong><span>Total activos</span></div><div><strong>{resumen.VERIFICADO || 0}</strong><span>Verificados</span></div><div><strong>{resumen.PENDIENTE || 0}</strong><span>Pendientes</span></div><div><strong>{(resumen.UBICACION_DIFERENTE || 0) + (resumen.CON_OBSERVACIONES || 0)}</strong><span>Incidencias</span></div></div>
      </div>

      {sesion.estado === 'ABIERTA' && !soloLectura && <div className="if-escaner">
        <div className="if-titulo"><Search size={20}/><div><strong>Registrar verificación por QR</strong><span>Por ahora ingresa el código que aparece debajo del QR; luego añadiremos cámara móvil.</span></div></div>
        <form className="if-form-codigo" onSubmit={seleccionarPorCodigo}><input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej. EQ-123 o PF-123" aria-label="Código QR del activo" required/><button className="boton-primario">Buscar activo</button></form>
        {activoSeleccionado && <form className="if-form-verificacion" onSubmit={guardarVerificacion}>
          <h4>{activoSeleccionado.tipo} · {activoSeleccionado.marca} {activoSeleccionado.modelo}</h4>
          <p>Serie: {activoSeleccionado.serie || 'Sin serie'} · Código patrimonial: {activoSeleccionado.codigo_patrimonial || 'Sin código'}</p>
          <p>Ubicación esperada: <strong>{activoSeleccionado.ubicacion_esperada || 'No registrada'}</strong></p>
          {activoSeleccionado.colaborador && <p>Colaborador asignado: {activoSeleccionado.colaborador}</p>}{activoSeleccionado.area_colaborador && <p>Área del colaborador: {activoSeleccionado.area_colaborador}</p>}
          <label>Ubicación observada<input value={ubicacion} onChange={e => setUbicacion(e.target.value)} maxLength={150} placeholder="Ej. Oficina de logística"/></label>
          <label>Observaciones<textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} maxLength={5000} placeholder="Estado físico, diferencias o detalles (opcional)"/></label>
          <button className="boton-primario" disabled={guardando}>{guardando ? 'Guardando...' : <><CheckCircle2 size={17}/> Guardar verificación</>}</button>
        </form>}
      </div>}

      <div className="if-activos-cabecera"><div><h3>Activos de la jornada</h3><p>Los pendientes no se consideran perdidos automáticamente.</p></div><div className="if-busqueda"><Search size={16}/><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar equipo..." aria-label="Buscar activo"/></div></div>
      <div className="if-tabla-contenedor"><table className="if-tabla"><thead><tr><th>Activo</th><th>Serie / código</th><th>Ubicación esperada</th><th>Estado de revisión</th></tr></thead><tbody>
        {activosFiltrados.map(a => <tr key={a.detalle_id} onClick={() => { setActivoSeleccionado(a); setCodigo((a.tipo && ['MONITOR','TECLADO','MOUSE','PARLANTES','CAMARA WEB','AUDIFONOS'].includes(String(a.tipo).toUpperCase()) ? 'PF-' : 'EQ-') + a.equipo_id); setUbicacion(a.ubicacion_observada || a.ubicacion_esperada || ''); setObservaciones(a.observaciones_revision || ''); }}><td><strong>{a.tipo} · {a.marca} {a.modelo}</strong><small>{a.colaborador || 'Sin colaborador asignado'}</small></td><td>{a.serie || '—'}<small>{a.codigo_patrimonial || '—'}</small></td><td>{a.ubicacion_esperada || 'No registrada'}<small>{a.area_colaborador ? `Área: ${a.area_colaborador}` : ''}</small></td><td><span className={'if-estado-revision if-' + a.estado_revision.toLowerCase()}>{estadoTexto[a.estado_revision] || a.estado_revision}</span></td></tr>)}
        {activosFiltrados.length === 0 && <tr><td colSpan="4">No se encontraron activos.</td></tr>}
      </tbody></table></div>
      {activoSeleccionado && sesion.estado === 'ABIERTA' && !soloLectura && <div className="if-seleccion-movil"><button type="button" onClick={() => { document.querySelector('.if-escaner')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Ir al formulario de verificación del activo seleccionado</button></div>}
    </>}
  </section>;
}
export default InventarioFisicoPage;
