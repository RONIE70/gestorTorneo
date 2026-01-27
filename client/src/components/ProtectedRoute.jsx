import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProtectedRoute = ({ children, rolesPermitidos = [] }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [perfil, setPerfil] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const verificarSesion = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (!session) {
                    setUser(null);
                    setLoading(false);
                    return;
                }

                setUser(session.user);

                const { data: profile } = await supabase
                    .from('perfiles')
                    .select('rol')
                    .eq('id', session.user.id)
                    .maybeSingle();

                setPerfil(profile);
            } catch (error) {
                console.error("Error en validación:", error);
            } finally {
                setLoading(false);
            }
        };

        verificarSesion();
    }, []);

    // 1. MIENTRAS CARGA: No redireccionar, mostrar pantalla de espera
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white animate-pulse font-black uppercase tracking-widest italic">
                    Validando Credenciales...
                </div>
            </div>
        );
    }

    // 2. SI NO HAY USUARIO: Al login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. SI HAY USUARIO PERO EL ROL NO COINCIDE: Al Dashboard
    if (rolesPermitidos.length > 0 && (!perfil || !rolesPermitidos.includes(perfil.rol))) {
        console.warn("Acceso denegado: Rol insuficiente");
        return <Navigate to="/" replace />;
    }

    // 4. TODO OK: Renderiza la página
    return children;
};

export default ProtectedRoute;