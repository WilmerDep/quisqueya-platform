# LoanOps RD - Mapa completo de pantallas

**Versión:** v1.0  
**Fecha:** 16/05/2026  
**Tipo:** Documento maestro de navegación, vistas y subvistas

## Propósito

Este documento organiza todas las pantallas, subvistas, estados y documentos definidos para LoanOps RD. Sirve como índice maestro para diseño, desarrollo, QA, prompts de IA y control de avance.

## Convención usada

- **Principal:** pantalla de entrada de un módulo.
- **Subvista:** pantalla derivada o vista interna del módulo.
- **Subvista tab:** pestaña interna que debe diseñarse como pantalla individual cuando aplique.
- **Estado:** pantalla o bloque de feedback del sistema.
- **Modal crítico:** confirmación de acción sensible.
- **Documento:** PDF/recibo/reporte generado por el sistema.

## Resumen general

| Bloque | Cantidad | Propósito |
|---|---:|---|
| A. Web Admin Empresa / Supervisor | 62 | Pantallas principales para la operación diaria de una empresa prestamista: administración, cobro, cartera, caja y reportes. |
| B. Super Admin SaaS | 25 | Pantallas globales para operar la plataforma SaaS, administrar empresas, planes, facturación, auditoría y soporte. |
| C. App móvil Cobrador | 18 | Experiencia optimizada para campo: cobrar, visitar, registrar promesas, consultar rutas y cerrar operación diaria. |
| D. Estados, alertas y modales críticos | 23 | Estados transversales que evitan errores, comunican resultados y protegen acciones sensibles. |
| E. PDFs, recibos y documentos finales | 8 | Documentos exportables y entregables generados por el sistema. |
| F. UI Kit visual | 24 | Sistema visual dividido en global, desktop y móvil para mantener consistencia de diseño. |
| G. Onboarding | 10 | Flujo guiado para activar una empresa y llevarla a su primera operación real. |
| H. Mi Cuenta | 9 | Perfil, seguridad, sesiones, preferencias y actividad personal del usuario. |
| I. Landing pública y acceso público | 15 | Pantallas de marketing, conversión, educación, acceso y soporte público. |
| J. Legales públicos | 7 | Pantallas legales y de confianza para operación SaaS y manejo de datos. |

**Total de vistas/documentos/estados registrados:** 201

## Mapa detallado

## A. Web Admin Empresa / Supervisor

**Propósito:** Pantallas principales para la operación diaria de una empresa prestamista: administración, cobro, cartera, caja y reportes.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| A01 | Login web | Principal | Acceso de usuarios internos por correo/usuario y contraseña; redirección por rol. |
| A02 | Recuperar acceso | Subvista Auth | Solicitud de recuperación de contraseña y estado de correo enviado. |
| A03 | Dashboard admin | Principal | KPIs, alertas, actividad reciente y acciones rápidas. |
| A04 | Dashboard - Alertas operativas | Subvista | Detalle de alertas: mora, promesas vencidas, caja, rutas y cobradores. |
| A05 | Cobrar Hoy - Admin | Principal | Vista administrativa de cobros del día por sucursal, cobrador, atraso y estado. |
| A06 | Cobrar Hoy - Registrar cobro | Subvista | Formulario de pago completo con impacto en cuota, préstamo, caja y recibo. |
| A07 | Cobrar Hoy - Cobro parcial | Subvista | Registro de abono parcial y saldo restante. |
| A08 | Cobrar Hoy - No pagó | Subvista | Motivo, nota, evidencia y opción de promesa. |
| A09 | Cobrar Hoy - Registrar visita | Subvista | Resultado de visita, observación, ubicación y seguimiento. |
| A10 | Cobrar Hoy - Promesa de pago | Subvista | Monto prometido, fecha prometida, nota y responsable. |
| A11 | Cobrar Hoy - Recibo generado | Subvista | Estado del recibo, descarga, impresión y envío. |
| A12 | Clientes - Listado | Principal | Tabla/card híbrida con búsqueda, filtros, score, estado, préstamos activos y saldo pendiente. |
| A13 | Clientes - Crear cliente | Subvista | Formulario por secciones: personales, dirección, referencias, asignación y notas. |
| A14 | Clientes - Perfil resumen | Subvista | Header financiero, score, estado, préstamos activos, próxima cuota y última visita. |
| A15 | Clientes - Editar | Subvista tab | Edición de datos personales, referencias, dirección y asignación. |
| A16 | Clientes - Fichas | Subvista tab | Fichas de comportamiento, motivos, notas y registro manual. |
| A17 | Clientes - Historial de pagos | Subvista tab | Pagos completos/parciales, recibos y exportación. |
| A18 | Clientes - Notas de visita | Subvista tab | Historial de visitas, resultados y comentarios. |
| A19 | Clientes - Promesas | Subvista tab | Promesas activas, cumplidas, vencidas y canceladas. |
| A20 | Clientes - Documentos/PDF | Subvista tab | Documentos del cliente, historial exportable y recibos. |
| A21 | Préstamos - Listado | Principal | Listado con filtros por estado, cliente, sucursal, cobrador, saldo y fechas. |
| A22 | Crear préstamo - Paso 1 Cliente | Subvista wizard | Buscador avanzado, cards de cliente y contexto de riesgo. |
| A23 | Crear préstamo - Paso 2 Detalles | Subvista wizard | Monto, interés, frecuencia, plazo, fecha, sucursal, cobrador y resumen vivo. |
| A24 | Crear préstamo - Paso 3 Confirmación | Subvista wizard | Resumen final, advertencias y calendario resumido. |
| A25 | Detalle préstamo - Resumen | Subvista | Header financiero, saldo pendiente, estado, cliente y acciones. |
| A26 | Detalle préstamo - Cuotas | Subvista tab | Calendario completo de cuotas y estados. |
| A27 | Detalle préstamo - Pagos | Subvista tab | Historial de pagos vinculados al préstamo. |
| A28 | Detalle préstamo - Reprogramar/Refinanciar | Subvista | Ajustes controlados con motivo, cálculo y confirmación. |
| A29 | Detalle préstamo - Cancelar | Subvista crítica | Cancelación con motivo, impacto y auditoría. |
| A30 | Rutas - Listado | Principal | Rutas por fecha, cobrador, sucursal, clientes, esperado, cobrado y estado. |
| A31 | Rutas - Crear ruta | Subvista | Asignación de cobrador, fecha, clientes y orden. |
| A32 | Rutas - Detalle | Subvista | Clientes asignados, estado de visita, monto esperado/cobrado y acciones. |
| A33 | Rutas - Registrar visita | Subvista | Resultado de visita desde la ruta. |
| A34 | Rutas - Registrar cobro | Subvista | Cobro desde ruta con recibo. |
| A35 | Rutas - Mapa | Subvista | Visualización geográfica/orden sugerido. |
| A36 | Rutas - Historial | Subvista | Rutas cerradas, desempeño y eventos. |
| A37 | Rutas - Cerrar ruta | Subvista crítica | Resumen esperado vs cobrado, diferencias y cierre. |
| A38 | Caja - Resumen | Principal | Balance inicial, entradas, salidas, balance actual y estado. |
| A39 | Caja - Movimientos | Subvista | Listado de entradas/salidas, origen, usuario y método. |
| A40 | Caja - Registrar entrada | Subvista | Ingreso manual permitido con concepto y evidencia. |
| A41 | Caja - Registrar salida | Subvista | Salida manual controlada con motivo y responsable. |
| A42 | Caja - Cierre de caja | Subvista crítica | Monto teórico, monto real, diferencia y confirmación. |
| A43 | Caja - Historial de cierres | Subvista | Cierres diarios, diferencias y responsable. |
| A44 | Reportes - Dashboard | Principal | Vista general de reportes financieros y operativos. |
| A45 | Reportes - Financieros | Subvista | Capital, intereses, mora, caja y préstamos activos. |
| A46 | Reportes - Operativos | Subvista | Cobradores, clientes atrasados, promesas, sucursales y productividad. |
| A47 | Reportes - Exportaciones | Subvista | Exportar PDF/CSV por filtros. |
| A48 | Reportes - Plantillas | Subvista | Plantillas de exportación con campos configurables. |
| A49 | Reportes - Programar envío | Subvista | Programación de reportes por correo y frecuencia. |
| A50 | Usuarios - Listado | Principal | Usuarios por rol, estado, sucursal y último acceso. |
| A51 | Usuarios - Crear/Editar | Subvista | Datos, rol, sucursal, estado y acceso. |
| A52 | Usuarios - Resumen | Subvista tab | Ficha de usuario y métricas de uso. |
| A53 | Usuarios - Permisos | Subvista tab | Permisos activos por módulo y restricciones. |
| A54 | Usuarios - Actividad | Subvista tab | Acciones recientes y auditoría por usuario. |
| A55 | Usuarios - Sesiones | Subvista tab | Dispositivos, IP, ubicación y cierre de sesiones. |
| A56 | Configuración - Empresa | Principal/tab | Datos comerciales, RNC, logo, correo, teléfono y dirección. |
| A57 | Configuración - Sucursales | Subvista tab | Crear, editar, activar/desactivar sucursales. |
| A58 | Configuración - Mora | Subvista tab | Modo de mora, valor, días de gracia y reglas. |
| A59 | Configuración - Recibo | Subvista tab | Logo, título, pie, campos visibles y preview. |
| A60 | Configuración - Préstamos | Subvista tab | Reglas de bloqueo, reprogramación y defaults. |
| A61 | Configuración - Branding | Subvista tab | Color, nombre visual, logos y estilo. |
| A62 | Configuración - Notificaciones | Subvista tab | Canales, eventos y preferencias empresariales. |

