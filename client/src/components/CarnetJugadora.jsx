import React, { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

const CarnetJugadora = ({ jugadora, config, mostrarDorso = false, esVistaPrevia = false }) => {
  const frenteRef = useRef(null);
  const dorsoRef = useRef(null);
  const [nombreCategoria, setNombreCategoria] = useState("");
  
  // ESTADOS PARA IMÁGENES BLINDADAS (Base64)
  const [fotoB64, setFotoB64] = useState(null);
  const [escudoB64, setEscudoB64] = useState(null);
  const [logoLigaB64, setLogoLigaB64] = useState(null);

  const EstilosPactados = { magenta: '#de1777', negro: '#000000', texto: '#ffffff' };

  // --- FUNCIÓN DE BLINDAJE: Convierte URL a datos internos para el PDF ---
  const transformarBase64 = async (url) => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      console.warn("Error blindando imagen, se usará URL original:", url);
      return url; 
    }
  };

  useEffect(() => {
    const inicializar = async () => {
      if (!jugadora) return;

      // 1. Blindaje inmediato de todas las imágenes
      const f = await transformarBase64(jugadora.foto_url);
      setFotoB64(f);
      const e = await transformarBase64(jugadora.club_escudo || jugadora.equipos?.escudo_url || jugadora.equipos?.logo_url);
      setEscudoB64(e);
      const l = await transformarBase64(config?.logo_url);
      setLogoLigaB64(l);

      // 2. Lógica de Categoría (Prioridad dato directo)
      if (jugadora.categoria_actual && jugadora.categoria_actual !== "S/D") {
        setNombreCategoria(jugadora.categoria_actual);
      } else if (jugadora.fecha_nacimiento) {
        const añoNac = new Date(jugadora.fecha_nacimiento).getUTCFullYear();
        const { data: cats } = await supabase.from('categorias').select('nombre, año_desde, año_hasta').eq('organizacion_id', jugadora.organizacion_id);
        const match = cats?.find(c => añoNac >= c.año_desde && añoNac <= (c.año_hasta || añoNac));
        setNombreCategoria(match ? match.nombre : "S/D");
      }
    };
    inicializar();
  }, [jugadora, config]);

  const handleDescargarPDF = async () => {
    const pdf = new jsPDF('l', 'mm', [85.6, 54]);
    const opts = { scale: 3, useCORS: true, backgroundColor: '#ffffff' };
    
    const canvasF = await html2canvas(frenteRef.current, opts);
    pdf.addImage(canvasF.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);
    
    pdf.addPage([85.6, 54], 'l');
    const canvasD = await html2canvas(dorsoRef.current, opts);
    pdf.addImage(canvasD.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);
    
    pdf.save(`Carnet_${jugadora.apellido}.pdf`);
  };

  if (!jugadora) return null;
  const urlValidacion = `https://gestor-torneo.vercel.app/#/verificar/${jugadora.dni}`;

  const cardStyle = {
    width: '323px', height: '204px',
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto, position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column'
  };

  const UI_FRENTE = (
    <div className="p-3 flex flex-col h-full justify-between relative">
      <span className="absolute -right-2 -bottom-2 text-[55px] font-black italic opacity-10 uppercase pointer-events-none">LIGA</span>
      <div className="z-10 flex justify-between items-start">
        <div>
          <h2 className="text-[20px] font-black italic uppercase leading-none truncate w-48">{config?.nombre_liga || 'LIGA'}</h2>
          <p className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-80 mt-1">TEMPORADA OFICIAL 2026</p>
        </div>
        {escudoB64 && <img src={escudoB64} className="h-10 w-10 object-contain bg-white/10 rounded p-0.5" alt="e" />}
      </div>
      <div className="flex gap-3 z-10 flex-1 mt-2 items-center">
        <div className="w-[90px] h-[110px] min-w-[90px] bg-black/40 border-2 border-white/30 rounded-lg overflow-hidden">
          <img src={fotoB64 || jugadora.foto_url} className="w-full h-full object-cover" alt="p" />
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-1">
          <h3 className="text-[14px] font-black uppercase leading-tight border-b border-white/20 pb-1 mb-1">{jugadora.apellido} <br/> {jugadora.nombre}</h3>
          <div className="grid grid-cols-2 gap-1">
            <div><p className="text-[6px] font-black opacity-60 uppercase">DNI</p><p className="text-[11px] font-bold">{jugadora.dni}</p></div>
            <div><p className="text-[6px] font-black opacity-60 uppercase">CATEGORÍA</p><p className="text-[11px] font-bold uppercase">{nombreCategoria}</p></div>
          </div>
          <div className="mt-1">
            <p className="text-[6px] font-black opacity-60 uppercase">CLUB</p>
            <p className="text-[10px] font-black uppercase truncate leading-none">{jugadora.club_nombre || jugadora.equipos?.nombre || 'SIN CLUB'}</p>
          </div>
          <div className="mt-2 inline-flex w-fit px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[7px] font-black uppercase text-emerald-400">BIOMETRÍA OK</div>
        </div>
      </div>
    </div>
  );

  const UI_DORSO = (
    <div className="flex h-full w-full items-center justify-between p-4 z-10">
      <div className="w-1/2 flex flex-col items-center justify-center border-r border-white/10">
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center p-3">
          {logoLigaB64 && <img src={logoLigaB64} className="max-w-full max-h-full object-contain opacity-80" alt="l" />}
        </div>
        <p className="text-[7px] font-black uppercase mt-3 opacity-50 text-center">DOCUMENTO OFICIAL</p>
      </div>
      <div className="w-1/2 flex flex-col items-center justify-center">
        <div className="bg-white p-1.5 rounded-lg shadow-2xl"><QRCodeSVG value={urlValidacion} size={85} level="H" /></div>
        <p className="text-[7px] font-black mt-3 opacity-70 uppercase text-center">VERIFICACIÓN DIGITAL</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-8">
      {esVistaPrevia ? (
        <>
          <div ref={frenteRef} style={cardStyle} className="rounded-xl shadow-2xl border border-white/10">{UI_FRENTE}</div>
          <div ref={dorsoRef} style={cardStyle} className="rounded-xl shadow-2xl border border-white/10">{UI_DORSO}</div>
          <button onClick={handleDescargarPDF} className="bg-rose-600 text-white font-black py-4 px-12 rounded-2xl shadow-2xl uppercase text-[11px] hover:bg-rose-500 transition-all">
            📥 Descargar Carnet PDF
          </button>
        </>
      ) : (
        <div ref={mostrarDorso ? dorsoRef : frenteRef} style={cardStyle} className="rounded-xl shadow-2xl border border-white/10">
          {mostrarDorso ? UI_DORSO : UI_FRENTE}
        </div>
      )}
    </div>
  );
};

export default CarnetJugadora;