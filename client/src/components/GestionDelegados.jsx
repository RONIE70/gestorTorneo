import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlusIcon } from '@heroicons/react/24/solid';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid';

const CarnetDelDelegado = ({ data, clubNombre }) => {
  const carnetRef = useRef(null);
  
  // RUTA DE VERIFICACIÓN (Apunta a la página de tu App, no a la API directamente)
  const urlVerificacion = `${window.location.origin}/#/verificar/delegado/${data.dni}`;

  // FUNCIÓN DE DESCARGA
  const descargarCarnet = async () => {
    if (!carnetRef.current) return;
    
    try {
      const canvas = await html2canvas(carnetRef.current, {
        useCORS: true, // Crucial para que cargue la foto de Cloudinary
        scale: 2,      // Doble resolución para que no salga borroso
        backgroundColor: null
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `Delegado_${data.nombre}.png`;
      link.click();
    } catch (err) {
      console.error("Error al descargar:", err);
      alert("No se pudo generar la imagen. Reintentá.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 group">
      {/* EL CARNET VISUAL */}
      <div 
        ref={carnetRef}
        className="w-[65mm] h-[95mm] bg-gradient-to-br from-gray-900 via-black to-slate-900 border-[4px] border-[#e10098] rounded-[24px] overflow-hidden shadow-2xl relative flex flex-col items-center"
      >
        {/* Encabezado Degradado */}
        <div className="w-full bg-gradient-to-r from-[#e10098] to-[#ff00ad] py-3 text-center shadow-md">
          <span className="text-black font-black tracking-[0.25em] text-[10px] uppercase">Acreditación Oficial</span>
        </div>

        {/* Foto con Saturación Suave (No B/N total) y Brillo Magenta */}
        <div className="mt-6 w-36 h-36 rounded-full border-4 border-[#e10098] overflow-hidden bg-slate-800 shadow-[0_0_25px_rgba(225,0,152,0.4)]">
          <img 
            src={data.foto_url || 'https://via.placeholder.com/150'} 
            className="w-full h-full object-cover saturate-[0.7] hover:saturate-100 transition-all duration-500" 
            alt="Foto" 
          />
        </div>

        {/* Nombre y DNI */}
        <div className="mt-4 text-center px-4 w-full text-white z-10">
          <h4 className="text-2xl font-black uppercase tracking-tighter leading-none drop-shadow-lg">
            {data.nombre}
          </h4>
          <p className="text-[#e10098] font-black text-sm mt-2 tracking-widest">{data.dni}</p>
        </div>

        {/* Badge Rol con Degradado */}
        <div className="mt-auto mb-20 bg-gradient-to-r from-[#e10098]/30 to-transparent border-l-4 border-[#e10098] px-6 py-1">
          <span className="text-[#e10098] text-[11px] font-black uppercase tracking-[0.3em]">
            DELEGADO
          </span>
        </div>

        {/* QR de Verificación */}
        <div className="absolute bottom-4 bg-white p-1.5 rounded-xl shadow-xl border-2 border-[#e10098]/20">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlVerificacion)}`} 
            className="w-14 h-14" 
            alt="QR" 
          />
        </div>

        {/* Marca de Agua Lateral */}
        <div className="absolute bottom-12 -rotate-90 -right-12 opacity-5 pointer-events-none text-white text-5xl font-black uppercase whitespace-nowrap">
          {clubNombre}
        </div>
      </div>

      {/* BOTÓN DE DESCARGA (Fuera del Ref para que no salga en la foto) */}
      <button 
        onClick={descargarCarnet}
        className="flex items-center gap-2 bg-[#e10098] hover:bg-white text-black px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all shadow-lg active:scale-95 uppercase border-2 border-[#e10098]"
      >
        <ArrowDownTrayIcon className="w-4 h-4" />
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