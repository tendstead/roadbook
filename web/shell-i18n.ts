import type { Plugin } from 'vite';
// @tendstead/ui 0.1.1 has no labels prop. Localize only its fixed chrome during
// compilation, retaining the published component, behavior and attribution.
// Fail closed on upstream changes so upgrades cannot silently lose translations.
export function localizeShell(source: string): string {
  let result = source;
  for (const key of [
    'Skip to content',
    'Menu',
    'All destinations',
    'A little more in order.',
    'Connected services'
  ]) {
    const before = `>${key}<`;
    if (!result.includes(before))
      throw new Error('Update the Roadbook shell language adapter: ' + key);
    result = result.replaceAll(before, `>{$shellT(${JSON.stringify(key)})}<`);
  }
  for (const key of [
    'Application sidebar',
    'Main navigation',
    'Mobile navigation',
    'Close menu',
    'All navigation',
    'Connected services'
  ]) {
    const before = `aria-label="${key}"`;
    if (!result.includes(before))
      throw new Error('Update the Roadbook shell language adapter: ' + key);
    result = result.replaceAll(
      before,
      `aria-label={$shellT(${JSON.stringify(key)})}`
    );
  }
  return result.replace(
    '<script lang="ts">',
    '<script lang="ts">\nimport { translator as shellT } from "/src/lib/i18n";'
  );
}
export function shellLanguages(): Plugin {
  return {
    name: 'roadbook-shell-languages',
    enforce: 'pre',
    transform(source, id) {
      if (
        id.replaceAll('\\', '/').endsWith('/@tendstead/ui/dist/AppShell.svelte')
      )
        return { code: localizeShell(source), map: null };
    }
  };
}
