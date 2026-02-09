import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

const CarnetJugadora = ({ jugadora, config }) => {
  const carnetRef = useRef();
  const dorsoRef = useRef();

  // Colores pactados (Magenta Reinas a Negro)
  const EstilosPactados = {
    magenta: '#de1777', // El magenta de SC-1225/Reinas [cite: 1]
    negro: '#000000',
    texto: '#ffffff'
  };

  if (!jugadora) return <div className="text-slate-500 text-[10px]">Esperando datos...</div>;

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

    pdf.save(`Carnet_${jugadora.apellido}_${jugadora.dni}.pdf`);
  };

  // Medidas exactas para el contenedor del DOM (proporción 8.5/5.5)
  const cardContainerStyle = {
    width: '323px',  
    height: '204px', 
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 70%)`,
    color: EstilosPactados.texto
  };

  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      <div className="flex flex-col gap-6 scale-110">
        
        {/* FRENTE MODERNO */}
        <div 
          ref={carnetRef}
          style={cardContainerStyle}
          className="rounded-xl p-3 shadow-2xl relative overflow-hidden border border-white/10 flex flex-col justify-between"
        >
          {/* Fondo decorativo: Nombre de la liga en marca de agua gigante */}
          <span className="absolute -right-4 -bottom-2 text-[50px] font-black italic opacity-10 pointer-events-none whitespace-nowrap">
            {config?.nombre_liga?.split(' ')[0] || 'REINAS'}
          </span>

          <div className="z-10 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                {config?.nombre_liga || 'LIGA DE LAS NENAS'}
              </h2>
              <p className="text-[6px] font-bold uppercase tracking-[0.3em] opacity-80">
                TEMPORADA OFICIAL 2026 [cite: 2]
              </p>
            </div>
            {jugadora.club_escudo && (
              <img src={jugadora.club_escudo} className="h-10 w-14 object-contain" alt="club" />
            )}
          </div>

          <div className="flex gap-3 z-10 flex-1 mt-2">
            {/* Foto Perfil con borde moderno */}
            <div className="w-[90px] h-[115px] bg-black/20 border-2 border-white/20 overflow-hidden rounded-lg shadow-inner">
              <img 
                src={jugadora.foto_url || 'https://placehold.co/150x200/000/FFF?text=FOTO'} 
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
                alt="Perfil"
              />
            </div>

            {/* Bloque de Datos - Estilo Minimalista */}
            <div className="flex-1 flex flex-col justify-between py-0.5">
              <div className="space-y-1.5">
                <div>
                  <h3 className="text-[16px] font-black uppercase leading-none truncate tracking-tighter">
                    {jugadora.apellido} {jugadora.nombre} [cite: 11, 20]
                  </h3>
                </div>
                
                <div className="flex gap-3">
                  <div>
                    <p className="text-[6px] font-black opacity-60 uppercase">D.N.I. [cite: 12, 22]</p>
                    <p className="text-[12px] font-bold tracking-tight">{jugadora.dni}</p>
                  </div>
                  <div>
                    <p className="text-[6px] font-black opacity-60 uppercase">CATEGORÍA [cite: 9]</p>
                    <p className="text-[12px] font-bold">{jugadora.categoria_actual || 'SUR 15'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[6px] font-black opacity-60 uppercase">CLUB [cite: 4]</p>
                  <p className="text-[11px] font-bold truncate uppercase">{jugadora.club_nombre || 'DE TAQUITO'}</p>
                </div>
              </div>

              {/* Status de Verificación */}
              <div className={`mt-1 inline-flex items-center px-2 py-1 rounded-md border ${
                jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6)
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                <div className={`w-1 h-1 rounded-full mr-1.5 animate-pulse ${
                   jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6) ? 'bg-amber-500' : 'bg-emerald-400'
                }`} />
                <p className="text-[7px] font-black uppercase tracking-widest">
                  {jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6) 
                    ? 'VERIFICACIÓN PENDIENTE [cite: 3, 17]' 
                    : 'BIOMETRÍA OK'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DORSO MODERNO */}
        <div 
          ref={dorsoRef}
          style={cardContainerStyle}
          className="rounded-xl p-4 shadow-2xl relative overflow-hidden border border-white/10 flex items-center justify-between"
        >
           <div className="z-10 w-1/2 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center p-4 backdrop-blur-sm">
                {config?.logo_url && (
                  <img src={config.logo_url} className="w-full h-full object-contain opacity-50" alt="Logo" crossOrigin="anonymous"/>
                )}
              </div>
              <p className="text-[6px] font-black uppercase mt-4 opacity-40 text-center tracking-[0.2em] leading-tight">
                DOCUMENTO OFICIAL<br/>INTRANSFERIBLE
              </p>
           </div>

           <div className="z-10 w-1/2 flex flex-col items-center">
              <div className="bg-white p-2 rounded-lg shadow-2xl">
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
        className="group relative hover:scale-105 active:scale-95 text-white text-[11px] font-black py-4 px-12 rounded-2xl shadow-2xl transition-all uppercase tracking-[0.3em] overflow-hidden"
        style={{ backgroundColor: EstilosPactados.magenta }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        📥 Descargar Carnet PDF
      </button>
    </div>
  );
};

export default CarnetJugadora;