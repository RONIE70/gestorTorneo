import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import PlanillaArbitro from '../components/PlanillaArbitro';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- FUNCIÓN AUXILIAR FUERA DEL COMPONENTE ---
const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const extension = url.split('.').pop().toLowerCase();
      const format = (extension === 'png') ? 'image/png' : 'image/jpeg';
      resolve({
        data: canvas.toDataURL(format),
        format: (extension === 'png') ? 'PNG' : 'JPEG'
      });
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

// --- COMPONENTE DE ACCIONES GENERALES ---
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
          className="bg-slate-800 hover:bg-rose-600/20 hover:border-rose-600 border border-slate-700 py-4 rounded-2xl text-[9px] font-black uppercase text-white transition-all"
        >
          🚫 Expulsar Delegado
        </button>
        <button 
          onClick={() => reportarExtra('PUBLICO')}
          className="bg-slate-800 hover:bg-rose-600/20 hover:border-rose-600 border border-slate-700 py-4 rounded-2xl text-[9px] font-black uppercase text-white transition-all"
        >
          ⚠️ Sanción Público
        </button>
      </div>
    </div>
  );
};

const AdminArbitros = () => {
  const [partidos, setPartidos] = useState([]);
  const [partidoActivo, setPartidoActivo] = useState(null);
  const [jugadoras, setJugadoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(1);
  const [crucesDisponibles, setCrucesDisponibles] = useState([]);
  const [cruceActivo, setCruceActivo] = useState(null);
  const [golesL, setGolesL] = useState(0);
  const [golesV, setGolesV] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [logoBase64, setLogoBase64] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [configLiga, setConfigLiga] = useState(null);
  const [incidenciasResumen, setIncidenciasResumen] = useState({ 
    amarillasL: 0, rojasL: 0, amarillasV: 0, rojasV: 0, detallesSanciones: [] 
  });
  const [firmas, setFirmas] = useState({ arb: '', loc: '', vis: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { 
    fetchPartidos(); 
    cargarConfiguracionYLogo();
  }, []);

  const cargarConfiguracionYLogo = async () => {
    try {
      const { data } = await supabase.from('configuracion_liga').select('*').eq('id', 1).single();
      if (data) {
        setConfigLiga(data);
        if (data.logo_torneo) {
          const logoData = await getBase64ImageFromURL(data.logo_torneo);
          setLogoBase64(logoData);
        }
      }
    } catch (err) { console.error("Error al cargar logo:", err); }
  };

  const fetchPartidos = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('partidos').select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)').eq('finalizado', false).order('nro_fecha', { ascending: true });
      if (data && data.length > 0) {
        setPartidos(data);
        const unicos = data.reduce((acc, p) => {
          const key = `${p.nro_fecha}-${p.local_id}-${p.visitante_id}-${p.zona}`;
          if (!acc[key]) acc[key] = { nro_fecha: p.nro_fecha, local: p.local, visitante: p.visitante, local_id: p.local_id, visitante_id: p.visitante_id, zona: p.zona };
          return acc;
        }, {});
        setCrucesDisponibles(Object.values(unicos));
      } else { setCrucesDisponibles([]); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const cargarJugadorasCitadas = async (partidoId) => {
    try {
      // eslint-disable-next-line no-unused-vars
      const { data, error } = await supabase.from('planillas_citadas').select(`jugadora_id, equipo_id, jugadoras:jugadoras (id, nombre, apellido, dni, foto_url)`).eq('partido_id', partidoId);
      if (data) {
        setJugadoras(data.map(item => ({ id: item.jugadoras.id, nombre: item.jugadoras.nombre, apellido: item.jugadoras.apellido, equipo_id: item.equipo_id, foto_url: item.jugadoras.foto_url, dorsal: "S/N" })));
      }
    } catch (err) { console.error("Error cargando citadas:", err.message); }
  };

  const manejarIncidenciaFija = async (tipo, equipoId, jugadoraInfo) => {
    const esLocal = equipoId === partidoActivo.local_id;
    const esExtraCampo = jugadoraInfo.id === null;
    if (tipo === 'GOL' && !esExtraCampo) {
      if (esLocal) setGolesL(prev => prev + 1); else setGolesV(prev => prev + 1);
      await supabase.from('goles').insert({ partido_id: partidoActivo.id, jugadora_id: jugadoraInfo.id, equipo_id: equipoId });
    }
    if (tipo === 'GOL' || tipo === 'AMARILLA' || tipo === 'ROJA' || esExtraCampo) {
      await supabase.from('incidencias_partido').insert({ partido_id: partidoActivo.id, jugadora_id: jugadoraInfo.id, equipo_id: equipoId, tipo: tipo, categoria: partidoActivo.categoria, aclaracion: jugadoraInfo.motivo_extra || '' });
      setIncidenciasResumen(prev => ({ ...prev, detallesSanciones: [...prev.detallesSanciones, { nombre: esExtraCampo ? jugadoraInfo.apellido : `${jugadoraInfo.apellido}, ${jugadoraInfo.nombre}`, tipo: esExtraCampo ? `EXPULSIÓN ${tipo}` : tipo, club: esLocal ? partidoActivo.local.nombre : partidoActivo.visitante.nombre, foto: jugadoraInfo.foto_url || null }] }));
    }
  };

  const cerrarActaFinalConPDF = async () => {
    if (!firmas.arb || !firmas.loc || !firmas.vis) return alert("Faltan firmas");
    setEnviando(true);
    try {
      await supabase.from('partidos').update({ goles_local: golesL, goles_visitante: golesV, resultado_local: golesL, resultado_visitante: golesV, finalizado: true, jugado: true, firma_arbitro: firmas.arb, firma_local: firmas.loc, firma_visitante: firmas.vis }).eq('id', partidoActivo.id);
      alert("✅ Acta guardada.");
      setPartidoActivo(null);
      fetchPartidos();
    } catch (error) { alert("Error: " + error.message); } finally { setEnviando(false); }
  };

  if (loading && !partidoActivo) return <div className="p-20 text-center text-blue-500 font-black animate-pulse uppercase">Cargando...</div>;

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans">
      {!partidoActivo ? (
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="border-l-4 border-amber-500 pl-4"><h1 className="text-3xl font-black uppercase italic tracking-tighter">Planilla de <span className="text-amber-500">Juego</span></h1></header>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} onClick={() => { setFechaSeleccionada(n); setCruceActivo(null); }} className={`px-6 py-3 rounded-2xl text-xs font-black transition-all flex-shrink-0 ${fechaSeleccionada === n ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>FECHA {n}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-[10px] font-black uppercase text-blue-500 ml-2 tracking-widest">Encuentros</h2>
              {crucesDisponibles.filter(c => c.nro_fecha === fechaSeleccionada).map((c, i) => (
                <div key={i} onClick={() => setCruceActivo(c)} className={`p-5 rounded-[2rem] border cursor-pointer transition-all relative overflow-hidden ${cruceActivo?.local_id === c.local_id && cruceActivo?.visitante_id === c.visitante_id ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-slate-900 border-slate-800'}`}>
                   {c.local.nombre} VS {c.visitante.nombre}
                </div>
              ))}
            </div>
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-[10px] font-black uppercase text-amber-500 ml-2 tracking-widest">Categorías</h2>
              {cruceActivo ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                {partidos.filter(p => p.nro_fecha === cruceActivo.nro_fecha && p.local_id === cruceActivo.local_id && p.visitante_id === cruceActivo.visitante_id).map(p => (
                  <div key={p.id} onClick={() => { setPartidoActivo(p); setGolesL(0); setGolesV(0); setIncidenciasResumen({ amarillasL: 0, rojasL: 0, amarillasV: 0, rojasV: 0, detallesSanciones: [] }); cargarJugadorasCitadas(p.id); }} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center group cursor-pointer hover:border-emerald-500 shadow-xl transition-all relative overflow-hidden">
                    <div>
                      <span className="text-[9px] font-black text-emerald-500 uppercase">{p.categoria}</span>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Pendiente</p>
                    </div>
                    <div className="bg-emerald-600/10 text-emerald-500 p-3 rounded-full">📝</div>
                  </div>
                ))}
              </div> : <div className="h-40 flex items-center justify-center border-2 border-dashed border-slate-900 rounded-[2rem] text-slate-700 font-black uppercase text-xs">Selecciona un encuentro</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
          <button onClick={() => setPartidoActivo(null)} className="text-[10px] font-black uppercase text-slate-500 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">← Volver</button>
          
          <div className="text-center bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="flex justify-around items-center gap-4 mt-6">
              <div className="flex flex-col items-center gap-2">
                 <button onClick={() => setGolesL(v => v + 1)} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700">▲</button>
                 <span className="text-5xl font-black text-blue-500 leading-none">{golesL}</span>
                 <button onClick={() => setGolesL(v => Math.max(0, v - 1))} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700">▼</button>
                 <p className="text-[10px] font-black uppercase text-slate-400">{partidoActivo.local?.nombre}</p>
              </div>
              <div className="text-2xl font-black text-slate-700 italic">VS</div>
              <div className="flex flex-col items-center gap-2">
                 <button onClick={() => setGolesV(v => v + 1)} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700">▲</button>
                 <span className="text-5xl font-black text-white leading-none">{golesV}</span>
                 <button onClick={() => setGolesV(v => Math.max(0, v - 1))} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700">▼</button>
                 <p className="text-[10px] font-black uppercase text-slate-400">{partidoActivo.visitante?.nombre}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <AccionesGenerales equipoNombre={partidoActivo.local?.nombre} equipoId={partidoActivo.local_id} onIncidencia={manejarIncidenciaFija} />
            <AccionesGenerales equipoNombre={partidoActivo.visitante?.nombre} equipoId={partidoActivo.visitante_id} onIncidencia={manejarIncidenciaFija} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jugadoras.map(j => (
              <PlanillaArbitro key={j.id} jugadora={j} partidoId={partidoActivo.id} categoria={partidoActivo.categoria} onIncidencia={manejarIncidenciaFija} />
            ))}
          </div>

          <section className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] border-t-4 border-amber-500 shadow-2xl max-w-2xl mx-auto space-y-8 relative">
            <h3 className="text-center text-xl font-black uppercase italic text-amber-500 tracking-tighter">Resumen Oficial para Firmas</h3>
            <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
               <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6 text-center">
                <div className="flex-1">
                  <div className="text-6xl font-black text-white">{golesL}</div>
                  <p className="text-[10px] font-black text-blue-500 uppercase mt-2">{partidoActivo.local?.nombre}</p>
                </div>
                <div className="text-2xl font-black text-slate-800 italic px-6">FINAL</div>
                <div className="flex-1">
                  <div className="text-6xl font-black text-white">{golesV}</div>
                  <p className="text-[10px] font-black text-white uppercase mt-2">{partidoActivo.visitante?.nombre}</p>
                </div>
              </div>

              <div className="mb-8 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-500 italic mb-2 tracking-widest">Desglose de Sanciones:</h4>
                {incidenciasResumen.detallesSanciones.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                    <div className="flex-1">
                      <span className="block text-[10px] font-black uppercase leading-none">{s.nombre}</span>
                      <span className="text-[8px] text-slate-500 uppercase font-bold">{s.club}</span>
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${s.tipo.includes('ROJA') || s.tipo.includes('EXPULSIÓN') ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>{s.tipo}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <input placeholder="✍️ FIRMA ÁRBITRO PRINCIPAL" onChange={(e) => setFirmas({...firmas, arb: e.target.value})} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-[11px] font-black uppercase text-blue-400 outline-none focus:border-amber-500 transition-all" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="FIRMA LOCAL" onChange={(e) => setFirmas({...firmas, loc: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 outline-none focus:border-amber-500 transition-all" />
                  <input placeholder="FIRMA VISITA" onChange={(e) => setFirmas({...firmas, vis: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 outline-none focus:border-amber-500 transition-all" />
                </div>
              </div>
            </div>

            <button onClick={cerrarActaFinalConPDF} disabled={enviando} className={`w-full py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl transition-all ${enviando ? 'bg-slate-800 text-slate-600' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'}`}>
              {enviando ? 'GUARDANDO...' : '🚀 VALIDAR Y FIRMAR ACTA FINAL'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminArbitros;