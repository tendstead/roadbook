import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { localizeShell } from '../../shell-i18n';
test('adapts the published shell including drawer and accessible labels', () => {
  const source = readFileSync(
    'node_modules/@tendstead/ui/dist/AppShell.svelte',
    'utf8'
  );
  const output = localizeShell(source);
  expect(output).toContain('{$shellT("Menu")}');
  expect(output).toContain('aria-label={$shellT("Close menu")}');
  expect(output).toContain('{$shellT("Skip to content")}');
  expect(() =>
    localizeShell(source.replace('Skip to content', 'Changed upstream'))
  ).toThrow('Update the Roadbook shell language adapter');
});
