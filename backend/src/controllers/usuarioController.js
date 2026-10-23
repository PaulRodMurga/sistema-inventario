const pool = require('../config/database');
const { generarHashClave } = require('../utils/criptografia');
const {
    validarClaveSegura,
    validarEstadoUsuario,
    validarIdUsuario,
    validarNombreCuenta,
    validarNombrePersona,
    validarRolUsuario
} = require('../utils/validacionUsuario');

const CAMPOS_EDITABLES = new Set(['nombre', 'rol', 'estado']);
const CAMPOS_REGISTRO = new Set([
    'nombre',
    'usuario',
    'clave',
    'rol',
    'estado'
]);

const responderErrorSql = (res, error, mensaje) => {
    if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            mensaje: 'Ya existe una cuenta con ese nombre de usuario'
        });
    }

    console.error(mensaje, error);

    return res.status(500).json({
        success: false,
        mensaje
    });
};

const crearControladorUsuario = ({
    baseDatos = pool,
    crearHash = generarHashClave
} = {}) => {
    const listarUsuarios = async (req, res) => {
        try {
            const [filas] = await baseDatos.query(`
                SELECT
                    id,
                    nombre,
                    usuario,
                    rol,
                    estado,
                    intentos_fallidos,
                    bloqueado_hasta,
                    ultimo_acceso,
                    creado_en,
                    actualizado_en
                FROM usuario
                ORDER BY
                    estado = 'ACTIVO' DESC,
                    nombre,
                    id
            `);

            return res.json({
                success: true,
                cantidad: filas.length,
                data: filas
            });
        } catch (error) {
            return responderErrorSql(
                res,
                error,
                'No se pudieron obtener los usuarios'
            );
        }
    };

    const registrarUsuario = async (req, res) => {
        const cuerpo = req.body;

        if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los datos del usuario no son válidos'
            });
        }

        if (Object.keys(cuerpo).some((campo) => !CAMPOS_REGISTRO.has(campo))) {
            return res.status(400).json({
                success: false,
                mensaje: 'El registro contiene campos no permitidos'
            });
        }

        const nombre = validarNombrePersona(cuerpo.nombre);
        const usuario = validarNombreCuenta(cuerpo.usuario);
        const rol = validarRolUsuario(cuerpo.rol);
        const estado = validarEstadoUsuario(
            Object.hasOwn(cuerpo, 'estado') ? cuerpo.estado : 'ACTIVO'
        );
        const clave = validarClaveSegura(cuerpo.clave);
        const validaciones = [nombre, usuario, rol, estado, clave];
        const invalida = validaciones.find((resultado) => !resultado.valido);

        if (invalida) {
            return res.status(400).json({
                success: false,
                mensaje: invalida.mensaje
            });
        }

        try {
            const claveHash = await crearHash(clave.valor);
            const [resultado] = await baseDatos.query(
                `
                INSERT INTO usuario (
                    nombre,
                    usuario,
                    clave_hash,
                    rol,
                    estado
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    nombre.valor,
                    usuario.valor,
                    claveHash,
                    rol.valor,
                    estado.valor
                ]
            );

            return res.status(201).json({
                success: true,
                mensaje: 'Usuario registrado correctamente',
                data: { id: Number(resultado.insertId) }
            });
        } catch (error) {
            return responderErrorSql(
                res,
                error,
                'No se pudo registrar el usuario'
            );
        }
    };

    const actualizarUsuario = async (req, res) => {
        const id = validarIdUsuario(req.params?.id);
        const cuerpo = req.body;

        if (!id.valido) {
            return res.status(400).json({
                success: false,
                mensaje: id.mensaje
            });
        }

        if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los datos del usuario no son válidos'
            });
        }

        const campos = Object.keys(cuerpo);

        if (
            campos.length === 0 ||
            campos.some((campo) => !CAMPOS_EDITABLES.has(campo))
        ) {
            return res.status(400).json({
                success: false,
                mensaje: 'Indica al menos un campo editable válido'
            });
        }

        const cambios = [];
        const parametros = [];

        if (Object.hasOwn(cuerpo, 'nombre')) {
            const nombre = validarNombrePersona(cuerpo.nombre);
            if (!nombre.valido) {
                return res.status(400).json({ success: false, mensaje: nombre.mensaje });
            }
            cambios.push('nombre = ?');
            parametros.push(nombre.valor);
        }

        if (Object.hasOwn(cuerpo, 'rol')) {
            const rol = validarRolUsuario(cuerpo.rol);
            if (!rol.valido) {
                return res.status(400).json({ success: false, mensaje: rol.mensaje });
            }
            cambios.push('rol = ?');
            parametros.push(rol.valor);
        }

        if (Object.hasOwn(cuerpo, 'estado')) {
            const estado = validarEstadoUsuario(cuerpo.estado);
            if (!estado.valido) {
                return res.status(400).json({ success: false, mensaje: estado.mensaje });
            }
            cambios.push('estado = ?');
            parametros.push(estado.valor);
        }

        const conexion = await baseDatos.getConnection().catch((error) => {
            console.error('No se pudo iniciar la actualización del usuario:', error);
            return null;
        });

        if (!conexion) {
            return res.status(500).json({
                success: false,
                mensaje: 'No se pudo actualizar el usuario'
            });
        }

        let conexionDescartada = false;

        try {
            await conexion.beginTransaction();

            const [filas] = await conexion.query(
                `
                SELECT id, rol, estado
                FROM usuario
                WHERE id = ?
                FOR UPDATE
                `,
                [id.valor]
            );

            if (filas.length === 0) {
                await conexion.rollback();
                return res.status(404).json({
                    success: false,
                    mensaje: 'Usuario no encontrado'
                });
            }

            const actual = filas[0];
            const nuevoRol = Object.hasOwn(cuerpo, 'rol')
                ? validarRolUsuario(cuerpo.rol).valor
                : actual.rol;
            const nuevoEstado = Object.hasOwn(cuerpo, 'estado')
                ? validarEstadoUsuario(cuerpo.estado).valor
                : actual.estado;
            const dejaDeSerAdminActivo =
                actual.rol === 'ADMINISTRADOR' &&
                actual.estado === 'ACTIVO' &&
                (
                    nuevoRol !== 'ADMINISTRADOR' ||
                    nuevoEstado !== 'ACTIVO'
                );

            if (
                Number(req.usuario?.id) === id.valor &&
                dejaDeSerAdminActivo
            ) {
                await conexion.rollback();
                return res.status(409).json({
                    success: false,
                    mensaje: 'No puedes quitar tu propio acceso de administrador'
                });
            }

            if (dejaDeSerAdminActivo) {
                const [conteo] = await conexion.query(
                    `
                    SELECT COUNT(*) AS cantidad
                    FROM usuario
                    WHERE rol = 'ADMINISTRADOR'
                      AND estado = 'ACTIVO'
                    FOR UPDATE
                    `
                );

                if (Number(conteo[0]?.cantidad || 0) <= 1) {
                    await conexion.rollback();
                    return res.status(409).json({
                        success: false,
                        mensaje: 'Debe permanecer al menos un administrador activo'
                    });
                }
            }

            await conexion.query(
                `UPDATE usuario SET ${cambios.join(', ')} WHERE id = ?`,
                [...parametros, id.valor]
            );

            const cambiaAcceso =
                nuevoRol !== actual.rol ||
                nuevoEstado !== actual.estado;

            if (cambiaAcceso) {
                await conexion.query(
                    'DELETE FROM sesion_usuario WHERE usuario_id = ?',
                    [id.valor]
                );
            }

            await conexion.commit();

            return res.json({
                success: true,
                mensaje: 'Usuario actualizado correctamente',
                data: { sesion_actual_revocada: false }
            });
        } catch (error) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error('No se pudo revertir la actualización:', errorRollback);
                conexion.destroy?.();
                conexionDescartada = true;
            }

            return responderErrorSql(
                res,
                error,
                'No se pudo actualizar el usuario'
            );
        } finally {
            if (!conexionDescartada) conexion.release();
        }
    };

    const restablecerClave = async (req, res) => {
        const id = validarIdUsuario(req.params?.id);
        const cuerpo = req.body;

        if (
            !cuerpo ||
            typeof cuerpo !== 'object' ||
            Array.isArray(cuerpo) ||
            Object.keys(cuerpo).length !== 1 ||
            !Object.hasOwn(cuerpo, 'clave')
        ) {
            return res.status(400).json({
                success: false,
                mensaje: 'Indica únicamente la nueva contraseña'
            });
        }

        const clave = validarClaveSegura(cuerpo.clave);

        if (!id.valido || !clave.valido) {
            return res.status(400).json({
                success: false,
                mensaje: !id.valido ? id.mensaje : clave.mensaje
            });
        }

        let conexion;
        let conexionDescartada = false;

        try {
            const claveHash = await crearHash(clave.valor);
            conexion = await baseDatos.getConnection();
            await conexion.beginTransaction();

            const [resultado] = await conexion.query(
                `
                UPDATE usuario
                SET
                    clave_hash = ?,
                    intentos_fallidos = 0,
                    bloqueado_hasta = NULL
                WHERE id = ?
                `,
                [claveHash, id.valor]
            );

            if (resultado.affectedRows === 0) {
                await conexion.rollback();
                return res.status(404).json({
                    success: false,
                    mensaje: 'Usuario no encontrado'
                });
            }

            await conexion.query(
                'DELETE FROM sesion_usuario WHERE usuario_id = ?',
                [id.valor]
            );
            await conexion.commit();

            return res.json({
                success: true,
                mensaje: 'Contraseña actualizada correctamente',
                data: {
                    sesion_actual_revocada:
                        Number(req.usuario?.id) === id.valor
                }
            });
        } catch (error) {
            if (conexion) {
                try {
                    await conexion.rollback();
                } catch (errorRollback) {
                    console.error('No se pudo revertir el cambio de clave:', errorRollback);
                    conexion.destroy?.();
                    conexionDescartada = true;
                }
            }

            return responderErrorSql(
                res,
                error,
                'No se pudo actualizar la contraseña'
            );
        } finally {
            if (conexion && !conexionDescartada) conexion.release();
        }
    };

    return {
        actualizarUsuario,
        listarUsuarios,
        registrarUsuario,
        restablecerClave
    };
};

module.exports = {
    crearControladorUsuario,
    ...crearControladorUsuario()
};
