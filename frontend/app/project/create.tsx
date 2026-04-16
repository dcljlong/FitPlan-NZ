import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../components/theme';
import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

export default function CreateProjectScreen() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [saturdayEnabled, setSaturdayEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const router = useRouter();
  const { userName, region, saturdayDefault } = useUser();

  useEffect(() => {
    setSaturdayEnabled(saturdayDefault);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setStartDate(`${yyyy}-${mm}-${dd}`);
    api.getTemplates().then(setTemplates).catch(console.error).finally(() => setTemplatesLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Please enter a valid date (YYYY-MM-DD)');
      return;
    }
    setLoading(true);
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        start_date: startDate,
        saturday_enabled: saturdayEnabled,
        location_region: region,
        template_id: selectedTemplate,
        created_by: userName,
      });
      router.replace(`/project/${project.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Project</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>CHOOSE A TEMPLATE</Text>
          {templatesLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
              <TouchableOpacity
                testID="template-blank"
                style={[styles.templateCard, !selectedTemplate && styles.templateCardActive]}
                onPress={() => setSelectedTemplate(null)}
              >
                <Feather name="file-plus" size={28} color={!selectedTemplate ? colors.primary : colors.textSecondary} />
                <Text style={[styles.templateName, !selectedTemplate && styles.templateNameActive]}>Blank</Text>
                <Text style={styles.templateDesc}>Start fresh</Text>
              </TouchableOpacity>
              {templates.map(t => (
                <TouchableOpacity
                  testID={`template-${t.id}`}
                  key={t.id}
                  style={[styles.templateCard, selectedTemplate === t.id && styles.templateCardActive]}
                  onPress={() => { setSelectedTemplate(t.id); if (!name) setName(t.name); }}
                >
                  <Feather name="layers" size={28} color={selectedTemplate === t.id ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.templateName, selectedTemplate === t.id && styles.templateNameActive]}>{t.name}</Text>
                  <Text style={styles.templateDesc}>{t.tasks?.length || 0} tasks</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>PROJECT DETAILS</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Project Name *</Text>
            <TextInput
              testID="project-name-input"
              style={styles.input}
              placeholder="e.g. Office Level 3 Fitout"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              testID="project-desc-input"
              style={[styles.input, styles.textArea]}
              placeholder="Brief description..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Start Date *</Text>
            <TextInput
              testID="project-start-date-input"
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              value={startDate}
              onChangeText={setStartDate}
              keyboardType="numbers-and-punctuation"
            />

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.label}>Saturday Work</Text>
                <Text style={styles.toggleHint}>6 hours per Saturday</Text>
              </View>
              <TouchableOpacity
                testID="saturday-toggle"
                style={[styles.toggle, saturdayEnabled && styles.toggleActive]}
                onPress={() => setSaturdayEnabled(!saturdayEnabled)}
              >
                <View style={[styles.toggleKnob, saturdayEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            testID="create-project-submit-btn"
            style={[styles.createBtn, loading && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.createBtnText}>Create Project</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  content: { padding: spacing.md, paddingBottom: 120 },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: spacing.xs },
  templateScroll: { marginBottom: spacing.sm },
  templateCard: {
    width: 140, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginRight: spacing.sm,
    borderWidth: 2, borderColor: colors.border, alignItems: 'center',
  },
  templateCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  templateName: { ...typography.h3, fontSize: 14, color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' },
  templateNameActive: { color: colors.primary },
  templateDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  formCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.subtle,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    height: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontSize: 16, color: colors.textPrimary, backgroundColor: colors.background,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  toggleHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  toggle: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: colors.border, justifyContent: 'center', padding: 2,
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleKnob: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', ...shadows.subtle,
  },
  toggleKnobActive: { alignSelf: 'flex-end' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, ...shadows.medium,
  },
  createBtn: {
    height: 52, backgroundColor: colors.primary, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  createBtnText: { fontSize: 17, fontWeight: '700', color: colors.primaryForeground },
});
