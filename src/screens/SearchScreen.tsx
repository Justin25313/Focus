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
import { SearchUser } from '../filtering/engine/messages';
import { parseSearchInput } from '../filtering/instagram/search';
import { ChevronIcon, SearchIcon, VerifiedIcon } from '../ui/icons';
import { AvatarRow, Pulse } from '../ui/skeleton/Skeleton';
import { tabBarSpace, useTheme } from '../ui/theme';

export type SearchResult = { ok: boolean; users: SearchUser[] };

type Props = {
  visible: boolean;
  history: string[];
  runSearch: (query: string) => Promise<SearchResult>;
  onOpenProfile: (username: string) => void;
  onOpenPath: (path: string) => void;
  onClearHistory: () => void;
};

type ResultState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; result: SearchResult };

export function SearchScreen({
  visible,
  history,
  runSearch,
  onOpenProfile,
  onOpenPath,
  onClearHistory,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState<ResultState>({ status: 'idle' });
  const parsed = parseSearchInput(text);

  // The keyboard only opens when you tap the field, so the tab bar stays
  // usable right after switching to search.
  useEffect(() => {
    if (!visible) {
      inputRef.current?.blur();
    }
  }, [visible]);

  // Results while typing, through Instagram's own account search.
  useEffect(() => {
    const query = text.trim().replace(/^@/, '');
    if (
      query.length < 2 ||
      parsed.kind === 'path' ||
      parsed.kind === 'blocked'
    ) {
      setResults({ status: 'idle' });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setResults({ status: 'loading', query });
      runSearch(query).then(result => {
        if (!cancelled) {
          setResults({ status: 'done', query, result });
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, parsed.kind, runSearch]);

  const submit = () => {
    if (parsed.kind === 'username') {
      onOpenProfile(parsed.username);
    } else if (parsed.kind === 'path') {
      onOpenPath(parsed.path);
    } else if (
      parsed.kind === 'query' &&
      results.status === 'done' &&
      results.result.users.length > 0
    ) {
      onOpenProfile(results.result.users[0].username);
    }
  };

  const openUser = (username: string) => {
    setText('');
    onOpenProfile(username);
  };

  const users =
    results.status === 'done'
      ? results.result.users.filter(
          user =>
            parsed.kind !== 'username' ||
            user.username.toLowerCase() !== parsed.username.toLowerCase(),
        )
      : [];

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
          onSubmitEditing={submit}
          placeholder="Name, @benutzername oder Link"
          placeholderTextColor={theme.secondaryLabel}
          style={[styles.input, { color: theme.label }]}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          clearButtonMode="while-editing"
          textContentType="none"
          keyboardAppearance={theme.dark ? 'dark' : 'light'}
          accessibilityLabel="Instagram-Profil suchen"
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingBottom: tabBarSpace(insets.bottom) + 12,
        }}
      >
        {parsed.kind === 'username' ? (
          <ResultRow
            title={`@${parsed.username}`}
            subtitle="Profil direkt öffnen"
            onPress={() => openUser(parsed.username)}
          />
        ) : null}
        {parsed.kind === 'path' ? (
          <ResultRow
            title="Link öffnen"
            subtitle={parsed.path}
            onPress={() => {
              setText('');
              onOpenPath(parsed.path);
            }}
          />
        ) : null}
        {parsed.kind === 'blocked' ? (
          <Text style={[styles.note, { color: theme.secondaryLabel }]}>
            Dieser Link führt zu Reels oder Explore und bleibt in Focus
            gesperrt.
          </Text>
        ) : null}

        {results.status === 'loading' ? (
          <Pulse style={styles.skeleton}>
            {[0, 1, 2, 3].map(i => (
              <AvatarRow
                key={i}
                size={42}
                widths={[i % 2 ? '40%' : '52%', i % 2 ? '58%' : '34%']}
              />
            ))}
          </Pulse>
        ) : null}

        {users.map(user => (
          <ResultRow
            key={user.username}
            title={user.username}
            subtitle={user.fullName}
            verified={user.verified}
            onPress={() => openUser(user.username)}
          />
        ))}

        {results.status === 'done' && !results.result.ok ? (
          <Text style={[styles.note, { color: theme.secondaryLabel }]}>
            Die Namenssuche ist gerade nicht verfügbar (nicht angemeldet oder
            Instagram hat etwas geändert). Den genauen Benutzernamen kannst du
            trotzdem öffnen.
          </Text>
        ) : null}
        {results.status === 'done' &&
        results.result.ok &&
        users.length === 0 &&
        parsed.kind === 'query' ? (
          <Text style={[styles.note, { color: theme.secondaryLabel }]}>
            Keine Profile gefunden.
          </Text>
        ) : null}

        {parsed.kind === 'empty' && history.length > 0 ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.label }]}>
                Zuletzt geöffnet
              </Text>
              <Pressable onPress={onClearHistory} hitSlop={8}>
                <Text style={[styles.sectionAction, { color: theme.accent }]}>
                  Löschen
                </Text>
              </Pressable>
            </View>
            {history.map(name => (
              <ResultRow
                key={name}
                title={name}
                onPress={() => openUser(name)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ResultRow({
  title,
  subtitle,
  verified,
  onPress,
}: {
  title: string;
  subtitle?: string;
  verified?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.fill } : null,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.fill }]}>
        <Text style={[styles.avatarText, { color: theme.secondaryLabel }]}>
          {title.replace(/^@/, '').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          <Text
            style={[styles.rowTitle, { color: theme.label }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {verified ? <VerifiedIcon color="#3897F0" size={14} /> : null}
        </View>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: theme.secondaryLabel }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronIcon color={theme.tertiaryLabel} />
    </Pressable>
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
  skeleton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 18,
  },
  note: {
    fontSize: 15,
    lineHeight: 21,
    marginHorizontal: 20,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  sectionAction: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    minHeight: 60,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowSubtitle: {
    fontSize: 14,
  },
});
