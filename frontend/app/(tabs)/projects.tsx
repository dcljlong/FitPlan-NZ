import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows, getStatusColor, getStatusLabel } from '../../components/theme';
import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { userName } = useUser();

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadProjects(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    loadProjects();
  };

  const renderProject = ({ item }: { item: any }) => {
    const indicatorColor = getStatusColor(item.overall_indicator);
    const progress = item.task_count > 0 ? item.completed_tasks / item.task_count : 0;
    return (
      <TouchableOpacity
        testID={`project-card-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/project/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: indicatorColor }]} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.start_date}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="list" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.completed_tasks}/{item.task_count} tasks</Text>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: indicatorColor }]} />
        </View>
        <View style={styles.hoursRow}>
          <Text style={styles.hoursLabel}>
            {item.total_logged_hours?.toFixed(1) || '0'} / {item.total_quoted_hours?.toFixed(1) || '0'} hrs
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: indicatorColor + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: indicatorColor }]}>
              {getStatusLabel(item.overall_indicator)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>G'day, {userName} 👋</Text>
          <Text style={styles.headerTitle}>Projects</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          testID="projects-list"
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProject}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clipboard" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No projects yet</Text>
              <Text style={styles.emptySubtext}>Tap + to create your first project</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity
        testID="create-project-btn"
        style={styles.fab}
        onPress={() => router.push('/project/create')}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    paddingBottom: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greeting: { ...typography.body, color: colors.textSecondary },
  headerTitle: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadows.subtle,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  cardTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  cardDesc: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  cardMeta: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { fontSize: 13, color: colors.textSecondary },
  progressBarBg: {
    height: 6, backgroundColor: colors.surfaceSecondary,
    borderRadius: 3, marginBottom: spacing.sm, overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hoursLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { ...typography.h3, color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primary, justifyContent: 'center',
    alignItems: 'center', ...shadows.medium,
  },
});
