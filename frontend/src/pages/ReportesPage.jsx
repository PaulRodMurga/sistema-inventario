import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ChartColumn, Building2, Check, ChevronRight, CircleHelp,
  FileSpreadsheet, FileText, Filter, Laptop, Monitor, Package,
  RefreshCw, RotateCcw, Search, Users, X
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import { obtenerReportes } from '../services/reportesService';

const FILTROS_INICIALES = {
  unidad_empresarial_id: '',
  area_id: '',
  estado: '',
  colaborador_id: ''
};
const ESTADOS = [
  { valor: 'LIBRE', etiqueta: 'Libre', color: '#16a36a' },
  { valor: 'ASIGNADO', etiqueta: 'Asignado', color: '#3976d5' },
  { valor: 'EN_CUSTODIA', etiqueta: 'En custodia', color: '#d79a2b' },
  { valor: 'PERDIDO', etiqueta: 'Perdido', color: '#df7a36' },
  { valor: 'ROBADO', etiqueta: 'Robado', color: '#d94d58' },
  { valor: 'BAJA', etiqueta: 'Baja', color: '#778397' }
];
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen general', icono: Activity, descripcion: 'Indicadores principales del inventario' },
  { id: 'organizacion', etiqueta: 'Por unidad y área', icono: Building2, descripcion: 'Distribución organizacional de equipos' },
  { id: 'colaboradores', etiqueta: 'Por colaborador', icono: Users, descripcion: 'Equipos que tiene cada colaborador' },
  { id: 'perifericos', etiqueta: 'Periféricos', icono: Monitor, descripcion: 'Disponibilidad y vinculación' }
];
const numero = (valor) => new Intl.NumberFormat('es-PE').format(Number(valor || 0));
const etiqueta = (valor) => String(valor || 'Sin información').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letra) => letra.toUpperCase());

function BotonExportar({ onClick, disabled = false, children }) {
  return <button type="button" className="reportes-boton-secundario" onClick={onClick} disabled={disabled}><FileSpreadsheet size={16} />{children}</button>;
}
function EstadoVacio({ titulo, detalle }) {
  return <div className="reportes-vacio"><div className="reportes-vacio-icono"><FileText size={22} /></div><strong>{titulo}</strong><p>{detalle}</p></div>;
}
function CabeceraSeccion({ titulo, descripcion, accion }) {
  return <div className="reportes-cabecera-seccion"><div><h3>{titulo}</h3><p>{descripcion}</p></div>{accion}</div>;
}
function textoFiltrosPendientes(hayCambios, cargando) {
  if (cargando) return 'Consultando información...';
  return hayCambios ? 'Tienes cambios sin aplicar. Presiona “Generar reporte”.' : 'Los resultados corresponden a los filtros aplicados.';
}

