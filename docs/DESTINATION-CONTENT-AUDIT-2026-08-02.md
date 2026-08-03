# Auditoría de contenido de Destinos — contrato mínimo por fases

**Fecha:** 2 de agosto de 2026  
**Repositorio:** `WilmerDep/quisqueya-platform`  
**Referencia visual y técnica principal:** single de Experiencias  
**Objetivo:** identificar la estructura real de las entradas de Destinos en WordPress y definir únicamente el contrato backend necesario para alimentar la single de Destinos en la fase actual.

---

## 1. Contexto de fase

Quisqueya Travel se está desarrollando por fases y con tres frentes que avanzan parcialmente en paralelo:

1. web comercial;
2. API/plataforma;
3. CRM editorial y operativo.

La ausencia actual de un editor completo de Destinos en el CRM no se considera deuda técnica. El CRM será, en fases posteriores, la herramienta desde la que se publicarán y administrarán Destinos, Experiencias, editoriales y servicios DMC.

En esta fase solo se incorporará al backend lo necesario para:

- conservar el contenido editorial real de WordPress;
- exponerlo mediante la API pública;
- alimentar la single dinámica de Destinos;
- mantener un fallback temporal mientras el CRM no gestione todos los campos.

---

## 2. Fuente editorial actual

Los Destinos se encuentran publicados en WordPress como entradas (`post`) y no como un tipo de contenido independiente.

Entradas auditadas:

- Santo Domingo;
- La Altagracia;
- Puerto Plata;
- Samaná;
- La Romana;
- Santiago de los Caballeros.

Aunque su origen sea `post`, dentro de la nueva plataforma deben normalizarse como entidades `Destination`.

Flujo acordado:

```text
Entrada WordPress
      ↓
Migración / normalización
      ↓
Destination en Prisma
      ↓
API pública por slug
      ↓
Single dinámica en Next.js
```

---

## 3. Patrón real encontrado en las entradas

Las entradas no usan exactamente los mismos encabezados ni el mismo número de secciones. Sin embargo, comparten una estructura editorial reconocible:

1. eyebrow o introducción de contexto;
2. título del destino;
3. imagen principal;
4. tagline o encabezado de apertura;
5. párrafo introductorio;
6. varias secciones narrativas con títulos propios;
7. listas de lugares, razones, actividades o recomendaciones;
8. imágenes intercaladas entre secciones;
9. cierre comercial y llamada a la acción.

Ejemplos:

### Santo Domingo

- Donde la historia cobra vida frente al mar Caribe;
- El alma colonial que enamora;
- Una ciudad viva, moderna y caribeña;
- El Malecón: el alma frente al mar;
- Por qué debe estar en el itinerario;
- cierre comercial.

### Puerto Plata

- La joya del Atlántico;
- Donde el Atlántico pinta postales;
- Playas con carácter;
- Naturaleza y adrenalina;
- alma colonial;
- gastronomía;
- cierre comercial.

### Samaná

- El paraíso escondido;
- aventuras naturales;
- imprescindibles;
- cultura y tradición;
- perfil del viajero;
- cierre comercial.

Conclusión: no se debe modelar cada encabezado como una columna fija de Prisma. Se necesita un cuerpo editorial estructurado y flexible.

---

## 4. Single de Experiencias como plantilla matriz

La single de Experiencias continúa siendo la referencia principal porque ya resuelve:

- ruta dinámica por `slug`;
- consulta a API;
- estado publicado;
- metadata SEO;
- hero multimedia;
- navegación segmentada;
- coordinación del Header al hacer scroll;
- galería y lightbox;
- secciones internas;
- mapa;
- FAQ;
- CTA lateral;
- responsive;
- animaciones.

Destinos no debe crear otro sistema de single. Debe heredar esta arquitectura y sustituir únicamente los bloques específicos de Experiencias por bloques editoriales propios.

---

## 5. Contrato mínimo recomendado para esta fase

El modelo `Destination` ya dispone de:

- `id`;
- `slug`;
- `name`;
- `description`;
- `featuredMediaId`;
- `status`;
- procedencia y fechas.

Para alimentar la single actual se recomienda añadir solamente:

```prisma
excerpt               String? @db.Text
featuredText          String? @map("featured_text") @db.Text
galleryMediaSourceIds Json?   @map("gallery_media_source_ids")
contentSectionsJson   Json?   @map("content_sections_json")
locationJson          Json?   @map("location_json")
displayJson           Json?   @map("display_json")
editorialFlagsJson    Json?   @map("editorial_flags_json")
sortOrder             Int     @default(0) @map("sort_order")
```

No se recomienda incorporar todavía campos independientes para clima, gastronomía, cultura, movilidad, mejor época o similares. Esos conceptos pueden conservarse como secciones editoriales hasta que el CRM defina una necesidad operativa clara.

---

## 6. Contrato de bloques editoriales

Contrato público recomendado:

```ts
export type PublicDestinationContentSection = {
  id: string;
  eyebrow?: string;
  title?: string;
  content?: string;
  items: string[];
  media?: PublicMedia | null;
  mediaSourceId?: number;
  mediaPosition?: 'before' | 'after' | 'left' | 'right';
  anchor?: string;
  order: number;
};
```

Contrato principal:

```ts
export type PublicDestination = {
  id: string;
  sourceId?: number;
  slug: string;
  name: string;
  excerpt?: string;
  description?: string;
  featuredText?: string;
  location?: {
    country?: string;
    region?: string;
  };
  featuredMedia?: PublicMedia | null;
  gallery: PublicMedia[];
  galleryMediaSourceIds: number[];
  sections: PublicDestinationContentSection[];
  display?: Record<string, unknown>;
  editorialFlags: PublicDestinationEditorialFlag[];
  sourceUrl?: string;
  status?: string;
};
```

Este contrato permite conservar la estructura real de cada entrada sin imponer el mismo número de secciones ni los mismos títulos.

---

## 7. Normalización desde WordPress

La migración debe:

1. identificar las seis entradas de Destinos por slug o manifiesto;
2. separar el contenido propio de la entrada del formulario, footer y bloques globales de WordPress;
3. capturar la imagen destacada;
4. extraer imágenes intermedias y sus IDs de medios;
5. convertir encabezados `h2`, `h3` y `h4` en secciones;
6. asociar párrafos y listas con la sección anterior;
7. generar un `anchor` estable por sección;
8. conservar el HTML editorial permitido dentro de `content`;
9. registrar flags cuando falte imagen, título o contenido;
10. guardar procedencia y URL original.

El cierre comercial global no debe duplicarse dentro de cada sección si la nueva single ya aporta su propio CTA.

---

## 8. Navegación segmentada

La navegación de capítulos de Destinos debe derivarse de las secciones disponibles.

No debe hardcodearse una lista idéntica para todos los Destinos.

Ejemplo para Santo Domingo:

```text
Descubre
Alma colonial
Ciudad caribeña
El Malecón
Planifica tu viaje
```

La implementación reutilizará el patrón de:

- `ExperienceChapterNav`;
- `ExperienceHeaderCoordinator`.

Durante la primera adaptación pueden existir wrappers específicos de Destinos. La extracción de una base común se realizará de forma incremental para evitar regresiones en Experiencias.

---

## 9. Campos reservados para fases posteriores

Quedan fuera de esta entrega:

- editor visual completo del CRM;
- historial de revisiones;
- programación de publicación;
- traducciones administrables;
- workflow de aprobación;
- relaciones editoriales avanzadas;
- SEO administrable desde CRM;
- bloques drag-and-drop;
- permisos editoriales específicos;
- preview desde el CRM;
- versionado de medios.

Estos puntos no se consideran faltantes de la fase actual.

---

## 10. Orden de implementación aprobado

### Backend

1. ampliar `Destination` con el contrato mínimo;
2. crear migración Prisma;
3. ampliar tipos públicos;
4. mapear galería, ubicación, secciones y flags;
5. adaptar importación/migración desde WordPress;
6. validar `/public/destinations/:slug`.

### Frontend

7. ampliar `DestinationItem`;
8. consumir los nuevos campos desde `getDestinationBySlug()`;
9. adaptar hero multimedia de Experiencias;
10. adaptar navegación segmentada y coordinación del Header;
11. renderizar secciones dinámicas;
12. añadir galería, mapa o FAQ solo cuando existan datos;
13. conservar fallback migrado temporal.

---

## 11. Decisión final

La single de Destinos se construirá sobre la arquitectura de la single de Experiencias.

El backend almacenará un conjunto pequeño de campos estructurales y un arreglo flexible de secciones editoriales. Esto permite alimentar la web actual y prepara la futura administración desde el CRM sin adelantar toda la capa editorial de fases posteriores.
