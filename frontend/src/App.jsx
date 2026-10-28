import { useEffect, useState } from 'react';

import {
  LayoutDashboard,
  MonitorSmartphone,
  Users,
  Smartphone,
  ClipboardList,
  ArrowLeftRight,
  FileText,
  Settings,
  Bell,
  LogOut,
  PackageCheck,
  Package,
  UsersRound,
  AlertTriangle,
  FileWarning,
  CalendarClock,
  ArrowUpRight
} from 'lucide-react';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

import './App.css';
// Componentes visuales compartidos por las páginas del inventario.
import './pages/EquiposPage.css';
import { obtenerDashboard } from './services/dashboardService';
import EquiposPage from './pages/EquiposPage';
import EtiquetasQRPage from './pages/EtiquetasQRPage';
import ActivoQRPage from './pages/ActivoQRPage';
import AsignacionesPage from './pages/AsignacionesPage';
import ColaboradoresPage from './pages/ColaboradoresPage';
import MovimientosPage from './pages/MovimientosPage';
import ActasPage from './pages/ActasPage';
import LineasPage from './pages/LineasPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import LoginPage from './pages/LoginPage';
import CampoBusqueda from './components/CampoBusqueda';
import {
  cerrarSesion,
  hayTokenSesion,
  obtenerSesionActual
} from './services/authService';
import { EVENTO_SESION_VENCIDA } from './services/apiClient';


function App() {

  const [usuarioAutenticado, setUsuarioAutenticado] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  useEffect(() => {
    let activo = true;

    const comprobarSesion = async () => {
      if (!hayTokenSesion()) {
        setVerificandoSesion(false);
        return;
      }

      try {
        const usuario = await obtenerSesionActual();
        if (activo) setUsuarioAutenticado(usuario);
      } catch {
        if (activo) setUsuarioAutenticado(null);
      } finally {
        if (activo) setVerificandoSesion(false);
      }
    };

    const sesionVencida = () => {
      setUsuarioAutenticado(null);
      setVerificandoSesion(false);
    };

    window.addEventListener(EVENTO_SESION_VENCIDA, sesionVencida);
    comprobarSesion();

    return () => {
      activo = false;
      window.removeEventListener(
        EVENTO_SESION_VENCIDA,
        sesionVencida
      );
    };
  }, []);

  const salir = async () => {
    try {
      await cerrarSesion();
    } finally {
      setUsuarioAutenticado(null);
    }
  };

  if (verificandoSesion) {
    return (
      <main className="sesion-verificando" role="status">
        Verificando sesión...
      </main>
    );
  }

  if (window.location.pathname.startsWith('/activo/')) {
    const codigoQR = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] || '');
    return <ActivoQRPage codigo={codigoQR} />;
  }

  if (!usuarioAutenticado) {
    return <LoginPage onAutenticado={setUsuarioAutenticado} />;
  }

  return (
    <AplicacionInventario
      usuario={usuarioAutenticado}
      onCerrarSesion={salir}
    />
  );
}

function AplicacionInventario({ usuario, onCerrarSesion }) {

  const [seccionActiva, setSeccionActiva] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroActasDashboard, setFiltroActasDashboard] = useState('TODOS');
  const [contratosSoloPorVencer, setContratosSoloPorVencer] = useState(false);
  const esAdministrador = usuario.rol === 'ADMINISTRADOR';
  const esConsulta = usuario.rol === 'CONSULTA';


  const cargarDashboard = async () => {
    try {
      setCargando(true);
      setError('');

      const datos = await obtenerDashboard();

      setDashboard(datos);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;

    if (seccionActiva === 'Dashboard') {
      const solicitud = obtenerDashboard();

      Promise.resolve().then(() => {
        if (!activo) return;
        setCargando(true);
        setError('');
      });

      solicitud
        .then((datos) => {
          if (activo) setDashboard(datos);
        })
        .catch((error) => {
          if (!activo) return;
          console.error('Error:', error);
          setError(error.message);
        })
        .finally(() => {
          if (activo) setCargando(false);
        });
    }

    return () => {
      activo = false;
    };
  }, [seccionActiva]);

  const abrirActasConFiltro = (filtro) => {
    setFiltroActasDashboard(filtro);
    setSeccionActiva('Actas');
  };

  const abrirContratosPorVencer = () => {
    setContratosSoloPorVencer(true);
    setSeccionActiva('Configuración');
  };

  const resumen = dashboard?.resumen || {
    total_equipos: 0,
    asignados: 0,
    libres: 0,
    perdidos: 0,
    robados: 0,
    baja: 0,
    total_colaboradores: 0,
    total_lineas: 0
  };

  const incidencias =
    Number(resumen.perdidos || 0) +
    Number(resumen.robados || 0);
  const porcentajeAsignados = Number(resumen.total_equipos || 0) > 0 ? Math.round((Number(resumen.asignados || 0) / Number(resumen.total_equipos)) * 100) : 0;
  const porcentajeLibres = Number(resumen.total_equipos || 0) > 0 ? Math.round((Number(resumen.libres || 0) / Number(resumen.total_equipos)) * 100) : 0;
  const alertasDashboard = dashboard?.alertas || { actas_pendientes: 0, devoluciones_pendientes: 0, devoluciones_por_revisar: 0, contratos_por_vencer: 0 };
  const formatearCantidad = (valor) => Number(valor || 0).toLocaleString('es-PE');

  const datosPorEstado = (dashboard?.por_estado || []).map((elemento) => ({
    estado: elemento.estado
      ?.replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letra) => letra.toUpperCase()),

    cantidad: Number(elemento.cantidad)
  }));

  const opcionesMenu = [
    {
      nombre: 'Dashboard',
      icono: LayoutDashboard
    },
    {
      nombre: 'Equipos',
      icono: MonitorSmartphone
    },
    {
      nombre: 'Etiquetas QR',
      icono: PackageCheck
    },
    {
      nombre: 'Colaboradores',
      icono: Users
    },
    {
      nombre: 'Líneas móviles',
      icono: Smartphone
    },
    {
      nombre: 'Asignaciones',
      icono: ClipboardList
    },
    {
      nombre: 'Movimientos',
      icono: ArrowLeftRight
    },
    {
      nombre: 'Actas',
      icono: FileText
    }
  ];

  return (
    <div className="aplicacion">

      <a className="salto-contenido" href="#contenido-principal">
        Saltar al contenido principal
      </a>

      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-logo">
          <div className="logo-icono">
            <MonitorSmartphone size={26} aria-hidden="true" />
          </div>

          <div>
            <h1>Inventario TI</h1>
            <p>Control de equipos</p>
          </div>
        </div>

        <nav className="menu" aria-label="Secciones del inventario">
          {opcionesMenu.map((opcion) => {
            const Icono = opcion.icono;

            return (
              <button
                type="button"
                className={`menu-opcion ${seccionActiva === opcion.nombre ? 'activo' : ''}`}
                key={opcion.nombre}
                onClick={() => setSeccionActiva(opcion.nombre)}
                aria-label={`Abrir ${opcion.nombre}`}
                aria-current={seccionActiva === opcion.nombre ? 'page' : undefined}
              >
                <Icono size={20} aria-hidden="true" />
                <span>{opcion.nombre}</span>
              </button>
            );
          })}
        </nav>

        {esAdministrador && (
          <button
            type="button"
            className={`menu-opcion configuracion ${seccionActiva === 'Configuración' ? 'activo' : ''
              }`}
            onClick={() => {
              setContratosSoloPorVencer(false);
              setSeccionActiva('Configuración');
            }}
            aria-label="Abrir Configuración"
            aria-current={seccionActiva === 'Configuración' ? 'page' : undefined}
          >
            <Settings size={20} aria-hidden="true" />
            <span>Configuración</span>
          </button>
        )}
      </aside>

      <main id="contenido-principal" className="contenido" tabIndex="-1">

        <header className="barra-superior">
          <div>
            <h2>{seccionActiva}</h2>
            <p>
              {seccionActiva === 'Dashboard'
                ? 'Resumen general del inventario tecnológico'
                : 'Administración del sistema de inventario'}
            </p>
          </div>

          <div className="acciones-superiores">
            <CampoBusqueda
              className="buscador"
              etiqueta="Buscar en el inventario"
              placeholder="Buscar..."
            />

            <button
              type="button"
              className="boton-icono"
              title="Notificaciones"
              aria-label="Abrir notificaciones"
            >
              <Bell size={20} aria-hidden="true" />
            </button>

            <div className="usuario">
              <div className="avatar">
                {obtenerIniciales(usuario.nombre)}
              </div>

              <div>
                <strong>{usuario.nombre}</strong>
                <span>{formatearRol(usuario.rol)}</span>
              </div>
            </div>

            <button
              type="button"
              className="boton-icono boton-salir"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={onCerrarSesion}
            >
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        {esConsulta && (
          <div className="aviso-solo-lectura" role="status">
            Cuenta de consulta: las modificaciones están bloqueadas.
          </div>
        )}

        {seccionActiva === 'Dashboard' && (

          <section className="pagina">

            {cargando && (
              <div className="mensaje-conexion mensaje-cargando">
                Cargando información del inventario...
              </div>
            )}

            {error && (
              <div className="mensaje-conexion mensaje-error">
                <span>{error}</span>

                <button type="button" onClick={cargarDashboard}>
                  Reintentar
                </button>
              </div>
            )}

            <div className="dashboard-bienvenida">
              <div>
                <span className="dashboard-eyebrow">CENTRO DE CONTROL · INVENTARIO TI</span>
                <h3>Resumen del inventario</h3>
                <p>Vista general de equipos, asignaciones y tareas administrativas.</p>
              </div>
              <button type="button" className="boton-primario dashboard-actualizar" onClick={cargarDashboard} disabled={cargando}>
                {cargando ? 'Actualizando...' : 'Actualizar datos'}
              </button>
            </div>
            <div className="dashboard-accesos" aria-label="Accesos rápidos">
              <button type="button" onClick={() => setSeccionActiva('Equipos')}><Package size={17} /> Equipos <ArrowUpRight size={15} /></button>
              <button type="button" onClick={() => setSeccionActiva('Asignaciones')}><PackageCheck size={17} /> Asignaciones <ArrowUpRight size={15} /></button>
              <button type="button" onClick={() => setSeccionActiva('Actas')}><FileText size={17} /> Actas <ArrowUpRight size={15} /></button>
              <button type="button" onClick={() => setSeccionActiva('Movimientos')}><ArrowLeftRight size={17} /> Movimientos <ArrowUpRight size={15} /></button>
            </div>

            <div className="tarjetas dashboard-kpis">
              <article className="tarjeta dashboard-kpi dashboard-kpi-total"><div className="dashboard-kpi-icono"><Package size={19} /></div><span>Total de equipos</span><strong>{formatearCantidad(resumen.total_equipos)}</strong><small>Inventario registrado</small></article>
              <article className="tarjeta tarjeta-verde dashboard-kpi"><div className="dashboard-kpi-icono"><PackageCheck size={19} /></div><span>Asignados</span><strong>{formatearCantidad(resumen.asignados)}</strong><small>{porcentajeAsignados}% del inventario</small><div className="dashboard-progreso"><span style={{ width: porcentajeAsignados + '%' }} /></div></article>
              <article className="tarjeta tarjeta-celeste dashboard-kpi"><div className="dashboard-kpi-icono"><Package size={19} /></div><span>Libres</span><strong>{formatearCantidad(resumen.libres)}</strong><small>{porcentajeLibres}% disponibles</small><div className="dashboard-progreso dashboard-progreso-celeste"><span style={{ width: porcentajeLibres + '%' }} /></div></article>
              <article className="tarjeta tarjeta-roja dashboard-kpi"><div className="dashboard-kpi-icono"><AlertTriangle size={19} /></div><span>Incidencias</span><strong>{formatearCantidad(incidencias)}</strong><small>{formatearCantidad(resumen.perdidos)} perdidos · {formatearCantidad(resumen.robados)} robados</small></article>
              <article className="tarjeta dashboard-kpi dashboard-kpi-secundario"><div className="dashboard-kpi-icono"><UsersRound size={19} /></div><span>Colaboradores</span><strong>{formatearCantidad(resumen.total_colaboradores)}</strong><small>Registrados en el sistema</small></article>
              <article className="tarjeta dashboard-kpi dashboard-kpi-secundario"><div className="dashboard-kpi-icono"><Smartphone size={19} /></div><span>Líneas móviles</span><strong>{formatearCantidad(resumen.total_lineas)}</strong><small>En el inventario móvil</small></article>
            </div>

            <div className="paneles">
              <article className="panel panel-grande">
                <h3>Equipos por estado</h3>
                <p>Distribución actual del inventario</p>

                <div className="grafico-vacio">
                  <div className="contenedor-grafico">
                    {datosPorEstado.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={datosPorEstado}
                          margin={{
                            top: 20,
                            right: 20,
                            left: 0,
                            bottom: 10
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e5e7eb"
                          />

                          <XAxis
                            dataKey="estado"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickLine={false}
                          />

                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />

                          <Tooltip
                            cursor={{ fill: '#eff6ff' }}
                            contentStyle={{
                              border: '1px solid #dbe1ea',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgb(15 23 42 / 10%)'
                            }}
                          />

                          <Bar
                            dataKey="cantidad"
                            name="Equipos"
                            fill="#2563eb"
                            radius={[7, 7, 0, 0]}
                            maxBarSize={70}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="mensaje-vacio">
                        No existen equipos para mostrar
                      </div>
                    )}
                  </div>
                </div>
              </article>

              <article className="panel panel-movimientos">
                <h3>Últimos movimientos</h3>
                <p>Actividad reciente del inventario</p>

                <div className="contenedor-movimientos">
                  {(dashboard?.ultimos_movimientos || []).length > 0 ? (
                    <div className="lista-movimientos">
                      {dashboard.ultimos_movimientos.map((movimiento) => (
                        <div
                          className="movimiento-item"
                          key={movimiento.id}
                        >
                          <div className="movimiento-icono">
                            <ArrowLeftRight size={18} />
                          </div>

                          <div className="movimiento-informacion">
                            <strong>
                              {movimiento.tipo_movimiento?.replaceAll('_', ' ')}
                            </strong>

                            <span>
                              {movimiento.marca} {movimiento.modelo}
                            </span>

                            <small>
                              {movimiento.colaborador || 'Sin colaborador'}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sin-movimientos">
                      No existen movimientos para mostrar
                    </div>
                  )}
                </div>
              </article>
            </div>

            <section className="dashboard-seccion-graficos" aria-label="Análisis del inventario">
              <div className="dashboard-seccion-titulo"><div><h3>Análisis del inventario</h3><p>Distribución por marca, operador móvil y área.</p></div></div>
              <div className="dashboard-graficos-grid">
                <PanelGraficoDashboard titulo="Equipos por marca" descripcion="Marcas con más equipos registrados" datos={dashboard?.por_marca || []} clave="marca" alSeleccionar={() => setSeccionActiva('Equipos')} />
                <PanelGraficoDashboard titulo="Equipos por operador" descripcion="Distribución por operador móvil" datos={dashboard?.por_operador || []} clave="operador" alSeleccionar={() => setSeccionActiva('Equipos')} />
                <PanelGraficoDashboard titulo="Asignaciones por área" descripcion="Asignaciones actualmente activas" datos={dashboard?.por_area || []} clave="area" alSeleccionar={() => setSeccionActiva('Asignaciones')} />
              </div>
            </section>

            <section className="dashboard-seccion-alertas">
              <div className="dashboard-seccion-titulo"><div><h3>Control administrativo</h3><p>Elementos que pueden necesitar seguimiento.</p></div><button type="button" className="dashboard-link-modulo" onClick={() => setSeccionActiva('Actas')}>Abrir actas <ArrowUpRight size={15} /></button></div>
              <div className="dashboard-alertas-grid">
                <button type="button" className="dashboard-alerta" onClick={() => abrirActasConFiltro('PENDIENTES')}><span className="dashboard-alerta-icono alerta-ambar"><FileWarning size={19} /></span><span className="dashboard-alerta-texto"><strong>Actas pendientes</strong><small>Actas en estado pendiente</small></span><b>{formatearCantidad(alertasDashboard.actas_pendientes)}</b><ArrowUpRight size={16} /></button>
                <button type="button" className="dashboard-alerta" onClick={() => abrirActasConFiltro('DEVOLUCIONES_PENDIENTES')}><span className="dashboard-alerta-icono alerta-azul"><CalendarClock size={19} /></span><span className="dashboard-alerta-texto"><strong>Devoluciones pendientes</strong><small>Equipos aún marcados como entregados</small></span><b>{formatearCantidad(alertasDashboard.devoluciones_pendientes)}</b><ArrowUpRight size={16} /></button>
                <button type="button" className="dashboard-alerta" onClick={() => abrirActasConFiltro('DEVOLUCIONES_REVISAR')}><span className="dashboard-alerta-icono alerta-rojo"><AlertTriangle size={19} /></span><span className="dashboard-alerta-texto"><strong>Devoluciones por revisar</strong><small>Estado y marca de devolución no coinciden</small></span><b>{formatearCantidad(alertasDashboard.devoluciones_por_revisar)}</b><ArrowUpRight size={16} /></button>
                <button type="button" className="dashboard-alerta" onClick={abrirContratosPorVencer}><span className="dashboard-alerta-icono alerta-verde"><CalendarClock size={19} /></span><span className="dashboard-alerta-texto"><strong>Contratos por vencer</strong><small>Finalizan dentro de los próximos 30 días</small></span><b>{formatearCantidad(alertasDashboard.contratos_por_vencer)}</b><ArrowUpRight size={16} /></button>
              </div>
              <p className="dashboard-nota-datos">Las alertas se calculan con los registros actuales de MySQL; no son notificaciones enviadas automáticamente.</p>
            </section>

          </section>
        )}

        {seccionActiva === 'Equipos' && (
          <EquiposPage soloLectura={esConsulta} />
        )}

        {seccionActiva === 'Etiquetas QR' && (
          <EtiquetasQRPage />
        )}

        {seccionActiva === 'Asignaciones' && (
          <AsignacionesPage soloLectura={esConsulta} />
        )}

        {seccionActiva === 'Colaboradores' && (
          <ColaboradoresPage soloLectura={esConsulta} />
        )}

        {seccionActiva === 'Líneas móviles' && (
          <LineasPage soloLectura={esConsulta} />
        )}

        {seccionActiva === 'Movimientos' && (
          <MovimientosPage />
        )}

        {seccionActiva === 'Actas' && (
          <ActasPage filtroInicial={filtroActasDashboard} />
        )}

        {seccionActiva === 'Configuración' && (
          <ConfiguracionPage
            usuarioActual={usuario}
            onSesionRevocada={onCerrarSesion}
            pestanaInicial={contratosSoloPorVencer ? 'contratas' : 'proveedores'}
            contratosSoloPorVencer={contratosSoloPorVencer}
          />
        )}


      </main>
    </div>
  );
}

function PanelGraficoDashboard({ titulo, descripcion, datos, clave, alSeleccionar }) {
  const datosGrafico = (datos || []).map((fila) => ({
    etiqueta: fila[clave] || 'Sin dato',
    cantidad: Number(fila.cantidad || 0)
  })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 7);

  return (
    <article className="panel dashboard-panel-grafico">
      <div className="dashboard-panel-grafico-cabecera"><div><h3>{titulo}</h3><p>{descripcion}</p></div><button type="button" onClick={alSeleccionar} aria-label={'Abrir módulo relacionado: ' + titulo} title="Abrir módulo relacionado"><ArrowUpRight size={17} /></button></div>
      <div className="dashboard-grafico-secundario">
        {datosGrafico.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={datosGrafico} layout="vertical" margin={{ top: 2, right: 12, left: 4, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8edf5" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 11 }} />
          <YAxis type="category" dataKey="etiqueta" width={104} axisLine={false} tickLine={false} tick={{ fill: '#526178', fontSize: 11 }} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(valor) => [valor, 'Equipos']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgb(15 23 42 / 8%)' }} />
          <Bar dataKey="cantidad" fill="#6278e7" radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart></ResponsiveContainer> : <div className="dashboard-grafico-sin-datos">No hay datos para mostrar</div>}
      </div>
    </article>
  );
}

function obtenerIniciales(nombre) {
  const partes = String(nombre || 'Usuario')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return partes
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}

function formatearRol(rol) {
  const etiquetas = {
    ADMINISTRADOR: 'Administrador',
    OPERADOR: 'Operador',
    CONSULTA: 'Consulta'
  };

  return etiquetas[rol] || rol;
}

export default App;
