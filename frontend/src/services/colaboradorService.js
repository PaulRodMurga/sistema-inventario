import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/colaboradores';

export const listarColaboradores = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener los colaboradores'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de colaboradores válido'
    );
};

export const registrarColaborador = async (
    colaborador
) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(colaborador),
        mensajeError: 'No se pudo registrar el colaborador'
    });
};

export const obtenerColaboradorPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener el colaborador'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió un detalle de colaborador válido'
    );
};

export const actualizarColaborador = async (
    id,
    colaborador
) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(colaborador),
        mensajeError: 'No se pudo actualizar el colaborador'
    });
};

export const validarImportacionColaboradores = async (carga) => {
    const resultado = await solicitarApi(`${RUTA_API}/importar/validar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(carga),
        mensajeError: 'No se pudo validar el archivo de colaboradores'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió una validación de colaboradores válida'
    );
};

export const importarColaboradores = async (carga) => solicitarApi(
    `${RUTA_API}/importar`,
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(carga),
        mensajeError: 'No se pudieron importar los colaboradores'
    }
);
