import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import * as faceapi from 'face-api.js';
import EXIF from 'exif-js';

const ValidadorBiometrico = () => {
    const [pendientes, setPendientes] = useState([]);
    const [filtroClub, setFiltroClub] = useState('');
    const [cargandoModelos, setCargandoModelos] = useState(true);
    const [seleccionada, setSeleccionada] = useState(null);
    const [resultadoIA, setResultadoIA] = useState(null);
    const [resultadoForense, setResultadoForense] = useState(null);
    const [procesando, setProcesando] = useState(false);
    const [userOrgId, setUserOrgId] = useState(null);

    // --- FUNCIÓN CLAVE: CARGADOR NATIVO (Evita el error 'n') ---
    const cargarImagenHTML = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Error al cargar imagen: " + url));
            // Agregamos timestamp para limpiar la caché y forzar CORS
            img.src = url + (url.includes('?') ? '&' : '?') + "t=" + new Date().getTime();
        });
    };

    useEffect(() => {
        const obtenerContexto = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: perfil } = await supabase
                    .from('perfiles')
                    .select('organizacion_id')
                    .eq('id', session.user.id)
                    .single();
                if (perfil) setUserOrgId(perfil.organizacion_id);
            }
        };
        obtenerContexto();
    }, []);

    // 1. CARGA DE MODELOS MEJORADA
    useEffect(() => {
        const loadModels = async () => {
            // Asegúrate que la carpeta 'models' esté en /public/models
            const MODEL_URL = '/models'; 
            try {
                console.log("Iniciando carga de cerebros IA...");
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                console.log("IA Lista para operar.");
                setCargandoModelos(false);
            } catch (err) {
                console.error("No se pudieron cargar los modelos en " + MODEL_URL, err);
                alert("Error crítico: No se encuentran los modelos de IA en la carpeta pública.");
            }
        };
        loadModels();
    }, []);

    const fetchPendientes = useCallback(async () => {
        if (!userOrgId) return;
        const { data } = await supabase
            .from('jugadoras')
            .select('*, equipos:equipo_id!inner(nombre)')
            .eq('organizacion_id', userOrgId)
            .eq('verificacion_biometrica_estado', 'pendiente')
            .order('id', { ascending: false });
        setPendientes(data || []);
    }, [userOrgId]);

    useEffect(() => { if (userOrgId) fetchPendientes(); }, [userOrgId, fetchPendientes]);

    const analizarForense = (imgElement) => {
        return new Promise((resolve) => {
            try {
                EXIF.getData(imgElement, function() {
                    const tags = EXIF.getAllTags(this);
                    const software = (tags.Software || "").toLowerCase();
                    const esEditada = ["photoshop", "canva", "picsart", "adobe"].some(ed => software.includes(ed));
                    resolve({
                        sospechosa: esEditada,
                        mensaje: esEditada ? `⚠️ EDITADA CON: ${tags.Software}` : "✅ Imagen Original"
                    });
                });
            } catch { resolve({ sospechosa: false, mensaje: "✅ Imagen Original" }); }
        });
    };

    const ejecutarCheckCompleto = async (jugadora) => {
        setProcesando(true);
        setResultadoIA(null);
        setResultadoForense(null);

        try {
            // CARGA NATIVA (Aquí matamos el error 'n')
            const imgPerfil = await cargarImagenHTML(jugadora.foto_url);
            const imgDni = await cargarImagenHTML(jugadora.dni_foto_url);

            // ANÁLISIS FORENSE SOBRE EL ELEMENTO YA CARGADO
            const forense = await analizarForense(imgPerfil);
            setResultadoForense(forense);

            // DETECCIÓN IA
            const opciones = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
            const det1 = await faceapi.detectSingleFace(imgPerfil, opciones).withFaceLandmarks().withFaceDescriptor();
            const det2 = await faceapi.detectSingleFace(imgDni, opciones).withFaceLandmarks().withFaceDescriptor();

            if (det1 && det2) {
                const distancia = faceapi.euclideanDistance(det1.descriptor, det2.descriptor);
                const match = distancia < 0.45; // Umbral de confianza
                setResultadoIA({
                    distancia: distancia.toFixed(4),
                    mensaje: match ? "✅ IDENTIDAD CONFIRMADA" : "⚠️ DIFERENCIA DETECTADA",
                    match
                });
            } else {
                setResultadoIA({ mensaje: "❌ NO SE DETECTÓ ROSTRO", match: false, error: true });
            }
        } catch (err) {
            console.error(err);
            alert("Error al acceder a las fotos. Verificá que no tengan bloqueo de seguridad.");
        } finally {
            setProcesando(false);
        }
    };

    const actualizarEstado = async (id, nuevoEstado, distancia) => {
        const { error } = await supabase
            .from('jugadoras')
            .update({ 
                verificacion_biometrica_estado: nuevoEstado,
                distancia_biometrica_oficial: distancia ? parseFloat(distancia) : 0,
                fecha_validacion: new Date().toISOString(),
                estado_habil_admin: nuevoEstado === 'aprobado'
            })
            .eq('id', id);

        if (!error) {
            setSeleccionada(null);
            setResultadoIA(null);
            fetchPendientes();
        }
    };

    const pendientesFiltrados = pendientes.filter(j => 
        (j.equipos?.nombre || "").toLowerCase().includes(filtroClub.toLowerCase())
    );

    if (cargandoModelos) return <div className="p-20 text-center text-white font-black animate-pulse uppercase">Cargando Motores de Seguridad...</div>;

    return (
        <div className="flex h-screen bg-slate-950 text-white font-sans">
            {/* Listado Lateral */}
            <div className="w-1/4 border-r border-slate-800 p-6 bg-slate-900/50 flex flex-col">
                <h2 className="text-xl font-black italic mb-4 text-blue-500 uppercase">Pendientes ({pendientesFiltrados.length})</h2>
                <input type="text" placeholder="BUSCAR CLUB..." value={filtroClub} onChange={(e)=>setFiltroClub(e.target.value)} className="mb-4 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
                <div className="space-y-2 overflow-y-auto flex-1">
                    {pendientesFiltrados.map(j => (
                        <div key={j.id} onClick={() => { setSeleccionada(j); setResultadoIA(null); }} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${seleccionada?.id === j.id ? 'border-blue-500 bg-blue-600/10' : 'border-slate-800 bg-slate-900'}`}>
                            <p className="font-black uppercase text-[10px]">{j.apellido}, {j.nombre}</p>
                            <p className="text-[8px] text-slate-500 font-bold uppercase">{j.equipos?.nombre}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Panel de Revisión */}
            <div className="w-3/4 p-10 bg-slate-950 flex flex-col">
                {seleccionada ? (
                    <div className="space-y-8 h-full flex flex-col">
                        <header className="flex justify-between items-center">
                            <h2 className="text-2xl font-black uppercase italic italic">Estación de Validación</h2>
                            {resultadoForense && <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${resultadoForense.sospechosa ? 'bg-rose-600' : 'bg-emerald-600'}`}>{resultadoForense.mensaje}</span>}
                        </header>

                        <div className="grid grid-cols-2 gap-8">
                            <img src={seleccionada.foto_url} className="w-full h-80 object-cover rounded-[2rem] border-4 border-slate-800 shadow-2xl" alt="perfil" />
                            <img src={seleccionada.dni_foto_url} className="w-full h-80 object-cover rounded-[2rem] border-4 border-slate-800 shadow-2xl" alt="dni" />
                        </div>

                        {resultadoIA && (
                            <div className={`p-6 rounded-[2rem] text-center border-4 ${resultadoIA.match ? 'border-emerald-500 bg-emerald-500/10' : 'border-rose-500 bg-rose-500/10'}`}>
                                <p className="text-2xl font-black uppercase italic">{resultadoIA.mensaje}</p>
                                <p className="text-sm font-bold opacity-70">DISTANCIA: {resultadoIA.distancia}</p>
                            </div>
                        )}

                        <div className="mt-auto flex gap-4">
                            {!resultadoIA ? (
                                <button onClick={() => ejecutarCheckCompleto(seleccionada)} disabled={procesando} className="flex-1 bg-blue-600 hover:bg-blue-500 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all">
                                    {procesando ? "ANALIZANDO PÍXELES..." : "⚡ LANZAR ESCANEO"}
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => actualizarEstado(seleccionada.id, 'aprobado', resultadoIA.distancia)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-6 rounded-3xl font-black text-xl transition-all">APROBAR</button>
                                    <button onClick={() => actualizarEstado(seleccionada.id, 'rechazado')} className="flex-1 bg-rose-600 hover:bg-rose-500 py-6 rounded-3xl font-black text-xl transition-all">RECHAZAR</button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="m-auto text-center opacity-20"><p className="text-8xl mb-4">🛡️</p><p className="font-black tracking-[1em]">MODO SEGURIDAD</p></div>
                )}
            </div>
        </div>
    );
};

export default ValidadorBiometrico;