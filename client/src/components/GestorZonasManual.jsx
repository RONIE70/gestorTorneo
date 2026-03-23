import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const GestorZonasManual = ({ clubes, onActualizar }) => {
  const [procesando, setProcesando] = useState(null);

  const asignarZona = async (clubId, zona) => {
    setProcesando(clubId);
    try {
      const { error } = await supabase
        .from('equipos')
        .update({ zona: zona })
        .eq('id', clubId);

      if (error) throw error;
      onActualizar(); // Refresca la lista en el padre
    } catch (err) {
      alert("Error al asignar zona: " + err.message);
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl">
      <div className="text-center mb-6">
        <h2 className="text-xl font-black uppercase italic text-amber-500">Configuración Manual de Zonas</h2>
        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Asigna los equipos según el mérito del torneo anterior</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubes.map((club) => (
          <div key={club.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 w-full">
              <img src={club.escudo_url || 'https://via.placeholder.com/40'} className="w-10 h-10 object-contain" alt="escudo" />
              <span className="text-[11px] font-black uppercase truncate flex-1">{club.nombre}</span>
            </div>

            <div className="flex w-full gap-2">
              <button
                disabled={procesando === club.id}
                onClick={() => asignarZona(club.id, 'Zona A')}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                  club.zona === 'Zona A' 
                  ? 'bg-blue-600 text-white border-2 border-blue-400' 
                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-blue-500'
                }`}
              >
                Zona A
              </button>
              <button
                disabled={procesando === club.id}
                onClick={() => asignarZona(club.id, 'Zona B')}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                  club.zona === 'Zona B' 
                  ? 'bg-rose-600 text-white border-2 border-rose-400' 
                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-rose-500'
                }`}
              >
                Zona B
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GestorZonasManual;