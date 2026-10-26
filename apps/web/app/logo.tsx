import { APP_NAME, LOGO_GOLD_GRADIENT, LOGO_GRADIENT_ID, LOGO_HORIZONTAL } from '@epickem/shared';

interface LogoProps {
  /** Hauteur en px ; la largeur suit. */
  height?: number;
}

/**
 * Logo horizontal (symbole + EPICKEM). Il suit le thème grâce à la variable --epk-logo :
 * doré sur fond sombre, couleur du texte sur fond clair (voir la charte).
 * Le nom est donné aux lecteurs d'écran par `aria-label`.
 */
export function Logo({ height = 48 }: LogoProps) {
  const [, , width = 0, viewHeight = 1] = LOGO_HORIZONTAL.viewBox.split(' ').map(Number);

  return (
    <svg
      role="img"
      aria-label={APP_NAME}
      viewBox={LOGO_HORIZONTAL.viewBox}
      height={height}
      width={(height * width) / viewHeight}
      style={{ fill: 'var(--epk-logo)' }}
    >
      <defs>
        <linearGradient id={LOGO_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          {LOGO_GOLD_GRADIENT.map((color, index) => (
            <stop key={color} offset={index / (LOGO_GOLD_GRADIENT.length - 1)} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <path d={LOGO_HORIZONTAL.symbolPath} />
      <path transform={LOGO_HORIZONTAL.wordmarkTransform} d={LOGO_HORIZONTAL.wordmarkPath} />
    </svg>
  );
}
