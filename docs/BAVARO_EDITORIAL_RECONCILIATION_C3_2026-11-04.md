# Bávaro Adventure Park — conciliación editorial previa a C3

Fecha de revisión: 2026-11-04. Estado: **conciliado contra el documento recibido; correcciones aplicadas al seed de la rama aislada, sin modificar MySQL**. Este informe no autoriza publicación.

## Fuentes y alcance

- Fuente editorial: Breidy Solano, *Tercera parte excursiones descriptivos(1).docx*, sección «Bavaro Adventure Park», tabla y descripciones (líneas 211–574 de la extracción de texto).
- Base local: `data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json` (13 registros `create_draft`).
- Contrato API C2: `docs/EXPERIENCE_FAMILY_API_LOCAL_C2_2026-11-03.md`; la lectura de familias ya está implementada, pero falta la creación/verificación del padre en datos.
- Este cotejo compara la **fuente documental con la semilla del repositorio**, no el estado real de las filas en MySQL ni el último despliegue de Hostinger. Los registros de la API v1 de staging siguen separados según el chequeo HTTP 200 compartido por Wilmer.

## Regla de alimentación

**El documento no asigna desayuno a ninguna de las 13 modalidades de Bávaro.** No debemos agregar desayuno por analogía ni inferir que toda experiencia de día completo incluye almuerzo. El almuerzo, la cena y el refrigerio son atributos de **cada paquete**, nunca inclusiones generales del padre.

| Modalidad y slug (prefijo común `bavaro-adventure-park-`) | Alimentación en documento | Semilla antes de la corrección | Conciliación aplicada o pendiente |
| --- | --- | --- | --- |
| `explorer-adventure-catamaran` | Nachos y salsas; barra libre nacional. Sin almuerzo documentado. | `Snack.` y `Barra libre.` | Precisar **nachos y salsas** y bebida nacional; no agregar almuerzo ni desayuno. |
| `buggy-vip` | Almuerzo típico dominicano **sin bebidas**. | Almuerzo sin bebidas; bebida de almuerzo excluida. | Correcto en alimentación. |
| `zipline-mega-splash` | Almuerzo típico dominicano **sin bebidas**. | `Almuerzo dominicano.`; bebidas no identificadas. | Especificar «sin bebidas» y excluirlas con claridad. |
| `sacred-river` | Almuerzo típico dominicano **sin bebidas**. | `Almuerzo dominicano.`; bebidas no identificadas. | Especificar «sin bebidas» y excluirlas con claridad. |
| `buggy-zipline` | Almuerzo dominicano **sin bebidas**. | Almuerzo ausente. | Agregar almuerzo y exclusión de bebidas; cotejar Blue Lagoon, piscina, Pueblo y laberinto omitidos de `included`. |
| `sacred-river-zipline` | La sección individual **no menciona alimentación**. | Ninguna. | Mantener sin alimentación afirmada; pedir confirmación comercial antes de añadir/excluir comida. |
| `buggy-party-boat` | Almuerzo dominicano; snacks; barra libre nacional. | Alimentación y bebidas ausentes. | Agregar almuerzo, snacks y barra nacional; cotejar catamarán, snorkel, piscina y entretenimiento omitidos. La fuente **no especifica** «sin bebidas» para ese almuerzo. |
| `polaris-vip` | Almuerzo típico dominicano **sin bebidas**. | Almuerzo ausente. | Agregar almuerzo y exclusión de bebidas; cotejar Blue Lagoon, Pueblo, piscina y laberinto. |
| `polaris-zipline` | Almuerzo dominicano; no aclara si bebidas acompañan el almuerzo. | Almuerzo ausente. | Agregar almuerzo; **no** declarar bebidas incluidas o excluidas sin confirmación. |
| `full-access-buggy` | Almuerzo típico dominicano **sin bebidas**. | Almuerzo ausente. | Agregar almuerzo y exclusión de bebidas; listar zipline, caballos, Sacred River, Blue Lagoon, Jungle River y demás inclusiones documentadas. |
| `sacred-river-de-noche` | Cena Mar & Tierra; barra libre. | Cena Mar & Tierra; barra libre. | Correcto en alimentación; cotejar cenote, traslado y guías omitidos de `included`. |
| `polaris-de-noche` | Cena Mar & Tierra **de tres tiempos**; barra libre. | Cena Mar & Tierra; barra libre. | Precisar tres tiempos; cotejar traslado, cenote y guías omitidos. |
| `full-access-polaris` | La ficha remite al Full Access Buggy, sustituyendo el vehículo, pero **no declara almuerzo de forma independiente**. | Ninguna. | No heredar automáticamente almuerzo del Buggy; validar explícitamente con el proveedor. |

Balance documental: **8 almuerzos explícitos, 2 cenas, 1 refrigerio/barra en catamarán y 2 modalidades sin alimentación indicada**. Se contabiliza cada modalidad una sola vez. Antes de la corrección, **cinco almuerzos faltaban por completo en la semilla** (`buggy-zipline`, `buggy-party-boat`, `polaris-vip`, `polaris-zipline`, `full-access-buggy`) y dos figuran sin aclaración de que no incluyen bebidas (`zipline-mega-splash`, `sacred-river`). Estas siete diferencias quedaron corregidas localmente. El almuerzo de `buggy-party-boat` y `polaris-zipline` **no** se etiquetó «sin bebidas», ya que el documento no lo especifica.

## Corrección aplicada al seed local

