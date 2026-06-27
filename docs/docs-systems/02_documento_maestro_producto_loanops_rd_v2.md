# Documento Maestro del Producto V2

**Producto:** LoanOps RD  
**Tipo:** SaaS multiempresa para prestamistas  
**Pais objetivo:** Republica Dominicana  
**Version:** 2.0  
**Autor del proyecto:** PholioDev  


> **Decision oficial de stack:** LoanOps RD se construira con **React + Vite + TypeScript** en frontend, **NestJS + TypeScript** como backend API-first, **Prisma ORM** y **MySQL 8+** como base de datos principal. No se usara PostgreSQL, Neon ni Supabase como base principal en esta fase.

> **Criterio de infraestructura:** se prioriza MySQL porque esta disponible en el entorno actual del proyecto y evita pagar una base de datos adicional. La documentacion queda alineada a esa decision.


## 1. Resumen ejecutivo

LoanOps RD es una plataforma SaaS multiempresa para prestamistas en Republica Dominicana. Su objetivo es centralizar clientes, prestamos, cuotas, pagos, cobros, rutas, caja, reportes, usuarios, configuracion, auditoria y documentos.

La version 2.0 del documento maestro incorpora la decision tecnica oficial: el producto se construira con React + Vite en frontend, NestJS como backend API-first, Prisma como ORM y MySQL 8+ como base de datos principal.

La promesa del producto es permitir que el prestamista deje procesos manuales, libretas, hojas sueltas y controles dispersos para operar desde una plataforma moderna, trazable y escalable.

## 2. Vision del producto

Construir un SaaS moderno, claro y operativo para prestamistas que necesitan controlar su cartera, organizar cobradores, registrar pagos, evaluar clientes y cerrar caja con menos errores.

LoanOps RD debe sentirse como:

- CRM financiero.
- Sistema operativo de cobranzas.
- Panel administrativo SaaS.
- Herramienta movil para cobradores.

## 3. Decision tecnica oficial

| Area | Decision oficial |
|---|---|
| Frontend | React + Vite + TypeScript |
| UI | Tailwind CSS + Shadcn/UI + Lucide Icons |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Base de datos | MySQL 8+ |
| Auth | JWT + Refresh Tokens |
| PDFs | Puppeteer o PDFKit desde backend |
| Jobs iniciales | NestJS Schedule |
| Jobs futuros | BullMQ + Redis si aplica |
| App movil | React Native + Expo |

## 4. Modelo SaaS multiempresa

Cada prestamista funciona como una empresa dentro del sistema. Cada empresa tiene sus usuarios, sucursales, clientes, prestamos, cuotas, pagos, rutas, caja, reportes y configuracion.

Regla central:

- Ninguna empresa puede ver datos de otra.
- Toda entidad operativa debe contener `empresa_id`.
- Muchas entidades tambien deben contener `sucursal_id`.

## 5. Roles principales

### Super Admin

Administra el SaaS completo: empresas, planes, facturacion global, auditoria global, soporte y configuracion del sistema.

### Admin Empresa

Gestiona la operacion completa de una empresa prestamista: clientes, prestamos, pagos, caja, rutas, usuarios, reportes y configuracion.

### Supervisor

Supervisa cobradores, rutas, clientes, pagos, promesas y reportes operativos.

### Cobrador

Registra pagos, cobros parciales, visitas, promesas, no pago, rutas y recibos. Su experiencia debe estar optimizada para movil.

## 6. Modulos principales

| Modulo | Proposito |
|---|---|
| Autenticacion | Login, recuperacion, sesiones y permisos. |
| Empresas | Tenants del SaaS. |
| Sucursales | Oficinas o zonas operativas. |
| Usuarios | Roles, permisos y acceso. |
| Dashboard | Resumen operativo diario. |
| Clientes | Gestion de deudores. |
| Perfil del cliente | Centro financiero y operativo del cliente. |
| Prestamos | Creacion y gestion de prestamos. |
| Cuotas | Calendario de pagos. |
| Pagos | Registro de cobros. |
| Cobrar Hoy | Pantalla principal del cobrador. |
| Rutas | Organizacion de visitas y cobros. |
| Caja | Entradas, salidas y cierres. |
| Reportes | Analisis financiero y operativo. |
| Configuracion | Reglas por empresa. |
| Auditoria | Trazabilidad de acciones. |

## 7. Reglas de negocio criticas

