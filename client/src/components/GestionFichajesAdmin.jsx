import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import CarnetJugadora from './CarnetJugadora'; // Tu componente estrella

const GestionFichajesAdmin = ({ perfil }) => {
  const [jugadoras, setJugadoras] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState("");

// 2. useEffect con control de montado
useEffect(() => {
  let montado = true; // Control para evitar fugas de memoria

  const cargarDatos = async () => {
    try {
      const { data, error } = await supabase
        .from('jugadoras')
        .select('*')
        .eq('organizacion_id', perfil.organizacion_id)
        .order('apellido', { ascending: true });

      if (!error && montado) {
        setJugadoras(data);
      }
    } catch (err) {
      console.error("Error cargando jugadoras:", err);
    }
  };

  cargarDatos();

  return () => { montado = false; }; // Limpieza al desmontar
}, [perfil.organizacion_id]); // Solo se ejecuta si cambia la organización

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white">
      <h1 className="text-2xl font-black mb-6 uppercase">Panel de Impresión de Carnets</h1>
      
      {/* Buscador rápido */}
      <input 
        type="text" 
        placeholder="Buscar por Apellido o DNI..."
        className="w-full p-4 bg-slate-900 rounded-xl border border-slate-800 mb-8 outline-none focus:border-magenta-500 transition-all"
        onChange={(e) => setFiltro(e.target.value.toLowerCase())}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* LISTADO DE JUGADORAS */}
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
          {jugadoras
            .filter(j => j.apellido.toLowerCase().includes(filtro) || j.dni.includes(filtro))
            .map(jugadora => (
            <div 
              key={jugadora.id}
              onClick={() => setSeleccionada(jugadora)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${
                seleccionada?.id === jugadora.id ? 'border-magenta-500 bg-magenta-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="font-black uppercase">{jugadora.apellido}, {jugadora.nombre}</p>
                <p className="text-[10px] text-slate-400">DNI: {jugadora.dni} • CAT: {jugadora.categoria_actual}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Indicador de Verificación */}
                <span className={`w-3 h-3 rounded-full ${jugadora.verificacion_manual ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <button className="text-[10px] font-bold bg-slate-800 px-3 py-1 rounded-lg uppercase">Ver Carnet</button>
              </div>
            </div>
          ))}
        </div>

        {/* VISTA PREVIA Y DESCARGA */}
        <div className="sticky top-6 flex flex-col items-center justify-center bg-slate-900/50 rounded-3xl p-8 border border-slate-800 min-h-[500px]">
          {seleccionada ? (
            <>
              <p className="text-[10px] font-black text-magenta-500 mb-4 uppercase tracking-widest">Vista Previa para Impresión</p>
              <CarnetJugadora jugadora={seleccionada} config={perfil} />
              <p className="mt-6 text-[9px] text-slate-500 text-center max-w-xs uppercase font-bold">
                Una vez descargado, el PDF tendrá las medidas de 8.5x5.5cm listas para el lienzo de impresión.
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-slate-500 font-bold uppercase italic text-sm">Selecciona una jugadora del listado<br/>para generar su carnet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GestionFichajesAdmin;