import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import CarnetJugadora from './CarnetJugadora';

const GestionFichajesAdmin = ({ perfil }) => {
  const [jugadoras, setJugadoras] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [descargando, setDescargando] = useState(false);

  const frenteRef = useRef(null);
  const dorsoRef = useRef(null);

  useEffect(() => {
    const cargar = async () => {
      let query = supabase.from('jugadoras').select('*, equipos(nombre, escudo_url), organizaciones(nombre, logo_url)');
      if (perfil.rol !== 'superadmin') query = query.eq('organizacion_id', perfil.organizacion_id);
      const { data } = await query.order('apellido', { ascending: true });
      setJugadoras(data || []);
    };
    if (perfil) cargar();
  }, [perfil]);

  const handleDescargarPDF = async () => {
    if (!frenteRef.current || !dorsoRef.current) return;
    setDescargando(true);
    try {
      const pdf = new jsPDF('l', 'mm', [85.6, 54]);
      const opts = { scale: 3, useCORS: true, backgroundColor: '#ffffff' };
      const cF = await html2canvas(frenteRef.current, opts);
      pdf.addImage(cF.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);
      pdf.addPage([85.6, 54], 'l');
      const cD = await html2canvas(dorsoRef.current, opts);
      pdf.addImage(cD.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);
      pdf.save(`Carnet_${seleccionada.apellido}.pdf`);
    } catch (e) { console.error(e); } finally { setDescargando(false); }
  };

  const filtradas = jugadoras.filter(j => j.apellido?.toLowerCase().includes(filtro.toLowerCase()) || j.dni?.includes(filtro));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-[700px] bg-slate-900/50">
      {/* LISTADO */}
      <div className="lg:col-span-1 border-r border-white/5 bg-slate-950/20 p-4">
        <input type="text" placeholder="Buscar..." className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs outline-none focus:border-rose-600 mb-4" onChange={e => setFiltro(e.target.value)} />
        <div className="overflow-y-auto max-h-[600px] space-y-2 custom-scrollbar">
          {filtradas.map(j => (
            <div key={j.id} onClick={() => setSeleccionada(j)} className={`p-4 rounded-xl cursor-pointer transition-all ${seleccionada?.id === j.id ? 'bg-rose-600 shadow-lg' : 'hover:bg-white/5'}`}>
              <p className="text-xs font-black uppercase">{j.apellido}, {j.nombre}</p>
              <p className="text-[9px] opacity-60 uppercase">{j.organizaciones?.nombre}</p>
            </div>
          ))}
        </div>
      </div>

      {/* VISTA PREVIA VERTICAL (Corregida para evitar doble dorso) */}
      <div className="lg:col-span-2 p-8 flex flex-col items-center bg-black/40 overflow-y-auto max-h-[750px]">
        {seleccionada ? (
          <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
            
            {/* 1. FRENTE */}
            <div className="mb-10 text-center">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-3 tracking-widest">FRENTE DEL CARNET</p>
              <CarnetJugadora 
                carnetRef={frenteRef}
                jugadora={seleccionada} 
                config={{ nombre_liga: seleccionada.organizaciones?.nombre, logo_url: seleccionada.organizaciones?.logo_url }} 
                mostrarDorso={false} 
              />
            </div>

            {/* 2. DORSO */}
            <div className="mb-12 text-center">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-3 tracking-widest">DORSO DEL CARNET</p>
              <CarnetJugadora 
                carnetRef={dorsoRef}
                jugadora={seleccionada} 
                config={{ nombre_liga: seleccionada.organizaciones?.nombre, logo_url: seleccionada.organizaciones?.logo_url }} 
                mostrarDorso={true} 
              />
            </div>

            {/* 3. BOTÓN AL FINAL DE TODO */}
            <button 
              onClick={handleDescargarPDF}
              disabled={descargando}
              className="bg-rose-600 text-white font-black py-4 px-16 rounded-[2.5rem] shadow-2xl uppercase text-[11px] hover:bg-rose-500 transition-all disabled:opacity-50"
            >
              {descargando ? 'PROCESANDO...' : '📥 DESCARGAR CARNET COMPLETO'}
            </button>

          </div>
        ) : (
          <div className="mt-40 opacity-20 text-center uppercase font-black tracking-widest text-xs">Selecciona una jugadora para ver su carnet</div>
        )}
      </div>
    </div>
  );
};

export default GestionFichajesAdmin;