import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AdminFixture = ({ 
  fechasGeneradas, 
  categoriasDisponibles, 
  clubes = [], 
  onEditar, 
  onIntercambiar, 
  readOnly = false 
}) => {
  const [fixture, setFixture] = useState(fechasGeneradas);

  useEffect(() => {
    setFixture(fechasGeneradas);
  }, [fechasGeneradas]);

  const actualizarEncuentro = (fechaNumero, encuentroId, campo, valor) => {
    if (readOnly) return;
    const nuevoFixture = fixture.map(f => {
      if (f.numero === fechaNumero) {
        return {
          ...f,
          encuentros: f.encuentros.map(e => 
            e.id === encuentroId ? { ...e, [campo]: valor } : e
          )
        };
      }
      return f;
    });
    setFixture(nuevoFixture);
  };

  const guardarFixtureOficial = async () => {
    const confirmacion = window.confirm("¡ATENCIÓN! Se borrará cualquier fixture previo y se publicará este como el OFICIAL para nc-s1125. ¿Deseas continuar?");
    if (!confirmacion) return;

    try {
      // 1. LIMPIEZA: Borramos partidos existentes
      const { error: deleteError } = await supabase
        .from('partidos')
        .delete()
        .neq('id', 0); 

      if (deleteError) throw deleteError;

      // 2. PREPARACIÓN: Mapeo correcto a las nuevas columnas de la DB
      const partidosAInsertar = fixture.flatMap(f => 
        f.encuentros.map(e => ({
          nro_fecha: f.numero,
          fecha_calendario: f.fechaReal,
          zona: f.zona || null,
          local_id: e.loc?.id || null,
          visitante_id: e.vis?.id || null,
          categoria: e.categoria,
          horario: e.horario,
          finalizado: false
        }))
      );

      // 3. INSERCIÓN: Guardamos el nuevo fixture oficial
      const { error: insertError } = await supabase
        .from('partidos')
        .insert(partidosAInsertar);
        
      if (insertError) throw insertError;

      alert("🚀 ¡Fixture Oficial Publicado y Sincronizado!");
      window.location.reload();

    } catch (error) {
      alert("Error en el proceso: " + error.message);
    }
  };

  return (
    <div className={`p-6 bg-slate-900 rounded-[3rem] border ${readOnly ? 'border-slate-800' : 'border-blue-500/30'} shadow-2xl space-y-8 animate-in fade-in zoom-in duration-500`}>
      
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black uppercase italic text-blue-500 leading-none">
            {readOnly ? 'Calendario de la Competencia' : 'Previsualización del Fixture'}
          </h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">
            {readOnly ? 'Fechas y horarios oficiales' : 'Ajusta los detalles finales antes de la publicación'}
          </p>
        </div>
        
        {!readOnly && (
          <button 
            onClick={guardarFixtureOficial} 
            className="bg-emerald-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-500 transition-all active:scale-95 flex items-center gap-2"
          >
            🚀 Publicar Oficial
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {fixture && fixture.map(fecha => (
          <div key={`${fecha.zona || 'unica'}-${fecha.numero}`} className="bg-slate-950 p-5 rounded-[2rem] border border-slate-800 relative overflow-hidden group/card hover:border-blue-500/20 transition-all">
            
            {fecha.zona && (
              <div className="absolute top-0 right-8 bg-blue-600 text-[8px] font-black px-3 py-1 rounded-b-lg uppercase tracking-tighter">
                {fecha.zona}
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-sm font-black uppercase text-blue-400 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] italic">
                  {fecha.numero}
                </span>
                Fecha {fecha.numero}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold ml-8 uppercase italic tracking-widest">
                📅 {fecha.fechaReal || 'Pendiente'}
              </p>
            </div>
            
            <div className="space-y-3">
              {fecha.encuentros.map((e) => {
                const catData = categoriasDisponibles.find(c => c.nombre === e.categoria);
                const esAmistosa = catData && !catData.participa_torneo;

                return (
                  <div key={e.id} className={`bg-slate-900 p-3 rounded-xl border ${esAmistosa ? 'border-rose-900/30' : 'border-slate-800'} flex flex-col gap-3 transition-all`}>
                    
                    <div className="flex justify-between items-center px-2 gap-2">
                      {/* EQUIPO LOCAL */}
                      <div className="flex flex-col items-start flex-1 overflow-hidden">
                        {!readOnly ? (
                          <select
                            value={e.loc?.id || ""}
                            onChange={(ev) => onEditar(e.id, 'local_id', ev.target.value)}
                            className="bg-slate-950 text-[10px] font-black uppercase text-blue-400 p-1 rounded border border-slate-800 w-full outline-none focus:border-blue-500"
                          >
                            <option value="">{e.loc?.nombre || "A DEFINIR"}</option>
                            {clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        ) : (
                          <span className="text-[10px] font-black uppercase truncate w-full">{e.loc?.nombre || "A DEFINIR"}</span>
                        )}
                        <span className="text-[7px] text-blue-500 font-bold uppercase tracking-tighter">Local</span>
                      </div>
                      
                      {/* BOTÓN INTERCAMBIO Y VS */}
                      <div className="flex flex-col items-center">
                        {!readOnly && e.loc?.id && e.vis?.id && (
                          <button
                            onClick={() => onIntercambiar(e)}
                            className="mb-1 p-1 rounded-full bg-slate-800 hover:bg-amber-500 text-slate-400 hover:text-white transition-all active:scale-90"
                            title="Intercambiar Localía"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </button>
                        )}
                        <span className="text-[8px] font-black bg-slate-800 px-2 py-0.5 rounded text-slate-500">VS</span>
                        {esAmistosa && <span className="text-[6px] text-rose-500 font-black uppercase mt-1">Amistoso</span>}
                      </div>
                      
                      {/* EQUIPO VISITANTE */}
                      <div className="flex flex-col items-end flex-1 overflow-hidden">
                        {!readOnly ? (
                          <select
                            value={e.vis?.id || ""}
                            onChange={(ev) => onEditar(e.id, 'visitante_id', ev.target.value)}
                            className="bg-slate-950 text-[10px] font-black uppercase text-slate-400 p-1 rounded border border-slate-800 w-full outline-none text-right focus:border-blue-500"
                          >
                            <option value="">{e.vis?.nombre || "A DEFINIR"}</option>
                            {clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        ) : (
                          <span className="text-[10px] font-black uppercase truncate w-full text-right">{e.vis?.nombre || "A DEFINIR"}</span>
                        )}
                        <span className="text-[7px] text-slate-600 font-bold uppercase tracking-tighter">Visita</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {readOnly ? (
                        <div className="flex w-full justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/50">
                          <span className="text-[9px] font-black text-amber-500 uppercase italic">🕒 {e.horario} hs</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${esAmistosa ? 'text-rose-400 bg-rose-400/10' : 'text-slate-400'}`}>
                            {e.categoria}
                          </span>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="time" 
                            value={e.horario} 
                            onChange={(ev) => actualizarEncuentro(fecha.numero, e.id, 'horario', ev.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[10px] font-bold text-blue-400 flex-1 outline-none focus:border-blue-500 transition-colors"
                          />
                          <select
                            value={e.categoria}
                            onChange={(ev) => actualizarEncuentro(fecha.numero, e.id, 'categoria', ev.target.value)}
                            className={`bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[9px] font-bold flex-1 outline-none cursor-pointer ${esAmistosa ? 'text-rose-400' : 'text-slate-400'}`}
                          >
                            {categoriasDisponibles.map(cat => (
                              <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFixture;