import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Contacto = () => {
  const [formData, setFormData] = useState({ nombre: '', email: '', asunto: 'General', mensaje: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);

    const { error } = await supabase.from('mensajes_contacto').insert([formData]);

    if (error) {
      alert("Error al enviar: " + error.message);
    } else {
      setEnviado(true);
      setFormData({ nombre: '', email: '', asunto: 'General', mensaje: '' });
    }
    setEnviando(false);
  };

  return (
    <div className="p-4 md:p-12 bg-slate-950 min-h-screen text-white flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 bg-slate-900 p-8 md:p-12 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
        
        {/* DECORACIÓN FONDO */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>

        {/* COLUMNA INFO */}
        <div className="space-y-8 relative z-10">
          <header className="border-l-4 border-blue-500 pl-6">
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">Contactanos</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Atención al Propietario nc-s1125</p>
          </header>

          <div className="space-y-6">
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 group-hover:border-blue-500 transition-all text-xl">📍</div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Sede Central</p>
                <p className="text-sm font-bold">Buenos Aires, Argentina</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 group-hover:border-emerald-500 transition-all text-xl">✉️</div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Email Oficial</p>
                <p className="text-sm font-bold">organizacion@ncs1125.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* FORMULARIO */}
        <div className="relative z-10">
          {enviado ? (
            <div className="bg-emerald-600/10 border border-emerald-500/50 p-8 rounded-[2rem] text-center animate-in zoom-in duration-300">
              <span className="text-4xl mb-4 block">✅</span>
              <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">¡Mensaje Recibido!</h3>
              <p className="text-xs text-slate-400 font-medium">El propietario del torneo revisará tu consulta a la brevedad.</p>
              <button onClick={() => setEnviado(false)} className="mt-6 text-[10px] font-black uppercase text-emerald-500 underline">Enviar otro mensaje</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <input 
                  required
                  type="text" 
                  placeholder="Tu Nombre" 
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <input 
                  required
                  type="email" 
                  placeholder="Tu Email de contacto" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <select 
                  value={formData.asunto}
                  onChange={(e) => setFormData({...formData, asunto: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="General">Consulta General</option>
                  <option value="Fichaje">Problemas con Fichaje</option>
                  <option value="Pagos">Dudas sobre Aranceles</option>
                  <option value="Sanciones">Tribunal de Disciplina</option>
                </select>
                <textarea 
                  required
                  rows="4" 
                  placeholder="Escribe tu mensaje aquí..." 
                  value={formData.mensaje}
                  onChange={(e) => setFormData({...formData, mensaje: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                ></textarea>
              </div>
              <button 
                disabled={enviando}
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : '🚀 Enviar Mensaje al Propietario'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contacto;