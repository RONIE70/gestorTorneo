import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import * as faceapi from 'face-api.js';
import EXIF from 'exif-js'; // Asegúrate de tenerlo instalado: npm install exif-js

const ValidadorBiometrico = () => {
    const [pendientes, setPendientes] = useState([]);
    const [cargandoModelos, setCargandoModelos] = useState(true);
    const [seleccionada, setSeleccionada] = useState(null);
    const [resultadoIA, setResultadoIA] = useState(null);
    const [resultadoForense, setResultadoForense] = useState(null);
    const [procesando, setProcesando] = useState(false);
    const [userOrgId, setUserOrgId] = useState(null);
    

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

    // 1. CARGA DE MODELOS PESADOS (PC)
    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = window.location.origin + '/models';
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setCargandoModelos(false);
                fetchPendientes();
            } catch (err) {
                console.error("Error cargando modelos IA", err);
            }
        };
        loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

   
// Usamos useCallback para que la función no cambie en cada render
const fetchPendientes = useCallback(async () => {
    if (!userOrgId) return;

    try {
        const { data, error } = await supabase
            .from('jugadoras')
            .select(`
                *,
                equipos:equipo_id!inner (
                    nombre
                )
            `)
            .eq('organizacion_id', userOrgId)
            .eq('verificacion_biometrica_estado', 'pendiente')
            .order('id', { ascending: false });

        if (error) {
            console.error("Error Supabase:", error.message);
            return;
        }
        setPendientes(data || []);
    } catch (err) {
        console.error("Error inesperado:", err);
    }
}, [userOrgId]); 

useEffect(() => {
    if (userOrgId) {
        fetchPendientes();
    }
}, [userOrgId, fetchPendientes]);
// Solo se recrea si cambia el ID de la organización

