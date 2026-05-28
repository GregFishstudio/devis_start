import { useState } from 'react';
import {
  ActivityIndicator,
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
import { ACCENT, BottomTabInset, ERROR, SUCCESS, WARNING, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useClients } from '@/hooks/use-clients';
import { useQuotes } from '@/hooks/use-quotes';
import { useTheme } from '@/hooks/use-theme';
import type { Quote, QuoteStatus } from '@/types/database';

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    'Brouillon',
  sent:     'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  expired:  'Expiré',
};

// Colors optimized for dark navy background
const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft:    '#94A3B8',
  sent:     '#60A5FA',
  accepted: SUCCESS,
  rejected: ERROR,
  expired:  WARNING,
};

function StatusBadge({ status }: { status: QuoteStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55', borderWidth: 1 }]}>
      <ThemedText type="small" style={[styles.badgeText, { color }]}>
        {STATUS_LABELS[status]}
      </ThemedText>
    </View>
  );
}

function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardTop}>
        <ThemedText type="smallBold" style={styles.quoteNumber}>{quote.number}</ThemedText>
        <StatusBadge status={quote.status} />
      </View>
      <ThemedText themeColor="textSecondary" style={styles.cardClient}>
        {quote.clients?.name ?? 'Client non assigné'}
      </ThemedText>
      <View style={styles.cardBottom}>
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(quote.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.total}>
          {quote.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

export default function DocumentsScreen() {
  const theme = useTheme();
  const { quotes, isLoading, createQuote } = useQuotes();
  const { clients } = useClients();
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', client_id: '' });

  const nextNumber = `DEV-${String((quotes.length + 1)).padStart(4, '0')}`;

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createQuote.mutateAsync({
        number:      nextNumber,
        status:      'draft',
        title:       form.title.trim() || null,
        client_id:   form.client_id || null,
        description: null, notes: null,
        subtotal: 0, tax_rate: 20, tax_amount: 0, total: 0,
        pdf_url: null, valid_until: null,
      });
      setForm({ title: '', client_id: '' });
      setModalVisible(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Devis</ThemedText>
          <Pressable style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <ThemedText style={styles.addBtnText}>+ Nouveau</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <QuoteCard quote={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText style={styles.emptyIcon}>📄</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Aucun devis pour l'instant.{'\n'}Créez-en un ou demandez à l'IA.
              </ThemedText>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.modal}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">Nouveau devis</ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <ThemedText themeColor="textSecondary">Annuler</ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">Numéro</ThemedText>
                <ThemedView type="backgroundElement" style={styles.readonlyInput}>
                  <ThemedText style={styles.readonlyText}>{nextNumber}</ThemedText>
                </ThemedView>
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">Titre (optionnel)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={form.title}
                  onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
                  placeholder="Ex: Prestation web – Mai 2026"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">Client</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <Pressable
                      style={[styles.chip, !form.client_id && styles.chipSelected]}
                      onPress={() => setForm(f => ({ ...f, client_id: '' }))}>
                      <ThemedText type="small" style={!form.client_id ? styles.chipTextSelected : undefined}>
                        Aucun
                      </ThemedText>
                    </Pressable>
                    {clients.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.chip, form.client_id === c.id && styles.chipSelected]}
                        onPress={() => setForm(f => ({ ...f, client_id: c.id }))}>
                        <ThemedText type="small" style={form.client_id === c.id ? styles.chipTextSelected : undefined}>
                          {c.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.createBtn, { opacity: creating ? 0.7 : 1 }]}
                onPress={handleCreate}
                disabled={creating}>
                {creating
                  ? <ActivityIndicator color="#0D2A45" />
                  : <ThemedText style={styles.createBtnText}>Créer le devis</ThemedText>}
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
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  addBtnText: { color: '#F4F1EA', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteNumber: { color: ACCENT },
  cardClient: { fontSize: 14 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: ACCENT },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.two },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty: { paddingTop: Spacing.six, alignItems: 'center', gap: Spacing.three },
  emptyIcon: { fontSize: 40 },
  emptyText: { textAlign: 'center', lineHeight: 24 },
  modal: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBody: { flex: 1, padding: Spacing.four },
  modalFooter: { padding: Spacing.four },
  field: { gap: Spacing.one, marginBottom: Spacing.three },
  input: { height: 52, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, fontSize: 16, borderWidth: 1 },
  readonlyInput: { height: 52, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  readonlyText: { color: ACCENT, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#234d73',
  },
  chipSelected: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTextSelected: { color: '#0D2A45', fontWeight: '600' },
  createBtn: { height: 52, borderRadius: Spacing.three, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { color: '#F4F1EA', fontSize: 16, fontWeight: '600' },
});
