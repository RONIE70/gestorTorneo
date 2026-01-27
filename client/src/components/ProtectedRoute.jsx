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

    // 1. MIENTRAS CARGA: Pantalla de espera
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white animate-pulse font-black uppercase tracking-widest italic">
                    Validando Credenciales...
                </div>
            </div>
        );
    }

    // 2. CASO: NO HAY SESIÓN (Usuario anónimo)
    // Se lo manda al login porque no sabemos quién es.
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. CASO: HAY SESIÓN PERO EL ROL NO ES PERMITIDO
    // El usuario está logueado pero intenta entrar a un área que no le corresponde.
    const tienePermiso = rolesPermitidos.length === 0 || (perfil && rolesPermitidos.includes(perfil.rol));
    const esSuperAdmin = perfil?.rol === 'superadmin';

    if (!tienePermiso && !esSuperAdmin) {
        // Disparamos el aviso
        alert("⚠️ Acceso Restringido: Tu perfil no tiene permisos para esta área.");
        // Lo devolvemos al Dashboard sin cerrar su sesión
        return <Navigate to="/" replace />;
    }

    // 4. TODO OK: Renderiza la página solicitada
    return children;
};

export default ProtectedRoute;