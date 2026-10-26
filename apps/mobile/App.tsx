import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { APP_NAME, APP_TAGLINE, themes } from '@epickem/shared';

import icon from './assets/icon.png';

export default function App() {
  // Thème du téléphone (sombre par défaut) ; couleurs de la charte, docs/identite/charte-graphique.md
  const colors = themes[useColorScheme() === 'light' ? 'light' : 'dark'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={icon}
        style={styles.icon}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {APP_NAME}
      </Text>
      <Text style={[styles.tagline, { color: colors.accent }]}>{APP_TAGLINE}</Text>
      <Text style={{ color: colors.textMuted }}>
        Le squelette de l'application mobile fonctionne.
      </Text>
      <StatusBar style={colors === themes.light ? 'dark' : 'light'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontWeight: '600',
    marginBottom: 8,
  },
});