1. Toda entidad operativa debe contener `empresa_id`.
2. Los pagos deben actualizar cuota, prestamo, caja, recibo y auditoria.
3. Cliente bloqueado no puede recibir nuevos prestamos.
4. Promesas incumplidas afectan scoring.
5. Ruta cerrada no se edita libremente.
6. Caja cerrada no acepta movimientos sin reapertura autorizada.
7. Montos financieros se manejan con `DECIMAL`, no FLOAT.
8. Backend recalcula siempre importes financieros.
9. Auditoria no se edita desde UI.
10. Super Admin no debe operar datos de empresa sin modo soporte auditado.

## 8. Arquitectura funcional resumida

El flujo operativo principal es:

1. Crear empresa.
2. Configurar sucursales.
3. Crear usuarios.
4. Registrar clientes.
5. Crear prestamos.
6. Generar cuotas.
7. Cobrar desde Cobrar Hoy o rutas.
8. Registrar pagos, visitas y promesas.
9. Actualizar caja y auditoria.
10. Generar reportes y documentos.

## 9. Arquitectura de pantallas

### Web Admin

- Dashboard.
- Cobrar Hoy.
- Clientes.
- Perfil del cliente.
- Crear cliente.
- Prestamos.
- Crear prestamo.
- Detalle de prestamo.
- Rutas.
- Caja.
- Reportes.
- Usuarios.
- Configuracion.
- Mi Cuenta.

### Super Admin

- Dashboard global.
- Empresas.
- Usuarios globales.
- Planes y suscripciones.
- Facturacion.
- Reportes globales.
- Auditoria.
- Configuracion del sistema.
- Centro de ayuda.

### App movil

- Inicio.
- Cobrar Hoy.
- Registrar pago.
- Cobro parcial.
- No pago.
- Registrar visita.
- Promesa.
- Ruta.
- Mapa.
- Recibo.
- Historial.
- Cierre de ruta.

### Publico

- Landing.
- Funciones.
- Como funciona.
- App movil.
- Tutoriales.
- Planes.
- Contacto / demo.
- Login.
- Registro.
- Recuperar acceso.
- Legales.

## 10. Entidades principales

| Entidad | Campos clave |
|---|---|
| empresas | id, nombre_comercial, rnc, email, telefono, estado |
| sucursales | id, empresa_id, nombre, estado |
| usuarios | id, empresa_id, sucursal_id, email, rol, estado |
| clientes | id, empresa_id, sucursal_id, cobrador_id, telefono, estado, score_actual |
| prestamos | id, empresa_id, cliente_id, monto_capital, total_pagar, saldo_pendiente, estado |
| cuotas | id, empresa_id, prestamo_id, fecha_programada, monto_programado, estado |
| pagos | id, empresa_id, cliente_id, prestamo_id, monto_total, estado |
| recibos | id, empresa_id, pago_id, numero_recibo, estado |
| rutas | id, empresa_id, cobrador_id, fecha_ruta, estado |
| caja_movimientos | id, empresa_id, tipo_movimiento, origen, monto |
| auditoria | id, empresa_id, usuario_id, accion, entidad, detalle_json |

## 11. Roadmap

### MVP

- Auth.
- Empresas.
- Usuarios.
- Clientes.
- Prestamos.
- Cuotas.
- Pagos.
- Cobrar Hoy.
- Caja basica.
- Recibos.
- Dashboard basico.

### Pro

- Rutas.
- Promesas.
- Visitas.
- Fichas.
- Scoring.
- Reportes.
- PDFs avanzados.
- Auditoria completa.
- Configuracion avanzada.

### Escala

- Super Admin completo.
- Planes SaaS.
- Facturacion.
- App movil offline.
- Automatizaciones.
- IA para scoring y recordatorios.
- White label.

## 12. Criterios de exito

- El cobrador puede registrar un pago en pocos pasos.
- El administrador puede ver la operacion diaria en dashboard.
- Cada pago deja rastro financiero completo.
- Cada empresa solo ve sus datos.
- El sistema se puede desplegar sobre infraestructura con MySQL.
- Codex o Google AI Studio pueden construir sin cambiar stack.

## 13. Conclusion

LoanOps RD queda definido como un SaaS multiempresa con una decision tecnica realista y escalable: React + Vite, NestJS, Prisma y MySQL. Esta ruta reduce costo, respeta la infraestructura disponible y mantiene una arquitectura moderna API-first preparada para app movil y automatizaciones futuras.
