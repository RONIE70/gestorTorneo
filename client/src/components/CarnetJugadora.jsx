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

    const calcularCategoriaSaaS = async () => {

      if (!jugadora?.fecha_nacimiento || !jugadora?.organizacion_id) {
        setNombreCategoria(jugadora?.categoria_actual || "S/D");
        return;
      }

      try {

        const { data: categorias } = await supabase
          .from('categorias')
          .select('nombre, año_desde, año_hasta')
          .eq('organizacion_id', jugadora.organizacion_id);

        if (categorias) {

          const añoNac = new Date(jugadora.fecha_nacimiento).getFullYear();

          const catMatch = categorias.find(c =>
            añoNac >= c.año_desde && añoNac <= (c.año_hasta || añoNac)
          );

          setNombreCategoria(catMatch ? catMatch.nombre : (jugadora.categoria_actual || "S/D"));
        }

      } catch {
        setNombreCategoria(jugadora.categoria_actual || "S/D");
      }

    };

    calcularCategoriaSaaS();

  }, [jugadora]);

  if (!jugadora) return null;

  const urlBase = "https://gestor-torneo.vercel.app";
  const urlValidacion = `${urlBase}/#/verificar/${jugadora.dni}`;

  const esperarImagenes = async (elemento) => {

    await document.fonts.ready;

    const imgs = elemento.querySelectorAll("img");

    await Promise.all(
      Array.from(imgs)
        .filter(img => !img.complete)
        .map(img =>
          new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          })
        )
    );

  };

  const handleDescargarPDF = async () => {

    const pdf = new jsPDF('l', 'mm', [85.6, 54]);

    const opcionesCanvas = {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      logging: false
    };

    await esperarImagenes(carnetRef.current);

    const canvasFrente = await html2canvas(carnetRef.current, opcionesCanvas);

    pdf.addImage(canvasFrente.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.addPage([85.6, 54], 'l');

    await esperarImagenes(dorsoRef.current);

    const canvasDorso = await html2canvas(dorsoRef.current, opcionesCanvas);

    pdf.addImage(canvasDorso.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.save(`Carnet_${jugadora.apellido}.pdf`);

  };

  const cardContainerStyle = {
    width: '323px',
    height: '204px',
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto,
    position: 'relative',
    overflow: 'hidden'
  };

  return (

    <div className="flex flex-col items-center mt-6 space-y-6">

      <div className="flex flex-col gap-6 scale-110">

        {/* FRENTE */}

        {!mostrarDorso && (

          <div
            ref={carnetRef}
            style={cardContainerStyle}
            className="rounded-xl p-3 shadow-2xl border border-white/10 flex flex-col justify-between"
          >

            <span className="absolute -right-2 -bottom-2 text-[55px] font-black italic opacity-10 uppercase">
              {config?.nombre_liga?.split(' ')[0] || 'LIGA'}
            </span>

            <div className="z-10 flex justify-between items-start">

              <div>

                <h2 className="text-2xl font-black italic uppercase">
                  {config?.nombre_liga || 'LIGA DE LAS NENAS'}
                </h2>

                <p className="text-[6px] font-bold uppercase tracking-[0.3em] opacity-80">
                  TEMPORADA OFICIAL 2026
                </p>

              </div>

              {(jugadora.club_escudo || jugadora.equipos?.logo_url || jugadora.equipos?.escudo_url) && (

                <img
                  src={jugadora.club_escudo || jugadora.equipos?.logo_url || jugadora.equipos?.escudo_url}
                  crossOrigin="anonymous"
                  className="h-10 w-12 object-contain"
                  alt="club"
                />

              )}

            </div>

            <div className="flex gap-3 z-10 flex-1 mt-2">

              <div
                className="w-[95px] h-[115px] bg-black/40 border-2 border-white/30 rounded-lg"
                style={{
                  backgroundImage: `url(${jugadora.foto_url || 'https://placehold.co/150x200/000/FFF?text=FOTO'})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />

              <div className="flex-1 flex flex-col justify-between py-0.5">

                <div className="space-y-1">

                  <h3 className="text-[15px] font-black uppercase">
                    {jugadora.apellido} {jugadora.nombre}
                  </h3>

                  <div className="flex gap-3">

                    <div>
                      <p className="text-[6px] font-black opacity-60 uppercase">DNI</p>
                      <p className="text-[11px] font-bold">{jugadora.dni}</p>
                    </div>

                    <div>
                      <p className="text-[6px] font-black opacity-60 uppercase">CATEGORÍA</p>
                      <p className="text-[11px] font-bold uppercase">{nombreCategoria}</p>
                    </div>

                  </div>

                  <div>
                    <p className="text-[6px] font-black opacity-60 uppercase">CLUB</p>
                    <p className="text-[11px] font-bold uppercase">
                      {jugadora.equipos?.nombre || jugadora.club_nombre || 'SIN EQUIPO'}
                    </p>
                  </div>

                </div>

                <div className={`mt-1 inline-flex px-2 py-1 rounded-md border ${
                  jugadora.verificacion_manual || Number(jugadora.distancia_biometrica_oficial) > 0.6
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>

                  <p className="text-[7px] font-black uppercase tracking-widest">
                    {jugadora.verificacion_manual || Number(jugadora.distancia_biometrica_oficial) > 0.6
                      ? 'VERIFICACIÓN PENDIENTE'
                      : 'BIOMETRÍA OK'}
                  </p>

                </div>

              </div>

            </div>

          </div>

        )}

        {/* DORSO */}

        {mostrarDorso && (

          <div
            ref={dorsoRef}
            style={cardContainerStyle}
            className="rounded-xl p-4 shadow-2xl border border-white/10 flex items-center justify-between"
          >

            <div className="w-1/2 flex flex-col items-center">

              <div className="w-36 h-32 rounded-full bg-white/10 flex items-center justify-center p-4">

                {config?.logo_url && (

                  <img
                    src={config.logo_url}
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                    alt="logo"
                    />

                )}

              </div>

              <p className="text-[6px] font-black uppercase mt-4 opacity-40 text-center">
                DOCUMENTO OFICIAL
              </p>

            </div>

            <div className="w-1/2 flex flex-col items-center">

              <div className="bg-white p-2 rounded-lg">

                <QRCodeSVG value={urlValidacion} size={85} level="H" />

              </div>

              <p className="text-[6px] font-black mt-2 opacity-60 uppercase">
                VERIFICACIÓN DIGITAL
              </p>

            </div>

          </div>

        )}

      </div>

      {!mostrarDorso && (

        <button
          onClick={handleDescargarPDF}
          className="text-white text-[11px] font-black py-4 px-12 rounded-2xl shadow-2xl uppercase"
          style={{ backgroundColor: EstilosPactados.magenta }}
        >
          📥 Descargar Carnet PDF
        </button>

      )}

    </div>

  );

};

export default CarnetJugadora;