## B. Super Admin SaaS

**Propósito:** Pantallas globales para operar la plataforma SaaS, administrar empresas, planes, facturación, auditoría y soporte.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| B01 | Super Admin - Dashboard global | Principal | KPIs globales: empresas, ingresos, actividad, alertas y crecimiento. |
| B02 | Empresas/Tenants - Listado | Principal | Listado de empresas con plan, estado, usuarios, sucursales y actividad. |
| B03 | Empresas/Tenants - Crear empresa | Subvista | Alta de nueva empresa SaaS con plan y responsable. |
| B04 | Empresas/Tenants - Detalle | Subvista | Resumen, usuarios, sucursales, facturación y estado. |
| B05 | Empresas/Tenants - Suspender/Reactivar | Subvista crítica | Cambio de estado con motivo y auditoría. |
| B06 | Usuarios globales - Listado | Principal | Usuarios de todas las empresas con filtros globales. |
| B07 | Usuarios globales - Crear/Editar | Subvista | Gestión global de acceso, rol y empresa. |
| B08 | Usuarios globales - Sesiones | Subvista | Sesiones y seguridad por usuario. |
| B09 | Planes y suscripciones - Listado | Principal | Planes disponibles, límites, precios y estado. |
| B10 | Planes y suscripciones - Crear/Editar plan | Subvista | Nombre, precio, límites, módulos incluidos y estado. |
| B11 | Planes y suscripciones - Empresas suscritas | Subvista | Empresas asociadas a cada plan. |
| B12 | Facturación SaaS - Resumen | Principal | Ingresos, facturas, pagos, vencidos y estado. |
| B13 | Facturación SaaS - Facturas | Subvista | Listado y detalle de facturas. |
| B14 | Facturación SaaS - Pagos | Subvista | Pagos recibidos, fallidos y conciliación. |
| B15 | Reportes globales - Dashboard | Principal | Métricas globales del SaaS. |
| B16 | Reportes globales - Financieros | Subvista | MRR, ingresos, facturas, planes. |
| B17 | Reportes globales - Operativos | Subvista | Uso por empresa, módulos, usuarios activos. |
| B18 | Auditoría global | Principal | Registro global de acciones por empresa, usuario y entidad. |
| B19 | Configuración del sistema | Principal | Parámetros globales del SaaS. |
| B20 | Configuración - Seguridad | Subvista | Sesiones, 2FA, políticas de contraseña y límites. |
| B21 | Configuración - Correos/SMTP | Subvista | Plantillas, remitentes y eventos. |
| B22 | Configuración - Planes/limites | Subvista | Reglas globales por plan. |
| B23 | Centro de ayuda - Dashboard | Principal | Tickets, guías, tutoriales y soporte. |
| B24 | Centro de ayuda - Artículos | Subvista | Base de conocimiento y categorías. |
| B25 | Centro de ayuda - Tickets | Subvista | Solicitudes de soporte de empresas. |

## C. App móvil Cobrador

**Propósito:** Experiencia optimizada para campo: cobrar, visitar, registrar promesas, consultar rutas y cerrar operación diaria.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| C01 | App móvil - Login | Principal | Inicio de sesión compacto y seguro. |
| C02 | App móvil - Inicio/Resumen | Principal | Cobrado hoy, pendientes, ruta activa y accesos rápidos. |
| C03 | App móvil - Cobrar Hoy | Principal | Lista táctil de clientes con monto, atraso, promesa y estado. |
| C04 | App móvil - Detalle cliente | Subvista | Datos esenciales, préstamo activo, contacto y acciones. |
| C05 | App móvil - Registrar pago | Subvista | Pago completo con método y recibo. |
| C06 | App móvil - Cobro parcial | Subvista | Abono parcial y saldo restante. |
| C07 | App móvil - No pagó | Subvista | Motivo, nota y estado. |
| C08 | App móvil - Registrar visita | Subvista | Resultado de gestión y observación. |
| C09 | App móvil - Promesa de pago | Subvista | Fecha, monto y compromiso. |
| C10 | App móvil - Recibo | Subvista | Recibo para compartir por WhatsApp o descargar. |
| C11 | App móvil - Rutas | Principal | Ruta del día, progreso y clientes asignados. |
| C12 | App móvil - Mapa de ruta | Subvista | Mapa/orden de visitas. |
| C13 | App móvil - Historial de ruta | Subvista | Gestiones realizadas y pendientes. |
| C14 | App móvil - Cerrar ruta | Subvista crítica | Resumen de ruta y confirmación. |
| C15 | App móvil - Clientes | Principal | Consulta rápida de clientes asignados. |
| C16 | App móvil - Perfil/Mi cuenta | Subvista | Datos del cobrador, sesiones, soporte y preferencias. |
| C17 | App móvil - Offline/Sin conexión | Estado | Cola de acciones pendientes y sincronización. |
| C18 | App móvil - Sincronización completada | Estado | Confirmación de envío de datos. |

## D. Estados, alertas y modales críticos

**Propósito:** Estados transversales que evitan errores, comunican resultados y protegen acciones sensibles.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| D01 | Estado éxito | Estado global | Operación completada: pago, cliente, préstamo, cierre o configuración. |
| D02 | Estado advertencia | Estado global | Atención requerida: mora leve, promesa próxima, diferencia de caja. |
| D03 | Estado error | Estado global | Operación fallida o validación crítica. |
| D04 | Estado información | Estado global | Mensaje de contexto o recomendación. |
| D05 | Estado vacío | Estado global | Sin registros aún con CTA claro. |
| D06 | Estado loading/skeleton | Estado global | Carga de tablas, cards y formularios. |
| D07 | Estado sin permisos | Estado seguridad | Usuario sin acceso al módulo o acción. |
| D08 | Estado sesión expirada | Estado seguridad | Sesión caducada con retorno al login. |
| D09 | Estado mantenimiento | Estado sistema | Servicio temporalmente no disponible. |
| D10 | Estado 404 | Estado sistema | Página no encontrada. |
| D11 | Estado 500 | Estado sistema | Error interno controlado. |
| D12 | Recibo - Generado | Estado final recibo | Recibo listo para descargar, imprimir o enviar. |
| D13 | Recibo - Enviado | Estado final recibo | Confirmación de envío por canal. |
| D14 | Recibo - Error de envío | Estado final recibo | Fallo con acción para reintentar. |
| D15 | Modal guardar cambios | Modal crítico | Confirmar cambios importantes. |
| D16 | Modal eliminar registro | Modal crítico | Confirmar eliminación permitida. |
| D17 | Modal bloquear cliente | Modal crítico | Bloqueo con motivo y efecto en préstamos. |
| D18 | Modal desbloquear cliente | Modal crítico | Reactivación con advertencia. |
| D19 | Modal cancelar préstamo | Modal crítico | Motivo, impacto y confirmación. |
| D20 | Modal confirmar pago | Modal crítico | Confirmación antes de aplicar pago. |
| D21 | Modal cerrar caja | Modal crítico | Resumen teórico/real/diferencia. |
| D22 | Modal cerrar ruta | Modal crítico | Cierre irreversible/controlado. |
| D23 | Modal cerrar sesión | Modal crítico | Confirmación y opciones de sesión. |

## E. PDFs, recibos y documentos finales

**Propósito:** Documentos exportables y entregables generados por el sistema.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| E01 | Recibo de pago | Documento | Recibo con datos de empresa, cliente, pago, saldo y próxima cuota. |
| E02 | Recibo cobro parcial | Documento | Recibo de abono y saldo pendiente. |
| E03 | Historial cliente PDF | Documento | Resumen de cliente, pagos, fichas, promesas y préstamos. |
| E04 | Reporte financiero PDF | Documento | Capital, interés, mora, caja y filtros aplicados. |
| E05 | Reporte operativo PDF | Documento | Rendimiento cobradores, rutas, promesas y atrasos. |
| E06 | Cierre de caja PDF | Documento | Balance, movimientos, diferencias y firma/responsable. |
| E07 | Cierre de ruta PDF | Documento | Clientes visitados, cobrado, pendientes y observaciones. |
| E08 | Plantilla de exportación | Documento/Config | Canvas de campos para exportar reportes personalizados. |

