import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { ACCENT, BottomTabInset, ERROR, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/hooks/use-chat';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/types/database';

function MessageBubble({ item }: { item: ChatMessage }) {
  const theme = useTheme();
  const isUser = item.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : [styles.aiBubble, { backgroundColor: theme.backgroundElement }]]}>
      {!isUser && (
        <ThemedText type="small" style={styles.roleLabel}>IA</ThemedText>
      )}
      {item.audio_url && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.audioLabel}>
          🎙 Note vocale
        </ThemedText>
      )}
      <ThemedText style={isUser ? styles.userText : undefined}>{item.content}</ThemedText>
    </View>
  );
}

export default function ChatScreen() {
  const theme = useTheme();
  const { profile, signOut } = useAuth();
  const { messages, sendMessage, isSending } = useChat();
  const recorder = useVoiceRecorder(profile?.company_id);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const isRecording = recorder.state === 'recording';
  const isUploading = recorder.state === 'uploading';
  const micBusy = isRecording || isUploading;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    await sendMessage(text);
    listRef.current?.scrollToEnd({ animated: true });
  };

  const handleMicPress = async () => {
    if (isRecording) {
      const audioUrl = await recorder.stop();
      if (audioUrl) {
        await sendMessage('🎙 Note vocale', audioUrl);
        listRef.current?.scrollToEnd({ animated: true });
      }
    } else {
      await recorder.start();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.headerWrap} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Image source={require('../../assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
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
          renderItem={({ item }) => <MessageBubble item={item} />}
        />

        {recorder.error && (
          <View style={styles.errorBanner}>
            <ThemedText type="small" style={styles.errorText}>{recorder.error}</ThemedText>
          </View>
        )}

        {isRecording && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingDot} />
            <ThemedText type="small" style={styles.recordingText}>Enregistrement en cours… Appuyez pour arrêter</ThemedText>
          </View>
        )}

        <ThemedView type="backgroundElement" style={styles.inputBar}>
          {/* Mic button */}
          <Pressable
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handleMicPress}
            disabled={isSending || isUploading}>
            {isUploading
              ? <ActivityIndicator color={ACCENT} size="small" />
              : <ThemedText style={[styles.micIcon, isRecording && styles.micIconActive]}>
                  {isRecording ? '⏹' : '🎙'}
                </ThemedText>}
          </Pressable>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder={micBusy ? '' : 'Écrivez un message...'}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            editable={!micBusy}
          />

          <Pressable
            style={[styles.sendBtn, { opacity: !input.trim() || isSending || micBusy ? 0.4 : 1 }]}
            onPress={handleSend}
            disabled={!input.trim() || isSending || micBusy}>
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
  headerLogo: { width: 120, height: 43 },
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
  audioLabel: { fontSize: 11, opacity: 0.8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.three, marginTop: Spacing.six },
  emptyIcon: { fontSize: 32, color: ACCENT },
  emptyTitle: { textAlign: 'center', fontSize: 28 },
  emptyText: { textAlign: 'center', lineHeight: 24 },
  errorBanner: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.one,
    backgroundColor: '#4A1010',
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  errorText: { color: ERROR },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.one,
    backgroundColor: '#1A0D0D',
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ERROR,
  },
  recordingText: { color: ERROR, flex: 1 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.two,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#234d73',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#234d73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    borderColor: ERROR,
    backgroundColor: '#4A1010',
  },
  micIcon: { fontSize: 18 },
  micIconActive: { color: ERROR },
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
