const CLAVE_TOKEN = 'inventario_token_sesion';
const EVENTO_SESION_VENCIDA = 'inventario:sesion-vencida';

const API_POR_DEFECTO = 'http://localhost:3000/api';

export const normalizarApiBase = (valor) => {
    const candidato = typeof valor === 'string'
        ? valor.trim()
        : '';

    if (!candidato) return API_POR_DEFECTO;

    if (
        !/^(https?:\/\/|\/)/i.test(candidato) ||
        /^\/\//.test(candidato) ||
        /[?#]/.test(candidato)
    ) {
        throw new Error(
            'VITE_API_URL debe ser una URL http(s) o una ruta absoluta sin parámetros'
        );
    }

    return candidato.length > 1
        ? candidato.replace(/\/+$/, '')
        : candidato;
};

export const API_BASE = normalizarApiBase(
    import.meta.env.VITE_API_URL
);

export const obtenerApiUrl = (ruta = '') => {
    const segmento = String(ruta || '')
        .trim()
        .replace(/^\/+/, '');

    if (!segmento) return API_BASE;

    const separador = API_BASE.endsWith('/') ? '' : '/';
    return `${API_BASE}${separador}${segmento}`;
};

export class ErrorApi extends Error {
    constructor(
        mensaje,
        {
            estadoHttp = 0,
            codigo = null,
            causa = null,
            datos = null
        } = {}
    ) {
        super(mensaje);
        this.name = 'ErrorApi';
        this.estadoHttp = estadoHttp;
        this.codigo = codigo;
        this.datos = datos;

        if (causa) this.cause = causa;
    }
}

const esObjetoRespuesta = (valor) =>
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor);

export const procesarRespuestaApi = async (
    respuesta,
    mensajePredeterminado = 'No se pudo completar la solicitud'
) => {
    const estadoHttp = Number(respuesta?.status || 0);
    const tipoContenido =
        respuesta?.headers?.get?.('content-type') || '';

    if (!tipoContenido.includes('application/json')) {
        throw new ErrorApi(
            'El backend no devolvió una respuesta JSON válida',
            { estadoHttp }
        );
    }

    let resultado;

    try {
        resultado = await respuesta.json();
    } catch (causa) {
        throw new ErrorApi(
            'El backend devolvió un JSON inválido',
            { estadoHttp, causa }
        );
    }

    if (!esObjetoRespuesta(resultado)) {
        throw new ErrorApi(
            'La API devolvió una estructura de respuesta inválida',
            { estadoHttp }
        );
    }

    if (!respuesta.ok || resultado.success === false) {
        const mensaje = typeof resultado.mensaje === 'string' &&
            resultado.mensaje.trim()
            ? resultado.mensaje.trim()
            : mensajePredeterminado;

        throw new ErrorApi(mensaje, {
            estadoHttp,
            codigo: resultado.codigo ?? null,
            datos: resultado.data ?? null
        });
    }

    return resultado;
};

export const extraerListaApi = (
    resultado,
    mensaje = 'La API no devolvió un listado válido'
) => {
    if (!Array.isArray(resultado?.data)) {
        throw new ErrorApi(mensaje);
    }

    return resultado.data;
};

export const extraerObjetoApi = (
    resultado,
    mensaje = 'La API no devolvió un detalle válido'
) => {
    if (!esObjetoRespuesta(resultado?.data)) {
        throw new ErrorApi(mensaje);
    }

    return resultado.data;
};

export const solicitarApi = async (
    ruta,
    {
        mensajeError = 'No se pudo completar la solicitud',
        ...opcionesFetch
    } = {}
) => {
    try {
        const respuesta = await fetch(
            obtenerApiUrl(ruta),
            opcionesFetch
        );

        return await procesarRespuestaApi(
            respuesta,
            mensajeError
        );
    } catch (error) {
        if (
            error instanceof ErrorApi ||
            error?.name === 'AbortError'
        ) {
            throw error;
        }

        throw new ErrorApi(
            'No se pudo conectar con el backend',
            { causa: error }
        );
    }
};

// localStorage permite que la sesión se comparta entre pestañas del mismo navegador.
// Se migra el token anterior de sessionStorage para no obligar a iniciar sesión otra vez.
export const obtenerTokenSesion = () => {
    const tokenCompartido = localStorage.getItem(CLAVE_TOKEN);
    if (tokenCompartido) return tokenCompartido;

    const tokenAnterior = sessionStorage.getItem(CLAVE_TOKEN);
    if (tokenAnterior) {
        localStorage.setItem(CLAVE_TOKEN, tokenAnterior);
        localStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_TOKEN);
        return tokenAnterior;
    }

    return null;
};

export const guardarTokenSesion = (token) => {
    if (
        typeof token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
        throw new Error('La API no devolvió una sesión válida');
    }

    localStorage.setItem(CLAVE_TOKEN, token);
    sessionStorage.removeItem(CLAVE_TOKEN);
};

export const eliminarTokenSesion = () => {
    sessionStorage.removeItem(CLAVE_TOKEN);
};

const perteneceALaApi = (entrada) => {
    try {
        const base = new URL(API_BASE, window.location.href);
        const url = new URL(
            typeof entrada === 'string' ? entrada : entrada.url,
            window.location.href
        );

        const coincideRuta = base.pathname === '/' ||
            url.pathname === base.pathname ||
            url.pathname.startsWith(`${base.pathname}/`);

        return url.origin === base.origin && coincideRuta;
    } catch {
        return false;
    }
};

const MARCA_CLIENTE = Symbol.for('inventario.cliente-http-configurado');

export const configurarClienteHttp = () => {
    if (window[MARCA_CLIENTE]) return;

    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async (entrada, opciones = {}) => {
        if (!perteneceALaApi(entrada)) {
            return fetchOriginal(entrada, opciones);
        }

        const token = obtenerTokenSesion();
        const headers = new Headers(
            opciones.headers ||
            (entrada instanceof Request ? entrada.headers : undefined)
        );

        if (token) headers.set('Authorization', `Bearer ${token}`);

        const respuesta = await fetchOriginal(entrada, {
            ...opciones,
            headers
        });

        if (
            respuesta.status === 401 &&
            token &&
            obtenerTokenSesion() === token
        ) {
            eliminarTokenSesion();
            window.dispatchEvent(new CustomEvent(EVENTO_SESION_VENCIDA));
        }

        return respuesta;
    };

    Object.defineProperty(window, MARCA_CLIENTE, {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false
    });
};

export { EVENTO_SESION_VENCIDA };
