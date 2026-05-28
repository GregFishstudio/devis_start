import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import type { Client, NewClient } from '@/types/database';

export function useClients() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const key = ['clients', profile?.company_id];

  const { data: clients = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!profile?.company_id,
  });

  const createClient = useMutation({
    mutationFn: async (client: NewClient) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...client, company_id: profile!.company_id! })
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NewClient> & { id: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { clients, isLoading, createClient, updateClient, deleteClient };
}
