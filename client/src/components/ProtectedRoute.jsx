import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProtectedRoute = ({ children, rolRequerido, rolesPermitidos }) => {
    const [loading, setLoading] = useState(true);
    const [autorizado, setAutorizado] = useState(false);

    useEffect(() => {
        const verificarAcceso = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                setAutorizado(false);
                setLoading(false);
                return;
            }

            // Consultamos el rol en la tabla perfiles
            const { data: perfil } = await supabase
                .from('perfiles')
                .select('rol')
                .eq('id', session.user.id)
                .single();

            // Si el rol coincide con lo que pide la ruta o es superadmin (acceso total)
            if (perfil?.rol === 'superadmin' || perfil?.rol === rolRequerido || rolesPermitidos.includes(perfil?.rol)) {
                setAutorizado(true);
            }

            setLoading(false);
        };

        verificarAcceso();
    }, [rolRequerido, rolesPermitidos]);

    if (loading) return <div className="bg-slate-950 min-h-screen flex items-center justify-center text-white">Verificando seguridad...</div>;

    if (!autorizado) return <Navigate to="/login" />;

    return children;
};

export default ProtectedRoute;