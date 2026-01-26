import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

const CarnetJugadora = ({ jugadora, config }) => {
  const carnetRef = useRef();

  // --- SOLUCIÓN: Si config es null, creamos un objeto seguro ---
  const safeConfig = config || {
    color_fondo_carnet: '#de1777', // Rosa SC-1225
    color_texto_carnet: '#ffffff',
    color_recuadro_carnet: '#000000',
    nombre_liga: 'CARGANDO...',
    logo_url: null
  };

  const EstilosLiga = {
    fondo: safeConfig.color_fondo_carnet,
    texto: safeConfig.color_texto_carnet,
    acento: safeConfig.color_recuadro_carnet,
    logoLiga: safeConfig.logo_url || safeConfig.logo_torneo || null,
    escudoClub: jugadora?.club_escudo || null
  };

  // Si no hay jugadora, mostramos un mensaje pequeño en lugar de nada
  if (!jugadora) return <div className="text-slate-500 text-[10px]">Esperando datos de jugadora...</div>;

  const urlValidacion = `https://gestor-torneo-ncs1125.vercel.app/verificar/${jugadora?.id || 'demo'}`;
  
  // ... (aquí sigue el resto de tu código usando EstilosLiga y safeConfig)
  const handleDescargarPDF = async () => {
    const element = carnetRef.current;
    const canvas = await html2canvas(element, { 
      scale: 3, 
      useCORS: true, 
      allowTaint: true,
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
          className="w-[350px] h-[210px] rounded-lg p-2 shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between"
        >
          {/* Header Estilo Imagen */}
          <div className="z-10 flex justify-between items-start ">
            <div className="flex-1">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                {config?.nombre_liga || 'LIGA DE LAS NENAS'}
            </h2>
            <p className="text-[5px] font-bold uppercase tracking-[0.3em] mt-0 opacity-80">
        TEMPORADA OFICIAL 2026
      </p>
            </div>
          </div>

          <div className="flex gap-4 mt-1 z-10">
    {/* Foto de Perfil Enmarcada (TAMAÑO CARNET) */}
    <div className="w-[100px] h-[122px] bg-slate-900 border-2 border-white overflow-hidden rounded-md shadow-2xl flex-shrink-1">
       <img 
          src={jugadora.foto_url || 'https://via.placeholder.com/150'} 
          className="w-full h-full object-cover"
          alt="Foto"
          crossOrigin="anonymous"
        />
    </div>

            {/* Datos Derecha con Recuadros */}
            <div className="flex-1 space-y-2">
                <div className="space-y-0.5">
                    <p className="text-[8px] font-black uppercase italic">CLUB:</p>
                    <div style={{ backgroundColor: EstilosLiga.fondo }} className="h-6 rounded-sm border border-black/130 flex items-center px-2">
                        <span className="text-[10px] font-bold truncate uppercase">{jugadora.club_nombre || 'S/D'}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 space-y-0.5">
                        <p className="text-[8px] font-black uppercase italic">F. NACIMIENTO:</p>
                        <div style={{ backgroundColor: EstilosLiga.fondo }} className="h-6 rounded-sm border border-black/130 flex items-center px-1">
                            <span className="text-[10px] font-bold uppercase">{jugadora.fecha_nacimiento || 'XX/XX/XXXX'}</span>
                        </div>
                    </div>
                    <div className="w-24 space-y-0.5">
                        <p className="text-[8px] font-black uppercase italic">CATEGORÍA:</p>
                        <div style={{ backgroundColor: EstilosLiga.fondo }} className="h-6 rounded-sm border border-black/130 flex items-center px-2">
                            <span className="text-[10px] font-bold uppercase truncate">{jugadora.categoria_actual || '2026'}</span>
                        </div>
                    </div>
                </div>

                <div className="pt-0">
                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">
                        {jugadora.nombre} {jugadora.apellido}
                    </h3>
                    
                </div>
                <div className="bg-black/140 px-0 py-0.5 rounded border border-white/10 w-full text-center">
            <p className="text-[13px] font-black tracking-widest text-white">
                D.N.I. {jugadora.dni}
            </p>
        </div>
            </div>
          </div>

          {/* Logo Circular Acento */}
          <div className="absolute top-2 right-6 w-18 h-10 bg-white/20 
           flex items-center justify-center backdrop-blur-sm border border-white/130">
             {EstilosLiga.escudoClub ? (
                <img src={EstilosLiga.escudoClub} className="w-14 h-10 object-contain" alt="escudo club"/>
             ) : (
                <div className="text-white text-[8px] font-black"></div>
             )}
          </div>
       {/* Sello Dinámico de Validación */}
<div className={`absolute bottom-2 left-4 border px-3 py-1 rounded-xl z-20 ${
  jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6)
    ? 'bg-amber-500/10 border-amber-500/20' 
    : 'bg-emerald-500/10 border-emerald-500/20'
}`}>
  <p className={`text-[8px] font-black uppercase tracking-tighter leading-none ${
    jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6)
      ? 'text-amber-500' 
      : 'text-emerald-400'
  }`}>
    {jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6) 
      ? 'VERIFICACIÓN PENDIENTE' 
      : 'BIOMETRÍA OK'}
  </p>
</div>
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
                    {EstilosLiga.logoLiga ? (
                        <img src={EstilosLiga.logoLiga} className="w-24 h-24 object-contain opacity-80" alt="Marca de Agua" crossOrigin="anonymous"/>
                    ) : (
                        <div className="text-white/30 text-xs font-black italic">sin logo</div>
                    )}
                </div>
                <h2 className="text-xs font-black italic uppercase tracking-tighter mt-4 text-center">
                    {config?.nombre_liga || 'L   D   L   N  - LANUS'}
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
                    •FUTSAL FEMENINO INFANTIL•
                </p>
           </div>
           
           <span className="absolute bottom-2 right-4 text-[8px] font-mono opacity-60">DIGITAL SC</span>
        </div>

      </div>

      <button 
        onClick={handleDescargarPDF} 
        style={{ backgroundColor: EstilosLiga.fondo }}
        className="mt-4 hover:scale-105 active:scale-90 text-white text-[9px] font-black py-5 px-9 rounded-2xl shadow-2xl transition-all flex items-center gap-3 uppercase tracking-[0.2em] border border-white/20"
      >
        📥 Descargar Carnet 
      </button>
    </div>
  );
};

export default CarnetJugadora;