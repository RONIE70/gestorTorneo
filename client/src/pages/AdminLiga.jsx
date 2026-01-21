import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const AdminLiga = () => {
  const [tab, setTab] = useState('partidos');
  const [nuevoComunicado, setNuevoComunicado] = useState({ titulo: '', contenido: '', prioridad: 'normal' });

  const crearComunicado = async () => {
    const { error } = await supabase.from('comunicados').insert([nuevoComunicado]);
    if (!error) {
      alert("Comunicado publicado con éxito");
      setNuevoComunicado({ titulo: '', contenido: '', prioridad: 'normal' });
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white">
      <header className="mb-10">
        <h1 className="text-3xl font-black uppercase italic text-emerald-500 tracking-tighter">
          Sede Central <span className="text-white">NC-S1125</span>
        </h1>
        <div className="flex gap-4 mt-6">
          <button onClick={() => setTab('partidos')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'partidos' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Fixture</button>
          <button onClick={() => setTab('equipos')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'equipos' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Equipos</button>
          <button onClick={() => setTab('noticias')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'noticias' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Comunicados</button>
        </div>
      </header>

      {/* GESTIÓN DE COMUNICADOS */}
      {tab === 'noticias' && (
        <div className="max-w-2xl bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-emerald-400">Publicar Anuncio Oficial</h2>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Título del anuncio..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              value={nuevoComunicado.titulo}
              onChange={(e) => setNuevoComunicado({...nuevoComunicado, titulo: e.target.value})}
            />
            <textarea 
              placeholder="Contenido del mensaje..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 h-32 outline-none focus:ring-2 focus:ring-emerald-500"
              value={nuevoComunicado.contenido}
              onChange={(e) => setNuevoComunicado({...nuevoComunicado, contenido: e.target.value})}
            />
            <select 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none"
              value={nuevoComunicado.prioridad}
              onChange={(e) => setNuevoComunicado({...nuevoComunicado, prioridad: e.target.value})}
            >
              <option value="normal">Prioridad: Normal</option>
              <option value="urgente">Prioridad: Urgente (Rojo)</option>
            </select>
            <button onClick={crearComunicado} className="w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase hover:bg-emerald-500 transition-all">
              Publicar en Dashboard
            </button>
          </div>
        </div>
      )}

      {/* GESTIÓN DE PARTIDOS (SIMPLIFICADO) */}
      {tab === 'partidos' && (
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black uppercase italic text-emerald-400">Programación de Fecha</h2>
            <button className="bg-emerald-600 text-[10px] px-4 py-2 rounded-lg font-black uppercase">Nuevo Partido +</button>
          </div>
          <p className="text-slate-500 text-sm">Aquí verás la grilla de partidos para editar horarios y canchas.</p>
          {/* Aquí puedes mapear la tabla 'partidos' para editarlos */}
        </div>
      )}
    </div>
  );
};

export default AdminLiga;