import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

/**
 * Gold design tokens via globals.css (FlashFender #00AEEF primary, cool canvas).
 * Keep preview thin — stories/components owned elsewhere.
 */
const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "gold-canvas",
      values: [
        { name: "gold-canvas", value: "hsl(210 25% 97%)" },
        { name: "card", value: "#ffffff" },
        { name: "charcoal", value: "#1F2937" },
      ],
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
