import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

const CarnetJugadora = ({ jugadora, config, mostrarDorso = false, carnetRef }) => {
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [imgB64, setImgB64] = useState({ foto: null, escudo: null, logoLiga: null });

  // CAMBIO: Eliminamos la transparencia del negro (#3937378c -> #1a1a1a)
  // Las transparencias en sublimación suelen salir "lavadas" o con puntos extraños.
  const EstilosPactados = { 
    magenta: '#de1777', 
    negro: '#1a1a1a', // Negro sólido para mayor contraste
    texto: '#ffffff' 
  };

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
  
  // AJUSTE DE TAMAÑO: +1.5mm aprox (323px -> 329px / 204px -> 210px)
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
        /* --- FRENTE --- */
        <div className="p-3 flex flex-col h-full relative" style={{ paddingTop: '16px' }}>
          <span className="absolute -right-2 -bottom-2 text-[60px] font-black italic opacity-10 uppercase pointer-events-none">LIGA</span>
          
          <div className="z-10 flex justify-between items-start mb-1">
            <div className="max-w-[200px]">
              {/* Texto Liga: Aumentado a 19px para legibilidad */}
              <h2 className="text-[19px] font-black italic uppercase leading-none tracking-tighter">
                {config?.nombre_liga || 'LIGA'}
              </h2>
              <p className="text-[9px] font-bold uppercase opacity-90 mt-1">TEMPORADA OFICIAL 2026</p>
            </div>
            {imgB64.escudo && (
              <img 
                src={imgB64.escudo} 
                style={{ position: 'absolute', right: '16px', top: '16px', zIndex: 30 }}
                className="h-12 w-12 object-contain bg-white/20 rounded-md p-0.5" 
                alt="esc" 
              />
            )}
          </div>

          <div className="flex gap-4 z-10 mt-1 items-start">
            {/* Foto Jugadora: Un poco más grande para compensar el tamaño extra */}
            <div className="w-[85px] h-[97px] min-w-[95px] border-white/30 rounded-lg overflow-hidden">
              <img src={imgB64.foto || jugadora.foto_url} 
              className="w-full h-full object-cover" // <-- El object-cover mantiene la proporción
              style={{ aspectRatio: '85/97' }} // <-- Fuerza la proporción en el PDF
              alt="p" />
            </div>

            <div className="flex-1 flex flex-col">
              {/* Nombre: Subimos a 16px para que no se empaste al sublimar */}
              <h3 className="text-[16px] font-black uppercase leading-tight border-b-2 border-white/20 pb-1 mb-2">
                {jugadora.apellido} <br/> {jugadora.nombre}
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] opacity-70 uppercase font-black">D.N.I.</p>
                  <p className="text-[13px] font-bold leading-none">{jugadora.dni}</p>
                </div>
                <div>
                  <p className="text-[9px] opacity-70 uppercase font-black">CATEGORÍA</p>
                  <p className="text-[13px] font-bold uppercase leading-none">{nombreCategoria}</p>
                </div>
              </div>

              <div className="mt-1">
                <p className="text-[8px] opacity-70 uppercase font-black leading-none">CLUB</p>
                <p className="text-[13px] font-black uppercase truncate max-w-[160px] leading-normal">
                  {jugadora.club_nombre || jugadora.equipos?.nombre || 'SIN CLUB'}
                </p>
              </div>
            </div>
          </div>

          {/* Tag Biometría: Color sólido y letras más grandes */}
          <div 
            style={{ 
              position: 'absolute', 
              left: '16px', 
              bottom: '16px', 
              zIndex: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '85px',
              height: '15px',
              backgroundColor: '#0cfcac', // Verde sólido brillante
              border: '1px solid #ffffff50'
            }}
            className="rounded"
          >
            <p className="text-[9px] font-black uppercase text-black tracking-tighter m-0.5">
              BIOMETRÍA OK
            </p>
          </div>
        </div>
      ) : (
        /* --- DORSO --- */
        <div className="flex h-full w-full items-center justify-between p-5 z-10">
          <div className="w-1/2 flex flex-col items-center justify-center border-r border-white/10 h-3/4">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center p-3">
              {imgB64.logoLiga && <img src={imgB64.logoLiga} className="max-w-full max-h-full object-contain" alt="l" />}
            </div>
            <p className="text-[10px] font-black uppercase mt-4 opacity-70 text-center leading-tight">DOCUMENTO OFICIAL<br/>INTRANSFERIBLE</p>
          </div>
          <div className="w-1/2 flex flex-col items-center justify-center">
            <div className="bg-white p-2 rounded-lg">
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