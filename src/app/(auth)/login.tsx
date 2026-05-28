import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.brand}>ai-devis</ThemedText>
          <ThemedText themeColor="textSecondary">Gérez votre entreprise avec l'IA</ThemedText>
        </View>

        <View style={styles.form}>
          {!!error && (
            <ThemedView type="backgroundElement" style={styles.errorBox}>
              <ThemedText type="small" style={styles.errorText}>{error}</ThemedText>
            </ThemedView>
          )}

          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Pressable
            style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <ThemedText style={styles.buttonText}>Se connecter</ThemedText>}
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.link}>
            <ThemedText type="small" themeColor="textSecondary">Pas de compte ? </ThemedText>
            <ThemedText type="linkPrimary">Créer un compte</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.four, justifyContent: 'center', gap: Spacing.five },
  header: { gap: Spacing.two },
  brand: { fontSize: 36, lineHeight: 42 },
  form: { gap: Spacing.three },
  errorBox: { padding: Spacing.three, borderRadius: Spacing.two },
  errorText: { color: '#EF4444' },
  input: {
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
