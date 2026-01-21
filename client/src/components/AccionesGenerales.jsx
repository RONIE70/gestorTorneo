import React from 'react';



const AccionesGenerales = ({ equipoNombre, equipoId, onIncidencia }) => {
  const reportarExtra = (rol) => {
    const motivo = prompt(`Informe para el Tribunal sobre ${rol} de ${equipoNombre}:`);
    if (motivo) {
      onIncidencia(rol, equipoId, { 
        id: null, 
        apellido: rol, 
        nombre: equipoNombre,
        motivo_extra: motivo 
      });
      alert(`Reporte de ${rol} enviado.`);
    }
  };

  return (
    <div className="bg-slate-900 border-2 border-dashed border-slate-800 p-6 rounded-[2.5rem] flex flex-col gap-4">
      <h4 className="text-[10px] font-black uppercase text-slate-500 text-center tracking-widest">Incidentes de Equipo: {equipoNombre}</h4>
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => reportarExtra('DELEGADO')}
          className="bg-slate-800 hover:bg-red-600/20 hover:border-red-600 border border-slate-700 py-4 rounded-2xl text-[9px] font-black uppercase text-white transition-all"
        >
          🚫 Expulsar Delegado
        </button>
        <button 
          onClick={() => reportarExtra('PUBLICO')}
          className="bg-slate-800 hover:bg-red-600/20 hover:border-red-600 border border-slate-700 py-4 rounded-2xl text-[9px] font-black uppercase text-white transition-all"
        >
          ⚠️ Sanción Público
        </button>
      </div>
    </div>
  );
};

export default AccionesGenerales;