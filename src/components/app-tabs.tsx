import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

// Replace these placeholder icons with proper assets for each tab
const homeIcon = require('@/assets/images/tabIcons/home.png');
const exploreIcon = require('@/assets/images/tabIcons/explore.png');

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={homeIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="documents">
        <NativeTabs.Trigger.Label>Devis</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={exploreIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clients">
        <NativeTabs.Trigger.Label>Clients</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={homeIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="instagram">
        <NativeTabs.Trigger.Label>Instagram</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={exploreIcon} renderingMode="template" />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
