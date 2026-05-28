import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import type { Quote, QuoteStatus } from '@/types/database';

export function useQuotes() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const key = ['quotes', profile?.company_id];

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, clients(name)')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!profile?.company_id,
  });

  const createQuote = useMutation({
    mutationFn: async (quote: Omit<Quote, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'clients'>) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert({ ...quote, company_id: profile!.company_id! })
        .select()
        .single();
      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuoteStatus }) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { quotes, isLoading, createQuote, updateStatus, deleteQuote };
}