export default function ReportesPage() {
  const [datos, setDatos] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIALES);
  const [pestanaActiva, setPestanaActiva] = useState('resumen');
  const [busquedaColaborador, setBusquedaColaborador] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [actualizadoEn, setActualizadoEn] = useState(null);

  const cargar = useCallback(async (filtrosConsulta = FILTROS_INICIALES) => {
    setCargando(true);
    setError('');
    try {
      const resultado = await obtenerReportes(filtrosConsulta);
      setDatos(resultado);
      setFiltrosAplicados({ ...filtrosConsulta });
      setActualizadoEn(new Date());
    } catch (solicitudError) {
      setError(solicitudError.message || 'No se pudieron cargar los reportes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(FILTROS_INICIALES); }, [cargar]);

  const resumen = datos?.resumen || [];
  const filasUnidadArea = datos?.por_unidad_area || [];
  const filasColaborador = datos?.por_colaborador || [];
  const filasPerifericos = datos?.perifericos || [];
  const totalEquipos = useMemo(() => resumen.reduce((total, fila) => total + Number(fila.cantidad || 0), 0), [resumen]);
  const cantidadEstado = (estado) => Number(resumen.find((fila) => String(fila.estado).toUpperCase() === estado)?.cantidad || 0);
  const totalLibres = cantidadEstado('LIBRE');
  const totalAsignados = cantidadEstado('ASIGNADO');
  const totalCustodia = cantidadEstado('EN_CUSTODIA');
  const totalEspeciales = cantidadEstado('PERDIDO') + cantidadEstado('ROBADO') + cantidadEstado('BAJA');

  const datosGraficoEstados = useMemo(() => resumen.map((fila) => {
    const config = ESTADOS.find((estado) => estado.valor === String(fila.estado).toUpperCase());
    return { estado: config?.etiqueta || etiqueta(fila.estado), cantidad: Number(fila.cantidad || 0), color: config?.color || '#94a3b8' };
  }).filter((fila) => fila.cantidad > 0), [resumen]);

  const datosGraficoOrganizacion = useMemo(() => {
    const agrupados = new Map();
    filasUnidadArea.forEach((fila) => {
      const unidad = fila.unidad_empresarial || 'Sin unidad empresarial';
      const area = fila.area || 'Sin área';
      const clave = unidad + '|' + area;
      const actual = agrupados.get(clave) || { nombre: area + ' · ' + unidad, cantidad: 0 };
      actual.cantidad += Number(fila.cantidad || 0);
      agrupados.set(clave, actual);
    });
    return Array.from(agrupados.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  }, [filasUnidadArea]);

  const datosGraficoPerifericos = useMemo(() => {
    const agrupados = new Map();
    filasPerifericos.forEach((fila) => {
      const vinculo = String(fila.vinculo || '').toUpperCase();
      agrupados.set(vinculo, (agrupados.get(vinculo) || 0) + Number(fila.cantidad || 0));
    });
    return [
      { nombre: 'Vinculados', cantidad: agrupados.get('VINCULADO') || 0, color: '#3976d5' },
      { nombre: 'Disponibles', cantidad: agrupados.get('DISPONIBLE') || 0, color: '#16a36a' }
    ].filter((fila) => fila.cantidad > 0);
  }, [filasPerifericos]);

  const totalPerifericos = useMemo(() => filasPerifericos.reduce((total, fila) => total + Number(fila.cantidad || 0), 0), [filasPerifericos]);
  const perifericosVinculados = datosGraficoPerifericos.find((fila) => fila.nombre === 'Vinculados')?.cantidad || 0;
  const perifericosDisponibles = datosGraficoPerifericos.find((fila) => fila.nombre === 'Disponibles')?.cantidad || 0;

  const colaboradoresFiltrados = useMemo(() => {
    const busqueda = busquedaColaborador.trim().toLocaleLowerCase('es');
    if (!busqueda) return filasColaborador;
    return filasColaborador.filter((fila) => [
      fila.colaborador, fila.unidad_empresarial, fila.area, fila.marca,
      fila.modelo, fila.serie, fila.codigo_patrimonial
    ].some((valor) => String(valor || '').toLocaleLowerCase('es').includes(busqueda)));
  }, [filasColaborador, busquedaColaborador]);

  const hayFiltrosPendientes = Object.keys(FILTROS_INICIALES).some(
    (clave) => String(filtros[clave] || '') !== String(filtrosAplicados[clave] || '')
  );

  const filtrosActivos = useMemo(() => {
    const unidades = datos?.filtros?.unidades || [];
    const areas = datos?.filtros?.areas || [];
    const colaboradores = datos?.filtros?.colaboradores || [];
    const activos = [];
    if (filtrosAplicados.unidad_empresarial_id) activos.push({
      nombre: 'Unidad',
      valor: unidades.find((fila) => String(fila.id) === String(filtrosAplicados.unidad_empresarial_id))?.nombre || filtrosAplicados.unidad_empresarial_id
    });
    if (filtrosAplicados.area_id) activos.push({
      nombre: 'Área',
      valor: areas.find((fila) => String(fila.id) === String(filtrosAplicados.area_id))?.nombre || filtrosAplicados.area_id
    });
    if (filtrosAplicados.estado) activos.push({ nombre: 'Estado', valor: etiqueta(filtrosAplicados.estado) });
    if (filtrosAplicados.colaborador_id) activos.push({
      nombre: 'Colaborador',
      valor: colaboradores.find((fila) => String(fila.id) === String(filtrosAplicados.colaborador_id))?.nombre || filtrosAplicados.colaborador_id
    });
    return activos;
  }, [datos, filtrosAplicados]);

  const exportarCSV = (filas, nombreArchivo) => {
    if (!filas?.length) return;
    const columnas = Object.keys(filas[0]);
    const protegerCelda = (valor) => {
      const texto = String(valor ?? '').replaceAll('"', '""');
      const seguro = /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
      return '"' + seguro + '"';
    };
    const contenido = [
      columnas.map(protegerCelda).join(';'),
      ...filas.map((fila) => columnas.map((columna) => protegerCelda(fila[columna])).join(';'))
    ].join('\r\n');
    const archivo = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  const aplicarFiltros = (evento) => { evento.preventDefault(); cargar(filtros); };
  const limpiarFiltros = () => { setFiltros(FILTROS_INICIALES); cargar(FILTROS_INICIALES); };
  const actualizarDatos = () => cargar(filtrosAplicados);
  const pestana = PESTANAS.find((fila) => fila.id === pestanaActiva) || PESTANAS[0];

  const renderResumen = () => (
    <div className="reportes-vista">
      <CabeceraSeccion titulo="Panorama del inventario" descripcion="Indicadores de los equipos principales. Los periféricos se presentan en su propio reporte."
        accion={<BotonExportar disabled={!resumen.length} onClick={() => exportarCSV(resumen, 'resumen-inventario.csv')}>Exportar resumen</BotonExportar>} />
      <div className="reportes-kpis">
        <article className="reportes-kpi reportes-kpi-principal"><div className="reportes-kpi-icono"><Laptop size={19} /></div><span>Total de equipos</span><strong>{numero(totalEquipos)}</strong><small>Equipos principales incluidos en el reporte</small></article>
        <article className="reportes-kpi"><div className="reportes-kpi-icono kpi-verde"><Check size={19} /></div><span>Libres</span><strong>{numero(totalLibres)}</strong><small>Disponibles para asignación</small></article>
        <article className="reportes-kpi"><div className="reportes-kpi-icono kpi-azul"><Users size={19} /></div><span>Asignados</span><strong>{numero(totalAsignados)}</strong><small>Actualmente bajo responsabilidad</small></article>
        <article className="reportes-kpi"><div className="reportes-kpi-icono kpi-ambar"><Package size={19} /></div><span>En custodia</span><strong>{numero(totalCustodia)}</strong><small>Retenidos temporalmente</small></article>
        <article className="reportes-kpi"><div className="reportes-kpi-icono kpi-rojo"><Activity size={19} /></div><span>Estados especiales</span><strong>{numero(totalEspeciales)}</strong><small>Perdidos, robados o dados de baja</small></article>
      </div>
      <div className="reportes-grid-analisis">
        <section className="reportes-panel">
          <CabeceraSeccion titulo="Distribución por estado" descripcion="Composición del inventario según su situación actual." />
          {datosGraficoEstados.length ? (
            <div className="reportes-grafico-donut">
              <div className="reportes-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosGraficoEstados} dataKey="cantidad" nameKey="estado" innerRadius="64%" outerRadius="88%" paddingAngle={3} stroke="none">
                      {datosGraficoEstados.map((fila) => <Cell key={fila.estado} fill={fila.color} />)}
                    </Pie>
                    <Tooltip formatter={(valor) => [numero(valor), 'Equipos']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="reportes-donut-centro"><strong>{numero(totalEquipos)}</strong><span>equipos</span></div>
              </div>
              <div className="reportes-leyenda-estados">
                {datosGraficoEstados.map((fila) => (
                  <div className="reportes-leyenda-fila" key={fila.estado}>
                    <span className="reportes-punto" style={{ backgroundColor: fila.color }} />
                    <span>{fila.estado}</span><strong>{numero(fila.cantidad)}</strong>
                    <small>{totalEquipos ? Math.round((fila.cantidad / totalEquipos) * 100) : 0}%</small>
                  </div>
                ))}
              </div>
            </div>
          ) : <EstadoVacio titulo="No hay equipos para mostrar" detalle="Prueba quitando algunos filtros o actualizando la información." />}
        </section>
        <section className="reportes-panel reportes-panel-consejo">
          <div className="reportes-panel-titulo-icono"><CircleHelp size={18} /></div>
          <h3>¿Cómo interpretar este resumen?</h3>
          <p>Los equipos libres están disponibles para nuevas asignaciones. Los asignados se encuentran bajo responsabilidad de un colaborador.</p>
          <p>Los equipos en custodia permanecen retenidos temporalmente. Los estados especiales agrupan equipos perdidos, robados o dados de baja.</p>
          <div className="reportes-nota"><strong>Alcance del reporte</strong><span>Los periféricos, como monitores, teclados y mouse, se contabilizan en la pestaña Periféricos para evitar duplicidades.</span></div>
        </section>
      </div>
    </div>
  );

  const renderOrganizacion = () => (
    <div className="reportes-vista">
      <CabeceraSeccion titulo="Distribución organizacional" descripcion="Consulta cuántos equipos corresponden a cada unidad empresarial, área y estado."
        accion={<BotonExportar disabled={!filasUnidadArea.length} onClick={() => exportarCSV(filasUnidadArea, 'equipos-por-unidad-y-area.csv')}>Exportar reporte</BotonExportar>} />
      <section className="reportes-panel">
        <div className="reportes-panel-subtitulo"><div><strong>Áreas con mayor cantidad de equipos</strong><span>Se muestran las 10 combinaciones de unidad y área con más equipos.</span></div></div>
        {datosGraficoOrganizacion.length ? (
          <div className="reportes-grafico-barras" style={{ height: Math.max(300, datosGraficoOrganizacion.length * 42) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGraficoOrganizacion} layout="vertical" margin={{ top: 6, right: 24, left: 12, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nombre" width={220} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(valor) => [numero(valor), 'Equipos']} />
                <Bar dataKey="cantidad" name="Equipos" fill="#3976d5" radius={[0, 6, 6, 0]} barSize={19} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EstadoVacio titulo="No hay distribución disponible" detalle="No se encontraron equipos para los filtros seleccionados." />}
      </section>
      <section className="reportes-panel">
        <CabeceraSeccion titulo="Detalle por unidad, área y estado" descripcion="La tabla conserva el desglose completo del reporte." />
        {filasUnidadArea.length ? (
          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead><tr><th>Unidad empresarial</th><th>Área</th><th>Estado</th><th className="alinear-derecha">Cantidad</th></tr></thead>
              <tbody>{filasUnidadArea.map((fila, indice) => (
                <tr key={indice}>
                  <td>{fila.unidad_empresarial || 'Sin unidad empresarial'}</td><td>{fila.area || 'Sin área'}</td>
                  <td><span className={'reportes-etiqueta-estado estado-' + String(fila.estado || '').toLowerCase()}>{etiqueta(fila.estado)}</span></td>
                  <td className="alinear-derecha"><strong>{numero(fila.cantidad)}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EstadoVacio titulo="No hay resultados" detalle="Modifica los filtros y vuelve a generar el reporte." />}
      </section>
    </div>
  );

  const renderColaboradores = () => (
    <div className="reportes-vista">
      <CabeceraSeccion titulo="Equipos por colaborador" descripcion="Identifica qué equipos están asignados actualmente y dónde se encuentra cada responsable."
        accion={<BotonExportar disabled={!filasColaborador.length} onClick={() => exportarCSV(filasColaborador, 'equipos-por-colaborador.csv')}>Exportar reporte</BotonExportar>} />
      <section className="reportes-panel">
        <div className="reportes-tabla-barra">
          <div><strong>{numero(filasColaborador.length)} equipos asignados</strong><span>Registros de asignaciones activas.</span></div>
          <label className="reportes-busqueda-tabla">
            <Search size={16} />
            <input type="search" value={busquedaColaborador} onChange={(evento) => setBusquedaColaborador(evento.target.value)} placeholder="Buscar colaborador o equipo..." aria-label="Buscar colaborador o equipo" />
            {busquedaColaborador && <button type="button" onClick={() => setBusquedaColaborador('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
          </label>
        </div>
        {colaboradoresFiltrados.length ? (
          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead><tr><th>Colaborador</th><th>Unidad empresarial</th><th>Área</th><th>Tipo</th><th>Equipo</th><th>Serie / código</th><th>Estado</th></tr></thead>
              <tbody>{colaboradoresFiltrados.map((fila) => (
                <tr key={fila.equipo_id}>
                  <td><strong>{fila.colaborador || 'Sin colaborador'}</strong></td><td>{fila.unidad_empresarial || 'Sin unidad empresarial'}</td>
                  <td>{fila.area || 'Sin área'}</td><td>{etiqueta(fila.tipo)}</td>
                  <td>{[fila.marca, fila.modelo].filter(Boolean).join(' ') || 'Sin descripción'}</td>
                  <td>{fila.serie || fila.codigo_patrimonial || '—'}</td>
                  <td><span className={'reportes-etiqueta-estado estado-' + String(fila.estado_actual || '').toLowerCase()}>{etiqueta(fila.estado_actual)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EstadoVacio titulo={busquedaColaborador ? 'No se encontraron coincidencias' : 'No hay asignaciones activas'} detalle={busquedaColaborador ? 'Prueba con otro nombre, área, marca o serie.' : 'No existen equipos asignados con los filtros seleccionados.'} />}
      </section>
    </div>
  );

  const renderPerifericos = () => (
    <div className="reportes-vista">
      <CabeceraSeccion titulo="Disponibilidad de periféricos" descripcion="Consulta cuántos periféricos están vinculados a equipos principales y cuántos figuran disponibles."
        accion={<BotonExportar disabled={!filasPerifericos.length} onClick={() => exportarCSV(filasPerifericos, 'reporte-perifericos.csv')}>Exportar reporte</BotonExportar>} />
      <div className="reportes-aviso-alcance"><CircleHelp size={17} /><span>Esta vista muestra el inventario global de periféricos. Los filtros organizacionales de las otras pestañas no se aplican aquí.</span></div>
      <div className="reportes-kpis reportes-kpis-perifericos">
        <article className="reportes-kpi"><div className="reportes-kpi-icono"><Monitor size={19} /></div><span>Total de periféricos</span><strong>{numero(totalPerifericos)}</strong><small>Registros de periféricos</small></article>
        <article className="reportes-kpi"><div className="reportes-kpi-icono kpi-azul"><Laptop size={19} /></div><span>Vinculados</span><strong>{numero(perifericosVinculados)}</strong><small>Relacionados con un equipo principal</small></article>
        <article className="reportes-kpi"><div className="reportes-kpi-icono kpi-verde"><Package size={19} /></div><span>Disponibles</span><strong>{numero(perifericosDisponibles)}</strong><small>Sin vínculo registrado</small></article>
      </div>
      <div className="reportes-grid-analisis">
        <section className="reportes-panel">
          <CabeceraSeccion titulo="Estado de vinculación" descripcion="Comparación entre periféricos vinculados y disponibles." />
          {datosGraficoPerifericos.length ? (
            <div className="reportes-grafico-donut reportes-grafico-donut-compacto">
              <div className="reportes-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosGraficoPerifericos} dataKey="cantidad" nameKey="nombre" innerRadius="64%" outerRadius="88%" paddingAngle={3} stroke="none">
                      {datosGraficoPerifericos.map((fila) => <Cell key={fila.nombre} fill={fila.color} />)}
                    </Pie>
                    <Tooltip formatter={(valor) => [numero(valor), 'Periféricos']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="reportes-donut-centro"><strong>{numero(totalPerifericos)}</strong><span>periféricos</span></div>
              </div>
              <div className="reportes-leyenda-estados">
                {datosGraficoPerifericos.map((fila) => (
                  <div className="reportes-leyenda-fila" key={fila.nombre}>
                    <span className="reportes-punto" style={{ backgroundColor: fila.color }} />
                    <span>{fila.nombre}</span><strong>{numero(fila.cantidad)}</strong>
                    <small>{totalPerifericos ? Math.round((fila.cantidad / totalPerifericos) * 100) : 0}%</small>
                  </div>
                ))}
              </div>
            </div>
          ) : <EstadoVacio titulo="No hay periféricos registrados" detalle="Cuando existan periféricos, su distribución aparecerá aquí." />}
        </section>
        <section className="reportes-panel">
          <CabeceraSeccion titulo="Detalle por estado" descripcion="El estado actual de cada grupo de periféricos." />
          {filasPerifericos.length ? (
            <div className="reportes-tabla-contenedor">
              <table className="reportes-tabla">
                <thead><tr><th>Vinculación</th><th>Estado</th><th className="alinear-derecha">Cantidad</th></tr></thead>
                <tbody>{filasPerifericos.map((fila, indice) => (
                  <tr key={indice}>
                    <td>{etiqueta(fila.vinculo)}</td>
                    <td><span className={'reportes-etiqueta-estado estado-' + String(fila.estado || '').toLowerCase()}>{etiqueta(fila.estado)}</span></td>
                    <td className="alinear-derecha"><strong>{numero(fila.cantidad)}</strong></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EstadoVacio titulo="Sin información" detalle="No se encontraron registros de periféricos." />}
        </section>
      </div>
    </div>
  );

  return (
    <main className="pagina-reportes">
      <header className="reportes-hero">
        <div className="reportes-hero-contenido">
          <div className="reportes-icono-principal"><ChartColumn size={22} /></div>
          <div>
            <div className="reportes-eyebrow">ANÁLISIS Y CONTROL</div>
            <h2>Reportes gerenciales</h2>
            <p>Consulta la distribución, asignación y disponibilidad de los activos tecnológicos.</p>
            <div className="reportes-actualizacion"><span className="reportes-indicador-en-linea" />{actualizadoEn ? 'Datos actualizados a las ' + actualizadoEn.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'Esperando información'}</div>
          </div>
        </div>
        <div className="reportes-hero-acciones">
          <button type="button" className="reportes-boton-secundario" onClick={() => window.print()}><FileText size={16} />Imprimir / PDF</button>
          <button type="button" className="reportes-boton-primario" onClick={actualizarDatos} disabled={cargando}><RefreshCw size={16} className={cargando ? 'reportes-icono-girando' : ''} />{cargando ? 'Actualizando...' : 'Actualizar datos'}</button>
        </div>
      </header>

      {error && <div className="reportes-error" role="alert">{error}</div>}

      <nav className="reportes-pestanas" aria-label="Tipos de reportes" role="tablist">
        {PESTANAS.map((fila) => {
          const Icono = fila.icono;
          const activa = pestanaActiva === fila.id;
          return (
            <button key={fila.id} type="button" className={'reportes-pestana' + (activa ? ' activa' : '')}
              onClick={() => setPestanaActiva(fila.id)} role="tab" aria-selected={activa}>
              <span className="reportes-pestana-icono"><Icono size={18} /></span>
              <span className="reportes-pestana-texto"><strong>{fila.etiqueta}</strong><small>{fila.descripcion}</small></span>
              <ChevronRight className="reportes-pestana-flecha" size={16} />
            </button>
          );
        })}
      </nav>

      {pestanaActiva !== 'perifericos' && (
        <form className="reportes-filtros-panel" onSubmit={aplicarFiltros}>
          <div className="reportes-filtros-encabezado">
            <div className="reportes-filtros-titulo">
              <span className="reportes-filtros-icono"><Filter size={17} /></span>
              <div><strong>Filtrar reportes de equipos</strong><small>Selecciona uno o varios criterios para acotar los resultados.</small></div>
            </div>
            <div className="reportes-filtros-acciones">
              <button type="button" className="reportes-enlace-boton" onClick={limpiarFiltros} disabled={!hayFiltrosPendientes && !filtrosActivos.length}><RotateCcw size={14} />Limpiar</button>
              <button type="submit" className="reportes-boton-primario" disabled={cargando}><Filter size={15} />Generar reporte</button>
            </div>
          </div>
          <div className="reportes-campos-filtros">
            <label><span>Unidad empresarial</span>
              <select value={filtros.unidad_empresarial_id} onChange={(evento) => setFiltros((actual) => ({ ...actual, unidad_empresarial_id: evento.target.value, area_id: '' }))}>
                <option value="">Todas las unidades</option>
                {(datos?.filtros?.unidades || []).map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}
              </select>
            </label>
            <label><span>Área</span>
              <select value={filtros.area_id} onChange={(evento) => setFiltros((actual) => ({ ...actual, area_id: evento.target.value }))}>
                <option value="">Todas las áreas</option>
                {(datos?.filtros?.areas || []).map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}
              </select>
            </label>
            <label><span>Estado del equipo</span>
              <select value={filtros.estado} onChange={(evento) => setFiltros((actual) => ({ ...actual, estado: evento.target.value }))}>
                <option value="">Todos los estados</option>
                {ESTADOS.map((fila) => <option key={fila.valor} value={fila.valor}>{fila.etiqueta}</option>)}
              </select>
            </label>
            <label><span>Colaborador</span>
              <select value={filtros.colaborador_id} onChange={(evento) => setFiltros((actual) => ({ ...actual, colaborador_id: evento.target.value }))}>
                <option value="">Todos los colaboradores</option>
                {(datos?.filtros?.colaboradores || []).map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="reportes-filtros-pie">
            <span>{textoFiltrosPendientes(hayFiltrosPendientes, cargando)}</span>
            {filtrosActivos.length > 0 && (
              <div className="reportes-chips-filtros"><span>Aplicados:</span>
                {filtrosActivos.map((fila) => <span className="reportes-chip" key={fila.nombre}>{fila.nombre}: {fila.valor}</span>)}
              </div>
            )}
          </div>
        </form>
      )}

      {cargando && datos && <div className="reportes-cargando-linea"><span />Actualizando resultados...</div>}
      {!datos && cargando && <div className="reportes-carga-inicial"><RefreshCw size={20} className="reportes-icono-girando" />Preparando los reportes...</div>}
      {datos && (
        <section className="reportes-contenido" role="tabpanel" aria-label={pestana.etiqueta}>
          {pestanaActiva === 'resumen' && renderResumen()}
          {pestanaActiva === 'organizacion' && renderOrganizacion()}
          {pestanaActiva === 'colaboradores' && renderColaboradores()}
          {pestanaActiva === 'perifericos' && renderPerifericos()}
        </section>
      )}
      <footer className="reportes-pie-pagina">
        <span><FileText size={14} />Los reportes reflejan los registros disponibles al momento de la consulta.</span>
        <span>{actualizadoEn ? 'Última actualización: ' + actualizadoEn.toLocaleString('es-PE') : 'Sin actualización'}</span>
      </footer>
    </main>
  );
}
