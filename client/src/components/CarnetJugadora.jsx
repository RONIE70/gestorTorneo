import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

const CarnetJugadora = ({ jugadora, config }) => {
  const carnetRef = useRef();
  const dorsoRef = useRef();

  // Colores definitivos (Magenta Reinas a Negro)
  const EstilosPactados = {
    magenta: '#de1777', 
    negro: '#000000',
    texto: '#ffffff'
  };

  if (!jugadora) return <div className="text-slate-500 text-[10px]">Cargando datos...</div>;

  const urlValidacion = `https://gestor-torneo-ncs1125.vercel.app/verificar/${jugadora?.id || 'demo'}`;

  const handleDescargarPDF = async () => {
    // Tamaño estándar 8.5 x 5.5 cm (ID-1)
    const pdf = new jsPDF('l', 'mm', [85.6, 54]);
    const opcionesCanvas = { 
      scale: 4, 
      useCORS: true, 
      backgroundColor: null,
      logging: false 
    };

    const canvasFrente = await html2canvas(carnetRef.current, opcionesCanvas);
    pdf.addImage(canvasFrente.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.addPage([85.6, 54], 'l');
    const canvasDorso = await html2canvas(dorsoRef.current, opcionesCanvas);
    pdf.addImage(canvasDorso.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.save(`Carnet_${jugadora.apellido}.pdf`);
  };

  // Medidas exactas para el contenedor del DOM (proporción 8.5/5.5)
  const cardContainerStyle = {
    width: '323px',  
    height: '204px', 
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto
  };

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      <div className="flex flex-col gap-6 scale-110">
        
        {/* FRENTE CON CORRECCIONES DE TEXTO Y MARCA DE AGUA */}
        <div 
          ref={carnetRef} 
          style={cardContainerStyle} 
          className="rounded-xl p-3 shadow-2xl relative overflow-hidden border border-white/10 flex flex-col justify-between"
        >
          {/* Marca de agua transparente en el fondo */}
          <span className="absolute -right-2 -bottom-2 text-[55px] font-black italic opacity-10 pointer-events-none whitespace-nowrap uppercase">
            {config?.nombre_liga?.split(' ')[0] || 'LIGA'}
          </span>

          <div className="z-10 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                {config?.nombre_liga || 'LIGA DE LAS NENAS'}
              </h2>
              <p className="text-[6px] font-bold uppercase tracking-[0.3em] opacity-80">
                TEMPORADA OFICIAL 2026
              </p>
            </div>
            {jugadora.club_escudo && (
              <img src={jugadora.club_escudo} className="h-10 w-14 object-contain" alt="club" />
            )}
          </div>

          <div className="flex gap-3 z-10 flex-1 mt-2">
            {/* Foto de Perfil */}
            <div className="w-[90px] h-[115px] bg-black/20 border-2 border-white/20 overflow-hidden rounded-lg shadow-lg">
              <img 
                src={jugadora.foto_url || 'https://placehold.co/150x200/000/FFF?text=FOTO'} 
                className="w-full h-full object-cover" 
                crossOrigin="anonymous" 
                alt="Perfil" 
              />
            </div>

            {/* Bloque de Datos */}
            <div className="flex-1 flex flex-col justify-between py-0.5">
              <div className="space-y-1">
                <h3 className="text-[15px] font-black uppercase leading-[1] tracking-tighter break-words">
                  {jugadora.apellido} {jugadora.nombre}
                </h3>
                
                <div className="flex gap-3">
                  <div>
                    <p className="text-[6px] font-black opacity-60 uppercase">D.N.I.</p>
                    <p className="text-[12px] font-bold">{jugadora.dni}</p>
                  </div>
                  <div>
                    <p className="text-[6px] font-black opacity-60 uppercase">CATEGORÍA</p>
                    <p className="text-[12px] font-bold">{jugadora.categoria_actual || 'SUR 15'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[6px] font-black opacity-60 uppercase">CLUB</p>
                  <p className="text-[11px] font-bold truncate uppercase">{jugadora.club_nombre || 'DE TAQUITO'}</p>
                </div>
              </div>

              {/* Status de Verificación */}
              <div className={`mt-1 inline-flex items-center px-2 py-1 rounded-md border ${
                jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6)
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                <p className="text-[7px] font-black uppercase tracking-widest">
                  {jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6) 
                    ? 'VERIFICACIÓN PENDIENTE' 
                    : 'BIOMETRÍA OK'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <img 
    src={config.logo_url} 
    className="w-full h-full object-contain opacity-70 mix-blend-multiply" 
    alt="Logo" 
    crossOrigin="anonymous"
    style={{ filter: 'contrast(120%)' }} // Ayuda a que el blanco desaparezca mejor
  />
      </div>

      <button 
        onClick={handleDescargarPDF} 
        className="text-white text-[11px] font-black py-4 px-12 rounded-2xl shadow-2xl transition-all uppercase tracking-[0.3em] hover:scale-105 active:scale-95" 
        style={{ backgroundColor: EstilosPactados.magenta }}
      >
        📥 Descargar Carnet PDF
      </button>
    </div>
  );
};

export default CarnetJugadora;