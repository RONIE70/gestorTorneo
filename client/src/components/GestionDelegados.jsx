/* eslint-disable no-undef */
import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlusIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';

// 1. COMPONENTE DEL CARNET (Recibe configLiga como prop)
export const CarnetDelDelegado = ({ data, clubNombre, soloDiseño = false, configLiga }) => {
  const carnetRef = useRef(null);
  const urlVerificacion = `${window.location.origin}/#/verificar/delegado/${data.dni}`;

  const descargarCarnet = async () => {
    if (!carnetRef.current) return;
    try {
      const canvas = await html2canvas(carnetRef.current, {
        useCORS: true,
        scale: 4,
        backgroundColor: "#000000",
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `Delegado_${data.nombre}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Error al descargar carnet:", err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        ref={carnetRef}
        className="w-[66.8mm] h-[86.9mm] bg-black border-[4px] border-[#e10098] rounded-[20px] overflow-hidden shadow-2xl relative flex flex-col items-center"
        style={{ minWidth: '66.8mm', minHeight: '86.9mm', maxWidth: '66.8mm', maxHeight: '86.9mm', 
          backgroundColor: '#000000' // Forzado para el canvas
        }}
      >
        <div className="w-full bg-[#e10098] py-1.5 text-center shadow-md z-20">
          <span className="text-black font-black tracking-[0.1em] text-[10px] uppercase">
            {configLiga?.nombre_liga || "Liga de las Nenas"}
          </span>
        </div>

        <div className="mt-1 z-20">
          <span className="text-white text-[10px] font-black uppercase tracking-[0.25em]">DELEGADO HABILITADO</span>
        </div>

        <div className="mt-2 w-28 h-32 rounded-full border-[3px] border-[#e10098] overflow-hidden bg-slate-900 shadow-lg z-20 flex items-center justify-center">
          <img 
            src={data.foto_url} 
            className="min-w-full min-h-full object-cover aspect-square saturate-[0.85] contrast-[1.1]" 
            style={{ objectPosition: 'center' }} 
            alt="Foto" 
          />
        </div>

        <div className="mt-1 text-center px-2 w-full z-20">
          <h4 className="text-white text-[16px] font-black uppercase tracking-tighter leading-none">
            {data.nombre_completo || data.nombre}
          </h4>
          <p className="text-[#e10098] font-black text-[13px] mt-0.5 tracking-widest">{data.dni}</p>
        </div>

        <div className="mt-auto mb-5 bg-white p-1 rounded-lg shadow-xl z-20">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlVerificacion)}`} 
            className="w-12 h-12" 
            alt="QR" 
          />
        </div>

        <div className="absolute bottom-1.5 z-20">
          <span className="text-[#e10098] text-[6px] font-black uppercase tracking-[0.4em] opacity-90">ACREDITACION OFICIAL</span>
        </div>

        {/* MARCAS DE AGUA LATERALES */}
        {/* LADO IZQUIERDO */}
        <div 
          className="absolute left-1 top-0 bottom-0 flex items-center justify-center pointer-events-none opacity-20"
          style={{ width: '20px' }}
        >
          <span 
            className="text-white text-[18px] font-black uppercase whitespace-nowrap tracking-tighter"
            style={{ 
              writingMode: 'vertical-rl', 
              transform: 'rotate(180deg)',
              display: 'inline-block'
            }}
          >
            {configLiga?.nombre_liga || "LIGA OFICIAL"}
          </span>
        </div>

        {/* LADO DERECHO */}
        <div 
          className="absolute right-1 top-0 bottom-0 flex items-center justify-center pointer-events-none opacity-20"
          style={{ width: '20px' }}
        >
          <span 
            className="text-white text-[18px] font-black uppercase whitespace-nowrap tracking-tighter"
            style={{ 
              writingMode: 'vertical-rl',
              display: 'inline-block'
            }}
          >
            {clubNombre || "CLUB"}
          </span>
        </div>
      </div>
      {!soloDiseño && (
        <button onClick={descargarCarnet} className="bg-slate-800 hover:bg-[#e10098] text-white hover:text-black px-4 py-2 rounded-xl text-[10px] font-black transition-all border border-slate-700 uppercase">
          <ArrowDownTrayIcon className="w-4 h-4 inline mr-2" />
          Descargar Credencial
        </button>
      )}
    </div>
  );
};

// 2. COMPONENTE PRINCIPAL (Recibe clubData y configLiga desde AdminDelegado)
const GestionDelegados = ({ clubData, configLiga }) => {
  const [delegados, setDelegados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generandoLona, setGenerandoLona] = useState(false);
  const [fotoUrl, setFotoUrl] = useState('');

  const lienzoRef = useRef(null);
  const idClub = clubData?.id;

  useEffect(() => {
    const obtenerDelegados = async () => {
      if (!idClub) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('delegados')
          .select('*')
          .eq('club_id', idClub);

        if (error) throw error;
        setDelegados(data || []);
      } catch (error) {
        console.error("Error al cargar delegados:", error.message);
      } finally {
        setLoading(false);
      }
    };
    obtenerDelegados();
  }, [idClub]);

  const imprimirLona = async () => {
    if (delegados.length === 0) return alert("No hay delegados para imprimir");
    setGenerandoLona(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [1000, 1000]
      });

      const canvas = await html2canvas(lienzoRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 1000, 1000);
      doc.save(`LONA_DELEGADOS_${clubData?.nombre?.replace(/\s/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error generando lona:", error);
      alert("Error al generar el PDF de la lona.");
    } finally {
      setGenerandoLona(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'nc_s1125_presets'); 
    try {
      const res = await axios.post('https://api.cloudinary.com/v1_1/dgtc9qfmv/image/upload', formData);
      setFotoUrl(res.data.secure_url);
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("Error al subir foto a Cloudinary");
    } finally {
      setUploading(false);
    }
  };

  const guardarDelegado = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const nombre = formData.get('nombre').trim().toUpperCase();
    const dni = formData.get('dni').trim();

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) return alert("El nombre solo debe contener letras.");
    if (!/^\d{7,8}$/.test(dni)) return alert("DNI inválido.");
    if (!fotoUrl) return alert("Debes subir una foto.");

    try {
      const { data, error } = await supabase
        .from('delegados')
        .insert([{
          nombre,
          dni,
          foto_url: fotoUrl,
          club_id: parseInt(idClub),
          categoria: "DELEGADO",
          rol: "delegado",
          organizacion_id: configLiga?.organizacion_id // Vinculación automática a la liga
        }])
        .select()
        .single();

      if (error) throw error;

      setDelegados([...delegados, data]);
      setShowModal(false);
      setFotoUrl('');
      alert("✅ Delegado registrado correctamente");
    } catch (err) {
      alert("❌ Error al guardar: " + err.message);
    }
  };

  if (loading) return <div className="text-white p-10 text-center font-black animate-pulse uppercase">Sincronizando Delegados...</div>;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 gap-4">
        <h3 className="text-white font-black text-xl uppercase tracking-tighter">Cuerpo de Delegados</h3>
        <div className="flex gap-2">
          <button 
            onClick={imprimirLona} 
            disabled={generandoLona}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all active:scale-95"
          >
            <PrinterIcon className="w-4 h-4" />
            {generandoLona ? 'PROCESANDO...' : 'IMPRIMIR LONA 1MT'}
          </button>

          <button onClick={() => setShowModal(true)} className="bg-[#e10098] text-white px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2">
            <UserPlusIcon className="w-4 h-4" /> NUEVO DELEGADO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        {delegados.length === 0 ? (
          <div className="col-span-full py-20 text-slate-600 font-bold uppercase border-2 border-dashed border-slate-800 w-full text-center rounded-3xl">
            No hay delegados registrados
          </div>
        ) : (
          delegados.map((del) => (
            <CarnetDelDelegado 
              key={del.id} 
              data={del} 
              clubNombre={clubData?.nombre} 
              configLiga={configLiga} // <--- PASAR PROP AQUÍ
            />
          ))
        )}
      </div>

      {/* LIENZO PARA LONA (OCULTO) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
        <div 
          ref={lienzoRef} 
          style={{ 
            width: '1000mm', height: '1000mm', padding: '10mm',
            display: 'grid', gridTemplateColumns: 'repeat(12, 66.8mm)', 
            gap: '5mm', background: 'white'
          }}
        >
          {delegados.map((del) => (
            <CarnetDelDelegado 
              key={del.id} 
              data={del} 
              clubNombre={clubData?.nombre} 
              soloDiseño={true} 
              configLiga={configLiga} // <--- PASAR PROP AQUÍ TAMBIÉN
            />
          ))}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[32px] overflow-hidden">
            <div className="bg-[#e10098] p-6 flex justify-between items-center text-black font-black uppercase">
              <h3>Ficha de Delegado</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl">&times;</button>
            </div>
            <form className="p-8 space-y-4" onSubmit={guardarDelegado}>
              <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 rounded-full border-2 border-[#e10098] overflow-hidden bg-slate-800">
                  {fotoUrl ? <img src={fotoUrl} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-[8px] text-[#e10098] font-black uppercase">Sin Foto</div>}
                </div>
                <label className="mt-3 cursor-pointer bg-slate-800 px-4 py-2 rounded-xl text-white text-[10px] font-black border border-slate-700">
                  {uploading ? 'SUBIENDO...' : 'ELEGIR FOTO'}
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                </label>
              </div>
              <input name="nombre" required className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none" placeholder="Nombre y Apellido" />
              <input name="dni" required maxLength="8" className="w-full bg-slate-800 border border-slate-800 rounded-2xl px-4 py-3 text-white outline-none" placeholder="DNI" />
              <button disabled={uploading} type="submit" className="w-full bg-[#e10098] text-black font-black py-4 rounded-2xl transition-all active:scale-95">
                {uploading ? 'ESPERANDO FOTO...' : 'REGISTRAR DELEGADO'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionDelegados;