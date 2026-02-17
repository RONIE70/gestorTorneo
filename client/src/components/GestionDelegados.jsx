import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlusIcon } from '@heroicons/react/24/solid';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid';

const CarnetDelDelegado = ({ data, clubNombre }) => {
  const carnetRef = useRef(null);
  const urlVerificacion = `${window.location.origin}/#/verificar/delegado/${data.dni}`;

  const descargarCarnet = async () => {
    if (!carnetRef.current) return;
    try {
      const canvas = await html2canvas(carnetRef.current, {
        useCORS: true,
        scale: 3,
        backgroundColor: null
      });
      const link = document.createElement('a');
      link.download = `Delegado_${data.nombre}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* CONTENEDOR CON TUS MEDIDAS EXACTAS */}
      <div 
        ref={carnetRef}
        className="w-[66.8mm] h-[86.9mm] bg-black border-[4px] border-[#e10098] rounded-[20px] overflow-hidden shadow-2xl relative flex flex-col items-center"
        style={{ minWidth: '66.8mm', minHeight: '86.9mm', maxWidth: '66.8mm', maxHeight: '86.9mm' }}
      >
        {/* 1. CABECERA: LIGA DE LAS NENAS */}
        <div className="w-full bg-[#e10098] py-1.5 text-center shadow-md z-20">
          <span className="text-black font-black tracking-[0.1em] text-[10px] uppercase">
            Liga de las Nenas
          </span>
        </div>

        {/* 2. ROL: DELEGADO HABILITADO (Texto limpio, sin fondo) */}
        <div className="mt-3 z-20">
          <span className="text-white text-[8px] font-black uppercase tracking-[0.25em]">
            DELEGADO HABILITADO
          </span>
        </div>

        {/* 3. FOTO: CIRCULAR (object-cover para no deformar) */}
        <div className="mt-2 w-32 h-32 rounded-full border-[3px] border-[#e10098] overflow-hidden bg-slate-900 shadow-lg z-20">
          <img 
            src={data.foto_url} 
            className="w-full h-full object-cover aspect-square saturate-[0.85] contrast-[1.1]" 
            alt="Foto" 
          />
        </div>

        {/* 4. NOMBRE Y DNI */}
        <div className="mt-2 text-center px-2 w-full z-20">
          <h4 className="text-white text-[18px] font-black uppercase tracking-tighter leading-none">
            {data.nombre}
          </h4>
          <p className="text-[#e10098] font-black text-[13px] mt-0.5 tracking-widest">
            {data.dni}
          </p>
        </div>

        {/* 5. QR DE VERIFICACIÓN */}
        <div className="mt-auto mb-5 bg-white p-1 rounded-lg shadow-xl z-20">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlVerificacion)}`} 
            className="w-12 h-12" 
            alt="QR" 
          />
        </div>

        {/* 6. ACREDITACIÓN OFICIAL (Debajo del QR, letra mini) */}
        <div className="absolute bottom-1.5 z-20">
          <span className="text-[#e10098] text-[6.5px] font-black uppercase tracking-[0.4em] opacity-90">
            ACREDITACION OFICIAL
          </span>
        </div>

        {/* --- MÁRGENES LATERALES --- */}

        {/* IZQUIERDA: LIGA DE LAS NENAS */}
        <div className="absolute top-1/2 -left-12 -translate-y-1/2 -rotate-90 origin-center pointer-events-none opacity-10">
          <span className="text-white text-3xl font-black uppercase whitespace-nowrap tracking-tighter">
            LIGA DE LAS NENAS
          </span>
        </div>

        {/* DERECHA: NOMBRE DEL CLUB */}
        <div className="absolute top-1/2 -right-12 -translate-y-1/2 rotate-90 origin-center pointer-events-none opacity-10">
          <span className="text-white text-3xl font-black uppercase whitespace-nowrap tracking-tighter">
            {clubNombre}
          </span>
        </div>
      </div>

      <button 
        onClick={descargarCarnet}
        className="bg-slate-800 hover:bg-[#e10098] text-white hover:text-black px-4 py-2 rounded-xl text-[10px] font-black transition-all border border-slate-700 uppercase"
      >
        Descargar Credencial
      </button>
    </div>
  );
};