Se actualizaron las inclusiones de Explorer Adventure – Catamarán, Zipline Mega Splash, Sacred River, Buggy + Zipline, Buggy + Party Boat, Polaris VIP, Polaris + Zipline, Full Access Buggy, ambas modalidades nocturnas y Full Access Polaris. Se conservaron los **13 slugs, identificadores, importes, operaciones `create_draft`, flags editoriales y asociaciones de familia**. Las dos modalidades sin alimentación explícita permanecieron sin comidas añadidas. El cambio **no** sincroniza automáticamente registros ya publicados en MySQL; requiere cotejo de diferencias antes de cualquier actualización de datos reales.

## Inclusiones, exclusiones y condiciones que hay que preservar

1. **Lockers**: el Word los presenta como «con costo adicional», aunque visualmente precedidos por un símbolo de inclusión. Deben permanecer **fuera** de `included` y tratados como gasto aparte; la semilla los incluye en `excluded`, lo cual es correcto. Para `buggy-zipline` el Word también excluye fotografías, souvenirs, bebidas/snacks adicionales, actividades no incluidas y suplemento de Bayahibe/La Romana: revisar la redacción específica en `excluded`.
2. **Transporte**: hay condiciones de cobertura; `polaris-zipline` menciona Punta Cana, Bávaro, Cap Cana, Uvero Alto y suplemento para Bayahibe/La Romana. No generalizar zonas ni inventar el costo del suplemento.
3. **Polaris VIP**: US$149 **por persona**, no por vehículo de hasta cuatro pasajeros. Diferenciar Full Access Buggy (US$169) y Full Access Polaris (US$199); no fusionar precios.
4. **Polaris de noche**: conductor de 18 años o más con licencia vigente (documentado de forma explícita); evitar trasladar restricciones a otras modalidades sin cotejo específico.
5. **Tarifas infantiles**: regla general de 6 a 12 años con 30 % de descuento, **excepto Polaris**, con importe final sujeto a confirmación comercial. No deducir política de menores de seis años, ni convertir la regla en tarifas automáticas.
6. **Medios, horarios y disponibilidad**: la imagen y galería por modalidad siguen marcadas como pendientes en la semilla; no usar imágenes del parque indiscriminadamente ni asumir que las operaciones nocturnas siguen el horario diurno general.
7. **Datos comunes del padre**: nombre, familia y destino pueden compartirse; alimentación, itinerarios, duraciones, restricciones, precios y políticas propias permanecen en cada paquete. No usar la suma de precios para una «combinación» de consulta.

## Preparación para el padre `bavaro-adventure-park`

La definición prevista es `displayJson.experienceFamily = { "version": 2, "mode": "multi_inquiry", "packageSlugs": [...] }`, con los **13 slugs exactos y únicos**, manteniendo el orden del archivo semilla. El padre no debe heredar alimentación ni un precio fijo arbitrario. Los hijos publicados conservan su URL individual.

Antes de aplicar datos en cualquier entorno, el *dry-run* de C3 debe comprobar la existencia/colisión del slug padre, referencias y propietarios actuales, el estado `PUBLISHED` de los 13 hijos, los medios disponibles y la posibilidad de revertir solo los cambios que cree. **Los datos de este seed no prueban por sí solos el estado de MySQL.**

Se preparó el preflight de **solo lectura** `scripts/preview-bavaro-family-c3.mjs`, que carece deliberadamente de modo `--apply`:

```bash
node scripts/preview-bavaro-family-c3.mjs
node scripts/preview-bavaro-family-c3.mjs --database
```

La primera orden utiliza únicamente el JSON del repositorio. Ejecutada inicialmente el 04/11/2026, detectó cinco almuerzos omitidos. Tras las correcciones, verificó **13 slugs únicos**, asociación correcta de los 13 al `familyKey`, 13 importes con base `USD/person`, cero advertencias de alimentación y generó una propuesta de padre **DRAFT** con `displayJson.experienceFamily.version=2`, `mode=multi_inquiry` y los 13 slugs en el orden del seed. Ninguno de los 13 tiene `featuredMediaId` en esta semilla. **No realizó escrituras en MySQL.**

La segunda orden requiere las variables de conexión MySQL del entorno local autorizado (`MYSQL_*`; acceso mediante Prisma y el adaptador ya configurado en el repositorio). También es de solo lectura: inspecciona colisiones por slug/ID, estado actual de los hijos, conflicto de pertenencia con otros padres publicados, presencia de media principal y **diferencias entre `included`/`excluded` del seed corregido y las filas reales**. **No se ejecutó aquí** por falta de una conexión local a la base del usuario. Una propuesta favorable no crea ni publica el padre; su aplicación y reversión siguen requiriendo implementación y aprobación específicas.

## Estado de cierre

- [x] Localizados los 13 registros del seed y las 13 modalidades en el Word.
- [x] Diferenciada alimentación por paquete, sin desayuno inventado.
- [x] Identificadas cinco omisiones de almuerzo y otras diferencias de inclusiones/exclusiones.
- [x] Aplicar correcciones editoriales al seed de la rama aislada y superar las verificaciones del preflight local.
- [ ] Conciliar esas correcciones con los registros actualmente almacenados en MySQL, evitando sobrescribir contenido publicado sin una decisión específica.
- [x] Ejecutar simulación de estructura C3 sin escritura sobre el seed (13/13 únicos).
- [ ] Ejecutar *dry-run* con vista de datos reales, verificar idempotencia en MySQL y definir reversión antes de crear padre o modificar publicaciones.
- [ ] Conectar/validar el consumo de `packages[]` por la web; mantener fallback del selector existente.
- [ ] Aprobar publicación supervisada, si las pruebas y el inventario real quedan conformes.
