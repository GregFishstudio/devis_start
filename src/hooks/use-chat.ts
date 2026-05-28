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

  const sendMessage = async (content: string) => {
    if (!profile?.company_id) return;
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      company_id: profile.company_id,
      user_id: null,
      role: 'user',
      content,
      intent: null,
      metadata: {},
      audio_url: null,
      created_at: new Date().toISOString(),
    };

    qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) => [...old, userMsg]);

    try {
      await supabase.from('chat_messages').insert({
        company_id: profile.company_id,
        role: 'user',
        content,
        metadata: {},
      });

      // TODO: Call AI Edge Function here
      // const { data } = await supabase.functions.invoke('ai-chat', { body: { content, company_id: profile.company_id } });
      const aiContent = `Message reçu : "${content}". L'intégration IA (OpenClaw + Gemini) sera connectée via Edge Function.`;

      await supabase.from('chat_messages').insert({
        company_id: profile.company_id,
        role: 'assistant',
        content: aiContent,
        metadata: {},
      });

      await qc.invalidateQueries({ queryKey: ['chat', profile.company_id] });
    } finally {
      setIsSending(false);
    }
  };

  return { messages, sendMessage, isSending };
}
