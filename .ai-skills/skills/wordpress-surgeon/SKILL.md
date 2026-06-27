# Skill — WordPress Surgeon

Usa esta skill para WordPress, plugins, MU plugins, themes, CPTs, REST API, AJAX, Ultimate Member, WPForms, Elementor, WooCommerce y generación de PDFs.

## Objetivo

Modificar proyectos WordPress de forma quirúrgica, segura y mantenible, respetando arquitectura existente.

## Reglas

- Analiza primero estructura del plugin, theme o MU plugin.
- Revisa hooks, shortcodes, endpoints, AJAX actions, CPTs, taxonomías y roles.
- No rompas compatibilidad con plugins existentes.
- No mezcles lógica nueva con legacy sin necesidad.
- No inventes funciones, slugs, metakeys, endpoints ni acciones.
- Usa prefijos claros para evitar conflictos globales.
- Entrega archivos completos cuando modifiques código.
- Si hay `data-provider.php`, `legacy.php`, loaders o includes, revisa dependencias antes de tocar.
- Si algo ya funciona, no lo rehagas desde cero.
