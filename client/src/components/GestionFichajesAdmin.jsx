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
        // Traemos jugadoras y adjuntamos el nombre de su organización (liga)
        let query = supabase
      .from('jugadoras')
      .select(`
        *,
        equipos (
          nombre,
          escudo_url
        ),
        organizaciones (
          nombre,
          logo_url
        )
      `);

        // Si no eres superadmin, solo ves tu liga
        if (perfil.rol !== 'superadmin') {
          query = query.eq('organizacion_id', perfil.organizacion_id);
        }

        const { data, error } = await query.order('apellido', { ascending: true });

        if (!error && montado) {
          setJugadoras(data);
        }
      } catch (err) {
        console.error("Error:", err);
      }
    };

    if (perfil) cargarDatos();
    return () => { montado = false; };
  }, [perfil]);

  // Filtro inteligente: Busca por Apellido, DNI o Nombre de Liga
  const jugadorasFiltradas = jugadoras.filter(j => 
    j.apellido?.toLowerCase().includes(filtro.toLowerCase()) || 
    j.dni?.includes(filtro) ||
    j.organizaciones?.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-[600px] bg-slate-900/50">
      
      {/* LISTADO LATERAL */}
      <div className="lg:col-span-1 border-r border-white/5 flex flex-col">
        <div className="p-4 bg-black/20">
          <input 
            type="text"
            placeholder="Buscar por apellido, DNI o liga..."
            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs outline-none focus:border-magenta-500 transition-all"
            onChange={(e) => setFiltro(e.target.value)}
          />
          <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold px-1">
            Resultados: {jugadorasFiltradas.length} jugadoras
          </p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
          {jugadorasFiltradas.map(jugadora => (
            <div 
              key={jugadora.id}
              onClick={() => setSeleccionada(jugadora)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 ${
                seleccionada?.id === jugadora.id ? 'bg-magenta-500/10 border-r-2 border-r-magenta-500' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">
                    {jugadora.apellido}, {jugadora.nombre}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                    {jugadora.organizaciones?.nombre || 'Liga General'}
                  </p>
                </div>
                <span className={`w-2 h-2 rounded-full ${jugadora.verificacion_manual ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-[10px] text-slate-500">DNI: {jugadora.dni}</p>
                <p className="text-[10px] text-magenta-500 font-black italic">{jugadora.categoria_actual}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VISTA PREVIA Y DESCARGA */}
      <div className="lg:col-span-2 p-8 flex flex-col items-center justify-center bg-black/40">
        {seleccionada ? (
          <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
            <CarnetJugadora jugadora={seleccionada} 
            config={{
    nombre_liga: seleccionada.organizaciones?.nombre,
    logo_url: seleccionada.organizaciones?.logo_url || perfil.logo_url 
    // ^ Si la liga tiene logo usa ese, sino usa el tuyo de SuperAdmin
  }} />
            <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 text-center max-w-sm">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-relaxed">
                Listo para el lienzo de 1 mt².<br/>
                Medida final: 8.5 cm x 5.5 cm
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 opacity-30">
            <div className="text-5xl">📇</div>
            <p className="text-xs font-black uppercase tracking-[0.3em]">Selecciona una jugadora<br/>para ver su carnet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionFichajesAdmin;