import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { solicitarApi, extraerObjetoApi } from '../services/apiClient';

const ESTADOS = ['LIBRE','ASIGNADO','EN_CUSTODIA','PERDIDO','ROBADO','BAJA'];
const etiqueta = (v) => String(v || '').replaceAll('_',' ').toLowerCase().replace(/\b\w/g, x => x.toUpperCase());

export default function ReportesPage() {
  const [datos, setDatos] = useState(null);
  const [filtros, setFiltros] = useState({ unidad_empresarial_id:'', area_id:'', estado:'', colaborador_id:'' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const query = new URLSearchParams(Object.entries(filtros).filter(([,v])=>v));
      const respuesta = await solicitarApi('/reportes?' + query.toString(), { mensajeError:'No se pudieron cargar los reportes' });
      setDatos(extraerObjetoApi(respuesta, 'La API no devolvió reportes válidos'));
    } catch(e) { setError(e.message || 'Error al cargar reportes'); }
    finally { setCargando(false); }
  };
  useEffect(()=>{ cargar(); }, []);
  const totales = useMemo(()=> (datos?.resumen || []).reduce((a,f)=>a+Number(f.cantidad||0),0),[datos]);

  const exportarCSV = (filas, nombre) => {
    if(!filas?.length) return;
    const columnas=Object.keys(filas[0]);
    const csv=[columnas.join(';'),...filas.map(f=>columnas.map(k=>String(f[k]??'').replaceAll(';',',').replaceAll('"','""')).map(v=>`"${v}"`).join(';'))].join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=nombre;a.click();URL.revokeObjectURL(url);
  };

  return <section className="pagina-reportes">
    <header className="reportes-cabecera"><div><h2>Reportes gerenciales</h2><p>Resumen del inventario TI, distribución y asignaciones.</p></div><button type="button" onClick={cargar} disabled={cargando}><RefreshCw size={16}/> Actualizar</button></header>
    {error && <div className="mensaje-error">{error}</div>}
    <div className="reportes-filtros">
      <label>Unidad empresarial<select value={filtros.unidad_empresarial_id} onChange={e=>setFiltros({...filtros,unidad_empresarial_id:e.target.value})}><option value="">Todas</option>{datos?.filtros?.unidades?.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
      <label>Área<select value={filtros.area_id} onChange={e=>setFiltros({...filtros,area_id:e.target.value})}><option value="">Todas</option>{datos?.filtros?.areas?.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
      <label>Estado<select value={filtros.estado} onChange={e=>setFiltros({...filtros,estado:e.target.value})}><option value="">Todos</option>{ESTADOS.map(x=><option key={x} value={x}>{etiqueta(x)}</option>)}</select></label>
      <label>Colaborador<select value={filtros.colaborador_id} onChange={e=>setFiltros({...filtros,colaborador_id:e.target.value})}><option value="">Todos</option>{datos?.filtros?.colaboradores?.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
      <button type="button" onClick={cargar} disabled={cargando}>Aplicar filtros</button>
    </div>
    {cargando && <p>Cargando reportes…</p>}
    {datos && <>
      <div className="reportes-indicadores"><article><span>Equipos incluidos</span><strong>{totales}</strong></article>{datos.resumen.map(x=><article key={x.estado}><span>{etiqueta(x.estado)}</span><strong>{Number(x.cantidad||0)}</strong></article>)}</div>
      <div className="reportes-acciones"><button type="button" onClick={()=>exportarCSV(datos.por_unidad_area,'reporte-unidad-area.csv')}><FileSpreadsheet size={16}/> Exportar unidad/área (Excel CSV)</button><button type="button" onClick={()=>exportarCSV(datos.por_colaborador,'reporte-colaboradores.csv')}><Download size={16}/> Exportar colaboradores (CSV)</button><button type="button" onClick={()=>window.print()}><FileText size={16}/> Imprimir / guardar PDF</button></div>
      <section className="panel reportes-panel"><h3>Equipos por unidad empresarial y área</h3><div className="tabla-reportes"><table><thead><tr><th>Unidad empresarial</th><th>Área</th><th>Estado</th><th>Cantidad</th></tr></thead><tbody>{datos.por_unidad_area.map((x,i)=><tr key={i}><td>{x.unidad_empresarial}</td><td>{x.area}</td><td>{etiqueta(x.estado)}</td><td>{x.cantidad}</td></tr>)}</tbody></table></div></section>
      <section className="panel reportes-panel"><h3>Periféricos disponibles y vinculados</h3><div className="tabla-reportes"><table><thead><tr><th>Vínculo</th><th>Estado</th><th>Cantidad</th></tr></thead><tbody>{datos.perifericos.map((x,i)=><tr key={i}><td>{etiqueta(x.vinculo)}</td><td>{etiqueta(x.estado)}</td><td>{x.cantidad}</td></tr>)}</tbody></table></div></section>
      <section className="panel reportes-panel"><h3>Equipos por colaborador</h3><div className="tabla-reportes"><table><thead><tr><th>Colaborador</th><th>Unidad</th><th>Área</th><th>Tipo</th><th>Equipo</th><th>Serie</th><th>Estado</th></tr></thead><tbody>{datos.por_colaborador.map(x=><tr key={x.equipo_id}><td>{x.colaborador}</td><td>{x.unidad_empresarial}</td><td>{x.area}</td><td>{etiqueta(x.tipo)}</td><td>{x.marca} {x.modelo}</td><td>{x.serie || x.codigo_patrimonial || '—'}</td><td>{etiqueta(x.estado_actual)}</td></tr>)}</tbody></table></div></section>
    </>}
  </section>;
}
