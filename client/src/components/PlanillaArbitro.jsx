import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const PlanillaArbitro = ({ jugadora, partidoId, categoria, onIncidencia }) => {
  const [goles, setGoles] = useState(0);
  const [amarillas, setAmarillas] = useState(0);
  const [roja, setRoja] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [cargando, setCargando] = useState(false);

  // --- NUEVA FUNCIÓN: REPORTE EXTRA-CAMPO ---
  // eslint-disable-next-line no-unused-vars
  const reportarExtra = (rol) => {
    const motivo = prompt(`Informe breve sobre la conducta de ${rol}:`);
    if (motivo) {
      onIncidencia(rol, jugadora.equipo_id, { 
        id: null, 
        apellido: rol, 
        nombre: 'OFICIAL/GENERAL',
        motivo_extra: motivo 
      });
      alert(`Reporte de ${rol} enviado al Tribunal.`);
    }
  };

  const registrarIncidencia = async (tipo) => {
    setCargando(true);
    let tipoEfectivo = tipo;
    let esDobleAmarilla = false;

    // Lógica de Doble Amarilla
    if (tipo === 'AMARILLA' && amarillas === 1) {
      tipoEfectivo = 'ROJA';
      esDobleAmarilla = true;
    }

    // Lógica para partidos de prueba o entrenamiento (ID >= 990)
    if (partidoId >= 990) {
      if (tipo === 'GOL') { 
        setGoles(v => v + 1); 
        onIncidencia('GOL', jugadora.equipo_id, jugadora); 
      }
      if (tipo === 'AMARILLA') {
        if (esDobleAmarilla) {
          setAmarillas(2);
          setRoja(true);
          onIncidencia('AMARILLA', jugadora.equipo_id, jugadora);
          onIncidencia('ROJA', jugadora.equipo_id, jugadora);
        } else {
          setAmarillas(1);
          onIncidencia('AMARILLA', jugadora.equipo_id, jugadora);
        }
      }  
      if (tipo === 'ROJA'){ 
        setRoja(true);
        onIncidencia('ROJA', jugadora.equipo_id, jugadora);
      }
      setCargando(false);
      return;
    }

    try {
      // Inserción en Base de Datos (Se eliminó 'aclaracion' para evitar errores de schema)
      const { error } = await supabase.from('incidencias_partido').insert({
        partido_id: partidoId,
        jugadora_id: jugadora.id,
        equipo_id: jugadora.equipo_id,
        tipo: tipoEfectivo,
        categoria: categoria
        // Si necesitas guardar la observación, asegúrate que la columna exista o usa 'tipo'
      });

      if (error) throw error;

      // Actualización de estados locales y llamado a onIncidencia para el acta final
      if (tipo === 'GOL') { 
        setGoles(v => v + 1); 
        onIncidencia('GOL', jugadora.equipo_id, jugadora); 
      }
      if (tipo === 'AMARILLA') {
        if (esDobleAmarilla) {
          setAmarillas(2);
          setRoja(true);
          onIncidencia('AMARILLA', jugadora.equipo_id, jugadora);
          onIncidencia('ROJA', jugadora.equipo_id, jugadora);
        } else {
          setAmarillas(1);
          onIncidencia('AMARILLA', jugadora.equipo_id, jugadora);
        }
      }
      if (tipo === 'ROJA') {
        setRoja(true);
        onIncidencia('ROJA', jugadora.equipo_id, jugadora);
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className={`p-5 rounded-[2.5rem] border transition-all duration-500 ${roja ? 'bg-rose-950/30 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-xl'}`}>
      
      {/* INFO JUGADORA */}
      <div className="flex gap-4 items-center mb-4">
        <div className="relative">
          <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 ${roja ? 'border-rose-500' : 'border-slate-700 bg-slate-800'}`}>
            <img 
              src={jugadora.foto_url || 'https://via.placeholder.com/150'} 
              alt="avatar" 
              className={`w-full h-full object-cover ${roja ? 'grayscale' : ''}`}
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-lg border-2 border-slate-900 shadow-lg">
            {jugadora.dorsal || '0'}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-black uppercase tracking-tight leading-tight">
            {jugadora.apellido}, <br/> <span className="text-slate-400">{jugadora.nombre}</span>
          </h3>
          <p className="text-[8px] font-black text-blue-500 uppercase mt-1 tracking-widest">
            {jugadora.club_nombre || 'EQUIPO NC'}
          </p>
        </div>

        <div className="text-center bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
          <span className="block text-xl font-black text-white leading-none">{goles}</span>
          <span className="text-[7px] font-bold text-slate-500 uppercase">Goles</span>
        </div>
      </div>

      {/* BOTONES DE INCIDENCIAS JUGADORA */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button disabled={cargando || roja} onClick={() => registrarIncidencia('GOL')} className="bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl text-[9px] font-black transition-all active:scale-95">⚽ GOL</button>
        <button disabled={cargando || roja || amarillas >= 2} onClick={() => registrarIncidencia('AMARILLA')} className={`py-3 rounded-2xl text-[9px] font-black transition-all ${amarillas > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>🟨 {amarillas === 1 ? '1ra AM' : 'AMAR'}</button>
        <button disabled={cargando || roja} onClick={() => { if(window.confirm("¿Roja Directa?")) registrarIncidencia('ROJA') }} className="bg-rose-600 hover:bg-rose-500 py-3 rounded-2xl text-[9px] font-black text-white transition-all">🟥 ROJA</button>
      </div>


      <textarea 
        placeholder="Observaciones de la jugadora..."
        value={observacion}
        onChange={(e) => setObservacion(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-[10px] text-slate-300 outline-none focus:border-blue-500 transition-all resize-none italic"
        rows="2"
      ></textarea>
    </div>
  );
};

export default PlanillaArbitro;