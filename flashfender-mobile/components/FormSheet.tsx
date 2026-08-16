import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/components/ui';

type FormSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Keyboard-safe bottom sheet. Android resizes via softwareKeyboardLayoutMode
 * plus KeyboardAwareScrollView so focused fields stay above the IME.
 */
export function FormSheet({ visible, onClose, children }: FormSheetProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <KeyboardAwareScrollView
          bottomOffset={32}
          extraKeyboardSpace={24}
          keyboardShouldPersistTaps="handled"
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
            },
          ]}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {children}
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
