import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import CarnetJugadora from './CarnetJugadora';

const GestionFichajesAdmin = ({ perfil }) => {
  const [jugadoras, setJugadoras] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    let montado = true;
    const cargarDatos = async () => {
      try {
        let query = supabase.from('jugadoras').select('*, equipos(nombre, logo_url, escudo_url), organizaciones(nombre, logo_url)');
        if (perfil.rol !== 'superadmin') query = query.eq('organizacion_id', perfil.organizacion_id);
        const { data, error } = await query.order('apellido', { ascending: true });
        if (!error && montado) setJugadoras(data);
      } catch (err) { console.error(err); }
    };
    if (perfil) cargarDatos();
    return () => { montado = false; };
  }, [perfil]);

  const filtradas = jugadoras.filter(j => j.apellido?.toLowerCase().includes(filtro.toLowerCase()) || j.dni?.includes(filtro));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-[600px] bg-slate-900/50">
      <div className="lg:col-span-1 border-r border-white/5 bg-slate-950/20 p-4">
        <input type="text" placeholder="Buscar jugadora..." className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs outline-none focus:border-rose-500 mb-4" onChange={(e) => setFiltro(e.target.value)} />
        <div className="overflow-y-auto max-h-[500px] space-y-2">
          {filtradas.map(j => (
            <div key={j.id} onClick={() => setSeleccionada(j)} className={`p-4 rounded-xl cursor-pointer transition-all ${seleccionada?.id === j.id ? 'bg-rose-600 shadow-lg' : 'hover:bg-white/5'}`}>
              <p className="text-xs font-black uppercase">{j.apellido}, {j.nombre}</p>
              <p className="text-[9px] opacity-60">DNI: {j.dni}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 p-8 flex flex-col items-center bg-black/40 overflow-y-auto max-h-[650px]">
        {seleccionada ? (
          <CarnetJugadora 
            jugadora={{
              ...seleccionada,
              club_nombre: seleccionada.equipos?.nombre || seleccionada.club_nombre,
              club_escudo: seleccionada.equipos?.logo_url || seleccionada.equipos?.escudo_url || seleccionada.club_escudo 
            }} 
            config={{
              nombre_liga: seleccionada.organizaciones?.nombre,
              logo_url: seleccionada.organizaciones?.logo_url || perfil.logo_url 
            }} 
          />
        ) : (
          <p className="text-xs font-black uppercase opacity-20 tracking-widest mt-20">Seleccioná una jugadora para previsualizar</p>
        )}
      </div>
    </div>
  );
};

export default GestionFichajesAdmin;