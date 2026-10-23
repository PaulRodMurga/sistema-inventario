const pool = require('../config/database');

const MAXIMO_COLABORADORES = 1000;
const ESTADOS = new Set(['ACTIVO', 'CESADO', 'EXTERNO']);

const normalizarClave = (valor) => String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const texto = (valor, maximo, obligatorio = false) => {
    const salida = valor === null || valor === undefined
        ? ''
        : String(valor).trim();

    if ((obligatorio && !salida) || salida.length > maximo) {
        return null;
    }

    return salida;
};

const normalizarCargaColaboradores = (cuerpo) => {
    const entradas = cuerpo?.colaboradores;
    const errores = [];
    const colaboradores = [];
    const codigos = new Map();
    const dnis = new Map();
    const agregar = (fila, campo, mensaje) => errores.push({
        hoja: 'Colaboradores',
        fila,
        campo,
        mensaje
    });

    if (!Array.isArray(entradas)) {
        agregar(null, 'archivo', 'La hoja Colaboradores no tiene una estructura válida');
        return { errores, colaboradores };
    }

    if (entradas.length === 0) {
        agregar(null, 'archivo', 'La hoja Colaboradores debe contener al menos un registro');
    }

    if (entradas.length > MAXIMO_COLABORADORES) {
        agregar(
            null,
            'archivo',
            `Solo se permiten ${MAXIMO_COLABORADORES} colaboradores por importación`
        );
    }

    entradas.slice(0, MAXIMO_COLABORADORES).forEach((entrada, indice) => {
        const fila = Number(entrada?.fila) || indice + 2;

        if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
            agregar(fila, 'fila', 'La fila no tiene una estructura válida');
            return;
        }

        const codigo = texto(entrada.codigo, 20, true);
        const apellidos = texto(entrada.apellidos, 100, true);
        const nombres = texto(entrada.nombres, 100, true);
        const dni = texto(entrada.dni, 15, true);
        const correo = texto(entrada.correo, 150);
        const cargo = texto(entrada.cargo, 100);
        const area = texto(entrada.area, 100);
        const centroCostos = texto(entrada.centro_costos, 150);
        const unidadEmpresarial = texto(entrada.unidad_empresarial, 150);
        const estado = normalizarClave(entrada.estado || 'ACTIVO');

        if (!codigo) agregar(fila, 'codigo', 'El código es obligatorio y admite hasta 20 caracteres');
        if (!apellidos) agregar(fila, 'apellidos', 'Los apellidos son obligatorios y admiten hasta 100 caracteres');
        if (!nombres) agregar(fila, 'nombres', 'Los nombres son obligatorios y admiten hasta 100 caracteres');
        if (!dni || !/^\d+$/.test(dni)) {
            agregar(fila, 'dni', 'El DNI es obligatorio, solo admite dígitos y un máximo de 15 caracteres');
        }
        if (correo === null) {
            agregar(fila, 'correo', 'El correo admite hasta 150 caracteres');
        } else if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            agregar(fila, 'correo', 'El correo no tiene un formato válido');
        }
        if (cargo === null) agregar(fila, 'cargo', 'El cargo supera la longitud permitida');
        if (area === null) agregar(fila, 'area', 'El área supera la longitud permitida');
        if (centroCostos === null) agregar(fila, 'centro_costos', 'El centro de costos supera la longitud permitida');
        if (unidadEmpresarial === null) agregar(fila, 'unidad_empresarial', 'La unidad empresarial supera la longitud permitida');
        if (!ESTADOS.has(estado)) agregar(fila, 'estado', 'El estado debe ser ACTIVO, CESADO o EXTERNO');

        if (codigo) {
            const claveCodigo = normalizarClave(codigo);
            if (codigos.has(claveCodigo)) {
                agregar(fila, 'codigo', `El código está repetido (también aparece en la fila ${codigos.get(claveCodigo)})`);
            } else {
                codigos.set(claveCodigo, fila);
            }
        }

        if (dni && /^\d+$/.test(dni)) {
            if (dnis.has(dni)) {
                agregar(fila, 'dni', `El DNI está repetido (también aparece en la fila ${dnis.get(dni)})`);
            } else {
                dnis.set(dni, fila);
            }
        }

        colaboradores.push({
            _fila: fila,
            codigo: codigo || '',
            apellidos: apellidos || '',
            nombres: nombres || '',
            dni: dni || '',
            correo: correo || '',
            cargo: cargo || '',
            area: area || '',
            centro_costos: centroCostos || '',
            unidad_empresarial: unidadEmpresarial || '',
            estado,
            cargo_id: null,
            area_id: null,
            centro_costos_id: null,
            unidad_empresarial_id: null
        });
    });

    return { errores, colaboradores };
};

