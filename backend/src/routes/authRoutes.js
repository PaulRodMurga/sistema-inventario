const express = require('express');

const {
    cerrarSesion,
    iniciarSesion,
    obtenerSesion
} = require('../controllers/authController');
const {
    requiereAutenticacion
} = require('../middleware/autenticacion');

const router = express.Router();

// Límite básico por IP para dificultar intentos automatizados de acceso.
// En despliegues con varias instancias, usar un almacén compartido (p. ej. Redis).
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const MAX_SOLICITUDES_LOGIN = 10;
const solicitudesLogin = new Map();

const limitarIntentosLogin = (req, res, next) => {
    const ahora = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'ip-desconocida';
    let registro = solicitudesLogin.get(ip);

    if (!registro || ahora >= registro.venceEn) {
        registro = {
            cantidad: 0,
            venceEn: ahora + VENTANA_LOGIN_MS
        };
    }

    registro.cantidad += 1;
    solicitudesLogin.set(ip, registro);

    // Limpia registros vencidos para evitar crecimiento indefinido del mapa.
    for (const [ipRegistrada, datos] of solicitudesLogin) {
        if (ahora >= datos.venceEn) {
            solicitudesLogin.delete(ipRegistrada);
        }
    }

    res.set('RateLimit-Limit', String(MAX_SOLICITUDES_LOGIN));
    res.set(
        'RateLimit-Remaining',
        String(Math.max(0, MAX_SOLICITUDES_LOGIN - registro.cantidad))
    );

    if (registro.cantidad > MAX_SOLICITUDES_LOGIN) {
        res.set(
            'Retry-After',
            String(Math.max(1, Math.ceil((registro.venceEn - ahora) / 1000)))
        );

        return res.status(429).json({
            success: false,
            mensaje: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde'
        });
    }

    return next();
};

router.post('/login', limitarIntentosLogin, iniciarSesion);
router.get('/sesion', requiereAutenticacion, obtenerSesion);
router.post('/logout', requiereAutenticacion, cerrarSesion);

module.exports = router;
