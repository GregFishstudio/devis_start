import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useClients } from '@/hooks/use-clients';
import { useTheme } from '@/hooks/use-theme';
import type { Client, NewClient } from '@/types/database';

const EMPTY_FORM: NewClient = { name: '', email: null, phone: null, address: null, siret: null, notes: null };

function ClientCard({ client, onDelete }: { client: Client; onDelete: () => void }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</ThemedText>
        </View>
        <View style={styles.cardInfo}>
          <ThemedText type="smallBold">{client.name}</ThemedText>
          {!!client.email && <ThemedText type="small" themeColor="textSecondary">{client.email}</ThemedText>}
          {!!client.phone && <ThemedText type="small" themeColor="textSecondary">{client.phone}</ThemedText>}
        </View>
        <Pressable
          onPress={() => Alert.alert('Supprimer', `Supprimer ${client.name} ?`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: onDelete },
          ])}>
          <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>×</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function ClientsScreen() {
  const theme = useTheme();
  const { clients, isLoading, createClient, deleteClient } = useClients();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewClient>(EMPTY_FORM);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const update = (key: keyof NewClient) => (value: string) =>
    setForm(f => ({ ...f, [key]: value || null }));

  const handleCreate = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await createClient.mutateAsync({ ...form, name: form.name.trim() });
      setForm(EMPTY_FORM);
      setModalVisible(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Clients</ThemedText>
          <Pressable style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <ThemedText style={styles.addBtnText}>+ Ajouter</ThemedText>
          </Pressable>
        </View>
        <View style={styles.searchBar}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher..."
            placeholderTextColor={theme.textSecondary}
            clearButtonMode="while-editing"
          />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ClientCard
              client={item}
              onDelete={() => deleteClient.mutate(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {search ? 'Aucun résultat.' : 'Aucun client pour l\'instant.\nAjoutez votre premier client.'}
              </ThemedText>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.modal}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold">Nouveau client</ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <ThemedText themeColor="textSecondary">Annuler</ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {([
                { key: 'name', label: 'Nom *', cap: 'words' as const },
                { key: 'email', label: 'Email', kb: 'email-address' as const, cap: 'none' as const },
                { key: 'phone', label: 'Téléphone', kb: 'phone-pad' as const, cap: 'none' as const },
                { key: 'address', label: 'Adresse', cap: 'sentences' as const },
                { key: 'siret', label: 'SIRET', kb: 'numeric' as const, cap: 'none' as const },
                { key: 'notes', label: 'Notes', cap: 'sentences' as const },
              ] as const).map(({ key, label, cap, kb }) => (
                <View key={key} style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                    value={form[key as keyof NewClient] ?? ''}
                    onChangeText={update(key as keyof NewClient)}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize={cap ?? 'none'}
                    keyboardType={kb ?? 'default'}
                    autoCorrect={false}
                    multiline={key === 'notes'}
                    numberOfLines={key === 'notes' ? 3 : 1}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.saveBtn, { opacity: saving || !form.name?.trim() ? 0.5 : 1 }]}
                onPress={handleCreate}
                disabled={saving || !form.name?.trim()}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <ThemedText style={styles.saveBtnText}>Enregistrer</ThemedText>}
              </Pressable>
            </View>
          </SafeAreaView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  addBtn: { backgroundColor: '#208AEF', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  addBtnText: { color: '#fff', fontWeight: '600' },
  searchBar: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  searchInput: { height: 40, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#208AEF22', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#208AEF', fontWeight: '700', fontSize: 18 },
  cardInfo: { flex: 1, gap: 2 },
  deleteIcon: { fontSize: 22, paddingHorizontal: Spacing.one },
  empty: { paddingTop: Spacing.six, alignItems: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 24 },
  modal: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalBody: { flex: 1, padding: Spacing.four },
  modalFooter: { padding: Spacing.four },
  field: { gap: Spacing.one, marginBottom: Spacing.three },
  input: { height: 52, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, fontSize: 16 },
  saveBtn: { height: 52, borderRadius: Spacing.three, backgroundColor: '#208AEF', alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
