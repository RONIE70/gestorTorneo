import React, {  useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

const CarnetJugadora = ({ jugadora, config, mostrarDorso = false, carnetRef }) => {
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [imgB64, setImgB64] = useState({ foto: null, escudo: null, logoLiga: null });

  const EstilosPactados = { magenta: '#de1777', negro: '#000000', texto: '#ffffff' };

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
      // Blindaje de imágenes
      const [f, e, l] = await Promise.all([
        toBase64(jugadora.foto_url),
        toBase64(jugadora.club_escudo || jugadora.equipos?.escudo_url || jugadora.equipos?.logo_url),
        toBase64(config?.logo_url)
      ]);
      setImgB64({ foto: f, escudo: e, logoLiga: l });

      // Categoria
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
    width: '323px', height: '204px',
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column'
  };

  return (
    <div ref={carnetRef} style={cardStyle} className="rounded-xl shadow-2xl border border-white/10">
      {!mostrarDorso ? (
        <div className="p-3 flex flex-col h-full justify-between relative">
          <span className="absolute -right-2 -bottom-2 text-[55px] font-black italic opacity-10 uppercase pointer-events-none">LIGA</span>
          <div className="z-10 flex justify-between items-start mb-1">
            <div>
              {/* TAMAÑO AJUSTADO PARA NOMBRE COMPLETO */}
              <h2 className="text-[17.5px] font-black italic uppercase leading-none w-58 tracking-tighter">
                {config?.nombre_liga || 'LIGA'}
              </h2>
              <p className="text-[7px] font-bold uppercase opacity-80 mt-1">TEMPORADA OFICIAL 2026</p>
            </div>
            {imgB64.escudo && (
  <img 
    src={imgB64.escudo} 
    style={{ 
      position: 'absolute', 
      right: '1cm', 
      top: '12px', // Ajustado para que alinee con el texto de la liga
      zIndex: 30 
    }}
    className="h-10 w-10 object-contain bg-white/10 rounded p-0.5 shadow-sm" 
    alt="escudo" 
  />
)}
          </div>
          <div className="flex gap-3 z-10 flex-1 mt-1">
            <div className="w-[90px] h-[100px] min-w-[90px] bg-black/40 border-2 border-white/30 rounded-lg overflow-hidden">
              <img src={imgB64.foto || jugadora.foto_url} className="w-full h-full object-cover" alt="p" />
            </div>
            <div className="flex-1 flex flex-col justify-start space-y-0.5 pt-1">
              <h3 className="text-[13px] font-black uppercase leading-[1.1] border-b border-white/20 pb-0.5 mb-1">{jugadora.apellido} <br/> {jugadora.nombre}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[7px] opacity-60 uppercase font-bold">D.N.I.</p><p className="text-[11px] font-bold">{jugadora.dni}</p></div>
                <div><p className="text-[7px] opacity-60 uppercase font-bold">CATEGORIA</p><p className="text-[11px] font-bold uppercase">{nombreCategoria}</p></div>
              </div>
              <div><p className="text-[7px] opacity-60 uppercase font-bold">CLUB:                                                                                               </p><p className="text-[10px] font-black uppercase truncate">{jugadora.club_nombre || jugadora.equipos?.nombre || 'SIN CLUB'}</p></div>
              {/* Tag Biometría posicionado a 1.5cm del borde derecho */}
<div 
  style={{ 
    position: 'absolute', 
    right: '1cm', 
    bottom: '12px', // Ajusta esta altura para que no pise el borde inferior
    zIndex: 20 
  }}
  className="inline-flex w-fit px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30"
>
  <div 
  style={{ 
    position: 'absolute', 
    right: '1cm', 
    bottom: '12px', 
    zIndex: 20,
    display: 'flex',           // Activa Flexbox
    alignItems: 'center',      // Centra verticalmente
    justifyContent: 'center',  // Centra horizontalmente
    minWidth: '60px',          // Le damos un ancho mínimo para que respire
    height: '14px'             // Altura fija para controlar el centro
  }}
  className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2"
>
  <p className="text-[7px] font-black uppercase text-emerald-400 tracking-tighter leading-none m-0">
    BIOMETRÍA OK
  </p>
</div>
</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-between p-4 z-10">
          <div className="w-1/2 flex flex-col items-center justify-center border-r border-white/10">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center p-3">
              {imgB64.logoLiga && <img src={imgB64.logoLiga} className="max-w-full max-h-full object-contain opacity-80" alt="l" />}
            </div>
            <p className="text-[7px] font-black uppercase mt-3 opacity-50 text-center">DOCUMENTO OFICIAL</p>
          </div>
          <div className="w-1/2 flex flex-col items-center justify-center">
            <div className="bg-white p-1.5 rounded-lg shadow-2xl"><QRCodeSVG value={urlValidacion} size={85} level="H" /></div>
            <p className="text-[7px] font-black mt-3 opacity-70 uppercase text-center">VERIFICACIÓN DIGITAL</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarnetJugadora;