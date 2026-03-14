import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckBadgeIcon, XCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';

const PaginaVerificacionDelegado = () => {
  const { dni } = useParams(); // Captura el DNI de la URL
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificar = async () => {
      try {
        console.log("Verificando DNI:", dni); // DEBUG
        const API_URL = "https://gestor-torneo-api.vercel.app";
        const res = await axios.get(`${API_URL}/api/verificar/delegado/${dni}`);
        
        console.log("Respuesta del servidor:", res.data); // DEBUG

        if (res.data && res.data.habilitado === true) {
          setDatos(res.data.datos);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error en la petición:", err.response?.data || err.message); // DEBUG
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    if (dni) verificar();
  }, [dni]);

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-[#e10098] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black uppercase tracking-widest text-xs">Consultando Sistema...</p>
    </div>
  );

  if (error || !datos) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <XCircleIcon className="w-24 h-24 text-red-600 mb-4" />
      <h1 className="text-white text-3xl font-black uppercase">Acceso Denegado</h1>
      <p className="text-slate-400 mt-2 font-bold uppercase text-xs">No se encontró un delegado oficial con el DNI: {dni}</p>
      <div className="mt-8 p-4 border border-red-600/30 bg-red-600/10 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-tighter">
        Aviso: Esta credencial no es válida o ha sido dada de baja.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center p-6 font-sans">
      {/* Icono de Verificado */}
      <div className="mt-10 flex flex-col items-center animate-bounce">
        <CheckBadgeIcon className="w-20 h-20 text-[#e10098]" />
        <span className="text-[#e10098] font-black text-sm tracking-[0.3em] mt-2 uppercase">Verificado</span>
      </div>

      {/* Tarjeta de Información */}
      <div className="mt-8 w-full max-w-sm bg-slate-900 border-2 border-[#e10098] rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(225,0,152,0.2)]">
        <div className="p-8 flex flex-col items-center">
          {/* Foto con saturación real */}
          <div className="w-40 h-40 rounded-full border-4 border-[#e10098] overflow-hidden bg-slate-800 mb-6 shadow-xl">
            <img src={datos.foto_url} className="w-full h-full object-cover" alt="Foto Delegado" />
          </div>

          <h2 className="text-white text-3xl font-black uppercase text-center leading-none">{datos.nombre}</h2>
          <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest">DNI: {datos.dni}</p>
          
          <div className="mt-6 w-full h-[1px] bg-slate-800"></div>

          {/* Datos del Club */}
          <div className="mt-6 flex items-center gap-4 w-full bg-black/40 p-4 rounded-2xl border border-white/5">
            <img src={datos.equipos?.escudo_url} className="w-12 h-12 object-contain" alt="Escudo" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Club / Organización</span>
              <span className="text-white font-black uppercase text-sm">{datos.equipos?.nombre || "Club Oficial"}</span>
            </div>
          </div>

          <div className="mt-4 w-full flex items-center justify-center gap-2 bg-[#e10098] py-3 rounded-2xl">
            <ShieldCheckIcon className="w-5 h-5 text-black" />
            <span className="text-black font-black text-xs uppercase tracking-widest">Habilitado para Campo</span>
          </div>
        </div>
      </div>

      <p className="mt-auto mb-10 text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] text-center">
        Sistema de Gestión Deportiva <br /> Acreditación Digital
      </p>
    </div>
  );
};

export default PaginaVerificacionDelegado;