// 2. COMPONENTE PRINCIPAL
const GestionDelegados = ({ clubData }) => {
  const [delegados, setDelegados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState('');

  const API_URL = "https://gestor-torneo-api.vercel.app"; 

  // Carga inicial
  useEffect(() => {
    const obtenerDelegados = async () => {
      try {
        const idClub = clubData?.id || clubData?._id;
        const response = await axios.get(`${API_URL}/api/delegados/${idClub}`);
        setDelegados(response.data);
      } catch (error) {
        console.error("Error cargando delegados:", error);
      } finally {
        setLoading(false);
      }
    };
    if (clubData?.id || clubData?._id) obtenerDelegados();
  }, [clubData]);

  // Subida a Cloudinary
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
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  // Guardar Delegado
  // Asegurate de tener importado el cliente de supabase al principio del archivo
// import { supabase } from '../supabaseClient'; 

const guardarDelegado = async (e) => {
  e.preventDefault();
  if (!fotoUrl) return alert("¡Falta la foto! Subila antes de registrar.");

  const equipoId = parseInt(clubData.id || clubData._id);
  const formData = new FormData(e.target);
  
  const nuevoDelegado = {
    nombre: formData.get('nombre'),
    dni: formData.get('dni'),
    categoria: "Delegado", // Forzado
    foto_url: fotoUrl,
    club_id: equipoId,
    rol: "delegado"
  };

  try {
    // INSERT DIRECTO EN SUPABASE (Sin pasar por el servidor de Node)
    const { data, error } = await supabase
      .from('delegados')
      .insert([nuevoDelegado])
      .select();

    if (error) throw error;

    setDelegados([...delegados, data[0]]);
    setShowModal(false);
    setFotoUrl('');
    alert("✅ Delegado registrado con éxito en Supabase");
  } catch (err) {
    console.error(err);
    alert(`❌ Error: ${err.message || "No se pudo guardar en Supabase"}`);
  }
};

  if (loading) return <div className="text-white p-10 animate-pulse font-black text-center">CARGANDO...</div>;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-white font-black text-xl tracking-tight uppercase">Cuerpo de Delegados</h3>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#e10098] text-white px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2"
        >
          <UserPlusIcon className="w-4 h-4" /> NUEVO DELEGADO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        {delegados.length === 0 ? (
          <div className="col-span-full py-20 text-center w-full bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-800 text-slate-600 font-bold uppercase">
            No hay delegados registrados
          </div>
        ) : (
          delegados.map((del) => (
            <CarnetDelDelegado key={del.id || del._id} data={del} clubNombre={clubData.nombre} />
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[32px] overflow-hidden">
            <div className="bg-[#e10098] p-6 flex justify-between items-center">
              <h3 className="text-black font-black uppercase">CREDENCIAL DIRIGENTES</h3>
              <button onClick={() => setShowModal(false)} className="text-black text-2xl font-black">&times;</button>
            </div>

            <form className="p-8 space-y-4" onSubmit={guardarDelegado}>
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#e10098] flex items-center justify-center overflow-hidden bg-slate-800 relative">
                  {fotoUrl ? <img src={fotoUrl} className="w-full h-full object-cover" /> : <span className="text-[#e10098] text-[10px] font-black uppercase">Foto</span>}
                </div>
                <label className="mt-3 cursor-pointer bg-slate-800 px-4 py-2 rounded-xl text-white text-[10px] font-black uppercase">
                  {uploading ? 'Cargando...' : 'Seleccionar Foto'}
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                </label>
              </div>

              <div className="space-y-4">
                <input name="nombre" required className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none" placeholder="Nombre y Apellido" />
                <input name="dni" required className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none" placeholder="DNI" />
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                   <span className="text-xs font-black uppercase text-white">DELEGADO OFICIAL</span>
                </div>
              </div>

              <button disabled={uploading} type="submit" className="w-full bg-[#e10098] text-black font-black py-4 rounded-2xl mt-4 shadow-lg active:scale-95 transition-all">
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