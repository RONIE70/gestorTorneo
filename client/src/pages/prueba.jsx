const ejecutarSorteoFinal = async (modalidadSeleccionada) => {
    setLoading(true);
    setShowModalPlayoff(false);
    setTipoPlayOff(modalidadSeleccionada);
    try {
      // 1. LIMPIEZA DE PARTIDOS
      await supabase.from('partidos').delete().neq('id', 0);

      // SOLO BORRAMOS ZONAS SI ES ALEATORIO. Si es manual, las mantenemos.
      if (metodoZonas === 'aleatorio') {
        await supabase.from('equipos').update({ zona: null }).neq('id', 0);
      }

      await supabase.from('configuracion_torneo').update({ tipo_playoff: modalidadSeleccionada }).eq('id', torneoActivoId);

      let fixtureFinal = [];
      let grupos = [];

      if (torneoModo === 'zonas') {
        if (metodoZonas === 'manual') {
          // MODO MANUAL: Agrupamos por lo que ya está en DB
          const zonaA = clubes.filter(c => c.zona === 'Zona A');
          const zonaB = clubes.filter(c => c.zona === 'Zona B');
          grupos = [zonaA, zonaB];
        } else {
          // MODO ALEATORIO: Lógica Berger + Cabezas
          const cabezas = clubes.filter(c => c.es_cabeza_serie).sort(() => Math.random() - 0.5);
          const resto = clubes.filter(c => !c.es_cabeza_serie).sort(() => Math.random() - 0.5);
          grupos = Array.from({ length: cantidadZonas }, () => []);
          cabezas.forEach((c, i) => grupos[i % cantidadZonas].push(c));
          resto.forEach((eq, index) => { grupos[(index + cabezas.length) % cantidadZonas].push(eq); });
        }

        let maxFechaZonas = 0;
        for (let i = 0; i < grupos.length; i++) {
          const nombreZona = `Zona ${String.fromCharCode(65 + i)}`;
          if (metodoZonas === 'aleatorio') {
             await supabase.from('equipos').update({ zona: nombreZona }).in('id', grupos[i].map(e => e.id));
          }
          const fixGrupo = generarFixtureBerger(grupos[i]);
          if (fixGrupo.length > maxFechaZonas) maxFechaZonas = fixGrupo.length;
          fixtureFinal.push(...fixGrupo.map(fecha => ({ ...fecha, zona: nombreZona, fechaReal: calcularFechaCalendario(fecha.numero) })));
        }
        // --- 3. GENERACIÓN DE CRUCES DE PLAY-OFF ---
const fechaPlayoff = maxFechaZonas + 1;
let encuentrosPlayoff = [];
if (modalidadSeleccionada === 'eliminacion_directa') {
encuentrosPlayoff.push({
id: 'f-1',
loc: { id: null, nombre: "1° ZONA A" },
vis: { id: null, nombre: "1° ZONA B" },
etapa: 'GRAN FINAL'
});
}
else if (modalidadSeleccionada === 'semis_y_final') {
encuentrosPlayoff.push({ id: 's-1', loc: { id: null, nombre: "1° ZONA A" }, vis: { id: null, nombre: "2° ZONA B" }, etapa: 'SEMIFINAL 1' });
encuentrosPlayoff.push({ id: 's-2', loc: { id: null, nombre: "1° ZONA B" }, vis: { id: null, nombre: "2° ZONA A" }, etapa: 'SEMIFINAL 2' });
}
else if (modalidadSeleccionada === 'mejores_6') {
  encuentrosPlayoff.push({ id: 'llave-1', loc: { id: null, nombre: "1° GENERAL" }, vis: { id: null, nombre: "6° GENERAL" }, etapa: 'LLAVE 1' });
  encuentrosPlayoff.push({ id: 'llave-2', loc: { id: null, nombre: "2° GENERAL" }, vis: { id: null, nombre: "5° GENERAL" }, etapa: 'LLAVE 2' });
  encuentrosPlayoff.push({ id: 'llave-3', loc: { id: null, nombre: "3° GENERAL" }, vis: { id: null, nombre: "4° GENERAL" }, etapa: 'LLAVE 3' });
}
else if (modalidadSeleccionada === 'mundialito') {
  encuentrosPlayoff.push({ id: 'm-1', loc: { id: null, nombre: "1° NORTE" }, vis: { id: null, nombre: "2° SUR" }, etapa: 'MUNDIALITO 1' });
  encuentrosPlayoff.push({ id: 'm-2', loc: { id: null, nombre: "1° SUR" }, vis: { id: null, nombre: "2° NORTE" }, etapa: 'MUNDIALITO 2' });
}

// --- NUEVA MODALIDAD AGREGADA AQUÍ ---
else if (modalidadSeleccionada === 'finales_por_puesto') {
// Partido por el título
encuentrosPlayoff.push({
id: 'f-titulo',
loc: { id: null, nombre: "1° ZONA A" },
vis: { id: null, nombre: "1° ZONA B" },
etapa: 'GRAN FINAL'
});


// Partido por el tercer puesto
encuentrosPlayoff.push({
id: 'f-tercer-puesto',
loc: { id: null, nombre: "2° ZONA A" },
vis: { id: null, nombre: "2° ZONA B" },
etapa: '3° PUESTO'
});
}
fixtureFinal.push({
numero: fechaPlayoff,
fechaReal: calcularFechaCalendario(fechaPlayoff),
zona: 'PLAY-OFFS',
encuentros: encuentrosPlayoff
});

      } else {
        const ida = generarFixtureBerger([...clubes].sort(() => Math.random() - 0.5));
        fixtureFinal = ida.map(f => ({ ...f, fechaReal: calcularFechaCalendario(f.numero), zona: 'Única' }));
      }

      // 4. GUARDADO
      const categoriasQueJuegan = categorias.filter(c => c.participa_torneo);
      const partidosParaInsertar = fixtureFinal.flatMap(fecha => 
        fecha.encuentros.flatMap(enc => {
          if (enc.loc.id && enc.vis.id) {
            return categoriasQueJuegan.map(cat => ({
              nro_fecha: fecha.numero,
              fecha_calendario: fecha.fechaReal,
              zona: fecha.zona,
              local_id: enc.loc.id,
              visitante_id: enc.vis.id,
              horario: cat.horario,
              categoria: cat.nombre,
              organizacion_id: userOrgId,
              finalizado: false
            }));
          }
          return [];
        })
      );

      await supabase.from('partidos').insert(partidosParaInsertar);
      await fetchData();
      alert("✅ Fixture generado con éxito.");
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };