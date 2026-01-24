import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const VerificacionJugadoras = () => {
  const [sospechosas, setSospechosas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarSospechosas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jugadoras')
        .select('*, equipo:equipos(nombre)')
        .or('verificacion_manual.eq.true,distancia_biometrica.gt.0.6')
        .order('id', { ascending: false });

      if (error) throw error;
      setSospechosas(data || []);
    } catch (error) {
      console.error("Error al cargar alertas:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarSospechosas();
  }, [cargarSospechosas]);

  const aprobarJugadora = async (id) => {
    const confirmacion = window.confirm("¿Confirmas que los datos y las fotos son válidos?");
    if (!confirmacion) return;

    const { error } = await supabase
      .from('jugadoras')
      .update({ 
        verificacion_manual: false, 
        distancia_biometrica: 0.1 
      })
      .eq('id', id);

    if (!error) {
      alert("✅ Jugadora habilitada correctamente.");
      cargarSospechosas();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-rose-500 font-black animate-pulse uppercase tracking-widest">
          Analizando Base de Datos...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white font-sans">
      <header className="mb-10 border-b border-slate-800 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-rose-600 tracking-tighter">
            Verificación Forense
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2">
            Revisión de Identidad 
          </p>
        </div>
        <div className="bg-rose-600/10 border border-rose-500/30 px-6 py-2 rounded-2xl">
            <span className="text-rose-500 font-black text-xl">{sospechosas.length}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase ml-3">Casos Críticos</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {sospechosas.length > 0 ? sospechosas.map((j) => (
          <div key={j.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row transition-all hover:border-rose-500/20">
            
            {/* Fotos Comparativas */}
            <div className="flex p-6 gap-4 bg-black/40">
               <div className="text-center">
                 <p className="text-[7px] font-black text-blue-500 uppercase mb-2">Selfie Perfil</p>
                 <img src={j.foto_url} className="w-32 h-40 object-cover rounded-xl border-2 border-slate-800" alt="Perfil" />
               </div>
               <div className="text-center">
                 <p className="text-[7px] font-black text-emerald-500 uppercase mb-2">Documento DNI</p>
                 <img src={j.dni_foto_url || j.foto_url} className="w-32 h-40 object-cover rounded-xl border-2 border-slate-800" alt="DNI" />
               </div>
            </div>

            {/* Datos y Botones */}
            <div className="flex-1 p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-black uppercase italic">{j.apellido}, {j.nombre}</h3>
                <p className="text-blue-400 font-bold text-[10px] uppercase">{j.equipo?.nombre || 'Club Independiente'}</p>
                
                {/* --- SECCIÓN MODIFICADA: GRID DE VALIDACIONES --- */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Biometría */}
                  <div className="bg-slate-800 p-4 rounded-2xl border border-white/5">
                    <p className="text-[8px] text-slate-500 uppercase font-black">Distancia Biométrica</p>
                    <p className={`text-xl font-black ${j.distancia_biometrica > 0.6 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {(j.distancia_biometrica * 100).toFixed(1)}%
                    </p>
                  </div>

                  {/* EXIF / Forense */}
                  <div className="bg-slate-800 p-4 rounded-2xl border border-white/5">
                    <p className="text-[8px] text-slate-500 uppercase font-black">Validación de Origen</p>
                    <p className={`text-[10px] font-black uppercase ${j.verificacion_manual ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {j.verificacion_manual ? "Captura detectada" : "Cámara Real"}
                    </p>
                  </div>

                  {/* OCR / Validación de Datos (NUEVA AGREGADA) */}
                  <div className={`p-4 rounded-2xl border ${!j.dni_confirmado_ocr ? 'bg-orange-500/10 border-orange-500/30' : 'bg-slate-800 border-white/5'}`}>
                    <p className="text-[8px] font-black uppercase text-slate-500">Validación de Datos (OCR)</p>
                    <p className={`text-[10px] font-black uppercase ${!j.dni_confirmado_ocr ? 'text-orange-500' : 'text-emerald-500'}`}>
                      {!j.dni_confirmado_ocr ? "⚠️ DNI No Detectado en Foto" : "✓ DNI Legible"}
                    </p>
                  </div>

                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button 
                  onClick={() => aprobarJugadora(j.id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95"
                >
                  ✅ Habilitar para el Torneo
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-900 rounded-[3rem]">
            <p className="text-slate-600 font-black uppercase italic tracking-widest">Sin alertas pendientes de revisión</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificacionJugadoras;