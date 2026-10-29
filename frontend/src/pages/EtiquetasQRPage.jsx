import { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw, Search, QrCode } from 'lucide-react';
import { solicitarApi, extraerListaApi } from '../services/apiClient';
import './EtiquetasQRPage.css';

export default function EtiquetasQRPage() {
    const [activos, setActivos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [contratoSeleccionado, setContratoSeleccionado] = useState('TODOS');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const cargar = async () => {
        setCargando(true);
        setError('');
        try {
            const resultado = await solicitarApi('/qr/activos', {
                mensajeError: 'No se pudieron generar las etiquetas QR'
            });
            setActivos(extraerListaApi(resultado));
        } catch (err) {
            setError(err.message || 'No se pudieron cargar las etiquetas QR');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const contratos = useMemo(() => {
        const unicos = new Map();
        activos.forEach((a) => {
            if (a.contrato_id != null) {
                unicos.set(String(a.contrato_id), a.nro_contrato || `Contrato #${a.contrato_id}`);
            }
        });
        return Array.from(unicos, ([id, etiqueta]) => ({ id, etiqueta }))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es-PE'));
    }, [activos]);

    const filtrados = useMemo(() => {
        const texto = busqueda.trim().toLocaleLowerCase('es-PE');
        return activos.filter((a) => {
            const coincideContrato = contratoSeleccionado === 'TODOS' ||
                (contratoSeleccionado === 'SIN_CONTRATO' ? a.contrato_id == null : String(a.contrato_id ?? '') === contratoSeleccionado);
            const coincideTexto = !texto || [
                a.codigo_qr, a.tipo, a.marca, a.modelo, a.serie,
                a.codigo_patrimonial, a.estado_actual, a.nro_contrato
            ].some((v) => String(v || '').toLocaleLowerCase('es-PE').includes(texto));
            return coincideContrato && coincideTexto;
        });
    }, [activos, busqueda, contratoSeleccionado]);

    const imprimir = () => window.print();

    return (
        <section className="pagina etiquetas-qr-pagina">
            <div className="etiquetas-qr-cabecera">
                <div>
                    <span className="etiquetas-qr-eyebrow">IDENTIFICACIÓN DE ACTIVOS</span>
                    <h3>Etiquetas QR</h3>
                    <p>Genera e imprime una etiqueta por equipo o periférico. Al escanearla se abrirá su ficha actualizada.</p>
                </div>
                <div className="etiquetas-qr-acciones no-imprimir">
                    <button type="button" className="boton-secundario" onClick={cargar} disabled={cargando}><RefreshCw size={16} /> Actualizar</button>
                    <button type="button" className="boton-primario" onClick={imprimir} disabled={!filtrados.length}><Printer size={16} /> Imprimir etiquetas</button>
                </div>
            </div>

            <div className="etiquetas-qr-filtros no-imprimir">
                <label className="etiquetas-qr-filtro-contrato">
                    <span>Filtrar por contrato</span>
                    <select value={contratoSeleccionado} onChange={(e) => setContratoSeleccionado(e.target.value)}>
                        <option value="TODOS">Todos los contratos</option>
                        {contratos.map((contrato) => <option key={contrato.id} value={contrato.id}>{contrato.etiqueta}</option>)}
                        <option value="SIN_CONTRATO">Sin contrato</option>
                    </select>
                </label>
                <label className="etiquetas-qr-busqueda">
                    <Search size={17} aria-hidden="true" />
                    <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por serie, código, tipo, marca o modelo..." />
                </label>
            </div>

            {error && <div className="mensaje-conexion mensaje-error" role="alert">{error}</div>}
            {cargando && <p className="etiquetas-qr-vacio">Generando códigos QR...</p>}
            {!cargando && !error && (
                <>
                    <div className="etiquetas-qr-resumen no-imprimir"><QrCode size={18} /> {filtrados.length} etiqueta(s) disponibles para imprimir</div>
                    {filtrados.length ? (
                        <div className="etiquetas-qr-grid">
                            {filtrados.map((a) => (
                                <article className="etiqueta-qr" key={a.codigo_qr}>
                                    <div className="etiqueta-qr-codigo">{a.codigo_qr}</div>
                                    <img src={a.qr} alt={`Código QR de ${a.tipo} ${a.id}`} />
                                    <strong>{a.tipo} · {a.marca} {a.modelo}</strong>
                                    <span>Serie: {a.serie || 'No registrada'}</span>
                                    <span>Código patrimonial: {a.codigo_patrimonial || 'No registrado'}</span>
                                    <span className="etiqueta-qr-estado">{a.estado_actual || 'SIN ESTADO'}</span>
                                </article>
                            ))}
                        </div>
                    ) : <p className="etiquetas-qr-vacio">No se encontraron activos con esa búsqueda.</p>}
                </>
            )}
            <p className="etiquetas-qr-nota no-imprimir">La consulta escaneada es de solo lectura. La ubicación aparecerá como “Sin ubicación registrada” hasta que exista ese dato en el inventario.</p>
        </section>
    );
}
