import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Search,
    LoaderCircle,
    Package,
    Users,
    Smartphone,
    ClipboardList,
    FileText,
    Monitor
} from 'lucide-react';

const GRUPOS_BUSQUEDA = [
    { clave: 'equipos', categoria: 'EQUIPO', titulo: 'Equipos', Icono: Package },
    { clave: 'perifericos', categoria: 'PERIFERICO', titulo: 'Periféricos', Icono: Monitor },
    { clave: 'colaboradores', categoria: 'COLABORADOR', titulo: 'Colaboradores', Icono: Users },
    { clave: 'lineas', categoria: 'LINEA', titulo: 'Líneas móviles', Icono: Smartphone },
    { clave: 'asignaciones', categoria: 'ASIGNACION', titulo: 'Asignaciones', Icono: ClipboardList },
    { clave: 'actas', categoria: 'ACTA', titulo: 'Actas', Icono: FileText }
];

function CampoBusqueda({
    className,
    etiqueta,
    placeholder,
    value,
    onChange,
    resultados = null,
    cargando = false,
    error = '',
    onSeleccionar
}) {
    const contenedorRef = useRef(null);
    const [abierto, setAbierto] = useState(false);
    const [indiceActivo, setIndiceActivo] = useState(-1);
    const esBusquedaGlobal = typeof onSeleccionar === 'function';

    const grupos = useMemo(() => GRUPOS_BUSQUEDA
        .map((grupo) => ({
            ...grupo,
            elementos: Array.isArray(resultados?.[grupo.clave])
                ? resultados[grupo.clave]
                : []
        }))
        .filter((grupo) => grupo.elementos.length > 0),
    [resultados]);

    const elementos = useMemo(
        () => grupos.flatMap((grupo) => grupo.elementos),
        [grupos]
    );

    useEffect(() => {
        if (!esBusquedaGlobal || String(value || '').trim().length < 2) {
            setAbierto(false);
            setIndiceActivo(-1);
            return;
        }

        setAbierto(true);
        setIndiceActivo(-1);
    }, [esBusquedaGlobal, value, resultados, cargando, error]);

    useEffect(() => {
        if (!esBusquedaGlobal || !abierto) return undefined;

        const cerrarFuera = (evento) => {
            if (
                contenedorRef.current &&
                !contenedorRef.current.contains(evento.target)
            ) {
                setAbierto(false);
            }
        };

        const cerrarEscape = (evento) => {
            if (evento.key === 'Escape') {
                setAbierto(false);
                setIndiceActivo(-1);
            }
        };

        document.addEventListener('mousedown', cerrarFuera);
        document.addEventListener('keydown', cerrarEscape);

        return () => {
            document.removeEventListener('mousedown', cerrarFuera);
            document.removeEventListener('keydown', cerrarEscape);
        };
    }, [esBusquedaGlobal, abierto]);

    const seleccionar = (elemento) => {
        if (!elemento) return;
        setAbierto(false);
        setIndiceActivo(-1);
        onSeleccionar?.(elemento);
    };

    const manejarTeclado = (evento) => {
        if (!esBusquedaGlobal) return;

        if (evento.key === 'ArrowDown' && elementos.length > 0) {
            evento.preventDefault();
            setAbierto(true);
            setIndiceActivo((actual) => (
                actual >= elementos.length - 1 ? 0 : actual + 1
            ));
        } else if (evento.key === 'ArrowUp' && elementos.length > 0) {
            evento.preventDefault();
            setAbierto(true);
            setIndiceActivo((actual) => (
                actual <= 0 ? elementos.length - 1 : actual - 1
            ));
        } else if (evento.key === 'Enter' && indiceActivo >= 0) {
            evento.preventDefault();
            seleccionar(elementos[indiceActivo]);
        }
    };

    let indiceGlobal = 0;

    return (
        <div
            className={`${className || ''} ${esBusquedaGlobal ? 'buscador-global' : ''}`.trim()}
            ref={esBusquedaGlobal ? contenedorRef : null}
        >
            <Search size={18} aria-hidden="true" />

            <input
                type="text"
                aria-label={etiqueta}
                placeholder={placeholder}
                value={value ?? ''}
                onChange={onChange}
                onFocus={() => {
                    if (esBusquedaGlobal && String(value || '').trim().length >= 2) {
                        setAbierto(true);
                    }
                }}
                onKeyDown={manejarTeclado}
                autoComplete="off"
                role={esBusquedaGlobal ? 'combobox' : undefined}
                aria-autocomplete={esBusquedaGlobal ? 'list' : undefined}
                aria-expanded={esBusquedaGlobal ? abierto : undefined}
                aria-controls={esBusquedaGlobal ? 'resultados-busqueda-global' : undefined}
            />

            {esBusquedaGlobal && abierto && String(value || '').trim().length >= 2 && (
                <div
                    id="resultados-busqueda-global"
                    className="busqueda-global-panel"
                    role="listbox"
                    aria-label="Resultados de búsqueda"
                >
                    {cargando && (
                        <div className="busqueda-global-estado">
                            <LoaderCircle size={16} className="busqueda-global-cargando" />
                            Buscando en el inventario...
                        </div>
                    )}

                    {!cargando && error && (
                        <div className="busqueda-global-error" role="alert">
                            {error}
                        </div>
                    )}

                    {!cargando && !error && elementos.length > 0 && (
                        <div className="busqueda-global-grupos">
                            {grupos.map((grupo) => {
                                const Icono = grupo.Icono;

                                return (
                                    <section className="busqueda-global-grupo" key={grupo.clave}>
                                        <h4>{grupo.titulo}</h4>
                                        {grupo.elementos.map((elemento) => {
                                            const indice = indiceGlobal;
                                            indiceGlobal += 1;

                                            return (
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={indiceActivo === indice}
                                                    className={`busqueda-global-resultado ${indiceActivo === indice ? 'activo' : ''}`}
                                                    key={`${elemento.categoria}-${elemento.id}`}
                                                    onMouseEnter={() => setIndiceActivo(indice)}
                                                    onClick={() => seleccionar(elemento)}
                                                >
                                                    <span className="busqueda-global-icono">
                                                        <Icono size={16} aria-hidden="true" />
                                                    </span>
                                                    <span className="busqueda-global-texto">
                                                        <strong>{elemento.titulo}</strong>
                                                        {elemento.subtitulo && <small>{elemento.subtitulo}</small>}
                                                    </span>
                                                    {elemento.estado && (
                                                        <span className="busqueda-global-estado-registro">
                                                            {elemento.estado.replaceAll('_', ' ')}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </section>
                                );
                            })}
                        </div>
                    )}

                    {!cargando && !error && elementos.length === 0 && (
                        <div className="busqueda-global-vacia">
                            <strong>No se encontraron coincidencias</strong>
                            <small>Prueba con un nombre, código, serie, IMEI o número de acta.</small>
                        </div>
                    )}

                    {!cargando && !error && elementos.length > 0 && (
                        <div className="busqueda-global-pie">
                            {resultados?.total ?? elementos.length} coincidencias · Usa ↑ y ↓ para navegar, Enter para abrir
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default CampoBusqueda;
