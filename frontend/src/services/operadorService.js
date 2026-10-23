import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/operadores';

// ==========================================
// LISTAR OPERADORES
// ==========================================
export const listarOperadores = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudo completar la consulta de operadores'
    });

    return extraerListaApi(
        resultado,
        'La respuesta no contiene una lista de operadores'
    );
};

// ==========================================
// OBTENER OPERADOR POR ID
// ==========================================
export const obtenerOperadorPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener el operador'
    });

    return extraerObjetoApi(
        resultado,
        'La respuesta no contiene los datos del operador'
    );
};

export const registrarOperador = async (operador) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(operador),
        mensajeError: 'No se pudo registrar el operador'
    });
};

export const actualizarOperador = async (id, operador) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(operador),
        mensajeError: 'No se pudo actualizar el operador'
    });
};