const completarValidacionBaseDatos = async (baseDatos, resultado) => {
    const agregar = (fila, campo, mensaje) => resultado.errores.push({
        hoja: 'Colaboradores',
        fila,
        campo,
        mensaje
    });
    const [cargos, areas, centros, unidades, existentes] = await Promise.all([
        baseDatos.query("SELECT id, nombre FROM cargo WHERE estado = 'ACTIVO'"),
        baseDatos.query("SELECT id, nombre FROM area WHERE estado = 'ACTIVO'"),
        baseDatos.query("SELECT id, codigo, nombre FROM centro_costos WHERE estado = 'ACTIVO'"),
        baseDatos.query("SELECT id, nombre FROM unidad_empresarial WHERE estado = 'ACTIVO'"),
        baseDatos.query('SELECT codigo, dni FROM colaborador')
    ]);
    const mapa = (filas, claves) => {
        const salida = new Map();
        for (const fila of filas) {
            for (const clave of claves) {
                if (fila[clave]) salida.set(normalizarClave(fila[clave]), Number(fila.id));
            }
        }
        return salida;
    };
    const mapas = {
        cargo: mapa(cargos[0], ['nombre']),
        area: mapa(areas[0], ['nombre']),
        centro_costos: mapa(centros[0], ['codigo', 'nombre']),
        unidad_empresarial: mapa(unidades[0], ['nombre'])
    };
    const codigosUsados = new Set(
        existentes[0].map((registro) => normalizarClave(registro.codigo))
    );
    const dnisUsados = new Set(
        existentes[0].map((registro) => String(registro.dni))
    );

    for (const colaborador of resultado.colaboradores) {
        const relaciones = [
            ['cargo', 'cargo_id', 'cargo'],
            ['area', 'area_id', 'área'],
            ['centro_costos', 'centro_costos_id', 'centro de costos'],
            ['unidad_empresarial', 'unidad_empresarial_id', 'unidad empresarial']
        ];

        for (const [campo, campoId, etiqueta] of relaciones) {
            if (!colaborador[campo]) continue;

            colaborador[campoId] = mapas[campo].get(
                normalizarClave(colaborador[campo])
            ) || null;

            if (!colaborador[campoId]) {
                agregar(
                    colaborador._fila,
                    campo,
                    `No existe un ${etiqueta} activo con ese nombre o código`
                );
            }
        }

        if (codigosUsados.has(normalizarClave(colaborador.codigo))) {
            agregar(colaborador._fila, 'codigo', 'El código ya está registrado');
        }

        if (dnisUsados.has(colaborador.dni)) {
            agregar(colaborador._fila, 'dni', 'El DNI ya está registrado');
        }
    }

    return resultado;
};

const prepararImportacion = async (baseDatos, cuerpo) => {
    const resultado = normalizarCargaColaboradores(cuerpo);

    if (resultado.colaboradores.length > 0) {
        await completarValidacionBaseDatos(baseDatos, resultado);
    }

    return resultado;
};

const resumen = (resultado) => ({
    valido: resultado.errores.length === 0,
    cantidad_colaboradores: resultado.colaboradores.length,
    errores: resultado.errores
});

const validarImportacionColaboradores = async (req, res) => {
    try {
        const resultado = await prepararImportacion(pool, req.body);
        return res.json({ success: true, data: resumen(resultado) });
    } catch (error) {
        console.error('Error al validar importación de colaboradores:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'No se pudo validar la importación de colaboradores'
        });
    }
};

const importarColaboradores = async (req, res) => {
    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        const resultado = await prepararImportacion(conexion, req.body);

        if (resultado.errores.length > 0) {
            await conexion.rollback();
            return res.status(422).json({
                success: false,
                mensaje: 'Corrige los errores del archivo antes de importar',
                data: resumen(resultado)
            });
        }

        const ids = [];

        for (const colaborador of resultado.colaboradores) {
            const [registro] = await conexion.query(`
                INSERT INTO colaborador (
                    codigo,
                    apellidos,
                    nombres,
                    dni,
                    correo,
                    cargo_id,
                    area_id,
                    centro_costos_id,
                    unidad_empresarial_id,
                    estado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                colaborador.codigo,
                colaborador.apellidos,
                colaborador.nombres,
                colaborador.dni,
                colaborador.correo,
                colaborador.cargo_id,
                colaborador.area_id,
                colaborador.centro_costos_id,
                colaborador.unidad_empresarial_id,
                colaborador.estado
            ]);
            ids.push(Number(registro.insertId));
        }

        await conexion.commit();
        return res.status(201).json({
            success: true,
            mensaje: `${ids.length} colaboradores importados correctamente`,
            id: ids[0],
            data: {
                cantidad_colaboradores: ids.length,
                ids
            }
        });
    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al importar colaboradores:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'Un código o DNI ya fue registrado'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'No se pudieron importar los colaboradores'
        });
    } finally {
        conexion?.release();
    }
};

module.exports = {
    completarValidacionBaseDatos,
    importarColaboradores,
    normalizarCargaColaboradores,
    validarImportacionColaboradores
};
