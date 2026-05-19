import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PrinterIcon, ChartBarIcon, TrophyIcon } from '@heroicons/react/24/solid';
import CarnetJugadora from './CarnetJugadora';
import GestionFichajesAdmin from './GestionFichajesAdmin';
import axios from 'axios';


const SuperAdminDashboard = () => {
  const [perfil, setPerfil] = useState(null);
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  const [generandoLona, setGenerandoLona] = useState(false);
  const [jugadorasLiga, setJugadorasLiga] = useState([]);
  const [loteParaImprimir, setLoteParaImprimir] = useState([]);
  const [clubesMap, setClubesMap] = useState({});
  const [ligasMap, setLigasMap] = useState({}); // MAPA DE LIGAS PARA EL PLIEGO
  const lienzoRef = useRef(null);
  
  // --- SECCIÓN CORREGIDA: REMOVEMOS LA FUNCIÓN SIN USAR PARA EVITAR EL ERROR DE ESLINT ---
  const [procesandoPliego, setProcesandoPliego] = useState(false);
  const [arrayDeUrlsDeTuBaseDeDatos] = useState([]);
  

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
        setPerfil(p);
        fetchGlobalStats();
        fetchRankingLigas();
        if (p) cargarDatosBase(p.organizacion_id);
      }
    };
    init();
  }, []);

  const fetchGlobalStats = async () => {
    const { count: l } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
    const { count: j } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
    const { count: a } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');
    setStats({ ligas: l || 0, jugadoras: j || 0, alertas: a || 0 });
  };

  const fetchRankingLigas = async () => {
    const { data: orgs } = await supabase.from('organizaciones').select('id, nombre, logo_url');
    if (orgs) {
      const ranking = await Promise.all(orgs.map(async (o) => {
        const { count } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).eq('organizacion_id', o.id);
        return { ...o, total: count || 0 };
      }));
      setRankingLigas(ranking.sort((a, b) => b.total - a.total));
    }
  };

  const cargarDatosBase = async (orgId) => {
    let qJ = supabase.from('jugadoras').select('*');
    if (orgId) qJ = qJ.eq('organizacion_id', orgId);
    const { data: jugs } = await qJ;
    setJugadorasLiga(jugs || []);
    
    // Mapeo de equipos
    const { data: eqs } = await supabase.from('equipos').select('id, nombre, escudo_url');
    const eMap = {}; eqs?.forEach(e => eMap[e.id] = { nombre: e.nombre, logo: e.escudo_url });
    setClubesMap(eMap);

    // MAPEO DE LIGAS (CRUCIAL PARA EL PLIEGO)
    const { data: confs } = await supabase.from('configuracion_liga').select('*');
    const lMap = {}; confs?.forEach(c => lMap[c.organizacion_id] = c);
    setLigasMap(lMap);

    // 💡 NOTA PARA EL NEGOCIO: Si guardás las URLs de los archivos PDF en una tabla de Supabase, 
    // podés descomentar las siguientes líneas dentro de esta función para llenar el pliego automáticamente:
    // const { data: planillas } = await supabase.from('partidos_planillas').select('url_pdf');
    // if (planillas) setArrayDeUrlsDeTuBaseDeDatos(planillas.map(p => p.url_pdf));
  };

  const imprimirBatchHD = async () => {
    if (!lienzoRef.current || jugadorasLiga.length === 0) return;
    setGenerandoLona(true);
    const POR_PLIEGO = 16; 
    try {
      for (let i = 0; i < jugadorasLiga.length; i += POR_PLIEGO) {
        const lote = jugadorasLiga.slice(i, i + POR_PLIEGO);
        setLoteParaImprimir(lote);
        await new Promise(r => setTimeout(r, 7000)); // Espera para blindaje
        const canvas = await html2canvas(lienzoRef.current, { scale: 4, useCORS: true, backgroundColor: "#ffffff", width: 1890, height: 1890 });
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [500, 500] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 500, 500);
        pdf.save(`PLIEGO_HD_P${Math.floor(i/16)+1}.pdf`);
      }
      alert("✅ Pliegos generados.");
    } catch (e) { console.error(e); } finally { setGenerandoLona(false); setLoteParaImprimir([]); }
  };


  const handleDescargarPliegoCompleto = async () => {
    if (!jugadorasLiga || jugadorasLiga.length === 0) {
      return alert("⚠️ No hay jugadoras cargadas para armar el pliego.");
    }

    setProcesandoPliego(true);

    try {
      // Mapeamos los datos exactamente igual a como lo hacés en tu lienzo técnico oculto
      const datosEstructuradosParaCarnets = jugadorasLiga.map(jug => ({
        id: jug.id,
        nombre: jug.nombre,
        apellido: jug.apellido,
        dni: jug.dni,
        categoria: jug.categoria_actual || "Única",
        foto_url: jug.foto_url,
        club_nombre: clubesMap[jug.equipo_id]?.nombre || "S/D",
        club_escudo: clubesMap[jug.equipo_id]?.logo || null,
        liga_nombre: ligasMap[jug.organizacion_id]?.nombre_liga || "LIGA OFICIAL",
        color_primario: ligasMap[jug.organizacion_id]?.color_primario || "#d90082",
        color_secundario: ligasMap[jug.organizacion_id]?.color_secundario || "#ffffff"
      }));

      // Enviamos el lote completo de datos estructurados al servidor
      const respuesta = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/crear-pliego-impresion`, 
        { listaJugadores: datosEstructuradosParaCarnets },
        { responseType: 'blob' }
      );

      const urlBlob = window.URL.createObjectURL(new Blob([respuesta.data], { type: 'application/pdf' }));
      const linkDescarga = document.createElement('a');
      linkDescarga.href = urlBlob;
      
      linkDescarga.setAttribute('download', `pliego_158cm_carnets_${Date.now()}.pdf`);
      document.body.appendChild(linkDescarga);
      linkDescarga.click();
      
      linkDescarga.remove();
      window.URL.revokeObjectURL(urlBlob);

      alert("🚀 Pliego industrial de 158cm con carnets vectoriales generado con éxito.");

    } catch (error) {
      console.error("Error al compilar el pliego maestro en el frontend:", error);
      alert("🚨 Hubo un problema en el servidor al intentar estampar las credenciales en el pliego.");
    } finally {
      setProcesandoPliego(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="flex justify-between items-center border-b border-white/10 pb-8">
          <h1 className="text-4xl font-black uppercase italic">Control <span className="text-rose-600">Maestro</span></h1>
          <div className="flex gap-4">
            <button onClick={imprimirBatchHD} disabled={generandoLona} className="bg-blue-600 px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl disabled:opacity-30 text-xs uppercase">
              <PrinterIcon className="w-5 h-5" /> {generandoLona ? 'PROCESANDO...' : 'IMPRIMIR PLIEGOS HD'}
            </button>
            <button
              onClick={() => handleDescargarPliegoCompleto(arrayDeUrlsDeTuBaseDeDatos)}
              disabled={procesandoPliego}
              className={`px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl ${
                procesandoPliego 
                  ? 'bg-slate-800 text-slate-600 border border-slate-700 animate-pulse' 
                  : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-purple-900/20 active:scale-95'
              }`}
            >
              {procesandoPliego ? "🖨️ COMPILANDO VECTORES EN SERVIDOR..." : "🖨️ ARMAR PLIEGO DE IMPRESIÓN (158 CM)"}
            </button>
          </div>
        </header>

        {/* ANALÍTICA RECUPERADA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl"><ChartBarIcon className="w-6 h-6 text-slate-500 mb-2"/><p className="text-slate-500 font-black text-[10px] uppercase">Ligas</p><h3 className="text-4xl font-black italic">{stats.ligas}</h3></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl border-b-emerald-500/50"><p className="text-emerald-500 font-black text-[10px] uppercase">Jugadoras</p><h3 className="text-4xl font-black italic text-emerald-500">{stats.jugadoras}</h3></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl border-b-rose-500/50"><p className="text-rose-500 font-black text-[10px] uppercase">Alertas</p><h3 className="text-4xl font-black italic text-rose-500">{stats.alertas}</h3></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 bg-slate-900 rounded-3xl border border-white/5 p-4 max-h-[600px] overflow-y-auto">
            <h2 className="text-lg font-black uppercase italic mb-4 flex items-center gap-2"><TrophyIcon className="w-5 h-5 text-amber-500"/> Ranking</h2>
            {rankingLigas.map(l => <div key={l.id} className="p-3 border-b border-white/5 flex justify-between text-[11px] font-bold uppercase"><span>{l.nombre}</span><span className="text-emerald-500">{l.total} JUG</span></div>)}
          </div>
          <div className="lg:col-span-3">
            <section className="bg-slate-900/30 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
              {perfil && <GestionFichajesAdmin perfil={perfil} />}
            </section>
          </div>
        </div>

        {/* LIENZO TÉCNICO OCULTO (Corregido con ligasMap) */}
        <div style={{ position: 'fixed', left: '-10000px', top: '0', background: 'white' }}>
          <div ref={lienzoRef} style={{ width: '500mm', height: '500mm', background: 'white', padding: '10mm', display: 'grid', gridTemplateColumns: 'repeat(2, 185mm)', gridAutoRows: '54mm', gap: '8mm' }}>
            {loteParaImprimir.map(jug => (
              <div key={`p-${jug.id}`} style={{ display: 'flex', gap: '5mm', alignItems: 'center' }}>
                <CarnetJugadora 
                  jugadora={{...jug, club_nombre: clubesMap[jug.equipo_id]?.nombre, club_escudo: clubesMap[jug.equipo_id]?.logo}} 
                  config={ligasMap[jug.organizacion_id]} // ASIGNA LA LIGA CORRECTA A CADA JUGADORA
                  mostrarDorso={false} 
                />
                <CarnetJugadora 
                  jugadora={{...jug, club_nombre: clubesMap[jug.equipo_id]?.nombre, club_escudo: clubesMap[jug.equipo_id]?.logo}} 
                  config={ligasMap[jug.organizacion_id]} 
                  mostrarDorso={true} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;