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
  LogOut
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
            onClick={() => setSeccionActiva('Configuración')}
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

            <div className="encabezado-pagina">
              <div>
                <h3>Resumen del inventario</h3>
                <p>Información actualizada de los equipos registrados</p>
              </div>

              <button
                type="button"
                className="boton-primario"
                onClick={cargarDashboard}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar datos'}
              </button>
            </div>

            <div className="tarjetas">
              <article className="tarjeta">
                <span>Total de equipos</span>
                <strong>{resumen.total_equipos}</strong>
                <small>Equipos registrados</small>
              </article>

              <article className="tarjeta tarjeta-verde">
                <span>Asignados</span>
                <strong>{resumen.asignados}</strong>
                <small>Equipos en uso</small>
              </article>

              <article className="tarjeta tarjeta-celeste">
                <span>Libres</span>
                <strong>{resumen.libres}</strong>
                <small>Disponibles para asignar</small>
              </article>

              <article className="tarjeta tarjeta-roja">
                <span>Incidencias</span>
                <strong>{incidencias}</strong>
                <small>Perdidos o robados</small>
              </article>
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

          </section>
        )}

        {seccionActiva === 'Equipos' && (
          <EquiposPage soloLectura={esConsulta} />
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
          <ActasPage />
        )}

        {seccionActiva === 'Configuración' && (
          <ConfiguracionPage
            usuarioActual={usuario}
            onSesionRevocada={onCerrarSesion}
          />
        )}


      </main>
    </div>
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
