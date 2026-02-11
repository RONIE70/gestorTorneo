import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const VerificacionPublica = () => {
  const { id: rawId } = useParams(); // Lo recibimos como rawId para limpiarlo
  const [jugadora, setJugadora] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        // --- LIMPIEZA DE ID (Evita el error de prefijos como GRU1:...) ---
        // Extrae solo el número final de la URL si el escáner manda basura
        const partes = rawId.split('/');
        const idLimpio = partes[partes.length - 1].replace(/\D/g, "");
        const idFinal = parseInt(idLimpio);

        // 1. Cargar Configuración de la Liga para los colores y logo
        const { data: configData } = await supabase
          .from('configuracion_liga')
          .select('*')
          .single();
        setConfig(configData);

        // 2. Cargar datos de la jugadora (Usando el ID limpio)
        const { data: jugadoraData } = await supabase
          .from('jugadoras')
          .select('*, equipos(nombre)')
          .eq('id', idFinal)
          .single();
        
        setJugadora(jugadoraData);
      } catch (err) {
        console.error("Error en validación:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
  }, [rawId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!jugadora) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h1 className="text-white font-black uppercase">Credencial Inexistente</h1>
      <p className="text-slate-500 text-sm mt-2">
        Esta identificación ({rawId}) no figura en los registros oficiales.
      </p>
    </div>
  );

  // Mantenemos tu lógica original de validación
  const esValida = !jugadora.sancionada && !jugadora.verificacion_manual;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 flex flex-col items-center justify-center">
      
      {/* HEADER DE LA LIGA (Dinámico con config) */}
      <div className="mb-6 text-center">
        {config?.logo_url ? (
          <img src={config.logo_url} className="h-16 mx-auto mb-2 object-contain" alt="Logo" />
        ) : (
          <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-2 flex items-center justify-center text-xl">🏆</div>
        )}
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          {config?.nombre_liga || 'Sistema de Verificación Oficial'}
        </h2>
      </div>

      {/* TARJETA DE ESTADO */}
      <div className={`w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border-4 ${esValida ? 'border-emerald-500' : 'border-rose-500'}`}>
        
        {/* CABECERA DE ESTADO */}
        <div className={`p-4 text-center font-black uppercase tracking-widest text-sm ${esValida ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {esValida ? '✅ Jugadora Habilitada' : '❌ Verificación Requerida'}
        </div>

        <div className="bg-slate-900 p-8 flex flex-col items-center">
          {/* FOTO GIGANTE PARA COMPARAR */}
          <div className="relative mb-6">
            <img 
              src={jugadora.foto_url} 
              className="w-48 h-56 rounded-[2.5rem] object-cover border-4 border-slate-800 shadow-2xl" 
              alt="Perfil" 
            />
            <div className="absolute -bottom-2 -right-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <span className="text-xl">🪪</span>
            </div>
          </div>

          <h1 className="text-3xl font-black uppercase text-center leading-none tracking-tighter">
            {jugadora.apellido}<br/>
            <span className="text-slate-400">{jugadora.nombre}</span>
          </h1>

          <div className="mt-6 w-full space-y-3">
            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Documento</span>
              <span className="font-mono font-bold text-lg">{jugadora.dni}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Equipo</span>
              <span className="font-bold text-blue-400 uppercase tracking-tight">
                {jugadora.equipos?.nombre || 'Sin equipo'}
              </span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                Validación Biométrica Exitosa
              </span>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[9px] text-slate-600 uppercase font-black text-center max-w-xs leading-relaxed opacity-60">
        Este documento es intransferible. La falsificación de identidad conlleva la expulsión inmediata de la liga {config?.nombre_liga || 'oficial'}.
      </p>
    </div>
  );
};

export default VerificacionPublica;