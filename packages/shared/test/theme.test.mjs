// Vérifie que les couleurs de la charte respectent les contrastes WCAG 2.2 AA, dans les deux thèmes.
// Lancer : pnpm --filter @epickem/shared test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrastRatio, contrastRules, cssVariableName, themeCss, themes } from '../dist/index.js';

describe('contrastRatio', () => {
  it('donne 21:1 pour noir sur blanc et 1:1 pour une couleur sur elle-même', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.equal(contrastRatio('#0B6BFF', '#0B6BFF'), 1);
  });

  it("ne dépend pas de l'ordre des couleurs", () => {
    assert.equal(contrastRatio('#0A0F1A', '#E4E7EB'), contrastRatio('#E4E7EB', '#0A0F1A'));
  });

  it('refuse une couleur mal écrite', () => {
    assert.throws(() => contrastRatio('bleu', '#FFFFFF'), TypeError);
  });
});

for (const [name, colors] of Object.entries(themes)) {
  describe(`thème ${name}`, () => {
    for (const { foreground, background, min } of contrastRules) {
      it(`${foreground} sur ${background} ≥ ${min}:1`, () => {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        assert.ok(
          ratio >= min,
          `${foreground} ${colors[foreground]} sur ${background} ${colors[background]} : ` +
            `${ratio.toFixed(2)}:1, il faut au moins ${min}:1`,
        );
      });
    }
  });
}

describe('themeCss', () => {
  it('déclare une variable par rôle, pour chaque thème', () => {
    const css = themeCss();
    for (const role of Object.keys(themes.dark)) {
      assert.ok(css.includes(`${cssVariableName(role)}:${themes.dark[role]};`), role);
      assert.ok(css.includes(`${cssVariableName(role)}:${themes.light[role]};`), role);
    }
  });

  it('écrit les noms de variables en kebab-case', () => {
    assert.equal(cssVariableName('surfaceRaised'), '--epk-surface-raised');
  });
});
