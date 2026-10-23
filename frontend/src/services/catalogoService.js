import { extraerListaApi, solicitarApi } from './apiClient';

const obtenerCatalogo = async (ruta) => {
    const resultado = await solicitarApi(`/${ruta}`, {
        mensajeError: `No se pudo cargar el catálogo ${ruta}`
    });

    return extraerListaApi(
        resultado,
        `La API no devolvió el catálogo ${ruta} correctamente`
    );
};

export const obtenerCatalogosColaborador = async () => {
    const [
        cargos,
        areas,
        centros_costos,
        unidades_empresariales
    ] = await Promise.all([
        obtenerCatalogo('cargos'),
        obtenerCatalogo('areas'),
        obtenerCatalogo('centros-costos'),
        obtenerCatalogo('unidades-empresariales')
    ]);

    return {
        cargos,
        areas,
        centros_costos,
        unidades_empresariales
    };
};
