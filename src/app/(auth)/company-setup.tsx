import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generateId } from '@/lib/generate-id';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT, ERROR, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

const FIELDS = [
  { key: 'name',       label: 'Nom de l\'entreprise *', cap: 'words'      as const },
  { key: 'email',      label: 'Email professionnel',    kb: 'email-address' as const, cap: 'none' as const },
  { key: 'phone',      label: 'Téléphone',              kb: 'phone-pad'    as const, cap: 'none' as const },
  { key: 'address',    label: 'Adresse',                cap: 'sentences'   as const },
  { key: 'siret',      label: 'SIRET',                  kb: 'numeric'      as const, cap: 'none' as const },
  { key: 'tva_number', label: 'Numéro TVA',             cap: 'characters'  as const },
] as const;

type FormKey = (typeof FIELDS)[number]['key'];

export default function CompanySetupScreen() {
  const theme = useTheme();
  const { session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<FormKey, string>>({
    name: '', email: '', phone: '', address: '', siret: '', tva_number: '',
  });

  const update = (key: FormKey) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Le nom de l\'entreprise est requis'); return; }
    if (!session?.user.id) return;
    setError('');
    setLoading(true);
    try {
      // Generate UUID client-side to avoid INSERT...RETURNING triggering the SELECT policy
      // (SELECT policy uses get_user_company_id() which returns null before profile is linked)
      const companyId = generateId();

      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          id:         companyId,
          name:       form.name.trim(),
          email:      form.email.trim()      || null,
          phone:      form.phone.trim()      || null,
          address:    form.address.trim()    || null,
          siret:      form.siret.trim()      || null,
          tva_number: form.tva_number.trim() || null,
        });

      if (companyError) throw companyError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', session.user.id);

      if (profileError) throw profileError;
      await refreshProfile();
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Votre entreprise</ThemedText>
            <ThemedText themeColor="textSecondary">
              Ces informations apparaîtront sur vos devis
            </ThemedText>
          </View>

          <View style={styles.form}>
            {!!error && (
              <ThemedView type="backgroundElement" style={styles.errorBox}>
                <ThemedText type="small" style={{ color: ERROR }}>{error}</ThemedText>
              </ThemedView>
            )}

            {FIELDS.map(({ key, label, cap, kb }) => (
              <View key={key} style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={form[key]}
                  onChangeText={update(key)}
                  placeholder={label.replace(' *', '')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize={cap ?? 'none'}
                  keyboardType={kb ?? 'default'}
                  autoCorrect={false}
                />
              </View>
            ))}

            <Pressable
              style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#0D2A45" />
                : <ThemedText style={styles.buttonText}>Créer mon espace</ThemedText>}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe:   { flex: 1, paddingHorizontal: Spacing.four },
  scroll: { paddingBottom: Spacing.six },
  header: { paddingTop: Spacing.five, paddingBottom: Spacing.four, gap: Spacing.two },
  form:   { gap: Spacing.three },
  field:  { gap: Spacing.one },
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
    marginTop: Spacing.two,
  },
  buttonText: { color: '#F4F1EA', fontSize: 16, fontWeight: '600' },
});
