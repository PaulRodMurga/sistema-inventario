const pool = require('../config/database');

const listarCatalogosColaborador = async (req, res) => {
    try {
        const [
            [cargos],
            [areas],
            [centrosCostos],
            [unidadesEmpresariales]
        ] = await Promise.all([
            pool.query(`
                SELECT id, nombre
                FROM cargo
                ORDER BY nombre
            `),

            pool.query(`
                SELECT id, nombre
                FROM area
                ORDER BY nombre
            `),

            pool.query(`
                SELECT id, nombre
                FROM centro_costos
                ORDER BY nombre
            `),

            pool.query(`
                SELECT id, nombre
                FROM unidad_empresarial
                ORDER BY nombre
            `)
        ]);

        res.json({
            success: true,
            data: {
                cargos,
                areas,
                centros_costos: centrosCostos,
                unidades_empresariales:
                    unidadesEmpresariales
            }
        });

    } catch (error) {
        console.error(
            'Error al listar catálogos:',
            error
        );

        res.status(500).json({
            success: false,
            mensaje:
                'Error al obtener los catálogos',
            error: error.message
        });
    }
};

module.exports = {
    listarCatalogosColaborador
};