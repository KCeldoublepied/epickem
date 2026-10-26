// Les images importées (import icon from './assets/icon.png') sont résolues par Metro.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
