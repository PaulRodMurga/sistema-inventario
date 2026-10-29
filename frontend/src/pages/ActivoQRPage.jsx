import { useEffect, useState } from 'react';
import { obtenerApiUrl, solicitarApi, obtenerTokenSesion } from '../services/apiClient';
import './ActivoQRPage.css';

export default function ActivoQRPage({ codigo }) {
    const [activo, setActivo] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [resultadoInventario, setResultadoInventario] = useState('');

    useEffect(() => {
        let vigente = true;
        fetch(obtenerApiUrl(`qr/activo/${encodeURIComponent(codigo)}`))
            .then(async (respuesta) => {
                const resultado = await respuesta.json();
                if (!respuesta.ok || resultado.success === false) {
                    throw new Error(resultado.mensaje || 'No se encontró el activo');
                }
                return resultado.data;
            })
            .then(async (datos) => {
                if (!vigente) return;
                setActivo(datos);
                if (!obtenerTokenSesion()) { setResultadoInventario('Para registrar la verificación, inicia sesión en este navegador y vuelve a escanear el QR.'); return; }
                try {
                    const respuesta = await solicitarApi('/inventario-fisico/verificar-qr/' + encodeURIComponent(codigo), { method: 'POST' });
                    if (vigente) setResultadoInventario(respuesta.mensaje || 'Activo verificado en la jornada actual.');
                } catch (err) { if (vigente) setResultadoInventario(err.message || 'No se pudo verificar el activo en la jornada actual.'); }
            })
            .catch((err) => { if (vigente) setError(err.message); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [codigo]);

    if (cargando) return <main className="activo-qr-pagina"><p>Consultando activo...</p></main>;
    if (error) return <main className="activo-qr-pagina"><h1>No se pudo consultar</h1><p role="alert">{error}</p></main>;
    if (!activo) return null;

    return (
        <main className="activo-qr-pagina">
            <section className="activo-qr-tarjeta">
                <p className="activo-qr-eyebrow">INVENTARIO TI · ETIQUETA QR</p>
                <h1>{activo.tipo} #{activo.id}</h1>
                <p className="activo-qr-subtitulo">{activo.marca} {activo.modelo}</p>
                <span className={`activo-qr-estado estado-${String(activo.estado_actual || '').toLowerCase()}`}>{activo.estado_actual || 'SIN ESTADO'}</span>
                {resultadoInventario && <p className="activo-qr-inventario" role="status">{resultadoInventario}</p>}
                <dl>
                    <div><dt>Serie</dt><dd>{activo.serie || 'No registrada'}</dd></div>
                    <div><dt>Código patrimonial</dt><dd>{activo.codigo_patrimonial || 'No registrado'}</dd></div>
                    {activo.imei && <div><dt>IMEI</dt><dd>{activo.imei}</dd></div>}
                    <div><dt>Ubicación</dt><dd>{activo.ubicacion || 'Sin ubicación registrada'}</dd></div>
                    <div><dt>Colaborador</dt><dd>{activo.colaborador_asignado || 'Sin colaborador asignado'}</dd></div>
                    {activo.nro_contrato && <div><dt>Contrato</dt><dd>{activo.nro_contrato}</dd></div>}
                    {activo.serie_equipo_principal && <div><dt>Equipo principal</dt><dd>Serie {activo.serie_equipo_principal}</dd></div>}
                </dl>
                {activo.perifericos?.length > 0 && <>
                    <h2>Periféricos vinculados</h2>
                    <ul>{activo.perifericos.map((p) => <li key={p.id}><strong>{p.tipo_periferico}</strong> — {p.marca} {p.modelo} · Serie: {p.serie || 'No registrada'} · {p.estado_actual}</li>)}</ul>
                </>}
            </section>
        </main>
    );
}
