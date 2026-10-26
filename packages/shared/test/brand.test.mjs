// Vérifie que les tracés du logo utilisés dans le code sont les mêmes que les fichiers de la charte.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { LOGO_HORIZONTAL, LOGO_SYMBOL, LOGO_SYMBOL_SMALL } from '../dist/index.js';

const logo = (file) =>
  readFileSync(new URL(`../../../docs/identite/logo/${file}`, import.meta.url), 'utf8');

describe('logo', () => {
  it('le symbole correspond à docs/identite/logo/symbole.svg', () => {
    assert.ok(logo('symbole.svg').includes(` d="${LOGO_SYMBOL.path}"`));
  });

  it("le symbole simplifié correspond à l'icône", () => {
    assert.ok(logo('icone.svg').includes(` d="${LOGO_SYMBOL_SMALL.path}"`));
  });

  it('le logo horizontal correspond à docs/identite/logo/logo-horizontal.svg', () => {
    const svg = logo('logo-horizontal.svg');
    assert.ok(svg.includes(`viewBox="${LOGO_HORIZONTAL.viewBox}"`));
    assert.ok(svg.includes(` d="${LOGO_HORIZONTAL.wordmarkPath}"`));
  });
});
