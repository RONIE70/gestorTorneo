import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const VerificarJugadora = () => {
    const { id } = useParams();
    const [jugadora, setJugadora] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch(`http://localhost:5000/validar-jugadora/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) setError(true);
                else setJugadora(data);
            })
            .catch(() => setError(true));
    }, [id]);

    if (error) return <div className="text-white text-center p-10">❌ Jugadora no encontrada o ID inválido.</div>;
    if (!jugadora) return <div className="text-white text-center p-10">Cargando datos...</div>;

    const estaHabilitada = !jugadora.verificacion_manual;

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
                <div className={`inline-block p-2 rounded-full mb-4 ${estaHabilitada ? 'bg-green-100' : 'bg-amber-100'}`}>
                    <img 
                        src={jugadora.foto_url} 
                        className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                        alt="Perfil"
                    />
                </div>
                
                <h1 className="text-2xl font-black text-slate-800 uppercase leading-tight">
                    {jugadora.nombre} {jugadora.apellido}
                </h1>
                <p className="text-blue-600 font-bold text-lg mb-1">{jugadora.equipos?.nombre_equipo || 'Sin Club'}</p>
                <p className="text-slate-500 font-medium mb-6">Categoría: {jugadora.categoria_actual}</p>

                <div className={`py-3 px-6 rounded-xl font-black text-xl uppercase tracking-widest ${
                    estaHabilitada ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                    {estaHabilitada ? '✅ HABILITADA' : '⚠️ REVISIÓN PENDIENTE'}
                </div>

                <p className="mt-6 text-[10px] text-slate-400 uppercase tracking-tighter">
                    Sistema de Verificación Biométrica nc-s1125 <br/> NO COUNTRY 2026
                </p>
            </div>
        </div>
    );
};

export default VerificarJugadora;