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
import {
  fetchYouTubeSuggestions,
  splitSuggestion,
} from '../search/youtubeSuggest';
import { FillIcon, SearchIcon } from '../ui/icons';
import { tabBarSpace, useTheme } from '../ui/theme';

/** encodeURIComponent, but also for !'()*~ so the path stays plain. */
export function encodeSearchQuery(query: string): string {
  return encodeURIComponent(query.trim()).replace(
    /[!'()*~]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function youtubeSearchPath(query: string): string {
  return `/results?search_query=${encodeSearchQuery(query)}`;
}

/**
 * Deliberate search instead of a recommendation feed: type what you want
 * to watch, get YouTube's results for exactly that.
 */
export function YouTubeSearchScreen({
  visible,
  onSearch,
}: {
  visible: boolean;
  onSearch: (path: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // The keyboard only opens when you tap the field, so the tab bar stays
  // usable right after switching to search.
  useEffect(() => {
    if (!visible) {
      inputRef.current?.blur();
    }
  }, [visible]);

  // Suggestions while typing; the latest keystroke wins.
  useEffect(() => {
    const query = text.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchYouTubeSuggestions(query, controller.signal).then(result => {
        if (!controller.signal.aborted) {
          setSuggestions(result);
        }
      });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const run = (query: string) => {
    const q = query.trim();
    if (!q) {
      return;
    }
    setRecent(prev =>
      [q, ...prev.filter(item => item.toLowerCase() !== q.toLowerCase())].slice(
        0,
        8,
      ),
    );
    setText('');
    onSearch(youtubeSearchPath(q));
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <Text style={[styles.largeTitle, { color: theme.label }]}>Suche</Text>
      <View style={[styles.field, { backgroundColor: theme.fill }]}>
        <SearchIcon color={theme.secondaryLabel} size={18} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => run(text)}
          placeholder="YouTube durchsuchen"
          placeholderTextColor={theme.secondaryLabel}
          style={[styles.input, { color: theme.label }]}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          keyboardAppearance={theme.dark ? 'dark' : 'light'}
          accessibilityLabel="YouTube durchsuchen"
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: tabBarSpace(insets.bottom) }}
      >
        {(text.trim() ? suggestions : recent).map(query => {
          const parts = splitSuggestion(query, text);
          return (
            <Pressable
              key={query}
              onPress={() => run(query)}
              accessibilityRole="button"
              accessibilityLabel={query}
              style={({ pressed }) => [
                styles.row,
                pressed ? { backgroundColor: theme.fill } : null,
              ]}
            >
              <SearchIcon color={theme.secondaryLabel} size={18} />
              <Text
                style={[styles.rowText, { color: theme.label }]}
                numberOfLines={1}
              >
                {parts.typed}
                <Text style={parts.typed ? styles.completion : null}>
                  {parts.rest}
                </Text>
              </Text>
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
            </Pressable>
          );
        })}
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
    fontSize: 16,
  },
  completion: {
    fontWeight: '600',
  },
});
