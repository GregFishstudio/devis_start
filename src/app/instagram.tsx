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
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { InstagramPost, InstagramPostStatus } from '@/types/database';

const STATUS_LABELS: Record<InstagramPostStatus, string> = {
  pending: 'En attente',
  processing: 'En cours',
  posted: 'Publié',
  failed: 'Échec',
};

const STATUS_COLORS: Record<InstagramPostStatus, string> = {
  pending: '#F59E0B',
  processing: '#208AEF',
  posted: '#22C55E',
  failed: '#EF4444',
};

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
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardRow}>
        {post.media_url ? (
          <Image source={{ uri: post.media_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <ThemedText style={styles.thumbIcon}>📷</ThemedText>
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[post.status] }]} />
          <ThemedText type="small" style={{ color: STATUS_COLORS[post.status] }}>
            {STATUS_LABELS[post.status]}
          </ThemedText>
          {!!post.context && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.cardContext}>
              {post.context}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardDate}>
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
        media_url: mediaUri,
        media_type: 'image',
        context: context.trim() || null,
        caption: null,
      });
      setMediaUri(null);
      setContext('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Instagram</ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.composer}>
          <Pressable style={styles.mediaPicker} onPress={pickMedia}>
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <ThemedText style={styles.mediaIcon}>📸</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Ajouter un média</ThemedText>
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
            style={[styles.submitBtn, { opacity: submitting || (!context.trim() && !mediaUri) ? 0.5 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting || (!context.trim() && !mediaUri)}>
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <ThemedText style={styles.submitBtnText}>Envoyer à l'agent</ThemedText>}
          </Pressable>
        </ThemedView>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PostCard post={item} />}
          ListHeaderComponent={
            posts.length > 0
              ? <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>Publications</ThemedText>
              : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Aucune publication.\nAjoutez un média et un contexte ci-dessus.
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
  header: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  composer: {
    margin: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  mediaPicker: { borderRadius: Spacing.two, overflow: 'hidden' },
  mediaPlaceholder: {
    height: 120,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.2)',
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
    backgroundColor: '#E1306C',
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
  thumbPlaceholder: { width: 60, height: 60, borderRadius: Spacing.two, backgroundColor: 'rgba(128,128,128,0.1)', alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 22 },
  cardContent: { flex: 1, gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', right: 0, top: 4 },
  cardContext: { lineHeight: 18 },
  cardDate: { marginTop: 2 },
  empty: { paddingTop: Spacing.four, alignItems: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 24 },
});
