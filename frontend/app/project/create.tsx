import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch, ScrollView, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../components/theme';
import { api } from '../../components/api';

type Template = { id: string; name: string; description?: string };
type PickerField = 'start' | 'target' | null;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function partsToIso(day: number, month: number, year: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isoToParts(iso?: string | null) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const today = new Date();
    return {
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };
  }
  const [year, month, day] = iso.split('-').map(Number);
  return { day, month, year };
}

function isoToNz(iso?: string | null) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function clampDateParts(day: number, month: number, year: number) {
  let m = Math.min(12, Math.max(1, month));
  let y = Math.min(2100, Math.max(2020, year));
  let d = Math.min(daysInMonth(m, y), Math.max(1, day));
  return { day: d, month: m, year: y };
}

function DatePickerModal({
  visible,
  title,
  initialIso,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  initialIso?: string | null;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
}) {
  const initial = isoToParts(initialIso);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  useEffect(() => {
    const next = isoToParts(initialIso);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
  }, [initialIso, visible]);

  const update = (nextDay: number, nextMonth: number, nextYear: number) => {
    const clamped = clampDateParts(nextDay, nextMonth, nextYear);
    setDay(clamped.day);
    setMonth(clamped.month);
    setYear(clamped.year);
  };

  const display = isoToNz(partsToIso(day, month, year));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalPreview}>{display}</Text>

          <View style={styles.pickerGrid}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Day</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => update(day + 1, month, year)}>
                <Feather name="chevron-up" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.spinValue}>{pad2(day)}</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => update(day - 1, month, year)}>
                <Feather name="chevron-down" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Month</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month + 1, year)}>
                <Feather name="chevron-up" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.spinValue}>{pad2(month)}</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month - 1, year)}>
                <Feather name="chevron-down" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Year</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month, year + 1)}>
                <Feather name="chevron-up" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.spinValue}>{year}</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month, year - 1)}>
                <Feather name="chevron-down" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => onConfirm(partsToIso(day, month, year))}>
              <Text style={styles.primaryBtnText}>Use Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
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
  const [pickerField, setPickerField] = useState<PickerField>(null);

  useEffect(() => {
    const today = new Date();
    setStartDate(partsToIso(today.getDate(), today.getMonth() + 1, today.getFullYear()));
  }, []);

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
    if (!cleanStart) {
      Alert.alert('Error', 'Project start date is required');
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

  const currentPickerIso = pickerField === 'start' ? startDate : targetEndDate;
  const currentPickerTitle = pickerField === 'start' ? 'Select Project Start' : 'Select Target Finish';

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
          <TouchableOpacity style={styles.inputLike} onPress={() => {}}>
            <Text style={[styles.inputLikeText, !name && styles.placeholderText]}>
              {name || 'Type project name below'}
            </Text>
          </TouchableOpacity>
          <View style={styles.inlineInputWrap}>
            <Text style={styles.miniLabel}>Name</Text>
            <TouchableOpacity style={styles.hiddenTouch} activeOpacity={1}>
              <View pointerEvents="none" />
            </TouchableOpacity>
          </View>
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
          <TouchableOpacity
            testID="project-start-date-input"
            style={styles.dateButton}
            onPress={() => setPickerField('start')}
          >
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.dateButtonText, !startDate && styles.placeholderText]}>
              {startDate ? isoToNz(startDate) : 'Select start date'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Target Finish</Text>
          <TouchableOpacity
            testID="project-target-end-date-input"
            style={styles.dateButton}
            onPress={() => setPickerField('target')}
          >
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.dateButtonText, !targetEndDate && styles.placeholderText]}>
              {targetEndDate ? isoToNz(targetEndDate) : 'Select target finish'}
            </Text>
          </TouchableOpacity>

          {targetEndDate ? (
            <TouchableOpacity style={styles.clearDateRow} onPress={() => setTargetEndDate('')}>
              <Feather name="x-circle" size={16} color={colors.textSecondary} />
              <Text style={styles.clearDateText}>Clear target finish</Text>
            </TouchableOpacity>
          ) : null}

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

      <DatePickerModal
        visible={pickerField !== null}
        title={currentPickerTitle}
        initialIso={currentPickerIso}
        onCancel={() => setPickerField(null)}
        onConfirm={(iso) => {
          if (pickerField === 'start') {
            setStartDate(iso);
            if (targetEndDate && targetEndDate < iso) {
              setTargetEndDate('');
            }
          } else if (pickerField === 'target') {
            setTargetEndDate(iso);
          }
          setPickerField(null);
        }}
      />
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
  inputLike: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.xs,
  },
  inputLikeText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  inlineInputWrap: { display: 'none' },
  miniLabel: { display: 'none' },
  hiddenTouch: { display: 'none' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  helper: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  clearDateRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearDateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
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
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalPreview: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  pickerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pickerCol: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  spinBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  spinValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});

