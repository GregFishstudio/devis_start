import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import type { ChatMessage } from '@/types/database';

export function useChat() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [isSending, setIsSending] = useState(false);

  const { data: messages = [] } = useQuery({
    queryKey: ['chat', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!profile?.company_id,
  });

  const sendMessage = async (content: string, audioUrl?: string | null) => {
    if (!profile?.company_id) return;
    setIsSending(true);

    // Optimistic insert
    const tempId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      company_id: profile.company_id,
      user_id: null,
      role: 'user',
      content,
      intent: null,
      metadata: {},
      audio_url: audioUrl ?? null,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) => [...old, userMsg]);

    try {
      // Persist user message
      await supabase.from('chat_messages').insert({
        company_id: profile.company_id,
        role: 'user',
        content,
        metadata: {},
        audio_url: audioUrl ?? null,
        user_id: null,
        intent: null,
      });

      // Call ai-chat Edge Function
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { content, company_id: profile.company_id, audio_url: audioUrl ?? null },
      });

      if (error) throw error;

      // If the edge function returned the saved assistant message, inject it
      if (data?.id) {
        qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) => {
          const withoutTemp = old.filter((m) => m.id !== tempId);
          // Add the real user message placeholder and the AI response
          return [...withoutTemp, data as ChatMessage];
        });
      }

      // Refresh from DB to get the real user message ID too
      await qc.invalidateQueries({ queryKey: ['chat', profile.company_id] });
    } catch (err) {
      // Remove optimistic message on failure
      qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) =>
        old.filter((m) => m.id !== tempId),
      );
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  return { messages, sendMessage, isSending };
}
