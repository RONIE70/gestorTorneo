import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';

const AdminGestionTorneos = () => {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTorneos = async () => {
      const { data } = await supabase.from('torneos').select('*').order('created_at', { ascending: false });
      setTorneos(data || []);
      setLoading(false);
    };
    fetchTorneos();
  }, []);

  const crearTorneo = async () => {
    const nombre = prompt("Nombre del Torneo (ej. Apertura 2026):");
    if (!nombre) return;
    const { data, error } = await supabase.from('torneos').insert({ nombre, activo: true }).select().single();
    if (!error) navigate(`/admin-config/${data.id}`);
  };

  if (loading) return <div className="p-20 text-center text-blue-500 font-black animate-pulse">CARGANDO HISTORIAL...</div>;

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex justify-between items-end border-b border-slate-800 pb-8">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">Organización <span className="text-blue-500">nc-s1125</span></h1>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-2">Panel de Control de Competiciones</p>
          </div>
          <button onClick={crearTorneo} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 transition-all">
            + Iniciar Nueva Temporada
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {torneos.map(t => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-blue-500/50 transition-all group">
              <div>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full ${t.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                  {t.activo ? '● TEMPORADA ACTIVA' : 'FINALIZADO'}
                </span>
                <h3 className="text-2xl font-black uppercase italic mt-4 group-hover:text-blue-400 transition-colors">{t.nombre}</h3>
                <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-tighter">ID Torneo: {t.id.slice(0,8)}</p>
              </div>
              <Link to={`/admin-config/${t.id}`} className="mt-8 bg-slate-800 group-hover:bg-blue-600 text-center py-4 rounded-xl font-black text-[10px] uppercase transition-all">
                Configurar Competición
              </Link>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default AdminGestionTorneos;