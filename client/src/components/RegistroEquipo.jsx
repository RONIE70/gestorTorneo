import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios';

const RegistroEquipo = ({ onEquipoCreado, inscripcionesAbiertas }) => {
  const [nuevoEquipo, setNuevoEquipo] = useState({ nombre: '', logo_url: '' });
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [creando, setCreando] = useState(false);

  // Lógica de subida de escudo a Cloudinary
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSubiendoLogo(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'nc_s1125_presets'); 

    try {
      const res = await axios.post(
        'https://api.cloudinary.com/v1_1/dgtc9qfmv/image/upload',
        formData
      );
      // Guardamos la URL de Cloudinary en el estado local logo_url
      setNuevoEquipo({ ...nuevoEquipo, logo_url: res.data.secure_url });
    } catch (err) {
      console.error(err);
      alert("Error al subir el escudo del club");
    } finally {
      setSubiendoLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nuevoEquipo.nombre) return alert("El nombre es obligatorio");
    
    setCreando(true);
    try {
      const { error } = await supabase
        .from('equipos')
        .insert([{ 
          nombre: nuevoEquipo.nombre.toUpperCase(), 
          // MODIFICACIÓN: Mapeamos el estado logo_url a la columna escudo_url de la DB
          escudo_url: nuevoEquipo.logo_url 
        }]);

      if (error) throw error;

      alert("✅ Club inscripto con éxito en nc-s1125");
      setNuevoEquipo({ nombre: '', logo_url: '' });
      if (onEquipoCreado) onEquipoCreado(); // Recarga la lista en AdminConfig
    } catch (err) {
      alert("Error al registrar: " + err.message);
    } finally {
      setCreando(false);
    }
  };

  if (!inscripcionesAbiertas) {
    return (
      <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-dashed border-rose-500/20 text-center">
        <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest italic">
          🚫 Las inscripciones están cerradas. No se pueden añadir nuevos clubes.
        </p>
      </div>
    );
  }

  return (
    <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-xl font-black uppercase italic text-emerald-500 tracking-tighter">Inscripción Oficial de Club</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Añade equipos a la base de datos del torneo</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-end gap-4 w-full lg:w-auto">
          <div className="w-full md:w-64">
            <label className="text-[8px] font-black uppercase text-slate-500 ml-2 mb-1 block">Nombre del Club</label>
            <input 
              type="text" 
              placeholder="EJ: CLUB ATLÉTICO EJEMPLO"
              value={nuevoEquipo.nombre}
              onChange={(e) => setNuevoEquipo({...nuevoEquipo, nombre: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-black outline-none focus:border-emerald-500 transition-all uppercase"
              required
            />
          </div>

          <div className="w-full md:w-56">
            <label className="text-[8px] font-black uppercase text-slate-500 ml-2 mb-1 block">Escudo / Logo</label>
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-emerald-600/10 file:text-emerald-500 file:font-black hover:file:bg-emerald-600/20 cursor-pointer"
              />
              {subiendoLogo && (
                <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center rounded-xl">
                  <span className="text-[8px] font-black animate-pulse text-emerald-400">CARGANDO...</span>
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit"
            disabled={creando || subiendoLogo}
            className={`w-full md:w-auto px-10 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 ${creando ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {creando ? 'REGISTRANDO...' : 'REGISTRAR CLUB'}
          </button>
        </form>
      </div>

      {nuevoEquipo.logo_url && !creando && (
        <div className="mt-4 flex items-center gap-3 bg-slate-950/50 p-3 rounded-2xl border border-slate-800 w-fit animate-in zoom-in-95">
          <img src={nuevoEquipo.logo_url} alt="Escudo" className="w-8 h-8 object-contain" />
          <span className="text-[9px] font-black text-emerald-500 uppercase">Escudo listo para registro</span>
        </div>
      )}
    </section>
  );
};

export default RegistroEquipo;