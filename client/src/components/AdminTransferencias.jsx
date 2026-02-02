import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const AdminTransferencias = () => {
  const [pases, setPases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [userOrgId, setUserOrgId] = useState(null);

  // 1. Obtener contexto de la Liga
  useEffect(() => {
    const obtenerContexto = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('organizacion_id')
          .eq('id', session.user.id)
          .single();
        if (perfil) setUserOrgId(perfil.organizacion_id);
      }
    };
    obtenerContexto();
  }, []);

  // 2. Cargar Transferencias filtradas por Organización
  const fetchTransferencias = useCallback(async () => {
    if (!userOrgId) return;
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from('transferencias')
        .select(`
          *,
          jugadoras:jugadora_id(nombre, apellido, dni),
          club_origen:club_origen_id(nombre),
          club_destino:club_destino_id(nombre)
        `)
        .eq('organizacion_id', userOrgId) // <--- Filtro de Seguridad SaaS
        .eq('estado', 'pendiente');

      if (error) throw error;
      setPases(data || []);
    } catch (err) {
      console.error("Error cargando pases:", err);
    } finally {
      setCargando(false);
    }
  }, [userOrgId]);

  useEffect(() => { fetchTransferencias(); }, [fetchTransferencias]);

  // 3. Acción para Aprobar el Pase
  const procesarPase = async (pase, nuevoEstado) => {
    try {
      // Actualizamos la transferencia
      // eslint-disable-next-line no-unused-vars
      const { error: errorPase } = await supabase
        .from('transferencias')
        .update({ estado: nuevoEstado, fecha_aprobacion: new Date() })
        .eq('id', pase.id);

      if (nuevoEstado === 'aprobado') {
        // ACTUALIZACIÓN VITAL: Cambiamos el equipo de la jugadora en la tabla principal
        await supabase
          .from('jugadoras')
          .update({ equipo_id: pase.club_destino_id })
          .eq('id', pase.jugadora_id);
      }

      alert(`Pase ${nuevoEstado} correctamente.`);
      fetchTransferencias();
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("Error al procesar el pase");
    }
  };

  if (cargando) return <div className="p-20 text-center animate-pulse text-blue-500 font-black">Sincronizando pases...</div>;

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white">
      <header className="mb-10 border-l-4 border-blue-500 pl-4">
        <h1 className="text-3xl font-black uppercase italic">Solicitudes de <span className="text-blue-500">Pases</span></h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Control de movimientos entre clubes</p>
      </header>

      <div className="grid gap-4">
        {pases.length > 0 ? pases.map(p => (
          <div key={p.id} className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 flex justify-between items-center group hover:border-blue-500 transition-all">
            <div>
              <h3 className="text-lg font-black uppercase">{p.jugadoras?.apellido}, {p.jugadoras?.nombre}</h3>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-rose-500 font-bold text-xs uppercase">{p.club_origen?.nombre}</span>
                <span className="text-slate-500 text-sm">➡</span>
                <span className="text-emerald-500 font-bold text-xs uppercase">{p.club_destino?.nombre}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => procesarPase(p, 'rechazado')} className="bg-slate-900 hover:bg-rose-600 px-6 py-3 rounded-xl text-[10px] font-black transition-all">RECHAZAR</button>
              <button onClick={() => procesarPase(p, 'aprobado')} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl text-[10px] font-black transition-all">AUTORIZAR PASE</button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[2rem]">
            <p className="text-slate-600 font-black uppercase text-xs">No hay pedidos de pase pendientes en tu liga</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransferencias;