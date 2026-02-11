import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const VerificacionPublica = () => {
  const { id: rawId } = useParams(); 
  const [jugadora, setJugadora] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        // --- LIMPIEZA DE ID (Anti-errores de escáner) ---
        const partes = rawId.split('/');
        const idLimpio = partes[partes.length - 1].replace(/\D/g, "");
        const idFinal = parseInt(idLimpio);

        // 1. Cargar Configuración (Usamos setConfig y ahora LEEMOS config abajo)
        const { data: configData } = await supabase
          .from('configuracion_liga')
          .select('*')
          .single();
        setConfig(configData);

        // 2. Cargar Jugadora
        const { data: jugadoraData, error } = await supabase
          .from('jugadoras')
          .select('*, equipos(nombre)')
          .eq('id', idFinal)
          .single();
        
        if (error) throw error;
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
      <h1 className="text-white font-black uppercase tracking-tighter">Credencial Inexistente</h1>
      <p className="text-slate-500 text-[10px] font-bold uppercase mt-2 max-w-xs">
        El registro <span className="text-rose-500">[{rawId}]</span> no coincide con ninguna jugadora activa en nc-s1125.
      </p>
    </div>
  );

  // Lógica de validación: Debe estar habilitada manualmente para ser VERDE
  const esValida = !jugadora.sancionada && jugadora.verificacion_manual === false;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 flex flex-col items-center justify-center">
      
      {/* HEADER DINÁMICO (Usando el valor de config) */}
      <div className="mb-6 text-center">
        {config?.logo_url ? (
          <img src={config.logo_url} className="h-16 mx-auto mb-2 object-contain" alt="Logo" />
        ) : (
          <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-2 flex items-center justify-center text-xl italic font-black">
            {config?.nombre_liga?.charAt(0) || 'L'}
          </div>
        )}
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          {config?.nombre_liga || 'SISTEMA DE VERIFICACIÓN OFICIAL'}
        </h2>
      </div>

      {/* TARJETA DE ESTADO */}
      <div className={`w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border-4 transition-colors duration-500 ${esValida ? 'border-emerald-500' : 'border-rose-500'}`}>
        
        <div className={`p-4 text-center font-black uppercase tracking-widest text-sm ${esValida ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {esValida ? '✅ Jugadora Habilitada' : '❌ Verificación Requerida'}
        </div>

        <div className="bg-slate-900 p-8 flex flex-col items-center">
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
              <span className="font-mono font-bold text-lg italic">{jugadora.dni}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Equipo</span>
              <span className="font-bold text-blue-400 uppercase">{jugadora.equipos?.nombre || 'Independiente'}</span>
            </div>
          </div>

          <div className={`mt-8 flex items-center gap-2 px-4 py-2 rounded-full border ${esValida ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${esValida ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {esValida ? 'Biometría Exitosa' : 'Revisión Manual Pendiente'}
              </span>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[9px] text-slate-600 uppercase font-bold text-center max-w-xs leading-relaxed opacity-60">
        Este documento es intransferible. La falsificación de identidad conlleva la expulsión de la liga {config?.nombre_liga || 'nc-s1125'}.
      </p>
    </div>
  );
};

export default VerificacionPublica;