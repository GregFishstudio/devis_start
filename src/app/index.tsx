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
import { BottomTabInset, Spacing } from '@/constants/theme';
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
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.roleLabel}>
            IA
          </ThemedText>
        )}
        <ThemedText style={isUser ? styles.userText : undefined}>{item.content}</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="smallBold">Assistant IA</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profile?.full_name ?? 'Mon entreprise'}
            </ThemedText>
          </View>
          <Pressable onPress={signOut}>
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
              <ThemedText type="subtitle" style={styles.emptyTitle}>Bonjour 👋</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Décrivez un devis, une note, ou une action Instagram.
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
              ? <ActivityIndicator color="#fff" size="small" />
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
  header: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  messageList: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  bubble: {
    maxWidth: '80%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#208AEF',
    borderBottomRightRadius: Spacing.one,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.3)',
    borderBottomLeftRadius: Spacing.one,
  },
  userText: { color: '#fff' },
  roleLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.three },
  emptyTitle: { textAlign: 'center', fontSize: 28 },
  emptyText: { textAlign: 'center', lineHeight: 24 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.two,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
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
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
