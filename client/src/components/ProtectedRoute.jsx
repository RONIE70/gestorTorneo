import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProtectedRoute = ({ children, rolRequerido, rolesPermitidos = [] }) => {
    const [loading, setLoading] = useState(true);
    const [autorizado, setAutorizado] = useState(false);

    useEffect(() => {
        const verificarAcceso = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (!session) {
                    setAutorizado(false);
                    setLoading(false);
                    return;
                }

                const { data: perfil } = await supabase
                    .from('perfiles')
                    .select('rol')
                    .eq('id', session.user.id)
                    .single();

                if (!perfil) {
                    setAutorizado(false);
                } else {
                    // Verificamos: 
                    // 1. Es Superadmin (Dios)
                    // 2. Es el rol específico requerido
                    // 3. El rol está en la lista de permitidos
                    const tieneRolEspecifico = rolRequerido && perfil.rol === rolRequerido;
                    const estaEnLista = rolesPermitidos.length > 0 && rolesPermitidos.includes(perfil.rol);
                    const esSuperAdmin = perfil.rol === 'superadmin';

                    if (esSuperAdmin || tieneRolEspecifico || estaEnLista) {
                        setAutorizado(true);
                    } else {
                        setAutorizado(false);
                    }
                }
            } catch (error) {
                console.error("Error en ProtectedRoute:", error);
                setAutorizado(false);
            } finally {
                setLoading(false);
            }
        };

        verificarAcceso();
    }, [rolRequerido, rolesPermitidos]);

    if (loading) return (
        <div className="bg-slate-950 min-h-screen flex items-center justify-center text-white italic uppercase font-black tracking-widest animate-pulse">
            Verificando Credenciales...
        </div>
    );

    // Si no está autorizado, lo mandamos al Dashboard (/) en lugar del login directo
    // para que vea que la tarjeta está bloqueada.
    if (!autorizado) return <Navigate to="/" replace />;

    return children;
};

export default ProtectedRoute;