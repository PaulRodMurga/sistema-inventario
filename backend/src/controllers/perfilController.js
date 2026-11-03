const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const { validarNombrePersona } = require('../utils/validacionUsuario');

const DIRECTORIO_FOTOS = path.resolve(__dirname, '../../uploads/perfiles');
const RUTA_PUBLICA_FOTOS = '/uploads/perfiles';

const detectarFormatoImagen = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

    if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return { extension: 'jpg', mime: 'image/jpeg' };
    }

    if (
        buffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
    ) {
        return { extension: 'png', mime: 'image/png' };
    }

    if (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return { extension: 'webp', mime: 'image/webp' };
    }

    return null;
};

const obtenerPerfilDesdeBD = async (usuarioId) => {
    const [filas] = await pool.query(
        `
        SELECT
            u.id,
            u.nombre,
            u.usuario,
            u.rol,
            p.foto_perfil
        FROM usuario u
        LEFT JOIN usuario_perfil p
            ON p.usuario_id = u.id
        WHERE u.id = ?
        LIMIT 1
        `,
        [usuarioId]
    );

    return filas[0] || null;
};

const responderError = (res, error, mensaje) => {
    console.error(mensaje, error);
    return res.status(500).json({
        success: false,
        mensaje
    });
};

const eliminarArchivoFoto = async (rutaPublica) => {
    if (
        typeof rutaPublica !== 'string' ||
        !rutaPublica.startsWith(`${RUTA_PUBLICA_FOTOS}/`)
    ) {
        return;
    }

    const nombre = path.basename(rutaPublica);
    if (!nombre || nombre !== rutaPublica.slice(RUTA_PUBLICA_FOTOS.length + 1)) {
        return;
    }

    try {
        await fs.unlink(path.join(DIRECTORIO_FOTOS, nombre));
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn('No se pudo eliminar una foto de perfil anterior:', error);
        }
    }
};

const obtenerPerfil = async (req, res) => {
    try {
        const perfil = await obtenerPerfilDesdeBD(req.usuario.id);

        if (!perfil) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontró el perfil del usuario'
            });
        }

        return res.json({ success: true, data: perfil });
    } catch (error) {
        return responderError(
            res,
            error,
            'No se pudo obtener el perfil. Verifica que esté instalada la tabla usuario_perfil'
        );
    }
};

const actualizarNombrePerfil = async (req, res) => {
    const cuerpo = req.body;

    if (
        !cuerpo ||
        typeof cuerpo !== 'object' ||
        Array.isArray(cuerpo) ||
        Object.keys(cuerpo).length !== 1 ||
        !Object.hasOwn(cuerpo, 'nombre')
    ) {
        return res.status(400).json({
            success: false,
            mensaje: 'Envía únicamente el nuevo nombre del perfil'
        });
    }

    const nombre = validarNombrePersona(cuerpo.nombre);
    if (!nombre.valido) {
        return res.status(400).json({
            success: false,
            mensaje: nombre.mensaje
        });
    }

    try {
        await pool.query(
            'UPDATE usuario SET nombre = ? WHERE id = ?',
            [nombre.valor, req.usuario.id]
        );

        const perfil = await obtenerPerfilDesdeBD(req.usuario.id);
        if (!perfil) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontró el perfil del usuario'
            });
        }

        return res.json({
            success: true,
            mensaje: 'Nombre actualizado correctamente',
            data: perfil
        });
    } catch (error) {
        return responderError(
            res,
            error,
            'No se pudo actualizar el nombre del perfil'
        );
    }
};

const actualizarFotoPerfil = async (req, res) => {
    if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
        return res.status(400).json({
            success: false,
            mensaje: 'Selecciona una imagen para tu foto de perfil'
        });
    }

    const formato = detectarFormatoImagen(req.file.buffer);
    if (!formato) {
        return res.status(400).json({
            success: false,
            mensaje: 'La imagen no es válida. Utiliza JPG, PNG o WEBP'
        });
    }

    const nombreArchivo = `${randomUUID()}.${formato.extension}`;
    const rutaArchivo = path.join(DIRECTORIO_FOTOS, nombreArchivo);
    const rutaPublica = `${RUTA_PUBLICA_FOTOS}/${nombreArchivo}`;

    try {
        await fs.mkdir(DIRECTORIO_FOTOS, { recursive: true });
        await fs.writeFile(rutaArchivo, req.file.buffer, { flag: 'wx' });

        const [fotosAnteriores] = await pool.query(
            'SELECT foto_perfil FROM usuario_perfil WHERE usuario_id = ? LIMIT 1',
            [req.usuario.id]
        );
        const fotoAnterior = fotosAnteriores[0]?.foto_perfil || null;

        await pool.query(
            `
            INSERT INTO usuario_perfil (usuario_id, foto_perfil)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE foto_perfil = ?
            `,
            [req.usuario.id, rutaPublica, rutaPublica]
        );

        if (fotoAnterior && fotoAnterior !== rutaPublica) {
            await eliminarArchivoFoto(fotoAnterior);
        }

        const perfil = await obtenerPerfilDesdeBD(req.usuario.id);
        return res.json({
            success: true,
            mensaje: 'Foto de perfil actualizada correctamente',
            data: perfil
        });
    } catch (error) {
        await fs.unlink(rutaArchivo).catch(() => {});
        return responderError(
            res,
            error,
            'No se pudo guardar la foto de perfil. Verifica que esté instalada la tabla usuario_perfil'
        );
    }
};

const eliminarFotoPerfil = async (req, res) => {
    try {
        const [filas] = await pool.query(
            'SELECT foto_perfil FROM usuario_perfil WHERE usuario_id = ? LIMIT 1',
            [req.usuario.id]
        );

        await pool.query(
            'UPDATE usuario_perfil SET foto_perfil = NULL WHERE usuario_id = ?',
            [req.usuario.id]
        );

        if (filas[0]?.foto_perfil) {
            await eliminarArchivoFoto(filas[0].foto_perfil);
        }

        const perfil = await obtenerPerfilDesdeBD(req.usuario.id);
        return res.json({
            success: true,
            mensaje: 'Foto de perfil eliminada correctamente',
            data: perfil
        });
    } catch (error) {
        return responderError(
            res,
            error,
            'No se pudo eliminar la foto de perfil. Verifica que esté instalada la tabla usuario_perfil'
        );
    }
};

module.exports = {
    actualizarFotoPerfil,
    actualizarNombrePerfil,
    eliminarFotoPerfil,
    obtenerPerfil
};
