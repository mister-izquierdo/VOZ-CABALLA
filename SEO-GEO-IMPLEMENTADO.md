# Voz Caballa — SEO y GEO

Dominio canónico previsto: https://vozcaballa.com

## Implementado
- Dominio de producción declarado en `astro.config.mjs`.
- Canonical absoluto por defecto en el layout común.
- Metadatos title, description, Open Graph y Twitter Cards consistentes.
- Imagen social por defecto y descripción accesible de la imagen.
- Robots meta `index, follow` y `noindex, follow` para páginas filtradas, errores y contenido sensible.
- Datos estructurados JSON-LD `Organization` y `WebSite`; las fichas no sensibles añaden `Article`.
- `robots.txt` con referencia al sitemap.
- `sitemap.xml` dinámico que enumera las páginas públicas estáticas y testimonios publicados no marcados como sensibles.
- `llms.txt` informativo, como recurso complementario no obligatorio.
- Textos de título y descripción revisados en las páginas principales.
- Las páginas legales provisionales quedan en `noindex` y fuera del sitemap hasta que se redacten.
- `.gitignore` excluye `.env` y variantes de entorno, manteniendo `.env.example`.

## URLs previstas al publicar
- https://vozcaballa.com/robots.txt
- https://vozcaballa.com/sitemap.xml
- https://vozcaballa.com/llms.txt

## Pendiente antes del lanzamiento
1. Completar y revisar jurídicamente las políticas de privacidad y cookies; retirar `noindex` y añadirlas al sitemap cuando estén listas.
2. Confirmar que las credenciales de Supabase de producción están configuradas como variables de entorno del despliegue y que RLS protege las tablas y vistas.
3. Verificar que el dominio `vozcaballa.com` apunta al despliegue HTTPS correcto.
4. Dar de alta el dominio en Google Search Console y Bing Webmaster Tools; enviar `https://vozcaballa.com/sitemap.xml`.
5. Probar las URL anteriores en producción y comprobar respuestas HTTP, canonical, robots, JSON-LD y vistas móviles.
6. Revisar contenido y permisos de publicación: los testimonios deben ser relatos publicados con consentimiento y no deben revelar datos privados.

## Nota GEO
`llms.txt` es un documento de orientación opcional. No garantiza rastreo ni inclusión en sistemas de IA. La base principal para SEO y visibilidad en respuestas generativas sigue siendo contenido propio, claro, verificable, accesible e indexable.

## Verificación de build
El build debe ejecutarse en un entorno que cumpla la versión declarada en `package.json` (`Node.js >=22.23.4`). En el entorno de revisión estaba disponible Node.js 22.16.0, por lo que no fue posible validar el build aquí.
