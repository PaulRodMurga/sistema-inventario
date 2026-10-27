import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/actas';

// No mostrar ceros o "pendiente" si la API antigua/incompleta no envía detalles.
const validarActa = (acta) => {
    const contadores = ['cantidad_equipos', 'cantidad_devueltos',
        'cantidad_no_devueltos', 'cantidad_por_revisar', 'cantidad_incidencias'];
    if (!acta || !Number.isSafeInteger(acta.id) || !Array.isArray(acta.equipos) ||
        !contadores.every((campo) => Number.isInteger(acta[campo]) && acta[campo] >= 0) ||
        acta.cantidad_equipos !== acta.equipos.length ||
        acta.cantidad_equipos !== acta.cantidad_devueltos + acta.cantidad_no_devueltos + acta.cantidad_por_revisar ||
        !['SIN_EQUIPOS', 'PENDIENTE', 'PARCIAL', 'TOTAL', 'REVISAR'].includes(acta.estado_devolucion) ||
        !acta.equipos.every((equipo) => equipo && Number.isSafeInteger(equipo.detalle_id) &&
            ['SI', 'NO', 'REVISAR'].includes(equipo.devolucion_registrada))) {
        throw new Error('La API de actas devolvió datos incompletos. Verifica que aplicaste también la corrección del backend.');
    }
    return acta;
};

// ==========================================
// LISTAR ACTAS
// ==========================================
export const listarActas = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron cargar las actas'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de actas válido'
    ).map(validarActa);
};

// ==========================================
// OBTENER ACTA POR ID
// ==========================================
export const obtenerActaPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener el acta'
    });

    const acta = validarActa(extraerObjetoApi(
        resultado,
        'La API no devolvió un detalle de acta válido'
    ));
    if (acta.id !== Number(id)) throw new Error('El detalle recibido no corresponde al acta solicitada');
    return acta;
};


// Carga un PDF a un documento específico del acta.
export const subirDocumentoActa = async (id, tipo, archivo) => {
    if (!['firmas', 'devolucion'].includes(tipo)) {
        throw new Error('Tipo de documento no válido');
    }
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    const resultado = await solicitarApi(`${RUTA_API}/${id}/documentos/${tipo}`, {
        method: 'POST',
        body: formulario,
        mensajeError: 'No se pudo cargar el PDF'
    });
    return resultado;
};

// Abre el PDF mediante una petición autenticada.
export const abrirDocumentoActa = async (id, tipo) => {
    if (!['firmas', 'devolucion'].includes(tipo)) {
        throw new Error('Tipo de documento no válido');
    }
    const { obtenerApiUrl } = await import('./apiClient');
    const respuesta = await fetch(obtenerApiUrl(`${RUTA_API}/${id}/documentos/${tipo}`));
    if (!respuesta.ok) {
        let mensaje = 'No se pudo abrir el PDF';
        try {
            const datos = await respuesta.json();
            if (datos?.mensaje) mensaje = datos.mensaje;
        } catch {}
        throw new Error(mensaje);
    }
    const url = URL.createObjectURL(await respuesta.blob());
    const ventana = window.open(url, '_blank', 'noopener,noreferrer');
    if (!ventana) {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `acta-${id}-${tipo}.pdf`;
        enlace.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};
