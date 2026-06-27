# PholioDev AI Skill Pack v2.0.0

Paquete reusable de instrucciones, metodologias y plantillas para trabajar con asistentes de IA en proyectos reales de desarrollo, automatizacion, WordPress, aplicaciones web, mobile, QA, UI/UX, propuestas y documentacion.

El objetivo del pack es convertir a la IA en un socio tecnico consistente: analiza antes de modificar, protege lo que ya funciona, usa la skill adecuada y entrega cambios claros, estables y listos para produccion.

## Contenido

```txt
global/      Reglas base de estilo, seguridad, stack y forma de entrega.
skills/      Metodologias por tipo de tarea.
adapters/    Instrucciones listas para Codex, ChatGPT GPTs, Cursor, Claude, Windsurf y Generic AI.
templates/   Formatos reutilizables para briefs, planes, reviews, bugs, propuestas y entregas.
```

## Skills incluidas

- `wordpress-surgeon`: WordPress, plugins, themes, hooks, shortcodes, CPTs y compatibilidad.
- `web-app-builder`: React, Next.js, frontend apps y experiencias web.
- `backend-api-architect`: APIs Node, Express, NestJS, PHP y servicios backend.
- `database-architect`: MySQL, PostgreSQL, Neon, Supabase, MongoDB y Prisma.
- `mobile-app-builder`: React Native, Expo y flujos mobile.
- `n8n-automation-architect`: Automatizaciones n8n, APIs, WhatsApp, Gmail y Sheets.
- `ui-ux-screen-generator`: UI/UX, pantallas, dashboards y flujos visuales.
- `full-team-mode`: Tareas complejas con analisis multi-rol.
- `qa-debugging`: QA, debugging, regresiones y validacion.
- `project-proposal`: Propuestas, cotizaciones y alcance tecnico.
- `pdf-document-builder`: PDFs, documentos y entregables formales.

## Uso rapido

1. Copia este pack dentro de tu proyecto, por ejemplo en `.ai-skills/`.
2. Copia el adaptador correspondiente a la herramienta que vas a usar.
3. Indica a la IA que lea el pack y active la skill adecuada antes de proponer arquitectura o modificar codigo.

Ejemplo:

```txt
Usa la skill wordpress-surgeon. Revisa la estructura del plugin antes de tocar codigo y propone un plan breve.
```

## Adaptadores

### Codex

1. Copia `adapters/codex/AGENTS.md` como `AGENTS.md` en la raiz del proyecto.
2. Deja este pack completo en `.ai-skills/` o en `pholiodev-ai-skill-pack/`.
3. Pide a Codex que use una skill especifica cuando aplique.

### ChatGPT GPTs

1. Crea o edita un GPT personalizado.
2. Pega `adapters/chatgpt-gpts/gpt-instructions.md` en las instrucciones del GPT.
3. Sube `global/`, `skills/`, `templates/`, `manifest.json`, `README.md` e `INSTALL.md` como conocimiento.

### Cursor

1. Copia el contenido de `adapters/cursor/cursor-rules.md` a las reglas del proyecto.
2. Mantén el pack dentro del repo para que Cursor pueda consultar `global/`, `skills/` y `templates/`.

### Claude

1. Usa `adapters/claude/claude-project-instructions.md` como Project Instructions.
2. Adjunta o referencia el contenido de `global/`, `skills/` y `templates/` como conocimiento del proyecto.

### Windsurf

1. Copia `adapters/windsurf/windsurf-rules.md` en las reglas del workspace.
2. Mantén el pack en el proyecto para que Windsurf pueda usar las skills por ruta.

### Generic AI

1. Usa `adapters/generic-ai/system-prompt.md` como prompt de sistema.
2. Adjunta las carpetas `global/`, `skills/` y `templates/` como contexto o conocimiento.

## Instalacion manual recomendada

```txt
mi-proyecto/
  AGENTS.md
  .ai-skills/
    global/
    skills/
    adapters/
    templates/
    manifest.json
    README.md
    INSTALL.md
```

Para Codex, el archivo clave es `AGENTS.md`. Para otras herramientas, usa el adaptador correspondiente y conserva `.ai-skills/` como fuente de conocimiento reusable.

## Release sugerido

Crear un release `v2.0.0` con el titulo:

```txt
PholioDev AI Skill Pack v2.0.0
```

Descripcion sugerida:

```txt
Initial reusable release of the PholioDev AI Skill Pack, including global rules, task-specific skills, AI tool adapters and reusable delivery templates.
```

## Licencia

Este paquete se distribuye bajo licencia MIT. Si el uso sera estrictamente interno o comercial privado, puedes reemplazar `LICENSE` por una licencia propietaria antes de publicar.
