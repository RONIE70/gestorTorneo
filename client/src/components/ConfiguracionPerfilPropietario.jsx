import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ConfiguracionPerfilPropietario = () => {
  const [perfil, setPerfil] = useState({
    email_contacto: '',
    whatsapp_contacto: '',
    nombre_liga: 'nc-s1125'
  });
  const [cargando, setCargando] = useState(false);

  // Cargar datos actuales al entrar
  useEffect(() => {
    const obtenerConfig = async () => {
      // eslint-disable-next-line no-unused-vars
      const { data, error } = await supabase
        .from('configuracion_liga')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data) setPerfil(data);
    };
    obtenerConfig();
  }, []);

  const actualizarPerfil = async () => {
    setCargando(true);
    const { error } = await supabase
      .from('configuracion_liga')
      .update({
        email_contacto: perfil.email_contacto,
        whatsapp_contacto: perfil.whatsapp_contacto,
        nombre_liga: perfil.nombre_liga
      })
      .eq('id', 1);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      alert("✅ Perfil de nc-s1125 actualizado. El botón de WhatsApp y el formulario de contacto ya reflejan los cambios.");
    }
    setCargando(false);
  };

  return (
    <div className="mt-12 bg-slate-900 border border-blue-500/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
      {/* Glow decorativo */}
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl"></div>

      <div className="relative z-10 space-y-6">
        <header className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <span className="text-3xl">⚙️</span>
          <div>
            <h2 className="text-xl font-black uppercase italic text-white tracking-tighter">Perfil de la Organización</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Configura cómo te contactarán las jugadoras y delegados</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-blue-500 ml-4">Email Público</label>
            <input 
              type="email" 
              value={perfil.email_contacto}
              onChange={(e) => setPerfil({...perfil, email_contacto: e.target.value})}
              placeholder="ejemplo@ncs1125.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-emerald-500 ml-4">WhatsApp (Sin el +)</label>
            <input 
              type="text" 
              value={perfil.whatsapp_contacto}
              onChange={(e) => setPerfil({...perfil, whatsapp_contacto: e.target.value})}
              placeholder="54911..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-emerald-400 font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <button 
          onClick={actualizarPerfil}
          disabled={cargando}
          className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
        >
          {cargando ? 'Sincronizando...' : '💾 Guardar Datos de Contacto'}
        </button>
      </div>
    </div>
  );
};

export default ConfiguracionPerfilPropietario;