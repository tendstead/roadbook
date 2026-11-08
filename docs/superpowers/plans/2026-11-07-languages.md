# English and German

Provide English and German for Roadbook, including navigation, forms, import review,
feedback and date/number presentation. Detect the browser language on first use;
Settings stores a per-browser override. Language does not change database settings,
CSV source interpretation, editable canonical values or financial calculations.

1. Test language fallback, reactivity, persistence and display formatting.
2. Add catalogs and localize app views and known service feedback. Adapt fixed
   labels in the published shell at build time until it exposes a labels API;
   fail the build if the expected upstream source changes.
3. Test both languages in mobile/desktop browser flows, including persistence,
   import, errors and unchanged saved values. Run application checks.
4. Update documentation, signed feature commit and existing PR; rebuild only the
   local Roadbook app, preserving its database and uploads.
