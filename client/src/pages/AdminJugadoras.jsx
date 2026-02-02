import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient'; // Importante para el contexto de sesión

const AdminJugadoras = () => {
  const [jugadoras, setJugadoras] = useState([]);
  const [busquedaClub, setBusquedaClub] = useState('');
  const [cargando, setCargando] = useState(true);
  const [userOrgId, setUserOrgId] = useState(null); // <--- ESTADO PARA EL FILTRO SaaS

  // 1. OBTENER EL CONTEXTO DE LA LIGA (VITAL PARA SEGURIDAD)
  useEffect(() => {
    const obtenerContextoOrg = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('organizacion_id')
            .eq('id', session.user.id)
            .single();
          
          if (perfil) setUserOrgId(perfil.organizacion_id);
        }
      } catch (err) {
        console.error("Error obteniendo organización:", err.message);
      }
    };
    obtenerContextoOrg();
  }, []);

  // 2. FUNCIÓN DE CARGA FILTRADA POR ORGANIZACIÓN
  const obtenerJugadoras = useCallback(async () => {
    if (!userOrgId) return; // No disparamos la carga hasta tener el ID de la liga

    try {
      // Usamos directamente Supabase con el filtro de organización
      const { data, error } = await supabase
        .from('jugadoras')
        .select(`
          *,
          equipos:equipo_id(nombre)
        `)
        .eq('organizacion_id', userOrgId) // <--- ESTE ES EL FILTRO DE SEGURIDAD
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setJugadoras(data);
      setCargando(false);
    } catch (err) {
      console.error("Error al obtener jugadoras:", err);
      setCargando(false);
    }
  }, [userOrgId]); // Se activa cuando obtenemos el ID de la organización

  useEffect(() => {
    obtenerJugadoras();
  }, [obtenerJugadoras]);

  // 3. FUNCIÓN PARA APROBAR CON CONTEXTO
  const aprobar = async (id) => {
    try {
      // Actualizamos vía Supabase asegurando que la jugadora pertenece a nuestra liga
      const { error } = await supabase
        .from('jugadoras')
        .update({ verificacion_manual: false, habilitada: true })
        .eq('id', id)
        .eq('organizacion_id', userOrgId); // Doble validación por seguridad

      if (!error) {
        obtenerJugadoras(); 
      } else {
        alert("No se pudo completar la aprobación");
      }
    // eslint-disable-next-line no-unused-vars
    } catch (err) { 
      alert("Error al conectar con el servidor"); 
    }
  };

  // Filtro por Nombre o Club (Mejorado para usar el nombre del equipo si existe)
  const jugadorasFiltradas = jugadoras.filter(j => 
    j.apellido.toLowerCase().includes(busquedaClub.toLowerCase()) ||
    j.equipos?.nombre?.toLowerCase().includes(busquedaClub.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-blue-500 uppercase italic">Gestión de Jugadoras</h1>
            <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Habilitaciones Pendientes</p>
          </div>
          <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700">
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 ml-2">Buscar por Apellido o Club</label>
            <input 
              type="text" 
              className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Buscar..."
              value={busquedaClub}
              onChange={(e) => setBusquedaClub(e.target.value)}
            />
          </div>
        </header>

        {cargando ? (
          <div className="text-center py-20 animate-pulse font-black text-slate-500 uppercase tracking-widest">
            Sincronizando base de datos...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jugadorasFiltradas.map(j => (
              <div key={j.id} className="bg-slate-800 rounded-[2rem] border border-slate-700 shadow-xl overflow-hidden relative group hover:border-blue-500/50 transition-all">
                
                {j.verificacion_manual && (
                  <div className="absolute top-4 right-4 bg-amber-500 text-slate-900 text-[9px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg z-10">
                    ⚠️ REVISIÓN PENDIENTE
                  </div>
                )}

                <div className="p-6 flex gap-4">
                  <div className="relative w-20 h-20">
                    <img src={j.foto_url} className="w-full h-full rounded-2xl object-cover border-2 border-slate-700" alt="Perfil" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-black uppercase leading-tight tracking-tighter">{j.apellido}, {j.nombre}</h2>
                    <p className="text-blue-400 font-black text-[10px] uppercase italic">{j.categoria_actual}</p>
                    <div className="mt-3 space-y-1">
                        <p className="text-slate-500 text-[10px] font-bold">DNI: <span className="text-slate-300">{j.dni}</span></p>
                        <p className="text-slate-500 text-[10px] font-bold uppercase italic">Club: <span className="text-emerald-500">{j.equipos?.nombre || 'Sin asignar'}</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-5 flex items-center justify-between border-t border-slate-700/50">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase ${j.verificacion_manual ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {j.verificacion_manual ? '● En espera' : '✓ Habilitada'}
                  </span>
                  
                  {j.verificacion_manual && (
                    <button 
                      onClick={() => aprobar(j.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 shadow-emerald-900/20"
                    >
                      APROBAR FICHAJE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminJugadoras;