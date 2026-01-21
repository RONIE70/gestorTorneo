import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
//import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora';

const AdminConfiguracion = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    id: null,
    nombre_liga: '',
    color_fondo_carnet: '#1e3a8a',
    color_texto_carnet: '#000000',
    color_recuadro_carnet: '#2563eb',
    logo_url: ''
  });

  // 1. DEFINICIÓN DE TEMAS PREDEFINIDOS
  const TEMAS = [
    { nombre: 'AFA / CLÁSICO', fondo: '#00355E', texto: '#000000', acento: '#75AADB' },
    { nombre: 'PREMIER / DARK', fondo: '#3D195B', texto: '#ffffff', acento: '#E90052' },
    { nombre: 'CHAMPIONS', fondo: '#000412', texto: '#ffffff', acento: '#004494' },
    { nombre: 'NEÓN / TECH', fondo: '#0f172a', texto: '#ffffff', acento: '#10b981' },
    { nombre: 'FIFA / GOLD', fondo: '#101820', texto: '#000000', acento: '#D4AF37' },
    { nombre: 'FEM / PINK', fondo: '#4c1d95', texto: '#ffffff', acento: '#ec4899' },
  ];

  const aplicarTema = (tema) => {
    setConfig({
      ...config,
      color_fondo_carnet: tema.fondo,
      color_texto_carnet: tema.texto,
      color_recuadro_carnet: tema.acento
    });
  };

  const jugadoraDemo = {
    nombre: "MARTINA",
    apellido: "GOAL",
    dni: "42.123.456",
    foto_url: "https://images.unsplash.com/photo-1543132220-3ce99c5ae03d?auto=format&fit=crop&q=80&w=200",
    categoria_actual: "PRIMERA DIVISIÓN"
  };

  // 1. Envolvemos la función en useCallback para que sea estable
  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_liga')
        .select('*')
        .single();
        
      if (error) throw error;
      if (data) setConfig(data);
    } catch (error) {
      console.error("Error al cargar configuración:", error);
    }
  }, []); // El array vacío indica que esta función no cambia nunca

  // 2. El useEffect ahora es seguro y no causará renders infinitos
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]); // Ahora fetchConfig es una dependencia estable


  const handleColorChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const guardarConfiguracion = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('configuracion_liga')
      .update({
        color_fondo_carnet: config.color_fondo_carnet,
        color_texto_carnet: config.color_texto_carnet,
        color_recuadro_carnet: config.color_recuadro_carnet,
        logo_url: config.logo_url,
        nombre_liga: config.nombre_liga
      })
      .eq('id', config.id);

    if (!error) alert("🚀 Identidad de Liga actualizada con éxito");
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-blue-500">Brand <span className="text-white">Manager</span></h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Personalización NC-S1125</p>
        </div>
        <button 
          onClick={guardarConfiguracion}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg"
        >
          {loading ? 'Procesando...' : 'Guardar Cambios'}
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <aside className="space-y-8">
          
          {/* SECCIÓN DE TEMAS PREDEFINIDOS */}
          <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800">
            <h2 className="text-[10px] font-black uppercase text-blue-400 mb-4 tracking-tighter">⚡ Temas Rápidos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMAS.map((tema, index) => (
                <button 
                  key={index} 
                  onClick={() => aplicarTema(tema)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 transition-all group"
                >
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tema.fondo }}></div>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tema.acento }}></div>
                  </div>
                  <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-white">{tema.nombre}</span>
                </button>
              ))}
            </div>
          </section>

          {/* SELECTORES DE COLOR MANUALES */}
          <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
            <h2 className="text-[10px] font-black uppercase text-slate-400 mb-2">Ajuste Manual</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col items-center gap-2 text-center">
                <label className="text-[8px] font-black text-slate-500 uppercase">Fondo</label>
                <input type="color" name="color_fondo_carnet" value={config.color_fondo_carnet} onChange={handleColorChange} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none" />
              </div>
              <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col items-center gap-2 text-center">
                <label className="text-[8px] font-black text-slate-500 uppercase">Texto</label>
                <input type="color" name="color_texto_carnet" value={config.color_texto_carnet} onChange={handleColorChange} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none" />
              </div>
              <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col items-center gap-2 text-center">
                <label className="text-[8px] font-black text-slate-500 uppercase">Acento</label>
                <input type="color" name="color_recuadro_carnet" value={config.color_recuadro_carnet} onChange={handleColorChange} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none" />
              </div>
            </div>
          </section>
        </aside>

        {/* VISTA PREVIA */}
        <section className="flex flex-col items-center justify-center bg-slate-900 rounded-[3rem] border border-slate-800 p-10 relative">
          <div className="absolute top-8 left-10 flex items-center gap-2">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black uppercase text-slate-500 italic">Previsualización en tiempo real</span>
          </div>
          
          <div className="scale-125">
            <CarnetJugadora jugadora={jugadoraDemo} config={config} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminConfiguracion;