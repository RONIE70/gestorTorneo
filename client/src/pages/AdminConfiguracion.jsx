import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import CarnetJugadora from '../components/CarnetJugadora';
import { useNavigate } from 'react-router-dom';

const AdminConfiguracion = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userOrgId, setUserOrgId] = useState(null);
  const [config, setConfig] = useState(null);

  const TEMAS = [
    { nombre: 'AFA / CLÁSICO', fondo: '#00355E', texto: '#000000', acento: '#75AADB' },
    { nombre: 'PREMIER / DARK', fondo: '#3D195B', texto: '#ffffff', acento: '#E90052' },
    { nombre: 'CHAMPIONS', fondo: '#000412', texto: '#ffffff', acento: '#004494' },
    { nombre: 'NEÓN / TECH', fondo: '#0f172a', texto: '#ffffff', acento: '#10b981' },
    { nombre: 'FIFA / GOLD', fondo: '#101820', texto: '#000000', acento: '#D4AF37' },
    { nombre: 'FEM / PINK', fondo: '#4c1d95', texto: '#ffffff', acento: '#ec4899' },
  ];

  const jugadoraDemo = {
    nombre: "MARTINA", 
    apellido: "GOAL", 
    dni: "42.123.456",
    foto_url: "",
    categoria_actual: "PRIMERA DIVISIÓN"
  };

  // 1. Recuperar Identidad de la Organización
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
        console.error("Error de autenticación:", err);
      }
    };
    obtenerContextoOrg();
  }, []);

  // 2. Cargar Configuración de Marca
  const fetchConfig = useCallback(async () => {
    if (!userOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion_liga')
        .select('*')
        .eq('organizacion_id', userOrgId);

      if (error) throw error;

      if (data && data.length > 0) {
        setConfig(data[0]);
      } else {
        // Valores iniciales si la organización es nueva
        setConfig({
          nombre_liga: 'SC-1225',
          color_fondo_carnet: '#de1777',
          color_texto_carnet: '#00030f',
          color_recuadro_carnet: '#fcfcfc',
          logo_url: ''
        });
      }
    } catch (error) {
      console.error("Error cargando configuración:", error.message);
    } finally {
      setLoading(false);
    }
  }, [userOrgId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 3. Guardar Cambios (Upsert por Organización)
  const guardarConfiguracion = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('configuracion_liga')
        .upsert({
          ...config,
          organizacion_id: userOrgId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organizacion_id' });

      if (error) throw error;
      alert("✅ Identidad visual actualizada correctamente.");
    } catch (error) {
      alert("❌ Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Renderizados de Estado
  if (!userOrgId) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-black uppercase tracking-widest animate-pulse">
      Identificando Liga...
    </div>
  );

  if (loading && !config) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">
      Sincronizando Estilos...
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans selection:bg-blue-500">
      <header className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-l-4 border-blue-600 pl-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-blue-500 tracking-tighter">
            Brand <span className="text-white">Manager</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Configuración de Identidad Visual
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => navigate('/AdminConfig')} // Cambiado de window.location
            className="flex-1 md:px-6 py-3 bg-slate-900 hover:bg-slate-800 rounded-2xl font-black text-[10px] uppercase transition-all border border-slate-800"
          >
            Volver
          </button>
          <button 
            onClick={guardarConfiguracion} 
            disabled={loading}
            className="flex-1 md:px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="space-y-8">
          {/* SECCIÓN DE TEMAS */}
          <section className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800/50 backdrop-blur-sm">
            <h2 className="text-[10px] font-black uppercase text-blue-400 mb-6 tracking-widest italic">⚡ Temas de Identidad</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMAS.map((tema, index) => (
                <button 
                  key={index} 
                  onClick={() => setConfig({...config, color_fondo_carnet: tema.fondo, color_texto_carnet: tema.texto, color_recuadro_carnet: tema.acento})}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 transition-all group"
                >
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full border-2 border-slate-900" style={{ backgroundColor: tema.fondo }}></div>
                    <div className="w-6 h-6 rounded-full border-2 border-slate-900" style={{ backgroundColor: tema.acento }}></div>
                  </div>
                  <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-white transition-colors">{tema.nombre}</span>
                </button>
              ))}
            </div>
          </section>

          {/* AJUSTES MANUALES */}
          <section className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800/50 backdrop-blur-sm space-y-8">
            <h2 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest italic">Ajuste de Precisión</h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: 'Fondo', name: 'color_fondo_carnet' },
                { label: 'Texto', name: 'color_texto_carnet' },
                { label: 'Acento', name: 'color_recuadro_carnet' }
              ].map((item) => (
                <div key={item.name} className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col items-center gap-3">
                  <label className="text-[8px] font-black text-slate-500 uppercase">{item.label}</label>
                  <input 
                    type="color" 
                    value={config[item.name]} 
                    onChange={(e) => setConfig({...config, [item.name]: e.target.value})} 
                    className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-none overflow-hidden" 
                  />
                </div>
              ))}
            </div>
            
            <div className="pt-6 border-t border-slate-800/50 space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2 italic">Nombre de la Liga / Marca</label>
                <input 
                  type="text" 
                  value={config.nombre_liga} 
                  onChange={(e) => setConfig({...config, nombre_liga: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs outline-none focus:border-blue-500 transition-all font-bold tracking-tight" 
                />
              </div>
            </div>
          </section>
        </div>

        {/* VISTA PREVIA */}
<section className="flex flex-col items-center justify-center bg-slate-900/30 rounded-[3.5rem] border border-slate-800/50 p-6 md:p-10 relative shadow-inner overflow-hidden min-h-[600px]">
  <div className="absolute top-8 left-10 flex items-center gap-3">
    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
    <span className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">Renderizado de Credencial</span>
  </div>
  
  {/* Ajustamos el margen superior para dar aire y el escalado para que no desborde */}
  <div className="mt-12 scale-90 md:scale-110 lg:scale-125 transition-all duration-700 ease-in-out">
    <CarnetJugadora jugadora={jugadoraDemo} config={config} />
  </div>

  {/* Reducimos el margen superior del texto para que no se pegue al botón de descarga */}
  <p className="mt- text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em] max-w-xs text-center leading-relaxed">
    Los cambios realizados aquí se aplicarán automáticamente a todas las jugadoras de la liga.
  </p>
</section>
      </main>
    </div>
  );
};

export default AdminConfiguracion;