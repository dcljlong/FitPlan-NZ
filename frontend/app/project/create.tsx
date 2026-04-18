import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../components/theme';
import { api } from '../../components/api';

type Template = { id: string; name: string; description?: string };

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function CreateProjectScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [saturdayEnabled, setSaturdayEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [region, setRegion] = useState('AUK');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getTemplates();
        setTemplates(data);
      } catch {
        setTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, []);

  const handleCreate = async () => {
    const cleanName = name.trim();
    const cleanStart = startDate.trim();
    const cleanTarget = targetEndDate.trim();

    if (!cleanName) {
      Alert.alert('Error', 'Project name is required');
      return;
    }
    if (!isValidDate(cleanStart)) {
      Alert.alert('Error', 'Please enter a valid project start date (YYYY-MM-DD)');
      return;
    }
    if (cleanTarget && !isValidDate(cleanTarget)) {
      Alert.alert('Error', 'Please enter a valid target finish date (YYYY-MM-DD)');
      return;
    }
    if (cleanTarget && cleanTarget < cleanStart) {
      Alert.alert('Error', 'Target finish cannot be earlier than project start');
      return;
    }

    setLoading(true);
    try {
      const project = await api.createProject({
        name: cleanName,
        description: description.trim(),
        start_date: cleanStart,
        target_end_date: cleanTarget || null,
        saturday_enabled: saturdayEnabled,
        location_region: region,
        template_id: selectedTemplate,
        created_by: 'user',
      });
      router.replace(`/project/${project.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Project</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            testID="project-name-input"
            style={styles.input}
            placeholder="e.g. 2 Dev Fitout L4-6"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            testID="project-description-input"
            style={[styles.input, styles.multiline]}
            placeholder="Optional notes"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Project Start *</Text>
          <TextInput
            testID="project-start-date-input"
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={startDate}
            onChangeText={setStartDate}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Target Finish</Text>
          <TextInput
            testID="project-target-end-date-input"
            style={styles.input}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor={colors.textSecondary}
            value={targetEndDate}
            onChangeText={setTargetEndDate}
            keyboardType="numbers-and-punctuation"
          />

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Saturday Work</Text>
              <Text style={styles.helper}>Include Saturdays in working-day calculations</Text>
            </View>
            <Switch
              testID="saturday-toggle"
              value={saturdayEnabled}
              onValueChange={setSaturdayEnabled}
              trackColor={{ false: colors.border, true: colors.primary + '88' }}
              thumbColor={saturdayEnabled ? colors.primary : '#fff'}
            />
          </View>

          <Text style={styles.label}>Region</Text>
          <View style={styles.segmentRow}>
            {['AUK', 'WGN', 'CHC'].map((r) => (
              <TouchableOpacity
                key={r}
                testID={`region-${r}`}
                style={[styles.segmentBtn, region === r && styles.segmentBtnActive]}
                onPress={() => setRegion(r)}
              >
                <Text style={[styles.segmentText, region === r && styles.segmentTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Start from Template</Text>
          <Text style={styles.helper}>Optional. Pick a default task structure to speed up setup.</Text>

          {templatesLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : templates.length === 0 ? (
            <Text style={styles.emptyText}>No templates available yet</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {templates.map((template) => {
                const selected = selectedTemplate === template.id;
                return (
                  <TouchableOpacity
                    key={template.id}
                    testID={`template-${template.id}`}
                    style={[styles.templateCard, selected && styles.templateCardSelected]}
                    onPress={() => setSelectedTemplate(selected ? null : template.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      {template.description ? (
                        <Text style={styles.templateDesc}>{template.description}</Text>
                      ) : null}
                    </View>
                    <Feather
                      name={selected ? 'check-circle' : 'circle'}
                      size={20}
                      color={selected ? colors.primary : colors.border}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity
          testID="submit-create-project-btn"
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Project</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  content: { padding: spacing.md, paddingBottom: 60, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    color: colors.textPrimary,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  helper: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  toggleRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  segmentRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  segmentBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtnActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: colors.secondaryForeground },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  templateCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
  },
  templateName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  templateDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  submitBtnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
});