const analizarForense = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; 
        
        img.onload = function() {
            try {
                EXIF.getData(img, function() {
                    const tags = EXIF.getAllTags(this);
                    if (!tags || Object.keys(tags).length === 0) {
                        resolve({ sospechosa: false, mensaje: "✅ Imagen Original", software: "Sin metadatos" });
                        return;
                    }
                    const software = (tags.Software || "").toLowerCase();
                    const editores = ["photoshop", "adobe", "canva", "picsart", "gimp", "lightroom"];
                    const esEditada = editores.some(ed => software.includes(ed));
                    
                    resolve({
                        sospechosa: esEditada,
                        software: tags.Software || "Cámara Nativa",
                        mensaje: esEditada ? `⚠️ EDITADA CON: ${tags.Software}` : "✅ Imagen Original"
                    });
                });
            } catch (err) {
                console.warn("Fallo al leer EXIF", err);
                resolve({ sospechosa: false, mensaje: "✅ Imagen Original", software: "No legible" });
            }
        };

        img.onerror = () => {
            resolve({ sospechosa: false, mensaje: "✅ Imagen Original", software: "Error de carga" });
        };

        // --- AQUÍ VA EL CAMBIO ---
        // En lugar de img.src = url; usás esto:
        img.src = url + (url.includes('?') ? '&' : '?') + "t=" + new Date().getTime();
    });
};


 const ejecutarCheckCompleto = async (jugadora) => {
    setProcesando(true);
    setResultadoIA(null);
    setResultadoForense(null);

    try {
        // --- 1. SEGURO FORENSE ---
        // Usamos un bloque try/catch independiente para que si falla no detenga la IA
        try {
            const forense = await analizarForense(jugadora.foto_url);
            setResultadoForense(forense);
        } catch (forenseError) {
            console.warn("Fallo análisis forense, pero seguimos con IA:", forenseError);
            setResultadoForense({ 
                sospechosa: false, 
                mensaje: "ℹ️ Metadatos no disponibles", 
                software: "Error de lectura" 
            });
        }

        // --- 2. CARGA DE IMÁGENES ---
        const imgPerfil = await faceapi.fetchImage(jugadora.foto_url);
        const imgDni = await faceapi.fetchImage(jugadora.dni_foto_url);

        // --- 3. BIOMETRÍA (Tu lógica original con umbral 0.4) ---
        // Agregamos opciones para asegurar la detección
        const opciones = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
        
        const det1 = await faceapi.detectSingleFace(imgPerfil, opciones).withFaceLandmarks().withFaceDescriptor();
        const det2 = await faceapi.detectSingleFace(imgDni, opciones).withFaceLandmarks().withFaceDescriptor();

        if (det1 && det2) {
            const distancia = faceapi.euclideanDistance(det1.descriptor, det2.descriptor);
            const esMismaPersona = distancia < 0.4;

            setResultadoIA({
                distancia: distancia.toFixed(4),
                mensaje: esMismaPersona ? "✅ IDENTIDAD CONFIRMADA" : "⚠️ NO COINCIDE LA IDENTIDAD",
                match: esMismaPersona
            });
        } else {
            let errorMsg = "❌ NO SE DETECTÓ ROSTRO EN: ";
            if (!det1 && !det2) errorMsg += "AMBAS FOTOS";
            else if (!det1) errorMsg += "FOTO PERFIL";
            else errorMsg += "FOTO DNI";
            
            setResultadoIA({ mensaje: errorMsg, match: false, error: true });
        }
    } catch (err) {
        console.error("Error crítico en el proceso:", err);
        alert("Hubo un problema al cargar las imágenes. Verificá la conexión.");
    } finally {
        setProcesando(false);
    }
};

    const actualizarEstado = async (id, nuevoEstado, distancia) => {
        const { error } = await supabase
            .from('jugadoras')
            .update({ 
                verificacion_biometrica_estado: nuevoEstado,
                distancia_biometrica_oficial: distancia || null,
                fecha_validacion: new Date().toISOString(),
                observaciones_ia: resultadoForense?.mensaje || ""
            })
            .eq('id', id)
            .eq('organizacion_id', userOrgId);

        if (!error) {
            setSeleccionada(null);
            setResultadoIA(null);
            setResultadoForense(null);
            fetchPendientes();
        }
    };

    if (cargandoModelos) return <div className="p-20 text-center text-white font-black animate-pulse">CARGANDO CEREBRO IA...</div>;

    return (
        <div className="flex h-screen bg-slate-950 text-white font-sans">
            {/* LISTADO LATERAL */}
            <div className="w-1/4 border-r border-slate-800 overflow-y-auto p-6 bg-slate-900/50">
                <h2 className="text-xl font-black italic mb-6 text-blue-500">PENDIENTES ({pendientes.length})</h2>
                <div className="space-y-3">
                    {pendientes.map(j => (
                        <div 
                            key={j.id} 
                            onClick={() => { setSeleccionada(j); setResultadoIA(null); setResultadoForense(null); }}
                            className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${seleccionada?.id === j.id ? 'border-blue-500 bg-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}
                        >
                            <p className="font-black uppercase text-xs">{j.apellido}, {j.nombre}</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">{j.equipos?.nombre || "Club no asignado"}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ÁREA DE REVISIÓN */}
            <div className="w-3/4 p-10 flex flex-col bg-slate-950">
                {seleccionada ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <header className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Estación de Seguridad</h2>
                            {resultadoForense && (
                                <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${resultadoForense.sospechosa ? 'bg-rose-600 animate-pulse' : 'bg-emerald-600'}`}>
                                    {resultadoForense.mensaje}
                                </span>
                            )}
                        </header>
                        
                        <div className="grid grid-cols-2 gap-8 mb-10">
                            <div className="space-y-2 group">
                                <p className="text-center text-[10px] font-black text-slate-500 uppercase italic">FOTO PERFIL</p>
                                <img src={seleccionada.foto_url} className="w-full h-80 object-cover rounded-[2rem] border-4 border-slate-800 group-hover:border-blue-500/50 transition-all shadow-2xl" alt="p" />
                            </div>
                            <div className="space-y-2 group">
                                <p className="text-center text-[10px] font-black text-slate-500 uppercase italic">FRENTE DNI</p>
                                <img src={seleccionada.dni_foto_url} className="w-full h-80 object-cover rounded-[2rem] border-4 border-slate-800 group-hover:border-emerald-500/50 transition-all shadow-2xl" alt="d" />
                            </div>
                        </div>

                        {resultadoIA && (
                            <div className={`mb-8 p-6 rounded-[2rem] text-center border-4 ${resultadoIA.match ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-rose-500/10 border-rose-500 text-rose-500'}`}>
                                <p className="text-2xl font-black uppercase italic">{resultadoIA.mensaje}</p>
                                <p className="text-sm font-bold opacity-70 mt-1">DISTANCIA EUCLIDIANA: {resultadoIA.distancia}</p>
                            </div>
                        )}

                        <div className="mt-auto flex gap-4">
                            {!resultadoIA ? (
                                <button onClick={() => ejecutarCheckCompleto(seleccionada)} disabled={procesando} className="flex-1 bg-blue-600 hover:bg-blue-500 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all active:scale-95">
                                    {procesando ? "PROCESANDO BIOMETRÍA Y EXIF..." : "⚡ LANZAR ESCANEO DE SEGURIDAD"}
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => actualizarEstado(seleccionada.id, 'aprobado', resultadoIA.distancia)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all">APROBAR HABILITACIÓN</button>
                                    <button onClick={() => actualizarEstado(seleccionada.id, 'rechazado')} className="flex-1 bg-rose-600 hover:bg-rose-500 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all">RECHAZAR FICHAJE</button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="m-auto text-center opacity-10">
                        <div className="text-[10rem] mb-4">🛡️</div>
                        <p className="font-black uppercase tracking-[1em]">MODO MONITOR DE SEGURIDAD</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidadorBiometrico;