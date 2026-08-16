import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FormSheet } from '@/components/FormSheet';
import { useTheme } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { askFlashAi } from '@/lib/flashAi';
import type { FlashAiMessage } from '@/lib/types';

export function AskFlashButton() {
  const { tokens, palette } = useTheme();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<FlashAiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
  }

  async function send() {
    const content = input.trim();
    if (!content || busy) return;

    const nextMessages: FlashAiMessage[] = [
      ...messages,
      { role: 'user', content },
    ];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    setError(null);

    try {
      const reply = await askFlashAi(nextMessages);
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: reply.content },
      ]);
    } catch (err) {
      setError(errorMessage(err));
      setMessages(nextMessages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: pressed ? palette.primaryPressed : palette.primary,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Ask Flash AI"
      >
        <Text style={styles.buttonLabel}>Ask Flash AI</Text>
      </Pressable>

      <FormSheet visible={open} onClose={close}>
              <Text style={[styles.sheetTitle, { color: tokens.text }]}>
                Ask Flash AI
              </Text>
              <Text style={[styles.disclaimer, { color: tokens.textMuted }]}>
                Drafts never auto-send. Replies stay in this panel.
              </Text>

              <ScrollView
                style={styles.thread}
                contentContainerStyle={styles.threadContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.length === 0 ? (
                  <Text style={[styles.emptyThread, { color: tokens.textMuted }]}>
                    Ask about inventory, follow-ups, or desk workflow. No second
                    chatbot brand — this is Flash AI only.
                  </Text>
                ) : (
                  messages.map((msg, index) => (
                    <View
                      key={`${msg.role}-${index}`}
                      style={[
                        styles.bubble,
                        {
                          alignSelf:
                            msg.role === 'user' ? 'flex-end' : 'flex-start',
                          backgroundColor:
                            msg.role === 'user'
                              ? palette.primarySoft
                              : tokens.background,
                          borderColor: tokens.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleRole,
                          { color: tokens.textMuted },
                        ]}
                      >
                        {msg.role === 'user' ? 'You' : 'Flash AI'}
                      </Text>
                      <Text style={[styles.bubbleText, { color: tokens.text }]}>
                        {msg.content}
                      </Text>
                    </View>
                  ))
                )}
                {busy ? (
                  <ActivityIndicator
                    color={palette.primary}
                    style={styles.spinner}
                  />
                ) : null}
              </ScrollView>

              {error ? (
                <Text style={[styles.error, { color: tokens.danger }]}>
                  {error}
                </Text>
              ) : null}

              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Compose a question…"
                placeholderTextColor={tokens.textMuted}
                editable={!busy}
                multiline
                style={[
                  styles.input,
                  {
                    color: tokens.text,
                    borderColor: tokens.border,
                    backgroundColor: tokens.background,
                  },
                ]}
              />

              <View style={styles.actions}>
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [
                    styles.secondary,
                    {
                      borderColor: tokens.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryLabel, { color: tokens.text }]}>
                    Close
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void send();
                  }}
                  disabled={busy || input.trim().length === 0}
                  style={({ pressed }) => [
                    styles.primary,
                    {
                      backgroundColor:
                        busy || input.trim().length === 0
                          ? tokens.border
                          : pressed
                            ? palette.primaryPressed
                            : palette.primary,
                    },
                  ]}
                >
                  <Text style={styles.primaryLabel}>Ask</Text>
                </Pressable>
              </View>
      </FormSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  keyboard: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  disclaimer: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  thread: {
    maxHeight: 280,
    marginBottom: 8,
  },
  threadContent: {
    paddingBottom: 8,
    gap: 8,
  },
  emptyThread: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    maxWidth: '92%',
  },
  bubbleRole: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  spinner: {
    marginVertical: 8,
  },
  error: {
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 120,
    fontSize: 15,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  primary: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
