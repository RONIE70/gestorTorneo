import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

const CarnetJugadora = ({ jugadora, config, mostrarDorso = false, carnetRef }) => {
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [imgB64, setImgB64] = useState({ foto: null, escudo: null, logoLiga: null });

  const EstilosPactados = { magenta: '#de1777', negro: '#1a1a1a', texto: '#ffffff' };

  const toBase64 = async (url) => {
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
    } catch (e) { return url; }
  };

  useEffect(() => {
    const cargarTodo = async () => {
      if (!jugadora) return;
      const [f, e, l] = await Promise.all([
        toBase64(jugadora.foto_url),
        toBase64(jugadora.club_escudo || jugadora.equipos?.escudo_url || jugadora.equipos?.logo_url),
        toBase64(config?.logo_url)
      ]);
      setImgB64({ foto: f, escudo: e, logoLiga: l });

      if (jugadora.categoria_actual && jugadora.categoria_actual !== "S/D") {
        setNombreCategoria(jugadora.categoria_actual);
      } else if (jugadora.fecha_nacimiento) {
        const añoNac = new Date(jugadora.fecha_nacimiento).getUTCFullYear();
        const { data: cats } = await supabase.from('categorias').select('nombre, año_desde, año_hasta').eq('organizacion_id', jugadora.organizacion_id);
        const match = cats?.find(c => añoNac >= c.año_desde && añoNac <= (c.año_hasta || añoNac));
        setNombreCategoria(match ? match.nombre : "S/D");
      }
    };
    cargarTodo();
  }, [jugadora, config]);

  if (!jugadora) return null;
  const urlValidacion = `https://gestor-torneo.vercel.app/#/verificar/${jugadora.dni}`;
  
  const cardStyle = {
    width: '329px', 
    height: '210px',
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 70%)`,
    color: EstilosPactados.texto,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
  };

  return (
    <div ref={carnetRef} style={cardStyle} className="rounded-xl shadow-2xl border border-white/20">
      {!mostrarDorso ? (
        <div className="p-3 flex flex-col h-full relative" style={{ paddingTop: '16px' }}>
          {/* Marca de agua Liga */}
          <span className="absolute -right-2 -bottom-2 text-[60px] font-black italic opacity-10 uppercase pointer-events-none">LIGA</span>
          
          {/* Header */}
          <div className="z-10 flex justify-between items-start mb-1">
            <div className="max-w-[200px]">
              <h2 className="text-[19px] font-black italic uppercase leading-none tracking-tighter">
                {config?.nombre_liga || 'LIGA'}
              </h2>
              <p className="text-[9px] font-bold uppercase opacity-90 mt-1">TEMPORADA OFICIAL 2026</p>
            </div>
            {imgB64.escudo && (
              <img src={imgB64.escudo} className="h-12 w-12 object-contain bg-white/20 rounded-md p-0.5" alt="esc" />
            )}
          </div>

          <div className="flex gap-4 z-10 mt-2 items-start">
            {/* Foto Jugadora: ACHICADA (82x94) */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-[82px] h-[94px] border-2 border-white/30 rounded-lg overflow-hidden bg-black/40">
                <img src={imgB64.foto || jugadora.foto_url} className="w-full h-full object-cover" alt="p" />
              </div>
              
              {/* TAG BIOMETRÍA: Ahora debajo de la foto para liberar espacio del club */}
              <div className="bg-[#0cfcac] px-1 py-0.5 rounded border border-white/30 min-w-[82px] text-center">
                <p className="text-[8px] font-black uppercase text-black m-0 leading-none">BIOMETRÍA OK</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <h3 className="text-[16px] font-black uppercase leading-tight border-b-2 border-white/20 pb-1 mb-2">
                {jugadora.apellido} <br/> {jugadora.nombre}
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[8px] opacity-70 uppercase font-black">D.N.I.</p>
                  <p className="text-[13px] font-bold leading-none">{jugadora.dni}</p>
                </div>
                <div>
                  <p className="text-[8px] opacity-70 uppercase font-black">CATEGORÍA</p>
                  <p className="text-[13px] font-bold uppercase leading-none">{nombreCategoria}</p>
                </div>
              </div>

              {/* Club: Ahora tiene más espacio porque la biometría se movió */}
              <div className="mt-4">
                <p className="text-[9px] opacity-70 uppercase font-black leading-none mb-1">CLUB</p>
                <p className="text-[14px] font-black uppercase leading-tight text-[#0cfcac]">
                  {jugadora.club_nombre || jugadora.equipos?.nombre || 'SIN CLUB'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-between p-5 z-10">
          <div className="w-1/2 flex flex-col items-center justify-center border-r border-white/10 h-3/4">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center p-3">
              {imgB64.logoLiga && <img src={imgB64.logoLiga} className="max-w-full max-h-full object-contain" alt="l" />}
            </div>
            <p className="text-[10px] font-black uppercase mt-4 opacity-70 text-center leading-tight">DOCUMENTO OFICIAL<br/>INTRANSFERIBLE</p>
          </div>
          <div className="w-1/2 flex flex-col items-center justify-center">
            <div className="bg-white p-2 rounded-lg shadow-xl">
              <QRCodeSVG value={urlValidacion} size={90} level="H" />
            </div>
            <p className="text-[10px] font-black mt-4 opacity-80 uppercase tracking-widest text-center">VERIFICACIÓN DIGITAL</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarnetJugadora;