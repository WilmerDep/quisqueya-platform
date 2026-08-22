# Saona — Especificación funcional piloto

**Fecha de validación:** 2026-08-21  
**Fuente funcional:** información suministrada y confirmada por Breidy para Quisqueya Travel  
**Estado:** validado como base funcional inicial  
**Propósito:** usar Saona como experiencia piloto para definir una estructura reutilizable de experiencias, variantes, políticas, recogidas y reglas operativas sin acoplar la lógica al frontend comercial.

---

## 1. Principio de implementación

Saona es la experiencia con mayor cantidad de variables identificadas hasta el momento y se utilizará como **caso de prueba estructural** para el resto del catálogo.

La implementación debe respetar:

- API / dominio como fuente de verdad.
- `quisqueya-web` como capa de presentación y consumo.
- No hardcodear reglas de negocio en componentes visuales.
- No duplicar políticas generales dentro de cada experiencia.
- Diferenciar contenido público, reglas operativas internas y excepciones por producto/proveedor.
- Mantener compatibilidad con experiencias que todavía no posean todos los campos avanzados.
- Los campos nuevos deben ser opcionales o admitir fallback seguro hasta que el catálogo completo sea normalizado.

---

## 2. Saona Regular — identidad y tarifa

### Nombre de trabajo

**Saona Regular**

### Precio por persona

- Adultos desde los **11 años cumplidos**: **USD 85**.
- Niños de **3 a 10 años**: **USD 50**.
- Niños menores de **3 años**: **gratis**.
- Las tarifas **incluyen impuestos y tasas**.

### Zonas a las que aplica la tarifa informada

- Santo Domingo.
- Boca Chica.
- Juan Dolio.
- Nueva Romana.
- Bávaro / Punta Cana.

> Nota de implementación: no asumir que la mecánica de recogida es idéntica en todas las zonas. La tarifa y la política de pickup deben modelarse por separado.

---

## 3. Duración y operación

- Duración informada: **aprox. 11 horas**.
- Saona Regular opera **todos los días**.
- Mínimo estándar: **2 pasajeros**.
- Para **1 pasajero**, se debe **validar disponibilidad** antes de confirmar.

---

## 4. Itinerario base — Saona Regular

Secuencia informada:

1. Recogida aproximada entre **6:45 a. m. y 7:40 a. m.**
2. Llegada aproximada a Bayahíbe: **9:30 a. m.**
3. Traslado marítimo hacia Isla Saona.
4. Tiempo de playa / actividades según operación.
5. Buffet aproximadamente a la **1:00 p. m.**
6. Salida hacia Palmilla aproximadamente a las **2:45 p. m.**
7. Regreso / continuación de la operación desde aproximadamente las **5:00 p. m.**

### Embarcaciones

- En la operación normal, las embarcaciones **no varían**.
- Si existe un fenómeno atmosférico que impida operar con seguridad, la excursión **no sale**.

> La presentación pública debe indicar que los horarios son aproximados y pueden ajustarse por logística, tránsito u operación, sin alterar la naturaleza del producto contratado.

---

## 5. Recogida y punto de encuentro

### Boca Chica y Juan Dolio

- Si el cliente se hospeda en hotel, la recogida puede confirmarse de forma inmediata.
- Otros casos deben validarse con coordinación cuando corresponda.

### Santo Domingo

- Punto estándar informado: **Parque Colón, frente a Pizzarelli**.
- Si el cliente solicita recogida en su lugar de estadía, **puede aplicar suplemento**.

### Nueva Romana / Bávaro / Punta Cana

- La zona está incluida dentro de la tarifa informada.
- El punto y horario exactos deben confirmarse según la operación y coordinación.

### Regla pública recomendada

La web no debe prometer de forma absoluta "recogida en todos los hoteles" sin contexto geográfico.

Debe comunicar que:

- el punto y horario exactos de recogida se confirman de acuerdo con la zona y operación;
- pueden existir suplementos cuando se solicite recogida especial o en el lugar de estadía fuera del punto estándar aplicable.

---

## 6. Confirmación operativa

La información suministrada indica que el cliente es reconfirmado antes de la experiencia con datos de hora y punto de encuentro.

### Presentación pública

Mostrar únicamente información útil para el viajero, por ejemplo:

> La hora y el punto exactos de recogida se confirman antes de la excursión.

### Información interna / CRM

No exponer públicamente procedimientos internos como:

- hora de cierre de ventas;
- responsable de reconfirmación;
- coordinador o ejecutivo que autoriza excepciones;
- notas operativas;
- estados internos de contacto.

Estos datos pertenecen a Operations/CRM.

---

## 7. Reservas con poca antelación

Regla informada previamente:

- Con **18 horas o menos** de anticipación, se debe validar con el coordinador de experiencia o ejecutivo comercial.

### Tratamiento recomendado

**Público:**

> Las reservas realizadas con poca antelación están sujetas a confirmación de disponibilidad.

**Interno / CRM:**

- umbral de anticipación;
- aprobación manual requerida;
- rol autorizado;
- estado de disponibilidad;
- observación / autorización.

---

## 8. Incluye

La experiencia informada contempla, entre otros elementos:

- transporte según modalidad contratada;
- embarcaciones correspondientes al recorrido;
- visita a Isla Saona;
- parada / recorrido asociado a Palmilla según itinerario;
- buffet en modalidad regular;
- bebidas / open bar según servicio operativo contratado;
- acompañamiento y logística de excursión.

> Antes de publicar microdetalles de bebidas o servicios accesorios, validar redacción comercial final y disponibilidad real del operador.

---

## 9. No incluye

Elementos mencionados como no incluidos o adicionales:

- servicio fotográfico;
- masajes;
- souvenirs;
- bebidas o productos premium no contemplados en el paquete;
- langosta cuando no haya sido contratada;
- servicios no descritos expresamente en el paquete.

La redacción pública debe evitar términos coloquiales o ambiguos y usar nomenclatura comercial consistente.

---

## 10. Accesibilidad, embarazo y casos especiales

### Embarazo

- No tratarlo como prohibición absoluta de Saona.
- Se puede ofrecer una alternativa **Catamarán–Catamarán** cuando sea apropiado.
- La confirmación debe depender de la evaluación operacional correspondiente.

### Movilidad reducida

- La experiencia regular **no es recomendable** para movilidad reducida por condiciones de embarque y traslado.
- Se puede **evaluar cada caso puntual**.

### Regla de comunicación pública

Evitar expresiones absolutas o generalizaciones sobre discapacidad. Comunicar limitaciones de accesibilidad de forma clara y ofrecer consulta previa para casos que necesiten asistencia especial.

---

# 11. Política general de cancelación y reembolso

Breidy confirmó que esta política es **general para Quisqueya Travel**, salvo excepciones expresas descritas más abajo.

## Cancelación solicitada por el cliente

- **Más de 24 horas antes de la experiencia:** reembolso **100%**.
- **24 horas o menos antes de la experiencia:** **no reembolsable**, penalidad **100%**.

Ejemplo validado:

- Cancelación 36 horas antes: **reembolso 100%**.

## No-show

- Penalidad **100%**.

## Fenómeno atmosférico / clima que impide la operación

- Reembolso **100%**, **o**
- reprogramación / postergación según acuerdo entre cliente y coordinador.

## Cancelación por el operador

- Reembolso **100%**.

## Cambio de fecha solicitado

- **No hay devolución** asociada al cambio de fecha.

> Nota: cuando se diseñe el flujo transaccional definitivo, debe precisarse técnicamente cómo se representa una reprogramación para evitar confundirla con cancelación + nueva venta.

---

## 12. Excepciones a la política general

La política general anterior **no debe asumirse automáticamente** para los siguientes parques / productos:

- Bávaro Adventure Park.
- Hacienda Park.
- El Dorado Water Park.
- Scape Park.
- Coco Bongo.

Para estos casos:

- se debe solicitar validación al **coordinador general**;
- los términos se acuerdan según el producto/proveedor aplicable.

### Implicación técnica

Las políticas deben ser entidades o reglas reutilizables y relacionables con experiencias/productos.

No duplicar el texto completo de la política general en cada single.

Modelo conceptual recomendado:

- política general de Quisqueya Travel;
- política específica o excepción por producto/proveedor;
- override excepcional cuando sea necesario;
- referencia desde cada experiencia a la política aplicable.

En la web comercial, mostrar un resumen y enlace a una página independiente de **Políticas de cancelación y reembolso**.

---

# 13. Variantes de Saona Regular

## Saona Regular + Almuerzo VIP

