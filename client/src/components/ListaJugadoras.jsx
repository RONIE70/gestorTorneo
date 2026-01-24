import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import FichaJugadora from '../components/FichaJugadora';

const ListaJugadoras = () => {
  const [jugadoras, setJugadoras] = useState([]);
  const [filtroClub, setFiltroClub] = useState('');
  const [loading, setLoading] = useState(true);
  
  // ESTADO PARA MANEJAR EL MODAL
  const [jugadoraSeleccionadaId, setJugadoraSeleccionadaId] = useState(null);

  useEffect(() => {
    fetchJugadoras();
  }, []);

  const fetchJugadoras = async () => {
    try {
      const { data, error } = await supabase
        .from('jugadoras')
        .select('*, equipos(nombre)')
        .order('apellido', { ascending: true });

      if (error) throw error;
      setJugadoras(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const jugadorasFiltradas = jugadoras.filter(j => 
    j.equipo_id?.toString().includes(filtroClub) || 
    j.equipos?.nombre.toLowerCase().includes(filtroClub.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Sincronizando Planteles...</div>;

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* BOTÓN PARA VOLVER AL FIXTURE */}
        <button 
          onClick={() => window.location.href = '/FixturePublico'}
          className="mb-6 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors"
        >
          ← Volver al Calendario
        </button>

        <h2 className="text-3xl font-black mb-8 uppercase italic tracking-tighter text-white">
          Galería de <span className="text-blue-500">Jugadoras</span>
        </h2>
        
        {/* FILTRO POR CLUB */}
        <div className="mb-10 bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-4 items-center shadow-2xl">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Filtrar por Club:</label>
          <input 
            type="text" 
            placeholder="NOMBRE DEL CLUB O ID..."
            className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex-1 focus:border-blue-500 outline-none text-xs font-bold uppercase text-white"
            value={filtroClub}
            onChange={(e) => setFiltroClub(e.target.value)}
          />
        </div>

        {/* GRILLA DE TARJETAS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {jugadorasFiltradas.map((j) => (
            <div 
              key={j.id} 
              // AL HACER CLICK EN CUALQUIER PARTE DE LA TARJETA SE ABRE EL PERFIL
              onClick={() => setJugadoraSeleccionadaId(j.id)}
              className="bg-slate-900 rounded-[2rem] p-4 border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group shadow-xl"
            >
              <div className="relative overflow-hidden rounded-2xl mb-4">
                <img 
                  src={j.foto_url || 'https://via.placeholder.com/150'} 
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500" 
                  alt={`${j.nombre} ${j.apellido}`} 
                />
                {!j.verificacion_manual && (
                   <div className="absolute top-2 right-2 bg-green-500 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg">
                      VERIFICADA
                   </div>
                )}
              </div>

              <h3 className="text-sm font-black uppercase truncate text-slate-100">
                {j.apellido} {j.nombre}
              </h3>
              <p className="text-[9px] text-blue-500 font-bold uppercase mt-1 italic">
                {j.equipos?.nombre || 'Club no asignado'}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center group-hover:border-blue-500/30">
                 <span className="text-[8px] font-black text-slate-600 group-hover:text-blue-400 uppercase transition-colors">Ver Perfil Completo</span>
                 <span className="text-xs group-hover:translate-x-1 transition-transform">➡️</span>
              </div>
            </div>
          ))}
        </div>

        {/* SI NO HAY RESULTADOS */}
        {jugadorasFiltradas.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-900 rounded-[3rem]">
            <p className="text-slate-600 font-black uppercase italic tracking-widest text-xs">No se encontraron jugadoras</p>
          </div>
        )}

        {/* MODAL DE FICHA (Puntos 3 y 4 de Reglas de Negocio) */}
        {jugadoraSeleccionadaId && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <FichaJugadora 
              jugadoraId={jugadoraSeleccionadaId} 
              onClose={() => setJugadoraSeleccionadaId(null)} 
              // REGLA: false para que NO vean las sanciones en esta vista pública
              esTribunal={false} 
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default ListaJugadoras;