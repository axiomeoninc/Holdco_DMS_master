import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import { Button } from "./Button";

const meta = {
  title: "Gold/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Save changes",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Premium: Story = {
  args: { variant: "premium", children: "Create deal" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

export const Loading: Story = {
  args: { variant: "primary", loading: true, children: "Saving…" },
};

export const WithIcons: Story = {
  args: {
    variant: "primary",
    leftIcon: <Plus className="h-4 w-4" />,
    children: "Add vehicle",
  },
};

export const FocusRing: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-2">
      <Button autoFocus variant="primary">
        Focused primary
      </Button>
      <Button autoFocus variant="outline">
        Focused outline
      </Button>
      <Button autoFocus variant="destructive">
        Focused destructive
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
};
