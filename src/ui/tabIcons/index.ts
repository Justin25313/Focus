import { ImageSourcePropType } from 'react-native';

/**
 * Template PNGs for the tab bar (rendered by scripts/render-tab-icons.mjs).
 * Tinted at runtime with the system label color so they adapt to the
 * Liquid Glass underneath.
 */
export type TabIconName =
  | 'home'
  | 'search'
  | 'message'
  | 'reels'
  | 'profile'
  | 'focus';

export const TAB_ICONS: Record<
  TabIconName,
  { outline: ImageSourcePropType; filled: ImageSourcePropType }
> = {
  home: {
    outline: require('./home.png'),
    filled: require('./home-filled.png'),
  },
  search: {
    outline: require('./search.png'),
    filled: require('./search-filled.png'),
  },
  message: {
    outline: require('./message.png'),
    filled: require('./message-filled.png'),
  },
  reels: {
    outline: require('./reels.png'),
    filled: require('./reels-filled.png'),
  },
  profile: {
    outline: require('./profile.png'),
    filled: require('./profile-filled.png'),
  },
  focus: {
    outline: require('./focus.png'),
    filled: require('./focus-filled.png'),
  },
};
