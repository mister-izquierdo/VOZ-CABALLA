/**
 * VOZ CABALLA · lib/categorias.ts
 * Lista única de categorías. La usan el formulario y (más adelante) el archivo de testimonios.
 * `valor` coincide con los valores de la base de datos (tipo categoria_testimonio).
 * `colorVar` es la variable de color de tokens.css.
 */
export interface Categoria {
  valor: string;
  etiqueta: string;
  colorVar: string;
  /** Si en esta categoría se pide el apartado «Archivos multimedia». */
  permiteArchivos: boolean;
}

export const CATEGORIAS: Categoria[] = [
  { valor: 'economicos', etiqueta: 'Económicos y comerciales', colorVar: '--cat-economicos', permiteArchivos: true },
  { valor: 'materiales', etiqueta: 'Daños materiales', colorVar: '--cat-materiales', permiteArchivos: true },
  { valor: 'laborales', etiqueta: 'Laborales', colorVar: '--cat-laborales', permiteArchivos: true },
  { valor: 'familiares', etiqueta: 'Familiares', colorVar: '--cat-familiares', permiteArchivos: false },
  { valor: 'psicologicas', etiqueta: 'Psicológicas', colorVar: '--cat-psicologicas', permiteArchivos: false },
  { valor: 'inseguridad_violencia', etiqueta: 'Inseguridad y violencia', colorVar: '--cat-inseguridad', permiteArchivos: true },
  { valor: 'otro', etiqueta: 'Otro', colorVar: '--cat-otro', permiteArchivos: true },
];
