import { useState } from 'react';
import {
    LockKeyhole,
    LogIn,
    MonitorSmartphone,
    UserRound
} from 'lucide-react';

import './LoginPage.css';
import { iniciarSesion } from '../services/authService';

function LoginPage({ onAutenticado }) {
    const [formulario, setFormulario] = useState({
        usuario: '',
        clave: ''
    });
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const actualizar = (evento) => {
        const { name, value } = evento.target;
        setFormulario((anterior) => ({
            ...anterior,
            [name]: value
        }));
    };

    const enviar = async (evento) => {
        evento.preventDefault();
        if (cargando) return;

        setCargando(true);
        setError('');

        try {
            const usuario = await iniciarSesion(
                formulario.usuario.trim().toLowerCase(),
                formulario.clave
            );

            onAutenticado(usuario);
        } catch (error) {
            setError(error.message || 'No se pudo iniciar sesión');
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="login-pagina">
            <section className="login-tarjeta" aria-labelledby="login-titulo">
                <div className="login-marca">
                    <div className="login-logo" aria-hidden="true">
                        <MonitorSmartphone size={30} />
                    </div>

                    <div>
                        <strong>Inventario TI</strong>
                        <span>Control de equipos</span>
                    </div>
                </div>

                <div className="login-encabezado">
                    <h1 id="login-titulo">Iniciar sesión</h1>
                    <p>Ingresa con tu cuenta asignada por el administrador.</p>
                </div>

                <form onSubmit={enviar}>
                    {error && (
                        <div className="login-error" role="alert">
                            {error}
                        </div>
                    )}

                    <label className="login-campo">
                        <span>Usuario</span>
                        <div>
                            <UserRound size={19} aria-hidden="true" />
                            <input
                                name="usuario"
                                type="text"
                                autoComplete="username"
                                minLength="3"
                                maxLength="60"
                                value={formulario.usuario}
                                onChange={actualizar}
                                disabled={cargando}
                                required
                                autoFocus
                            />
                        </div>
                    </label>

                    <label className="login-campo">
                        <span>Contraseña</span>
                        <div>
                            <LockKeyhole size={19} aria-hidden="true" />
                            <input
                                name="clave"
                                type="password"
                                autoComplete="current-password"
                                maxLength="128"
                                value={formulario.clave}
                                onChange={actualizar}
                                disabled={cargando}
                                required
                            />
                        </div>
                    </label>

                    <button
                        type="submit"
                        className="login-boton"
                        disabled={cargando}
                    >
                        <LogIn size={19} aria-hidden="true" />
                        {cargando ? 'Verificando...' : 'Ingresar'}
                    </button>
                </form>
            </section>
        </main>
    );
}

export default LoginPage;
