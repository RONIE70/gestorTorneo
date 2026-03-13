import React, { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

const CarnetJugadora = ({ jugadora, config, mostrarDorso = false }) => {
  const carnetRef = useRef(null);
  const dorsoRef = useRef(null);
  const [nombreCategoria, setNombreCategoria] = useState("");

  const EstilosPactados = {
    magenta: '#de1777',
    negro: '#000000',
    texto: '#ffffff'
  };

  useEffect(() => {
    const calcularCategoria = async () => {
      if (!jugadora?.fecha_nacimiento) return setNombreCategoria(jugadora?.categoria_actual || "S/D");
      const añoNac = new Date(jugadora.fecha_nacimiento).getUTCFullYear();
      
      const ID_LIGA_NENAS = "af190e5a-f84a-4fbf-8a82-1b04dbb72178";
      if (jugadora.organizacion_id === ID_LIGA_NENAS) {
        if (añoNac >= 1994 && añoNac <= 2008) return setNombreCategoria("Primera (Libre)");
        if (añoNac < 1994) return setNombreCategoria("Veteranas");
        const inicio = añoNac % 2 === 0 ? añoNac - 1 : añoNac;
        return setNombreCategoria(`${inicio}-${inicio + 1}`);
      }

      try {
        const { data: cats } = await supabase.from('categorias').select('nombre, año_desde, año_hasta').eq('organizacion_id', jugadora.organizacion_id);
        const match = cats?.find(c => añoNac >= c.año_desde && añoNac <= (c.año_hasta || añoNac));
        setNombreCategoria(match ? match.nombre : (jugadora.categoria_actual || "S/D"));
      } catch { setNombreCategoria(jugadora.categoria_actual || "S/D"); }
    };
    calcularCategoria();
  }, [jugadora]);

  const esperarImagenes = async (elemento) => {
    if (!elemento) return;
    await document.fonts.ready;
    const imgs = Array.from(elemento.querySelectorAll("img"));
    await Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const handleDescargarPDF = async () => {
    const pdf = new jsPDF('l', 'mm', [85.6, 54]);
    const opciones = { scale: 2.5, useCORS: true, backgroundColor: '#ffffff' };

    await esperarImagenes(carnetRef.current);
    const canvasF = await html2canvas(carnetRef.current, opciones);
    pdf.addImage(canvasF.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.addPage([85.6, 54], 'l');
    await esperarImagenes(dorsoRef.current);
    const canvasD = await html2canvas(dorsoRef.current, opciones);
    pdf.addImage(canvasD.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.save(`Carnet_${jugadora.apellido}.pdf`);
  };

  const cardStyle = {
    width: '323px', height: '204px',
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto, position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  };

  if (!jugadora) return null;
  const urlValidacion = `https://gestor-torneo.vercel.app/#/verificar/${jugadora.dni}`;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* FRENTE */}
      <div ref={carnetRef} style={{ ...cardStyle, display: mostrarDorso ? 'none' : 'flex' }} className="rounded-xl p-3 shadow-2xl border border-white/10">
        <span className="absolute -right-2 -bottom-2 text-[55px] font-black italic opacity-10 uppercase">{config?.nombre_liga?.split(' ')[0] || 'LIGA'}</span>
        <div className="z-10 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black italic uppercase leading-none">{config?.nombre_liga || 'LIGA'}</h2>
            <p className="text-[6px] font-bold uppercase tracking-widest opacity-80">TEMPORADA 2026</p>
          </div>
          {(jugadora.club_logo || jugadora.equipos?.logo_url) && (
            <img src={jugadora.club_logo || jugadora.equipos?.logo_url} crossOrigin="anonymous" className="h-10 w-12 object-contain bg-white/10 rounded p-0.5" alt="c" />
          )}
        </div>
        <div className="flex gap-3 z-10 flex-1 mt-2">
          <img src={jugadora.foto_url} crossOrigin="anonymous" className="w-[95px] h-[115px] object-cover border-2 border-white/30 rounded-lg" alt="j" />
          <div className="flex-1 flex flex-col justify-between py-0.5">
            <div className="space-y-1">
              <h3 className="text-[14px] font-black uppercase leading-tight">{jugadora.apellido} {jugadora.nombre}</h3>
              <div className="flex gap-3">
                <div><p className="text-[6px] opacity-60 uppercase font-black">DNI</p><p className="text-[11px] font-bold">{jugadora.dni}</p></div>
                <div><p className="text-[6px] opacity-60 uppercase font-black">CATEGORÍA</p><p className="text-[11px] font-bold">{nombreCategoria}</p></div>
              </div>
              <div><p className="text-[6px] opacity-60 uppercase font-black">CLUB</p><p className="text-[10px] font-black uppercase truncate">{jugadora.club_nombre || jugadora.equipos?.nombre || 'SIN CLUB'}</p></div>
            </div>
            <div className="mt-1 inline-flex w-fit px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[7px] font-black uppercase">BIOMETRÍA OK</div>
          </div>
        </div>
      </div>

      {/* DORSO */}
      <div ref={dorsoRef} style={{ ...cardStyle, display: mostrarDorso ? 'flex' : 'none' }} className="rounded-xl p-4 shadow-2xl border border-white/10 flex items-center justify-between">
        <div className="w-1/2 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center p-4">
            {config?.logo_url && <img src={config.logo_url} crossOrigin="anonymous" className="max-w-full max-h-full object-contain opacity-70" alt="l" />}
          </div>
          <p className="text-[6px] font-black uppercase mt-2 opacity-40 text-center">DOCUMENTO OFICIAL INTRANSFERIBLE</p>
        </div>
        <div className="w-1/2 flex flex-col items-center">
          <div className="bg-white p-1.5 rounded-lg"><QRCodeSVG value={urlValidacion} size={80} level="H" /></div>
          <p className="text-[6px] font-black mt-2 opacity-60 uppercase">VERIFICACIÓN DIGITAL</p>
        </div>
      </div>

      {!mostrarDorso && (
        <button onClick={handleDescargarPDF} className="text-white text-[10px] font-black py-3 px-8 rounded-xl shadow-xl uppercase" style={{ backgroundColor: EstilosPactados.magenta }}>📥 Bajar Individual</button>
      )}
    </div>
  );
};

export default CarnetJugadora;