import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT, BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/hooks/use-chat';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/types/database';

export default function ChatScreen() {
  const theme = useTheme();
  const { profile, signOut } = useAuth();
  const { messages, sendMessage, isSending } = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    await sendMessage(text);
    listRef.current?.scrollToEnd({ animated: true });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : [styles.aiBubble, { backgroundColor: theme.backgroundElement }]]}>
        {!isUser && (
          <ThemedText type="small" style={styles.roleLabel}>IA</ThemedText>
        )}
        <ThemedText style={isUser ? styles.userText : undefined}>{item.content}</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.headerWrap} edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText type="smallBold" style={styles.headerTitle}>Assistant IA</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profile?.full_name ?? 'Mon entreprise'}
            </ThemedText>
          </View>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <ThemedText type="small" themeColor="textSecondary">Déconnexion</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText style={styles.emptyIcon}>✦</ThemedText>
              <ThemedText type="subtitle" style={styles.emptyTitle}>Bonjour</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Décrivez un devis, une note,{'\n'}ou une action Instagram.
              </ThemedText>
            </View>
          }
          renderItem={renderMessage}
        />

        <ThemedView type="backgroundElement" style={styles.inputBar}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Écrivez un message..."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendBtn, { opacity: !input.trim() || isSending ? 0.4 : 1 }]}
            onPress={handleSend}
            disabled={!input.trim() || isSending}>
            {isSending
              ? <ActivityIndicator color="#0D2A45" size="small" />
              : <ThemedText style={styles.sendBtnText}>↑</ThemedText>}
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  headerWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A3D5D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  headerTitle: { color: ACCENT },
  signOutBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  messageList: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  bubble: {
    maxWidth: '80%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
    borderBottomRightRadius: Spacing.one,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: Spacing.one,
  },
  userText: { color: '#F4F1EA' },
  roleLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: ACCENT },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.three, marginTop: Spacing.six },
  emptyIcon: { fontSize: 32, color: ACCENT },
  emptyTitle: { textAlign: 'center', fontSize: 28 },
  emptyText: { textAlign: 'center', lineHeight: 24 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.two,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#234d73',
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    maxHeight: 120,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#0D2A45', fontSize: 18, fontWeight: '700' },
});
