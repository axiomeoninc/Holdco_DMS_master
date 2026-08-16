import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button } from "./Button";

const meta = {
  title: "Gold/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function OpenDialog(props: {
  severity?: "danger" | "warning" | "info";
  title?: string;
  message?: string;
  detail?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[320px] bg-[hsl(210_25%_97%)] p-8">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Re-open dialog
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => setOpen(false)}
        severity={props.severity}
        title={props.title}
        message={props.message}
        detail={props.detail}
        confirmLabel={props.confirmLabel}
      />
    </div>
  );
}

export const Destructive: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
  },
  render: () => (
    <OpenDialog
      severity="danger"
      message="This vehicle will be permanently removed from inventory."
      detail="This action cannot be undone."
    />
  ),
};

export const Warning: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
  },
  render: () => (
    <OpenDialog
      severity="warning"
      message="Exit without saving your quotation changes?"
      detail="Unsaved line items will be lost."
      confirmLabel="Discard"
    />
  ),
};

export const Info: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
  },
  render: () => (
    <OpenDialog
      severity="info"
      title="Send invoice PDF?"
      message="The customer will receive the current invoice by email."
      confirmLabel="Send"
    />
  ),
};
