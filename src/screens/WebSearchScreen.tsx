import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { encodeSearchQuery } from '../search/encode';
import { splitSuggestion } from '../search/youtubeSuggest';
import { ChevronIcon, FillIcon, SearchIcon } from '../ui/icons';
import { tabBarSpace, useTheme } from '../ui/theme';

export { encodeSearchQuery };

export function youtubeSearchPath(query: string): string {
  return `/results?search_query=${encodeSearchQuery(query)}`;
}

/** A direct hit for what was typed, e.g. "@name" or "r/name". */
export type SearchShortcut = {
  key: string;
  title: string;
  subtitle?: string;
  path: string;
};

type Props = {
  visible: boolean;
  title: string;
  placeholder: string;
  /** Turns a query into the app's search results path. */
  searchPath: (query: string) => string;
  /** Suggestions while typing (YouTube). */
  suggest?: (query: string, signal: AbortSignal) => Promise<string[]>;
  shortcuts?: (text: string) => SearchShortcut[];
  /** Earlier queries (this session). */
  recent: string[];
  onRemember: (query: string) => void;
  /** Shown while the field is empty, e.g. your Reddit communities. */
  saved?: { title: string; items: SearchShortcut[] };
  onOpen: (path: string) => void;
};

/**
 * Deliberate search instead of a feed: type what you want, get exactly
 * that. Used by YouTube, X and Reddit (whose start it is, too).
 */
export function WebSearchScreen({
  visible,
  title,
  placeholder,
  searchPath,
  suggest,
  shortcuts,
  recent,
  onRemember,
  saved,
  onOpen,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const typed = text.trim();

  // The keyboard only opens when you tap the field, so the tab bar stays
  // usable right after switching to search.
  useEffect(() => {
    if (!visible) {
      inputRef.current?.blur();
    }
  }, [visible]);

  // Suggestions while typing; the latest keystroke wins.
  useEffect(() => {
    if (!typed || !suggest) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggest(typed, controller.signal).then(result => {
        if (!controller.signal.aborted) {
          setSuggestions(result);
        }
      });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed, suggest]);

  const run = (query: string) => {
    const q = query.trim();
    if (!q) {
      return;
    }
    onRemember(q);
    setText('');
    onOpen(searchPath(q));
  };

  const open = (path: string) => {
    setText('');
    onOpen(path);
  };

  const hits = typed && shortcuts ? shortcuts(typed) : [];
  const queries = typed
    ? suggest
      ? suggestions
      : [typed]
    : recent.filter(Boolean);
  const pressedStyle = ({ pressed }: { pressed: boolean }) => [
    styles.row,
    pressed ? { backgroundColor: theme.fill } : null,
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <Text style={[styles.largeTitle, { color: theme.label }]}>{title}</Text>
      <View style={[styles.field, { backgroundColor: theme.fill }]}>
        <SearchIcon color={theme.secondaryLabel} size={18} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => run(text)}
          placeholder={placeholder}
          placeholderTextColor={theme.secondaryLabel}
          style={[styles.input, { color: theme.label }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          keyboardAppearance={theme.dark ? 'dark' : 'light'}
          accessibilityLabel={placeholder}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: tabBarSpace(insets.bottom) }}
      >
        {hits.map(hit => (
          <Pressable
            key={hit.key}
            onPress={() => open(hit.path)}
            accessibilityRole="button"
            style={pressedStyle}
          >
            <View style={styles.rowText}>
              <Text
                style={[styles.rowTitle, { color: theme.label }]}
                numberOfLines={1}
              >
                {hit.title}
              </Text>
              {hit.subtitle ? (
                <Text
                  style={[styles.rowSubtitle, { color: theme.secondaryLabel }]}
                  numberOfLines={1}
                >
                  {hit.subtitle}
                </Text>
              ) : null}
            </View>
            <ChevronIcon color={theme.tertiaryLabel} />
          </Pressable>
        ))}

        {queries.map(query => {
          const parts = splitSuggestion(query, text);
          return (
            <Pressable
              key={`q-${query}`}
              onPress={() => run(query)}
              accessibilityRole="button"
              accessibilityLabel={query}
              style={pressedStyle}
            >
              <SearchIcon color={theme.secondaryLabel} size={18} />
              <Text
                style={[styles.rowText, styles.query, { color: theme.label }]}
                numberOfLines={1}
              >
                {parts.typed}
                <Text style={parts.typed ? styles.completion : null}>
                  {parts.rest}
                </Text>
              </Text>
              {suggest ? (
                <Pressable
                  onPress={() => {
                    setText(query + ' ');
                    inputRef.current?.focus();
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`„${query}“ übernehmen`}
                >
                  <FillIcon color={theme.secondaryLabel} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {!typed && saved && saved.items.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.label }]}>
              {saved.title}
            </Text>
            {saved.items.map(item => (
              <Pressable
                key={item.key}
                onPress={() => open(item.path)}
                accessibilityRole="button"
                style={pressedStyle}
              >
                <Text
                  style={[styles.rowText, styles.query, { color: theme.label }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <ChevronIcon color={theme.tertiaryLabel} />
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 10,
    borderRadius: 11,
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  query: {
    fontSize: 16,
  },
  completion: {
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 4,
  },
});