- Opera **todos los días**.
- Mantiene el recorrido de Saona Regular.
- Diferencia principal: en lugar de buffet general, se ofrece **mesa / almuerzo privado para los clientes** según el servicio definido.

## Saona Regular + Transporte VIP

- Opera **todos los días**.
- Mantiene el recorrido base.
- Regularmente sale aproximadamente **30 minutos más tarde** que Saona Regular.

## Saona Regular + Transporte VIP + Almuerzo VIP

- Opera **todos los días**.
- Combina los ajustes de transporte y almuerzo sobre el producto base.

### Decisión de modelado

Estas opciones deben considerarse **variantes / upgrades de Saona Regular**, no experiencias independientes completas, salvo que futuras reglas comerciales u operativas obliguen a separarlas.

---

# 14. Saona 4 Playas

Nombre acordado para evitar la ambigüedad de "Saona VIP".

## Motivo

No es simplemente una mejora de Saona Regular: cambia sustancialmente el recorrido y el itinerario.

## Operación informada

- Recorrido de **4 playas**.
- Opera regularmente:
  - lunes;
  - miércoles;
  - viernes.

## Decisión de modelado

**Saona 4 Playas debe tratarse como experiencia independiente**, con:

- itinerario propio;
- días de operación propios;
- precio y reglas propias cuando sean confirmadas;
- política aplicable referenciada, no duplicada.

---

# 15. Separación de responsabilidades por fase

## Fase 1 — Web comercial

Puede incorporar y presentar los datos comerciales validados de Saona sin reconstruir la single aprobada.

Prioridades:

- enriquecer contenido;
- reutilizar layout aprobado;
- añadir solo bloques necesarios y compatibles;
- enlazar políticas generales en lugar de incrustarlas completas;
- no incorporar UI administrativa.

## Fase 2 — CRM / catálogo administrable

Debe permitir administrar progresivamente, según alcance autorizado:

- precios por segmento/edad;
- días de operación;
- mínimo de pasajeros;
- disponibilidad condicionada;
- itinerario;
- incluidos / excluidos;
- pickup / zonas / suplementos;
- recomendaciones;
- accesibilidad / restricciones;
- variantes y upgrades;
- política aplicable;
- notas operativas internas;
- reglas de confirmación / aprobación.

La existencia de esta especificación **no adelanta automáticamente alcance futuro**. Define la arquitectura y evita decisiones improvisadas cuando se autoricen los módulos correspondientes.

---

# 16. Modelo conceptual recomendado

Saona demuestra que una experiencia no debe reducirse a título + descripción + precio.

La estructura de dominio deberá poder evolucionar hacia algo equivalente a:

- `Experience`
- `ExperienceVariant`
- `PricingRule`
- `AgeRule`
- `OperatingSchedule`
- `PickupPolicy`
- `CancellationPolicy`
- `AccessibilityRule`
- `ParticipantRule`
- `Itinerary`
- `OperationalNote`

No se exige crear inmediatamente todas estas entidades físicas. Esta lista expresa responsabilidades de dominio descubiertas durante el levantamiento y debe orientar futuras decisiones de Prisma/API/CRM.

---

# 17. Reglas de no regresión

Al implementar Saona:

1. No romper las experiencias existentes que no tengan estos datos.
2. No rehacer la composición aprobada de la single salvo necesidad validada.
3. No convertir reglas internas en contenido público.
4. No hardcodear la política general en componentes.
5. No asumir que las políticas de parques externos son iguales a la política general.
6. No duplicar Saona Regular completa para cada upgrade.
7. No tratar Saona 4 Playas como simple variante si su recorrido es distinto.
8. No adelantar funcionalidades CRM de Fase 2 dentro de Fase 1.
9. Mantener API → normalización → presentación.
10. Cualquier dato futuro no confirmado debe permanecer explícitamente pendiente, nunca inferirse.

---

# 18. Estado del levantamiento

Con las respuestas recibidas el 2026-08-21, **Saona Regular queda suficientemente definida como piloto funcional inicial** para comenzar la adaptación técnica y editorial de Fase 1.

Pendiente para Saona 4 Playas:

- itinerario detallado;
- precio;
- reglas de edades si difieren;
- incluidos / excluidos específicos;
- pickup si difiere;
- cualquier excepción de política propia.

Estos datos no deben inventarse ni heredarse automáticamente de Saona Regular.