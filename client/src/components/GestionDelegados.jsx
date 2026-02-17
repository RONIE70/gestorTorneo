import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlusIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';

// 1. COMPONENTE DEL CARNET
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
      <div 
        ref={carnetRef}
        className="w-[66.8mm] h-[86.9mm] bg-black border-[4px] border-[#e10098] rounded-[20px] overflow-hidden shadow-2xl relative flex flex-col items-center"
        style={{ minWidth: '66.8mm', minHeight: '86.9mm', maxWidth: '66.8mm', maxHeight: '86.9mm' }}
      >
        <div className="w-full bg-[#e10098] py-1.5 text-center shadow-md z-20">
          <span className="text-black font-black tracking-[0.1em] text-[10px] uppercase">Liga de las Nenas</span>
        </div>

        <div className="mt-1 z-20">
          <span className="text-white text-[10px] font-black uppercase tracking-[0.25em]">DELEGADO HABILITADO</span>
        </div>

        <div className="mt-2 w-32 h-32 rounded-full border-[3px] border-[#e10098] overflow-hidden bg-slate-900 shadow-lg z-20">
          <img src={data.foto_url} className="w-full h-full object-cover aspect-square saturate-[0.85] contrast-[1.1]" alt="Foto" />
        </div>

        <div className="mt-1 text-center px-2 w-full z-20">
          <h4 className="text-white text-[16px] font-black uppercase tracking-tighter leading-none">{data.nombre_completo || data.nombre}</h4>
          <p className="text-[#e10098] font-black text-[13px] mt-0.5 tracking-widest">{data.dni}</p>
        </div>

        <div className="mt-auto mb-5 bg-white p-1 rounded-lg shadow-xl z-20">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlVerificacion)}`} className="w-12 h-12" alt="QR" />
        </div>

        <div className="absolute bottom-1.5 z-20">
          <span className="text-[#e10098] text-[6px] font-black uppercase tracking-[0.4em] opacity-90">ACREDITACION OFICIAL</span>
        </div>

        {/* MÁRGENES LATERALES */}
        <div className="absolute top-1/2 -left-5 -translate-y-1/2 -rotate-90 origin-center pointer-events-none opacity-10">
          <span className="text-white text-2xl font-black uppercase whitespace-nowrap tracking-tighter">LIGA DE LAS NENAS</span>
        </div>
        <div className="absolute top-1/2 -right-5 -translate-y-1/2 rotate-90 origin-center pointer-events-none opacity-10">
          <span className="text-white text-2xl font-black uppercase whitespace-nowrap tracking-tighter">{clubNombre}</span>
        </div>
      </div>

      <button onClick={descargarCarnet} className="bg-slate-800 hover:bg-[#e10098] text-white hover:text-black px-4 py-2 rounded-xl text-[10px] font-black transition-all border border-slate-700 uppercase">
        <ArrowDownTrayIcon className="w-4 h-4 inline mr-2" />
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

  // DECLARACIÓN ÚNICA DE API_URL (Al principio del componente)
  const API_URL = "https://gestor-torneo-api.vercel.app"; 

  const idClub = clubData?.id || clubData?._id;

  // Carga inicial
  useEffect(() => {
  const obtenerDelegados = async () => {
    if (!idClub) return;
    try {
      const response = await axios.get(`${API_URL}/api/delegados/${idClub}`);
      
      // Ajustamos el filtro para usar 'equipo_id' en lugar de 'club_id'
      const filtrados = response.data.filter(del => 
        String(del.equipo_id || del.club_id) === String(idClub)
      );
      
      setDelegados(filtrados);
    } catch (error) {
      console.error("Error cargando delegados:", error);
    } finally {
      setLoading(false);
    }
  };
  obtenerDelegados();
}, [idClub, API_URL]);

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
      alert("Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  // Guardar con VALIDACIONES
  const guardarDelegado = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const nombre = formData.get('nombre').trim();
    const dni = formData.get('dni').trim();

    // VALIDACIÓN: Solo letras en nombre
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
      return alert("❌ El nombre solo puede contener letras.");
    }

    // VALIDACIÓN: DNI 8 números
    if (!/^\d{8}$/.test(dni)) {
      return alert("❌ El DNI debe tener exactamente 8 números.");
    }

    if (!fotoUrl) return alert("¡Falta la foto!");

    const nuevoDelegado = {
      nombre,
      dni,
      foto_url: fotoUrl,
      equipo_id: parseInt(idClub),
      categoria: "Delegado",
      rol: "delegado"
    };

    try {
      const res = await axios.post(`${API_URL}/api/delegados`, nuevoDelegado);
      setDelegados([...delegados, res.data]);
      setShowModal(false);
      setFotoUrl('');
      alert("✅ Delegado registrado");
    } catch (err) {
      if (err.response?.status === 409) {
        alert("⚠️ Este DNI ya está registrado.");
      } else {
        alert("❌ Error al guardar.");
      }
    }
  };

  if (loading) return <div className="text-white p-10 text-center font-black animate-pulse">CARGANDO DELEGADOS...</div>;

  return (
    <div className="mt-6 space-y-6">
      {/* Botón Nuevo Delegado */}
      <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800">
        <h3 className="text-white font-black text-xl uppercase tracking-tighter">Cuerpo de Delegados</h3>
        <button onClick={() => setShowModal(true)} className="bg-[#e10098] text-white px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2">
          <UserPlusIcon className="w-4 h-4" /> NUEVO DELEGADO
        </button>
      </div>

      {/* Grid de Carnets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        {delegados.length === 0 ? (
          <div className="col-span-full py-20 text-slate-600 font-bold uppercase border-2 border-dashed border-slate-800 w-full text-center rounded-3xl">
            No hay delegados en este club
          </div>
        ) : (
          delegados.map((del) => (
            <CarnetDelDelegado key={del.id || del._id} data={del} clubNombre={clubData.nombre} />
          ))
        )}
      </div>

      {/* Modal de Registro */}
      {showModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[32px] overflow-hidden">
            <div className="bg-[#e10098] p-6 flex justify-between items-center">
              <h3 className="text-black font-black uppercase">Ficha de Delegado</h3>
              <button onClick={() => setShowModal(false)} className="text-black text-2xl font-black">&times;</button>
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
              <input name="nombre" required className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-[#e10098]" placeholder="Nombre y Apellido (Solo letras)" />
              <input name="dni" required maxLength="8" className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-[#e10098]" placeholder="DNI (8 números)" />
              <button disabled={uploading} type="submit" className="w-full bg-[#e10098] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">
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