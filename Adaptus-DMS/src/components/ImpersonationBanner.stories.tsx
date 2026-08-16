import type { Meta, StoryObj } from "@storybook/react";
import { ImpersonationBannerView } from "./ImpersonationBanner";

const meta = {
  title: "Gold/ImpersonationBanner",
  component: ImpersonationBannerView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onExit: () => undefined,
  },
} satisfies Meta<typeof ImpersonationBannerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Jordan Lee",
    email: "jordan.lee@novamotor.ca",
    showEmail: true,
  },
};

export const LongNameOverflow: Story = {
  args: {
    label:
      "Alexandria Maximilienne von Habsburg-Lorraine Dealership Support Proxy",
    email:
      "alexandria.maximilienne.von.habsburg-lorraine.support@very-long-dealership-domain.example.com",
    showEmail: true,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md border border-dashed border-border">
        <Story />
      </div>
    ),
  ],
};

export const Exiting: Story = {
  args: {
    label: "Jordan Lee",
    email: "jordan.lee@novamotor.ca",
    showEmail: true,
    exiting: true,
  },
};
