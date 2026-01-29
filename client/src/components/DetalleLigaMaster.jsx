import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const DetalleLigaMaster = () => {
    const { ligaId } = useParams();
    const navigate = useNavigate();
    const [jugadoras, setJugadoras] = useState([]);
    const [infoLiga, setInfoLiga] = useState(null);

    useEffect(() => {
        const cargarDatos = async () => {
            // 1. Info de la Liga
            const { data: liga } = await supabase.from('organizaciones').select('*').eq('id', ligaId).single();
            setInfoLiga(liga);

            // 2. Sus Jugadoras
            const { data: lista } = await supabase
                .from('jugadoras')
                .select('*, equipos(nombre)')
                .eq('organizacion_id', ligaId)
                .order('created_at', { ascending: false });
            setJugadoras(lista || []);
        };
        cargarDatos();
    }, [ligaId]);

    return (
        <div className="min-h-screen bg-slate-950 p-8 text-white">
            <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 font-bold text-xs hover:text-white transition-all">
                ← VOLVER AL PANEL MAESTRO
            </button>

            <header className="flex items-center justify-between mb-10 bg-slate-900 p-8 rounded-[2rem] border border-slate-800">
                <div className="flex items-center gap-6">
                    <img src={infoLiga?.logo_url} className="w-20 h-20 object-contain rounded-2xl bg-slate-950 p-2" alt="logo" />
                    <div>
                        <h1 className="text-3xl font-black uppercase italic">{infoLiga?.nombre}</h1>
                        <p className="text-blue-500 font-bold text-[10px] tracking-widest uppercase">Auditoría en Tiempo Real</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black italic">{jugadoras.length}</p>
                    <p className="text-slate-500 text-[10px] font-black uppercase">Jugadoras Registradas</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jugadoras.map(j => (
                    <div key={j.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                        <img src={j.foto_url} className="w-12 h-12 rounded-full object-cover border border-slate-700" alt="foto" />
                        <div>
                            <p className="text-xs font-black uppercase leading-none">{j.nombre} {j.apellido}</p>
                            <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase">{j.equipos?.nombre || 'Sin Equipo'}</p>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full mt-2 inline-block ${j.verificacion_biometrica_estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {j.verificacion_biometrica_estado || 'PENDIENTE'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DetalleLigaMaster;