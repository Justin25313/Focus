import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { RouteKind } from '../../filtering/instagram/routes';
import { AvatarRow, Bone, Circle, Lines, Pulse } from './Skeleton';

/**
 * Placeholders shaped like the Instagram page that is about to appear, so
 * the swap from skeleton to real content does not move anything around.
 */
export type SkeletonVariant = 'feed' | 'inbox' | 'profile' | 'post' | 'generic';

export function skeletonForRoute(kind: RouteKind): SkeletonVariant {
  switch (kind) {
    case 'home':
      return 'feed';
    case 'direct':
    case 'search':
      return 'inbox';
    case 'profile':
      return 'profile';
    case 'post':
      return 'post';
    default:
      return 'generic';
  }
}

export function InstagramSkeleton({ variant }: { variant: SkeletonVariant }) {
  return (
    <Pulse style={styles.fill}>
      {variant === 'feed' ? <Feed /> : null}
      {variant === 'inbox' ? <Inbox /> : null}
      {variant === 'profile' ? <Profile /> : null}
      {variant === 'post' ? <Post /> : null}
      {variant === 'generic' ? <Generic /> : null}
    </Pulse>
  );
}

function Header({ titleWidth = 110 }: { titleWidth?: number }) {
  return (
    <View style={styles.header}>
      <Bone width={titleWidth} height={22} />
      <View style={styles.headerIcons}>
        <Circle size={26} />
        <Circle size={26} />
      </View>
    </View>
  );
}

function PostCard() {
  const { width } = useWindowDimensions();
  return (
    <View>
      <AvatarRow size={34} widths={[120]} style={styles.postHead} />
      <Bone width={width} height={width} radius={0} />
      <View style={styles.actions}>
        <Circle size={24} />
        <Circle size={24} />
        <Circle size={24} />
      </View>
      <Lines widths={['35%', '85%', '60%']} style={styles.caption} />
    </View>
  );
}

function Feed() {
  return (
    <View>
      <Header />
      <View style={styles.stories}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={styles.story}>
            <Circle size={66} />
            <Bone width={52} height={9} radius={4} />
          </View>
        ))}
      </View>
      <PostCard />
    </View>
  );
}

function Post() {
  return (
    <View>
      <Header titleWidth={80} />
      <PostCard />
    </View>
  );
}

function Inbox() {
  return (
    <View>
      <Header titleWidth={130} />
      <Bone width="auto" height={36} radius={10} style={styles.searchPill} />
      <View style={styles.list}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <AvatarRow
            key={i}
            size={56}
            widths={[i % 2 ? '38%' : '48%', i % 3 ? '64%' : '52%']}
          />
        ))}
      </View>
    </View>
  );
}

function Profile() {
  const { width } = useWindowDimensions();
  const tile = (width - 2) / 3;
  return (
    <View>
      <Header titleWidth={140} />
      <View style={styles.profileTop}>
        <Circle size={86} />
        <View style={styles.stats}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.stat}>
              <Bone width={34} height={16} radius={4} />
              <Bone width={54} height={10} radius={4} />
            </View>
          ))}
        </View>
      </View>
      <Lines widths={['40%', '80%', '65%']} style={styles.bio} />
      <View style={styles.buttons}>
        <Bone width="auto" height={32} radius={8} style={styles.flex} />
        <Bone width="auto" height={32} radius={8} style={styles.flex} />
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Bone key={i} width={tile} height={tile * 1.33} radius={0} />
        ))}
      </View>
    </View>
  );
}

function Generic() {
  return (
    <View>
      <Header titleWidth={120} />
      <View style={styles.generic}>
        <Lines widths={['70%', '90%', '55%', '80%']} lineHeight={14} gap={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 20,
  },
  stories: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 14,
  },
  story: {
    alignItems: 'center',
    gap: 8,
  },
  postHead: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  caption: {
    paddingHorizontal: 14,
  },
  searchPill: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  list: {
    paddingHorizontal: 16,
    gap: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 24,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 6,
  },
  bio: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  generic: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
