import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/contratos';

export const listarContratos = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener los contratos'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de contratos válido'
    );
};

export const obtenerContratoPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener el contrato'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió el detalle del contrato'
    );
};

export const registrarContrato = async (contrato) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contrato),
        mensajeError: 'No se pudo registrar el contrato'
    });
};

export const actualizarContrato = async (id, contrato) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contrato),
        mensajeError: 'No se pudo actualizar el contrato'
    });
};

export const actualizarGamasContrato = async (id, gamas) => {
    return solicitarApi(`${RUTA_API}/${id}/gamas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamas }),
        mensajeError: 'No se pudieron actualizar las gamas y tarifas'
    });
};

export const inhabilitarContrato = async (id) => {
    return solicitarApi(`${RUTA_API}/${id}/inhabilitar`, {
        method: 'PUT',
        mensajeError: 'No se pudo inhabilitar el contrato'
    });
};