## F. UI Kit visual

**Propósito:** Sistema visual dividido en global, desktop y móvil para mantener consistencia de diseño.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| F01 | UI Kit Global - Colores primarios | UI Kit | Azul principal, variantes, fondos y bordes. |
| F02 | UI Kit Global - Colores semánticos | UI Kit | Éxito, advertencia, peligro, info y neutral. |
| F03 | UI Kit Global - Tipografía | UI Kit | Jerarquía H1/H2/H3/body/small/table. |
| F04 | UI Kit Global - Iconografía | UI Kit | Familias de iconos y uso por módulo. |
| F05 | UI Kit Global - Botones | UI Kit | Primary, secondary, danger, ghost, icon buttons. |
| F06 | UI Kit Global - Badges/Estados | UI Kit | Pagado, pendiente, vencido, parcial, bloqueado. |
| F07 | UI Kit Global - Inputs/Formularios | UI Kit | Campos, focus, errores, selects, search. |
| F08 | UI Kit Global - Cards | UI Kit | Cards, KPI, headers y footers. |
| F09 | UI Kit Global - Tabs | UI Kit | Tabs internos y navegación secundaria. |
| F10 | UI Kit Global - Alerts/Toasts | UI Kit | Mensajes del sistema. |
| F11 | UI Kit Global - Loading/Skeleton | UI Kit | Estados de carga. |
| F12 | UI Kit Global - Modales base | UI Kit | Estructura y acciones. |
| F13 | UI Kit Desktop - Sidebar/Topbar | UI Kit Desktop | Navegación principal web. |
| F14 | UI Kit Desktop - Tablas SaaS | UI Kit Desktop | Tablas, hover, acciones y filtros. |
| F15 | UI Kit Desktop - KPIs | UI Kit Desktop | Tarjetas de indicadores. |
| F16 | UI Kit Desktop - Panel derecho | UI Kit Desktop | Detalles contextuales. |
| F17 | UI Kit Desktop - Wizard/Stepper | UI Kit Desktop | Procesos guiados. |
| F18 | UI Kit Desktop - PDF Preview | UI Kit Desktop | Visor de documentos. |
| F19 | UI Kit Móvil - Header | UI Kit Móvil | Header compacto. |
| F20 | UI Kit Móvil - Bottom nav | UI Kit Móvil | Navegación principal móvil. |
| F21 | UI Kit Móvil - Cards táctiles | UI Kit Móvil | Cards para campo. |
| F22 | UI Kit Móvil - Formularios | UI Kit Móvil | Formularios de una columna. |
| F23 | UI Kit Móvil - Bottom sheets | UI Kit Móvil | Modales móviles. |
| F24 | UI Kit Móvil - Estados offline | UI Kit Móvil | Sincronización y cola. |

## G. Onboarding

**Propósito:** Flujo guiado para activar una empresa y llevarla a su primera operación real.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| G01 | Onboarding - Bienvenida | Principal | Primer acceso y progreso de configuración. |
| G02 | Onboarding - Configurar empresa | Subvista | Datos básicos, moneda, zona horaria y logo. |
| G03 | Onboarding - Crear sucursal | Subvista | Sucursal principal y responsable. |
| G04 | Onboarding - Crear usuario/cobrador | Subvista | Usuario operativo inicial. |
| G05 | Onboarding - Reglas de préstamo | Subvista | Frecuencia, interés, mora y bloqueo. |
| G06 | Onboarding - Configurar recibo | Subvista | Campos, logo y preview. |
| G07 | Onboarding - Crear primer cliente | Subvista | Registro simplificado. |
| G08 | Onboarding - Crear primer préstamo | Subvista | Mini wizard guiado. |
| G09 | Onboarding - Primer cobro | Subvista | Guía de Cobrar Hoy. |
| G10 | Onboarding - Completado | Estado final | Checklist completo y acceso al dashboard. |

## H. Mi Cuenta

