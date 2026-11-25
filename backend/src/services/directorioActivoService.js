const URL_VALIDAR_CUENTA_POR_DEFECTO = 'https://sap30003.distriluz.com.pe:60000/ActiveDirectory/Api/ActiveDirectory/ValidarDato';

class ErrorDirectorioActivo extends Error {
    constructor(mensaje, estadoHttp = 502) {
        super(mensaje);
        this.name = 'ErrorDirectorioActivo';
        this.estadoHttp = estadoHttp;
    }
}

const validarCuentaDirectorioActivo = async (
    usuario,
    clave,
    configuracion
) => {
    const apiUrl = configuracion?.url || URL_VALIDAR_CUENTA_POR_DEFECTO;
    const key = configuracion?.key;
    const sistema = configuracion?.sistema || '1';
    const timeoutMs = configuracion?.timeoutMs || 10000;

    if (typeof key !== 'string' || !key.trim()) {
        throw new ErrorDirectorioActivo(
            'El servicio de autenticación corporativa no está configurado',
            503
        );
    }

    let url;
    try {
        url = new URL(apiUrl);
    } catch {
        throw new ErrorDirectorioActivo(
            'La dirección del servicio de autenticación no es válida',
            503
        );
    }

    if (url.protocol !== 'https:') {
        throw new ErrorDirectorioActivo(
            'El servicio de autenticación debe utilizar HTTPS',
            503
        );
    }

    let respuesta;
    try {
        respuesta = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ADUser: usuario,
                ADPassword: clave,
                Sistema: String(sistema),
                Key: key
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch {
        throw new ErrorDirectorioActivo(
            'No fue posible comunicarse con el servicio de Active Directory',
            502
        );
    }

    if (!respuesta.ok) {
        throw new ErrorDirectorioActivo(
            'El servicio de Active Directory no está disponible temporalmente',
            502
        );
    }

    let resultado;
    try {
        resultado = await respuesta.json();
    } catch {
        throw new ErrorDirectorioActivo(
            'Active Directory devolvió una respuesta inválida',
            502
        );
    }

    const autenticacion = resultado?.getAuth;
    const cuentaAD = resultado?.getUser?.CargaUsuario;
    const codigoAD = typeof cuentaAD?.codigo === 'string'
        ? cuentaAD.codigo.trim().toLowerCase()
        : '';

    if (
        autenticacion?.resultAuth !== true ||
        autenticacion?.codResult !== 'A000' ||
        cuentaAD?.activo !== true ||
        codigoAD !== String(usuario).trim().toLowerCase()
    ) {
        return null;
    }

    const nombres = typeof cuentaAD.nombres === 'string'
        ? cuentaAD.nombres.trim()
        : '';
    const apellidos = typeof cuentaAD.apellidos === 'string'
        ? cuentaAD.apellidos.trim()
        : '';

    return Object.freeze({
        codigo: cuentaAD.codigo.trim(),
        nombres,
        apellidos,
        nombreCompleto: [nombres, apellidos].filter(Boolean).join(' ').slice(0, 120),
        idAD: typeof cuentaAD.idAD === 'string' ? cuentaAD.idAD : null,
        activo: true
    });
};

module.exports = {
    ErrorDirectorioActivo,
    validarCuentaDirectorioActivo
};
