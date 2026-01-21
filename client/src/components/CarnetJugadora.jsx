import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

const CarnetJugadora = ({ jugadora, config }) => {
  const carnetRef = useRef();

  // Mantenemos la lógica de edición de colores
  const EstilosLiga = {
    fondo: config?.color_fondo_carnet || '#d90082', // Rosa fuerte por defecto como la imagen
    texto: config?.color_texto_carnet || '#ffffff',
    acento: config?.color_recuadro_carnet || '#000000', // Negro para los recuadros
    logo: config?.logo_url || config?.logo_torneo || null 
  };

  if (!jugadora) return null;

  const urlValidacion = `https://gestor-torneo-ncs1125.vercel.app/verificar/${jugadora.id}`;

  const handleDescargarPDF = async () => {
    const element = carnetRef.current;
    const canvas = await html2canvas(element, { 
      scale: 3, 
      useCORS: true, 
      backgroundColor: null 
    });
    
    const imgData = canvas.toDataURL('image/png');
    // Ajustamos el PDF para que quepan ambas caras (frente y dorso)
    const pdf = new jsPDF('p', 'mm', [90, 130]); 
    pdf.addImage(imgData, 'PNG', 2, 2, 85.6, 120);
    pdf.save(`Carnet_${jugadora.apellido}_${jugadora.dni}.pdf`);
  };

  return (
    <div className="flex flex-col items-center mt-10 animate-fade-in">
      <div ref={carnetRef} className="p-2 bg-transparent flex flex-col gap-4">
        
        {/* VISTA FRONTAL (FRENTE) */}
        <div 
          style={{ 
            background: `linear-gradient(180deg, ${EstilosLiga.fondo} 0%, #000000 100%)`,
            color: EstilosLiga.texto 
          }}
          className="w-[350px] h-[210px] rounded-lg p-4 shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between"
        >
          {/* Header Estilo Imagen */}
          <div className="text-center z-10">
            <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">
                {config?.nombre_liga || 'LA LIGA DE LAS NENAS'}
            </h2>
            <p className="text-[7px] font-bold uppercase tracking-widest mt-1 opacity-90">
                FUTSAL FEMENINO INFANTIL - LANUS - 2026
            </p>
          </div>

          <div className="flex gap-3 mt-2 z-10">
            {/* Foto de Perfil Enmarcada */}
            <div className="w-32 h-40 bg-black border-2 border-black overflow-hidden rounded-sm shadow-xl">
               <img 
                  src={jugadora.foto_url || 'https://via.placeholder.com/150'} 
                  className="w-full h-full object-cover"
                  alt="Foto"
                />
            </div>

            {/* Datos Derecha con Recuadros */}
            <div className="flex-1 space-y-2">
                <div className="space-y-0.5">
                    <p className="text-[8px] font-black uppercase italic">INSTITUCIÓN:</p>
                    <div style={{ backgroundColor: EstilosLiga.fondo }} className="h-6 rounded-sm border border-black/50 flex items-center px-2">
                        <span className="text-[10px] font-bold truncate uppercase">{jugadora.club_nombre || 'S/D'}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 space-y-0.5">
                        <p className="text-[8px] font-black uppercase italic">FECHA DE NACIMIENTO:</p>
                        <div style={{ backgroundColor: EstilosLiga.fondo }} className="h-6 rounded-sm border border-black/50 flex items-center px-2">
                            <span className="text-[10px] font-bold uppercase">{jugadora.fecha_nacimiento || 'XX/XX/XXXX'}</span>
                        </div>
                    </div>
                    <div className="w-24 space-y-0.5">
                        <p className="text-[8px] font-black uppercase italic">CATEGORÍA:</p>
                        <div style={{ backgroundColor: EstilosLiga.fondo }} className="h-6 rounded-sm border border-black/50 flex items-center px-2">
                            <span className="text-[10px] font-bold uppercase truncate">{jugadora.categoria_actual || '2026'}</span>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">
                        {jugadora.nombre} {jugadora.apellido}
                    </h3>
                    <p className="text-xs font-bold tracking-widest mt-1 opacity-80">
                        D.N.I. {jugadora.dni}
                    </p>
                </div>
            </div>
          </div>

          {/* Logo Circular Acento */}
          <div className="absolute top-8 right-2 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
             {EstilosLiga.logo ? (
                <img src={EstilosLiga.logo} className="w-10 h-10 object-contain" alt="Logo"/>
             ) : (
                <div className="text-white text-[8px] font-black">LOGO</div>
             )}
          </div>
          <span className="absolute bottom-2 right-4 text-[8px] font-mono opacity-60">23:17</span>
        </div>

        {/* VISTA TRASERA (DORSO) */}
        <div 
          style={{ 
            background: `linear-gradient(180deg, ${EstilosLiga.fondo} 0%, #000000 100%)`,
            color: EstilosLiga.texto 
          }}
          className="w-[350px] h-[210px] rounded-lg p-4 shadow-2xl relative overflow-hidden border border-white/20 flex items-center justify-between"
        >
           {/* Logo Grande Fondo */}
           <div className="absolute -left-10 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
           
           <div className="z-10 w-1/2 flex flex-col items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center shadow-inner relative">
                    {EstilosLiga.logo ? (
                        <img src={EstilosLiga.logo} className="w-24 h-24 object-contain opacity-80" alt="Logo"/>
                    ) : (
                        <div className="text-white/30 text-xs font-black italic">MARCA AGUA</div>
                    )}
                </div>
                <h2 className="text-xs font-black italic uppercase tracking-tighter mt-4 text-center">
                    {config?.nombre_liga || 'LA LIGA DE LAS NENAS'}
                </h2>
           </div>

           {/* QR XL */}
           <div className="z-10 w-1/2 flex flex-col items-center justify-center">
                <div className="bg-white p-3 rounded-lg shadow-2xl">
                    <QRCodeSVG 
                        value={urlValidacion} 
                        size={100} 
                        level={"H"} 
                    />
                </div>
                <p className="text-[7px] font-black uppercase mt-4 tracking-widest opacity-80 text-center">
                    FUTSAL FEMENINO INFANTIL - LANUS - 2026
                </p>
           </div>
           
           <span className="absolute bottom-2 right-4 text-[8px] font-mono opacity-60">23:17</span>
        </div>

      </div>

      <button 
        onClick={handleDescargarPDF} 
        style={{ backgroundColor: EstilosLiga.fondo }}
        className="mt-8 hover:scale-105 active:scale-95 text-white text-[10px] font-black py-4 px-12 rounded-2xl shadow-2xl transition-all flex items-center gap-3 uppercase tracking-[0.2em] border border-white/20"
      >
        📥 Descargar Credencial Completa (Frente y Dorso)
      </button>
    </div>
  );
};

export default CarnetJugadora;