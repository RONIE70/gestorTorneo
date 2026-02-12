import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlusIcon, IdentificationIcon } from '@heroicons/react/24/solid';

// 1. COMPONENTE DEL CARNET
const CarnetDelDelegado = ({ data, clubNombre }) => {
  return (
    <div className="w-[65mm] h-[95mm] bg-black border-[4px] border-[#e10098] rounded-[24px] overflow-hidden shadow-2xl relative flex flex-col items-center">
      <div className="w-full bg-[#e10098] py-3 text-center">
        <span className="text-black font-black tracking-[0.25em] text-[10px] uppercase">Delegado Oficial</span>
      </div>

      <div className="mt-6 w-36 h-36 rounded-full border-4 border-[#e10098] overflow-hidden bg-slate-900">
        <img 
          src={data.foto_url || 'https://via.placeholder.com/150'} 
          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" 
          alt="Foto" 
        />
      </div>

      <div className="mt-4 text-center px-4 w-full">
        <h4 className="text-white text-2xl font-black uppercase tracking-tighter leading-none">{data.nombre}</h4>
        <p className="text-[#e10098] font-black text-sm mt-2">{data.dni}</p>
      </div>

      <div className="mt-auto mb-20 bg-[#e10098]/10 border border-[#e10098]/30 px-4 py-1 rounded-full">
        <span className="text-[#e10098] text-[10px] font-black uppercase tracking-widest">{data.categoria}</span>
      </div>

      <div className="absolute bottom-4 bg-white p-1.5 rounded-xl shadow-lg">
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/#/verificar/" + data.dni)}`} 
          className="w-14 h-14" 
          alt="QR" 
        />
      </div>

      <div className="absolute bottom-12 -rotate-90 -right-10 opacity-10 pointer-events-none text-white text-4xl font-black uppercase">
        {clubNombre}
      </div>
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

  // Carga inicial de delegados
  useEffect(() => {
    const obtenerDelegados = async () => {
      try {
        // Usamos el ID del club que viene por props
        const idClub = clubData?.id || clubData?._id;
        const response = await axios.get(`/api/delegados/${idClub}`);
        setDelegados(response.data);
      } catch (error) {
        console.error("Error cargando delegados:", error);
      } finally {
        setLoading(false);
      }
    };
    if (clubData?.id || clubData?._id) obtenerDelegados();
  }, [clubData]);

  // Subida de foto a Cloudinary
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'nc_s1125_presets'); // REEMPLAZA CON TU PRESET

    try {
      const res = await axios.post(
        'https://api.cloudinary.com/v1_1/dgtc9qfmv/image/upload',
        formData
      );
      setFotoUrl(res.data.secure_url);
    } catch (err) {
      console.error(err);
      alert("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  // Función fusionada para guardar
  const guardarDelegado = async (e) => {
    e.preventDefault();
    if (!fotoUrl) return alert("¡Falta la foto! Subila antes de registrar.");

    // CONVERSIÓN A NÚMERO PARA SUPABASE
    const equipoId = parseInt(clubData.id || clubData._id);

    const formData = new FormData(e.target);
    const nuevoDelegado = {
      nombre: formData.get('nombre'),
      dni: formData.get('dni'),
      categoria: formData.get('categoria'),
      foto_url: fotoUrl,
      club_id: equipoId
    };

    try {
      const res = await axios.post('/api/delegados', nuevoDelegado);
      setDelegados([...delegados, res.data]);
      setShowModal(false);
      setFotoUrl('');
      alert("✅ Delegado registrado con éxito");
    } catch (err) {
      console.error(err);
      alert("❌ Error al guardar. Revisá si el DNI ya existe.");
    }
  };

  if (loading) return <div className="text-white p-10 animate-pulse font-black text-center">CARGANDO...</div>;

  return (
    <div className="mt-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-white font-black text-xl tracking-tight uppercase">Cuerpo de Delegados</h3>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#e10098] text-white px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg shadow-magenta-600/20 active:scale-95 transition-all"
        >
          <UserPlusIcon className="w-4 h-4" />
          NUEVO DELEGADO
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        {delegados.length === 0 ? (
          <div className="col-span-full py-20 text-center w-full bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-800 text-slate-600 font-bold uppercase tracking-tighter">
            No hay delegados registrados
          </div>
        ) : (
          delegados.map((del) => (
            <CarnetDelDelegado key={del.id || del._id} data={del} clubNombre={clubData.nombre} />
          ))
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl">
            <div className="bg-[#e10098] p-6 flex justify-between items-center">
              <h3 className="text-black font-black uppercase tracking-tighter">Ficha de Delegado</h3>
              <button onClick={() => setShowModal(false)} className="text-black/50 hover:text-black font-black text-2xl">&times;</button>
            </div>

            <form className="p-8 space-y-4" onSubmit={guardarDelegado}>
              {/* Preview y Upload */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#e10098] flex items-center justify-center overflow-hidden bg-slate-800 relative">
                  {fotoUrl ? <img src={fotoUrl} className="w-full h-full object-cover" alt="Preview" /> : <span className="text-[#e10098] text-[10px] font-black uppercase">Sin Foto</span>}
                  {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] animate-pulse">SUBIENDO...</div>}
                </div>
                <label className="mt-3 cursor-pointer bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl border border-slate-700 transition-all text-white text-[10px] font-black uppercase">
                  {uploading ? 'Cargando...' : 'Seleccionar Foto'}
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                </label>
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <input name="nombre" required className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:border-[#e10098] outline-none" placeholder="Nombre y Apellido" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="dni" required className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:border-[#e10098] outline-none" placeholder="DNI" />
                  <select name="categoria" className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:border-[#e10098] outline-none appearance-none">
                    <option value="+30">+30</option>
                    <option value="+45">+45</option>
                    <option value="Libre">Libre</option>
                  </select>
                </div>
              </div>

              <button 
                disabled={uploading}
                type="submit" 
                className={`w-full ${uploading ? 'bg-slate-700' : 'bg-[#e10098] hover:bg-[#ff00ad]'} text-black font-black py-4 rounded-2xl mt-6 transition-all shadow-lg`}
              >
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