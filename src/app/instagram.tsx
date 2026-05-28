import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT, BottomTabInset, ERROR, SUCCESS, WARNING, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { InstagramPost, InstagramPostStatus } from '@/types/database';

const STATUS_LABELS: Record<InstagramPostStatus, string> = {
  pending:    'En attente',
  processing: 'En cours',
  posted:     'Publié',
  failed:     'Échec',
};

const STATUS_COLORS: Record<InstagramPostStatus, string> = {
  pending:    WARNING,
  processing: '#60A5FA',
  posted:     SUCCESS,
  failed:     ERROR,
};

const INSTAGRAM_PINK = '#E1306C';

function useInstagramPosts() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const key = ['instagram', profile?.company_id];

  const { data: posts = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_posts')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InstagramPost[];
    },
    enabled: !!profile?.company_id,
  });

  const createPost = useMutation({
    mutationFn: async (post: Pick<InstagramPost, 'media_url' | 'media_type' | 'context' | 'caption'>) => {
      const { error } = await supabase.from('instagram_posts').insert({
        ...post,
        company_id: profile!.company_id!,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { posts, isLoading, createPost };
}

function PostCard({ post }: { post: InstagramPost }) {
  const color = STATUS_COLORS[post.status];
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardRow}>
        {post.media_url ? (
          <Image source={{ uri: post.media_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <ThemedText style={styles.thumbIcon}>🖼</ThemedText>
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <ThemedText type="small" style={{ color }}>{STATUS_LABELS[post.status]}</ThemedText>
          </View>
          {!!post.context && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{post.context}</ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

export default function InstagramScreen() {
  const theme = useTheme();
  const { posts, isLoading, createPost } = useInstagramPosts();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!context.trim() && !mediaUri) return;
    setSubmitting(true);
    try {
      await createPost.mutateAsync({
        media_url:  mediaUri,
        media_type: 'image',
        context:    context.trim() || null,
        caption:    null,
      });
      setMediaUri(null);
      setContext('');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && (!!context.trim() || !!mediaUri);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText type="subtitle">Instagram</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Piloté par l'agent IA</ThemedText>
          </View>
        </View>

        <ThemedView type="backgroundElement" style={styles.composer}>
          <Pressable onPress={pickMedia} style={styles.mediaPicker}>
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <ThemedText style={styles.mediaIcon}>📸</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Sélectionner un média</ThemedText>
              </View>
            )}
          </Pressable>

          <TextInput
            style={[styles.contextInput, { color: theme.text }]}
            value={context}
            onChangeText={setContext}
            placeholder="Décrivez votre post, l'IA rédigera la légende..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit}>
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <ThemedText style={styles.submitBtnText}>Envoyer à l'agent ✦</ThemedText>}
          </Pressable>
        </ThemedView>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={posts.length > 0
            ? <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>Publications</ThemedText>
            : null}
          renderItem={({ item }) => <PostCard post={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Aucune publication.{'\n'}Ajoutez un média et un contexte.
              </ThemedText>
            </View>
          }
        />
      )}
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
  composer: {
    margin: Spacing.three,
    marginTop: 0,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  mediaPicker: { borderRadius: Spacing.two, overflow: 'hidden' },
  mediaPlaceholder: {
    height: 120,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#234d73',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  mediaPreview: { width: '100%', height: 160, borderRadius: Spacing.two },
  mediaIcon: { fontSize: 28 },
  contextInput: { fontSize: 15, lineHeight: 22, minHeight: 80, paddingTop: 0 },
  submitBtn: {
    height: 44,
    borderRadius: Spacing.two,
    backgroundColor: INSTAGRAM_PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.three },
  sectionTitle: { marginBottom: Spacing.one },
  card: { padding: Spacing.three, borderRadius: Spacing.three },
  cardRow: { flexDirection: 'row', gap: Spacing.three },
  thumb: { width: 60, height: 60, borderRadius: Spacing.two },
  thumbPlaceholder: { backgroundColor: '#234d73', alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 22 },
  cardContent: { flex: 1, gap: Spacing.one },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  empty: { paddingTop: Spacing.four, alignItems: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 24 },
});
