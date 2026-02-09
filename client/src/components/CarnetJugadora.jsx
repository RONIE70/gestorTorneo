import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

const CarnetJugadora = ({ jugadora, config }) => {
  const carnetRef = useRef();
  const dorsoRef = useRef();

  const safeConfig = config || {
    color_fondo_carnet: '#de1777', // Rosa SC-1225
    color_texto_carnet: '#ffffff',
    color_recuadro_carnet: '#000000',
    nombre_liga: 'LIGA DE LAS NENAS',
    logo_url: null
  };

  const EstilosLiga = {
    fondo: safeConfig.color_fondo_carnet,
    texto: safeConfig.color_texto_carnet,
    acento: safeConfig.color_recuadro_carnet,
    logoLiga: safeConfig.logo_url || null,
    escudoClub: jugadora?.club_escudo || null
  };

  if (!jugadora) return <div className="text-slate-500 text-[10px]">Esperando datos...</div>;

  const urlValidacion = `https://gestor-torneo-ncs1125.vercel.app/verificar/${jugadora?.id || 'demo'}`;

  const handleDescargarPDF = async () => {
    const pdf = new jsPDF('l', 'mm', [85.6, 54]); // Tamaño ID-1 estándar

    // Renderizar Frente
    const canvasFrente = await html2canvas(carnetRef.current, { scale: 4, useCORS: true });
    const imgFrente = canvasFrente.toDataURL('image/png');
    pdf.addImage(imgFrente, 'PNG', 0, 0, 85.6, 54);

    // Agregar Nueva Página para el Dorso
    pdf.addPage([85.6, 54], 'l');
    const canvasDorso = await html2canvas(dorsoRef.current, { scale: 4, useCORS: true });
    const imgDorso = canvasDorso.toDataURL('image/png');
    pdf.addImage(imgDorso, 'PNG', 0, 0, 85.6, 54);

    pdf.save(`Carnet_${jugadora.apellido}_${jugadora.dni}.pdf`);
  };

  // Estilo base para las tarjetas para asegurar que midan 8.5 x 5.5 cm en el DOM
  const cardStyle = {
    width: '323px',  // ~85.6mm
    height: '204px', // ~53.9mm
    background: `linear-gradient(180deg, ${EstilosLiga.fondo} 0%, #000000 100%)`,
    color: EstilosLiga.texto
  };

  return (
    <div className="flex flex-col items-center mt-10 space-y-6">
      <div className="flex flex-col gap-8">
        
        {/* FRENTE */}
        <div 
          ref={carnetRef}
          style={cardStyle}
          className="rounded-xl p-3 shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between select-none"
        >
          <div className="z-10 flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-1">
                {safeConfig.nombre_liga}
              </h2>
              <p className="text-[6px] font-bold uppercase tracking-[0.2em] opacity-80">
                TEMPORADA OFICIAL 2026
              </p>
            </div>
            {/* Escudo Club Arriba Derecha */}
            {EstilosLiga.escudoClub && (
              <img src={EstilosLiga.escudoClub} className="h-8 w-12 object-contain" alt="club" />
            )}
          </div>

          <div className="flex gap-3 mt-1 z-10 flex-1 overflow-hidden">
            {/* Foto Perfil */}
            <div className="w-[85px] h-[105px] bg-slate-900 border border-white/50 overflow-hidden rounded shadow-lg">
              <img 
                src={jugadora.foto_url || 'https://placehold.co/150x200/000/FFF?text=FOTO'} 
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
                alt="Perfil"
              />
            </div>

            {/* Datos */}
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <div>
                  <p className="text-[7px] font-black uppercase opacity-70">APELLIDO Y NOMBRE</p>
                  <h3 className="text-[13px] font-black uppercase leading-none truncate">
                    {jugadora.apellido} {jugadora.nombre}
                  </h3>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-[7px] font-black uppercase opacity-70">D.N.I.</p>
                    <p className="text-[11px] font-bold">{jugadora.dni}</p>
                  </div>
                  <div className="w-16">
                    <p className="text-[7px] font-black uppercase opacity-70">CATEGORÍA</p>
                    <p className="text-[11px] font-bold">{jugadora.categoria_actual || '2026'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[7px] font-black uppercase opacity-70">CLUB</p>
                  <p className="text-[10px] font-bold truncate">{jugadora.club_nombre || 'S/D'}</p>
                </div>
              </div>

              {/* Sello Biométrico */}
              <div className={`mt-1 inline-block px-2 py-0.5 rounded border ${
                jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' 
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              }`}>
                <p className="text-[7px] font-black uppercase leading-none">
                  {jugadora.verificacion_manual || (jugadora.distancia_biometrica > 0.6) 
                    ? 'VERIFICACIÓN PENDIENTE' 
                    : 'BIOMETRÍA OK'}
                </p>
              </div>
            </div>
          </div>
          <span className="absolute -bottom-1 -right-1 text-[40px] font-black italic opacity-5 pointer-events-none">
            {safeConfig.nombre_liga.split(' ')[0]}
          </span>
        </div>

        {/* DORSO */}
        <div 
          ref={dorsoRef}
          style={cardStyle}
          className="rounded-xl p-4 shadow-2xl relative overflow-hidden border border-white/20 flex items-center justify-between"
        >
           <div className="z-10 w-1/2 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center p-4">
                {EstilosLiga.logoLiga && (
                  <img src={EstilosLiga.logoLiga} className="w-full h-full object-contain opacity-40" alt="Logo" crossOrigin="anonymous"/>
                )}
              </div>
              <p className="text-[6px] font-black uppercase mt-4 opacity-50 text-center tracking-widest leading-tight">
                PROPIEDAD OFICIAL DE LA LIGA<br/>DOCUMENTO INTRANSFERIBLE
              </p>
           </div>

           <div className="z-10 w-1/2 flex flex-col items-center">
              <div className="bg-white p-2 rounded shadow-xl">
                  <QRCodeSVG value={urlValidacion} size={85} level={"H"} />
              </div>
              <p className="text-[6px] font-black mt-2 opacity-80 uppercase tracking-tighter">
                Escanear para verificar vigencia
              </p>
           </div>
        </div>
      </div>

      <button 
        onClick={handleDescargarPDF} 
        style={{ backgroundColor: EstilosLiga.fondo }}
        className="hover:scale-105 active:scale-95 text-white text-[11px] font-black py-4 px-10 rounded-full shadow-xl transition-all uppercase tracking-widest border-b-4 border-black/30"
      >
        📥 Descargar Carnet PDF
      </button>
    </div>
  );
};

export default CarnetJugadora;