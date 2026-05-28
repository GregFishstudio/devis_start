import { useState, useCallback } from 'react';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export type RecorderState = 'idle' | 'recording' | 'uploading';

export function useVoiceRecorder(companyId: string | null | undefined) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    if (Platform.OS === 'web') {
      setError('Enregistrement vocal non disponible sur web');
      return false;
    }
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      setError('Permission micro refusée');
      return false;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setState('recording');
    return true;
  }, [recorder]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (state !== 'recording') return null;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || !companyId) {
      setState('idle');
      return null;
    }

    setState('uploading');
    try {
      const fileName = `${companyId}/voice-${Date.now()}.m4a`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, blob, { contentType: 'audio/m4a', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('voice-notes').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setState('idle');
    }
  }, [recorder, state, companyId]);

  const cancel = useCallback(async () => {
    if (state === 'recording') {
      await recorder.stop();
    }
    setState('idle');
  }, [recorder, state]);

  return { state, error, start, stop, cancel };
}
