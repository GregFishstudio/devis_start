import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT, ERROR, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SignupScreen() {
  const theme = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (authError) {
      setError(authError.message);
    } else {
      Alert.alert(
        'Compte créé !',
        'Vérifiez votre email pour confirmer votre compte.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
    setLoading(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Créer un compte</ThemedText>
          <ThemedText themeColor="textSecondary">Démarrez gratuitement</ThemedText>
        </View>

        <View style={styles.form}>
          {!!error && (
            <ThemedView type="backgroundElement" style={styles.errorBox}>
              <ThemedText type="small" style={{ color: ERROR }}>{error}</ThemedText>
            </ThemedView>
          )}

          {([
            { value: fullName, setter: setFullName, placeholder: 'Nom complet', cap: 'words' as const },
            { value: email, setter: setEmail, placeholder: 'Email', cap: 'none' as const, kb: 'email-address' as const },
            { value: password, setter: setPassword, placeholder: 'Mot de passe (8 min.)', cap: 'none' as const, secure: true },
          ]).map(({ value, setter, placeholder, cap, kb, secure }) => (
            <TextInput
              key={placeholder}
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              value={value}
              onChangeText={setter}
              placeholder={placeholder}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize={cap}
              keyboardType={kb ?? 'default'}
              secureTextEntry={secure}
              autoCorrect={false}
            />
          ))}

          <Pressable
            style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleSignup}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#0D2A45" />
              : <ThemedText style={styles.buttonText}>Créer mon compte</ThemedText>}
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.link}>
            <ThemedText type="small" themeColor="textSecondary">Déjà un compte ? </ThemedText>
            <ThemedText type="linkPrimary">Se connecter</ThemedText>
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
  form: { gap: Spacing.three },
  errorBox: { padding: Spacing.three, borderRadius: Spacing.two },
  input: {
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#F4F1EA', fontSize: 16, fontWeight: '600' },
  link: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
