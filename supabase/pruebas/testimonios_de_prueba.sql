-- =====================================================================
-- VOZ CABALLA · Testimonios de PRUEBA ya publicados
-- Sirve para ver la página de Testimonios y la ficha individual antes de tener el panel.
-- Ejecutar en el SQL Editor de Supabase. NO usar en la web real.
-- Para borrarlos después:   delete from public.testimonios where contacto = 'prueba@ejemplo.com';
-- =====================================================================

insert into public.testimonios
  (estado, categoria, es_anonimo, nombre_publico, contacto, testimonio, consecuencias,
   frase_destacada, contenido_sensible, residencia_verificada, revision_reforzada_ok,
   documentacion_revisada, numero_publico, publicado_en)
values
('publicado', 'economicos', false, 'Alberto Serrado', 'prueba@ejemplo.com',
 'En solo 103 días he visto cómo mi negocio ha perdido ventas. Las consecuencias siguen afectando a mi actividad y cada mes tengo que decidir qué gasto puedo asumir y cuál no.',
 'He perdido 50.000 € en ventas y he tenido que reducir horas a mis empleados.',
 'He perdido 50.000€ en ventas', false, true, false, true, nextval('public.seq_numero_publico'), now() - interval '5 days'),
('publicado', 'inseguridad_violencia', true, 'Anónimo', 'prueba@ejemplo.com',
 'Iba caminando con las bolsas tras hacer la compra, salí del supermercado y unas personas me rodearon. Me quitaron el móvil y la cartera y tardé horas en poder avisar a mi familia.',
 'Ya no salgo sola de noche y evito pasar por esa zona.',
 'Me robaron a la salida del supermercado', false, true, false, false, nextval('public.seq_numero_publico'), now() - interval '4 days'),
('publicado', 'laborales', false, 'Marta López', 'prueba@ejemplo.com',
 'Trabajo en un pequeño comercio y desde que empezaron los hechos las ventas han caído tanto que me han reducido la jornada. Cada semana no sé si podré mantener el empleo.',
 'Cobro menos y vivo con la incertidumbre de perder mi puesto.',
 'Me han reducido la jornada y no sé si mantendré mi empleo', false, true, false, false, nextval('public.seq_numero_publico'), now() - interval '3 days'),
('publicado', 'psicologicas', true, 'Anónimo', 'prueba@ejemplo.com',
 'Desde aquellos días duermo mal y me sobresalto con cualquier ruido. Antes me sentía segura en mi barrio y ahora me cuesta mucho salir de casa, incluso para cosas sencillas.',
 'Ansiedad constante y miedo a salir sola.',
 'Desde aquellos días duermo mal y me sobresalto con cualquier ruido', true, true, true, false, nextval('public.seq_numero_publico'), now() - interval '2 days'),
('publicado', 'familiares', false, 'Carlos Ruiz', 'prueba@ejemplo.com',
 'Mi familia vive con miedo desde entonces. Mis hijos ya no juegan en la calle y hemos cambiado nuestras rutinas de forma que la vida diaria se ha vuelto mucho más complicada para todos.',
 'Los niños tienen miedo y mi pareja ha dejado de salir sola.',
 'Mis hijos ya no juegan en la calle', false, true, false, false, nextval('public.seq_numero_publico'), now() - interval '1 days'),
('publicado', 'materiales', false, 'Lucía Fernández', 'prueba@ejemplo.com',
 'Mi coche apareció con los cristales rotos y una puerta hundida. El seguro no cubre todos los daños y la reparación me ha costado casi un mes de sueldo, que no tenía previsto gastar.',
 'He tenido que pedir un préstamo para pagar la reparación.',
 'Mi coche apareció destrozado y el seguro no cubre todo', false, true, false, true, nextval('public.seq_numero_publico'), now() - interval '12 hours');

-- Archivos de prueba para la primera ficha (imágenes de ejemplo públicas)
-- (Sube imágenes reales desde Storage > documentos-publicos y regístralas aquí si quieres ver las miniaturas.)
