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

  // --- LÓGICA DE URL PARA EL QR (Fusionada) ---
  const urlBase = "https://gestor-torneo.vercel.app";
  const urlValidacion = `${urlBase}/verificar/${jugadora.id}`;

  const handleDescargarPDF = async () => {
    const pdf = new jsPDF('l', 'mm', [85.6, 54]);
    const opcionesCanvas = { 
      scale: 4, 
      useCORS: true, 
      backgroundColor: null,
      logging: false, 
      imageTimeout: 0,
      onclone: (clonedDoc) => {
        // Esto asegura que los gradientes se mantengan en el renderizado
        clonedDoc.querySelectorAll('.carnet-container-pdf').forEach(el => {
          el.style.webkitPrintColorAdjust = 'exact';
          // --- ESTO ES LO QUE SOLUCIONA EL MÓVIL ---
          el.style.width = '323px';  // Forzamos ancho de PC
          el.style.height = '204px'; // Forzamos alto de PC
          el.style.transform = 'scale(1)'; // Quitamos cualquier zoom del móvil
          el.style.margin = '0';
          el.style.padding = '12px'; 
        });
      }
    };

    const canvasFrente = await html2canvas(carnetRef.current, opcionesCanvas);
    pdf.addImage(canvasFrente.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.addPage([85.6, 54], 'l');
    const canvasDorso = await html2canvas(dorsoRef.current, opcionesCanvas);
    pdf.addImage(canvasDorso.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.save(`Carnet_${jugadora.apellido}.pdf`);
  };

  const cardContainerStyle = {
    width: '323px',  
    height: '204px', 
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  };

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      <div className="flex flex-col gap-6 scale-110">
        
        {/* FRENTE */}
        <div 
          ref={carnetRef} 
          style={cardContainerStyle} 
          className="rounded-xl p-3 shadow-2xl relative overflow-hidden border border-white/10 flex flex-col justify-between carnet-container-pdf"
        >
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
            {(jugadora.club_escudo || jugadora.equipos?.escudo_url) && (
              <img 
                src={jugadora.club_escudo || jugadora.equipos?.escudo_url} 
                className="h-10 w-12 object-contain" 
                alt="club"
                crossOrigin="anonymous" 
              />
            )}
          </div>

          <div className="flex gap-3 z-10 flex-1 mt-2">
            <div className="w-[90px] h-[115px] bg-black/20 border-2 border-white/20 overflow-hidden rounded-lg shadow-lg">
              <img 
                src={jugadora.foto_url || 'https://placehold.co/150x200/000/FFF?text=FOTO'} 
                className="w-full h-full object-cover" 
                crossOrigin="anonymous" 
                alt="Perfil" 
              />
            </div>

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
                  <p className="text-[11px] font-bold truncate uppercase">{jugadora.equipos?.nombre || jugadora.club_nombre || 'SIN EQUIPO'}</p>
                </div>
              </div>

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

        {/* DORSO */}
        <div 
          ref={dorsoRef} 
          style={cardContainerStyle} 
          className="rounded-xl p-4 shadow-2xl relative overflow-hidden border border-white/10 flex items-center justify-between carnet-container-pdf"
        >
           <div className="z-10 w-1/2 flex flex-col items-center">
              <div className="w-36 h-32 rounded-full bg-white/10 border border-white/20 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
                {config?.logo_url && (
                  <img 
                    src={config.logo_url} 
                    className="w-full h-full object-contain opacity-80 mix-blend-multiply" 
                    alt="Logo" 
                    crossOrigin="anonymous"
                    style={{ filter: 'contrast(120%)' }} 
                  />
                )}
              </div>
              <p className="text-[6px] font-black uppercase mt-4 opacity-40 text-center tracking-[0.2em] leading-tight">
                DOCUMENTO OFICIAL<br/>INTRANSFERIBLE
              </p>
           </div>

           <div className="z-10 w-1/2 flex flex-col items-center">
              <div className="bg-white p-2 rounded-lg shadow-2xl">
                  {/* QR INTEGRADO CORRECTAMENTE */}
                  <QRCodeSVG value={urlValidacion} size={85} level={"H"} />
              </div>
              <p className="text-[6px] font-black mt-2 opacity-60 uppercase tracking-widest">
                VERIFICACIÓN DIGITAL
              </p>
           </div>
        </div>
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