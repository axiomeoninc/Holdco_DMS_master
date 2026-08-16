import { toast } from 'sonner-native';

import { hapticError, hapticSuccess } from '@/lib/haptics';

export function toastSuccess(message: string): void {
  void hapticSuccess();
  toast.success(message);
}

export function toastError(message: string): void {
  void hapticError();
  toast.error(message);
}

export function toastInfo(message: string): void {
  toast(message);
}
