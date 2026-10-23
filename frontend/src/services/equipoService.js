import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/equipos';

export const listarTiposEquipo = async () => {
    const resultado = await solicitarApi(`${RUTA_API}/tipos`, {
        mensajeError: 'No se pudieron obtener los tipos de equipo'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un catálogo de tipos válido'
    );
};

export const listarEquipos = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener los equipos'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de equipos válido'
    );
};

export const obtenerEquipoPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener el equipo'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió un detalle de equipo válido'
    );
};

export const actualizarEquipo = async (id, equipo) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(equipo),
        mensajeError: 'No se pudo actualizar el equipo'
    });
};

export const registrarEquipo = async (equipo) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(equipo),
        mensajeError: 'No se pudo registrar el equipo'
    });
};

export const registrarEquiposLote = async (lote) => {
    return solicitarApi(`${RUTA_API}/lote`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(lote),
        mensajeError: 'No se pudo registrar el lote de equipos'
    });
};

export const validarImportacionEquipos = async (carga) => {
    const resultado = await solicitarApi(`${RUTA_API}/importar/validar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(carga),
        mensajeError: 'No se pudo validar el archivo de equipos'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió una validación de equipos válida'
    );
};

export const importarEquipos = async (carga) => solicitarApi(
    `${RUTA_API}/importar`,
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(carga),
        mensajeError: 'No se pudieron importar los equipos'
    }
);

export const listarPerifericosEquipo = async (equipoId) => {
    const resultado = await solicitarApi(
        `${RUTA_API}/${equipoId}/perifericos`,
        {
            mensajeError: 'No se pudieron obtener los periféricos'
        }
    );

    return extraerListaApi(
        resultado,
        'La API no devolvió una lista de periféricos válida'
    );
};

export const reemplazarPerifericoEquipo = async (
    equipoId,
    tipo,
    periferico,
    vinculoId = null
) => solicitarApi(
    `${RUTA_API}/${equipoId}/perifericos/${encodeURIComponent(tipo)}${vinculoId ? `/${vinculoId}` : ''}`,
    {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(periferico),
        mensajeError: 'No se pudo guardar el periférico'
    }
);

export const desvincularPerifericoEquipo = async (equipoId, tipo, vinculoId = null) =>
    solicitarApi(
        `${RUTA_API}/${equipoId}/perifericos/${encodeURIComponent(tipo)}${vinculoId ? `/${vinculoId}` : ''}`,
        {
            method: 'DELETE',
            mensajeError: 'No se pudo desvincular el periférico'
        }
    );

export const listarPerifericosDisponibles = async (tipo) => {
    const resultado = await solicitarApi(
        `${RUTA_API}/perifericos-disponibles/${encodeURIComponent(tipo)}`,
        { mensajeError: 'No se pudieron obtener los periféricos libres' }
    );
    return extraerListaApi(resultado, 'La API no devolvió una lista válida de periféricos libres');
};
