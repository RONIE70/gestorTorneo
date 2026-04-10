import React, { useState, useEffect } from 'react'; // Quitamos useCallback que no se usa
import { supabase } from '../supabaseClient';

const AdminLiga = () => {
  const [tab, setTab] = useState('partidos');
  const [nuevoComunicado, setNuevoComunicado] = useState({ titulo: '', contenido: '', prioridad: 'normal' });
  
  // --- ESTADOS PARA EL CONTROL DE FICHAJE ---
  const [configLiga, setConfigLiga] = useState(null);
  const [userOrgId, setUserOrgId] = useState(null);
  const [cargandoConfig, setCargandoConfig] = useState(true);

  // --- 1. CARGAR CONFIGURACIÓN AL ENTRAR (ÚNICA FUENTE DE VERDAD) ---
  useEffect(() => {
    const cargarConfiguracionInicial = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setCargandoConfig(false);
          return;
        }

        const { data: perfil } = await supabase
          .from('perfiles')
          .select('organizacion_id')
          .eq('id', session.user.id)
          .single();

        if (perfil?.organizacion_id) {
          setUserOrgId(perfil.organizacion_id);
          
          const { data: config } = await supabase
            .from('configuracion_liga')
            .select('*')
            .eq('organizacion_id', perfil.organizacion_id)
            .maybeSingle();
          
          if (config) setConfigLiga(config);
        }
      } catch (err) {
        console.error("Error cargando configuración:", err);
      } finally {
        setCargandoConfig(false);
      }
    };

    cargarConfiguracionInicial();
  }, []); // Se ejecuta solo una vez al montar

  // --- 2. FUNCIÓN TOGGLE RÁPIDO ---
  const toggleFichajeRapido = async () => {
    if (!userOrgId || !configLiga) return;
    
    const nuevoEstado = !configLiga.inscripciones_abiertas;
    
    const { error } = await supabase
      .from('configuracion_liga')
      .update({ inscripciones_abiertas: nuevoEstado })
      .eq('organizacion_id', userOrgId);

    if (!error) {
      setConfigLiga({ ...configLiga, inscripciones_abiertas: nuevoEstado });
      alert(nuevoEstado ? "🔓 Fichaje Habilitado" : "🔒 Fichaje Bloqueado");
    }
  };

  const crearComunicado = async () => {
    const { error } = await supabase.from('comunicados').insert([nuevoComunicado]);
    if (!error) {
      alert("Comunicado publicado con éxito");
      setNuevoComunicado({ titulo: '', contenido: '', prioridad: 'normal' });
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-black uppercase italic text-emerald-500 tracking-tighter">
          Sede Central <span className="text-white">NC-S1125</span>
        </h1>
        
        {/* --- 3. BOTÓN DE CONTROL RÁPIDO --- */}
        {!cargandoConfig && (
          <div className="mt-6 flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Acceso a Delegados</p>
              <h3 className="text-xs font-bold uppercase italic">Sistema de Fichaje Online</h3>
            </div>
            <button 
              onClick={toggleFichajeRapido}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg active:scale-95 ${
                configLiga?.inscripciones_abiertas 
                ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                : 'bg-rose-600 text-white shadow-rose-900/20'
              }`}
            >
              {configLiga?.inscripciones_abiertas ? '🔓 Abierto' : '🔒 Cerrado'}
            </button>
          </div>
        )}

        <div className="flex gap-4 mt-6">
          <button onClick={() => setTab('partidos')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'partidos' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Fixture</button>
          <button onClick={() => setTab('equipos')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'equipos' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Equipos</button>
          <button onClick={() => setTab('noticias')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'noticias' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Comunicados</button>
        </div>
      </header>

      {/* RENDERIZADO DE CONTENIDO (Noticias / Partidos) - Sigue igual que tu original */}
      {tab === 'noticias' && (
        <div className="max-w-2xl bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl animate-in fade-in duration-500">
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
            <button onClick={crearComunicado} className="w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase hover:bg-emerald-500 transition-all shadow-lg">
              Publicar en Dashboard
            </button>
          </div>
        </div>
      )}

      {tab === 'partidos' && (
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black uppercase italic text-emerald-400">Programación de Fecha</h2>
            <button className="bg-emerald-600 text-[10px] px-4 py-2 rounded-lg font-black uppercase">Nuevo Partido +</button>
          </div>
          <p className="text-slate-500 text-sm italic">Filtra, edita y gestiona los cruces de la jornada desde aquí.</p>
        </div>
      )}
    </div>
  );
};

export default AdminLiga;