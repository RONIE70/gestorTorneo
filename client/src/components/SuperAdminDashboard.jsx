import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PrinterIcon } from '@heroicons/react/24/solid';
import CarnetJugadora from './CarnetJugadora';
import GestionFichajesAdmin from './GestionFichajesAdmin';

const SuperAdminDashboard = () => {
  const [perfil, setPerfil] = useState(null);
  const [generandoLona, setGenerandoLona] = useState(false);
  const [jugadorasLiga, setJugadorasLiga] = useState([]);
  const [loteParaImprimir, setLoteParaImprimir] = useState([]);
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const lienzoRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
        setPerfil(p);
        if (p) cargarDatos(p.organizacion_id);
      }
    };
    load();
  }, []);

  const cargarDatos = async (orgId) => {
    try {
      let qJ = supabase.from('jugadoras').select('*');
      if (orgId) qJ = qJ.eq('organizacion_id', orgId);
      const { data: jugs } = await qJ;
      setJugadorasLiga(jugs || []);
      
      let qE = supabase.from('equipos').select('id, nombre, logo_url, escudo_url');
      if (orgId) qE = qE.eq('organizacion_id', orgId);
      const { data: eqs } = await qE;
      const map = {};
      eqs?.forEach(e => map[e.id] = { nombre: e.nombre, logo: e.logo_url || e.escudo_url });
      setClubesMap(map);

      const { data: configs } = await supabase.from('configuracion_liga').select('*');
      setConfigLiga(orgId ? configs.find(c => c.organizacion_id === orgId) : configs[0]);
    } catch (err) { console.error(err); }
  };

  const imprimirBatch = async () => {
    if (!lienzoRef.current || jugadorasLiga.length === 0) return;
    setGenerandoLona(true);
    const POR_PLIEGO = 15; // 2 col x 7/8 filas
    
    try {
      for (let i = 0; i < jugadorasLiga.length; i += POR_PLIEGO) {
        const lote = jugadorasLiga.slice(i, i + POR_PLIEGO);
        setLoteParaImprimir(lote);

        // TIEMPO CRÍTICO: Esperar a que se dibujen las fotos Base64
        await new Promise(r => setTimeout(r, 6000));

        const canvas = await html2canvas(lienzoRef.current, {
          scale: 2, useCORS: true, backgroundColor: "#ffffff",
          width: 1890, height: 1890
        });

        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [500, 500] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 500, 500);
        pdf.save(`PLIEGO_500x500_PARTE_${Math.floor(i/POR_PLIEGO)+1}.pdf`);
      }
      alert("✅ Pliegos descargados.");
    } catch (e) { console.error(e); } finally { 
      setGenerandoLona(false); 
      setLoteParaImprimir([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-black uppercase italic italic">Control <span className="text-rose-600">Maestro</span></h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">S SaaS HD - Calandra 500mm x 500mm</p>
        </div>
        <button onClick={imprimirBatch} disabled={generandoLona} className="bg-blue-600 px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all disabled:opacity-30">
          <PrinterIcon className="w-5 h-5" /> {generandoLona ? 'GENERANDO PLIEGOS...' : 'IMPRIMIR PLIEGOS HD'}
        </button>
      </header>

      {perfil && <GestionFichajesAdmin perfil={perfil} />}

      {/* LIENZO OCULTO TÉCNICO */}
      <div style={{ position: 'fixed', left: '-10000px', top: '0', background: 'white' }}>
        <div ref={lienzoRef} style={{ width: '500mm', height: '500mm', background: 'white', padding: '10mm', display: 'grid', gridTemplateColumns: 'repeat(2, 185mm)', gridAutoRows: '54mm', gap: '8mm' }}>
          {loteParaImprimir.map(jug => (
            <div key={`p-${jug.id}`} style={{ display: 'flex', gap: '5mm', alignItems: 'center' }}>
              <CarnetJugadora jugadora={{...jug, club_nombre: clubesMap[jug.equipo_id]?.nombre, club_escudo: clubesMap[jug.equipo_id]?.logo}} config={configLiga} mostrarDorso={false} />
              <CarnetJugadora jugadora={{...jug, club_nombre: clubesMap[jug.equipo_id]?.nombre, club_escudo: clubesMap[jug.equipo_id]?.logo}} config={configLiga} mostrarDorso={true} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;