**Propósito:** Perfil, seguridad, sesiones, preferencias y actividad personal del usuario.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| H01 | Mi Cuenta - Resumen | Principal | Perfil, estado, accesos rápidos y actividad reciente. |
| H02 | Mi Cuenta - Editar perfil | Subvista | Datos personales, foto, idioma y zona horaria. |
| H03 | Mi Cuenta - Seguridad | Subvista | Contraseña, 2FA, dispositivos y alertas. |
| H04 | Mi Cuenta - Sesiones activas | Subvista | Dispositivos, IP, ubicación y cierre de sesiones. |
| H05 | Mi Cuenta - Preferencias | Subvista | Tema, densidad, sonidos, inicio y formato regional. |
| H06 | Mi Cuenta - Notificaciones | Subvista | Canales y eventos personales. |
| H07 | Mi Cuenta - Permisos y rol | Subvista | Rol, módulos, acciones permitidas y restricciones. |
| H08 | Mi Cuenta - Actividad | Subvista | Historial filtrable de acciones. |
| H09 | Mi Cuenta - Cerrar sesión | Modal/subvista | Confirmación de salida. |

## I. Landing pública y acceso público

**Propósito:** Pantallas de marketing, conversión, educación, acceso y soporte público.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| I01 | Landing - Home/Hero | Pública | Propuesta de valor y mockups web/app. |
| I02 | Landing - Funciones | Pública | Módulos principales del sistema. |
| I03 | Landing - Cómo funciona | Pública | Proceso en 4 pasos. |
| I04 | Landing - Cobrar Hoy destacado | Pública | Diferencial operativo central. |
| I05 | Landing - App móvil | Pública | Experiencia para cobradores. |
| I06 | Landing - Videos tutoriales | Pública | Sección de videos para aprender la plataforma. |
| I07 | Landing - Seguridad y control | Pública | Roles, auditoría, sesiones y protección. |
| I08 | Landing - Reportes | Pública | Reportes financieros/operativos y exportación. |
| I09 | Landing - Planes | Pública | Básico, Pro y Empresa. |
| I10 | Landing - FAQ | Pública | Preguntas frecuentes. |
| I11 | Landing - Solicitar demo | Pública/conversión | Formulario de contacto y lead. |
| I12 | Login público | Pública/Auth | Acceso de usuarios existentes. |
| I13 | Registro / Crear cuenta | Pública/Auth | Alta de empresa nueva. |
| I14 | Recuperar contraseña | Pública/Auth | Recuperación de acceso. |
| I15 | Centro de tutoriales / Ayuda pública | Pública/Ayuda | Buscador, categorías, videos, guías, FAQ y soporte. |

## J. Legales públicos

**Propósito:** Pantallas legales y de confianza para operación SaaS y manejo de datos.

| ID | Pantalla / vista | Tipo | Descripción |
|---|---|---|---|
| J01 | Términos y condiciones | Legal | Uso permitido, responsabilidades, acceso, suspensión y aceptación. |
| J02 | Política de privacidad | Legal | Datos recopilados, uso, protección, retención y eliminación. |
| J03 | Política de cookies | Legal | Cookies esenciales, analíticas, sesión y preferencias. |
| J04 | Acuerdo de tratamiento de datos | Legal | Roles de responsable/proveedor, datos procesados y separación por empresa. |
| J05 | Seguridad y cumplimiento | Legal/confianza | Separación de datos, roles, auditoría, sesiones y buenas prácticas. |
| J06 | Consentimiento de comunicaciones | Legal/config | Preferencias de contacto comercial, soporte y recordatorios. |
| J07 | Estado del sistema | Legal/status | Disponibilidad de panel web, API, app móvil, reportes y autenticación. |

## Reglas de uso para desarrollo

1. Toda pantalla con subvistas debe desarrollarse como rutas o componentes separados cuando su flujo tenga lógica propia.
2. No mezclar varias subvistas en una sola pantalla visual si representan tareas diferentes.
3. Mantener consistencia visual con el Design System: azul principal, estados semánticos, cards, tablas SaaS, tabs y modales claros.
4. Priorizar el flujo operativo: clientes, préstamos, pagos, Cobrar Hoy, rutas, caja y reportes.
5. Cualquier acción crítica debe tener confirmación, auditoría y feedback visual.
6. Toda entidad operativa debe respetar la separación multiempresa por empresa_id/tenant_id.

## Siguiente documento recomendado

Después de este mapa, el siguiente entregable debe ser el **Documento maestro del producto**, seguido por el **Handoff técnico para Codex / Google AI Studio**.
