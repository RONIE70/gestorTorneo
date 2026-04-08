import React, { useState, useMemo } from 'react';
import CarnetJugadora from './CarnetJugadora';
import { 
  ViewColumnsIcon, 
  TableCellsIcon, 
  ShieldCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// 1. MOVEMOS LA LISTA AFUERA: Así es una referencia estática y no molesta al useMemo
const CATEGORIAS_LISTA = ['2011-2012', '2013-2014', '2015-2016', '2017-2018'];

const SeccionJugadoresDelegado = ({ jugadoras, equipoConfig }) => {
  const [vista, setVista] = useState('credencial');
  const [categoriaSel, setCategoriaSel] = useState('TODAS');

  // 2. LÓGICA DE CONTADORES Y ALERTAS
  const stats = useMemo(() => {
    const data = {
      conteos: { 'TODAS': jugadoras.length },
      alertas: { 'TODAS': false }
    };
    
    CATEGORIAS_LISTA.forEach(cat => {
      data.conteos[cat] = 0;
      data.alertas[cat] = false;
    });
    
    jugadoras.forEach(j => {
      // USAMOS Object.hasOwn para evitar el error de Object.prototype
      if (j.categoria && Object.hasOwn(data.conteos, j.categoria)) {
        data.conteos[j.categoria]++;
        if (j.verificacion_biometrica_estado !== 'aprobado') {
          data.alertas[j.categoria] = true;
          data.alertas['TODAS'] = true;
        }
      }
    });
    
    return data;
  }, [jugadoras]); // CATEGORIAS_LISTA ya no es necesaria aquí porque es externa

  const jugadorasFiltradas = useMemo(() => {
    if (categoriaSel === 'TODAS') return jugadoras;
    return jugadoras.filter(j => j.categoria === categoriaSel);
  }, [jugadoras, categoriaSel]);

  return (
    <div className="space-y-6 p-2 md:p-6 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER DE CONTROL */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl pb-4 border-b border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-600/20 rounded-xl border border-pink-500/30">
              <ShieldCheckIcon className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic text-white leading-none tracking-tighter">Credenciales</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {equipoConfig?.nombre || 'LdlN 2026'}
              </p>
            </div>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-2xl border border-white/10 shadow-inner">
            <button 
              onClick={() => setVista('tabla')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${vista === 'tabla' ? 'bg-slate-800 text-white shadow-lg border border-white/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <TableCellsIcon className="w-4 h-4" /> Lista
            </button>
            <button 
              onClick={() => setVista('credencial')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${vista === 'credencial' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <ViewColumnsIcon className="w-4 h-4" /> Carnet
            </button>
          </div>
        </div>

        {/* FILTROS CON ALERTAS ROJAS */}
        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
          {['TODAS', ...CATEGORIAS_LISTA].map(cat => {
            const tieneAlerta = stats.alertas[cat];
            const estaSeleccionado = categoriaSel === cat;

            return (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`relative whitespace-nowrap px-5 py-2.5 rounded-full text-[10px] font-black uppercase border-2 transition-all duration-300 flex items-center gap-2 ${
                  estaSeleccionado 
                  ? 'bg-white border-white text-black scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                  : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600'
                }`}
              >
                {cat}
                <span className={`px-2 py-0.5 rounded-md text-[8px] flex items-center gap-1 ${
                  tieneAlerta 
                    ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.5)]' 
                    : (estaSeleccionado ? 'bg-black text-white' : 'bg-slate-800 text-slate-400')
                }`}>
                  {tieneAlerta && <ExclamationTriangleIcon className="w-3 h-3" />}
                  {stats.conteos[cat] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDERIZADO DE CONTENIDO */}
      <div className="mt-6">
        {jugadorasFiltradas.length > 0 ? (
          vista === 'tabla' ? (
            <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-slate-900/20 backdrop-blur-sm shadow-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 text-slate-400 font-black uppercase italic tracking-wider">
                    <th className="p-5">Jugadora</th>
                    <th className="p-5 text-center">Bloque</th>
                    <th className="p-5 text-right">Biometría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {jugadorasFiltradas.map(jug => (
                    <tr key={jug.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-5 font-bold uppercase text-slate-200">{jug.apellido}, {jug.nombre}</td>
                      <td className="p-5 text-center">
                        <span className="bg-slate-800 px-3 py-1 rounded-lg font-black text-blue-400">{jug.categoria}</span>
                      </td>
                      <td className={`p-5 text-right font-black uppercase tracking-widest ${jug.verificacion_biometrica_estado === 'aprobado' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {jug.verificacion_biometrica_estado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-12 gap-x-6">
              {jugadorasFiltradas.map(jug => (
                <div key={jug.id} className="flex flex-col items-center">
                  <div className="relative group">
                    <CarnetJugadora 
                        jugadora={{
                          ...jug, 
                          // 1. Escudo del Club (Viene de la configuración del equipo del delegado)
                          club_escudo: equipoConfig?.escudo_url || equipoConfig?.logo_url,
                          club_nombre: equipoConfig?.nombre,
                          
                          // 2. Logo de la Liga (Usamos la URL de Cloudinary que pasaste)
                          liga_logo: equipoConfig?.organizacion_logo || equipoConfig?.logo_url
                        }} 
                        // Pasamos los colores oficiales definidos en tu tabla configuracion_liga
                        config={{
                          ...equipoConfig,
                          color_primario: equipoConfig?.color_primario || '#d90082', // El rosa de las nenas
                          color_fondo: equipoConfig?.color_fondo_carnet || '#1e3a8a',
                          mostrarDorso: false 
                        }} 
                        mostrarDorso={false} 
                      />
                      {/* 2. EL LOGO DE LA LIGA (SUPERPUESTO AL FRENTE) */}
                    <div className="absolute top-[45px] right-[22px] z-20 pointer-events-none">
                      <img 
                        src="https://res.cloudinary.com/dgtc9qfmv/image/upload/v1770690271/rt0j5lpxilkn8o6ugate.png" 
                        alt="logo-liga"
                        className="h-10 w-10 object-contain drop-shadow-lg opacity-90"
                      />
                    </div>
                    <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl text-[10px] font-black uppercase shadow-2xl border-2 z-10 whitespace-nowrap transition-transform duration-300 group-hover:scale-110 ${
                      jug.verificacion_biometrica_estado === 'aprobado' 
                      ? 'bg-emerald-600 border-emerald-400 text-white' 
                      : 'bg-rose-600 border-rose-400 text-white animate-pulse'
                    }`}>
                      {jug.verificacion_biometrica_estado === 'aprobado' ? '✓ Habilitada' : '✕ Inhabilitada'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
            <p className="text-slate-700 font-black uppercase italic tracking-[0.3em] text-sm">Sin jugadoras cargadas en {categoriaSel}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeccionJugadoresDelegado;