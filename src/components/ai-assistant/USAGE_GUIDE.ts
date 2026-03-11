/**
 * AI Assistant Components Usage Guide
 */

export const COMPARISON = {
  before: {
    lines: 40,
    readability: "Very Low ❌",
    maintainability: "Very Hard ❌",
    reusability: "Impossible ❌",
    testability: "Impossible ❌",
  },
  after: {
    lines: 15,
    readability: "Very High ✅",
    maintainability: "Very Easy ✅",
    reusability: "Very Easy ✅",
    testability: "Very Possible ✅",
  },
};

export const BENEFITS = [
  {
    title: "📦 Reusability",
    description:
      "You can use the same components in multiple pages without repeating code",
  },
  {
    title: "🔧 Ease of Maintenance",
    description:
      "Change colors/styles in one place only (assistantUIStyles.ts)",
  },
  {
    title: "📖 Clear Readability",
    description: "The code became easy to understand and read even for new developers",
  },
  {
    title: "✅ Ease of Testing",
    description: "Each component can be tested separately (Unit Tests)",
  },
  {
    title: "🎨 Consistency",
    description: "The same style and appearance in all places",
  },
  {
    title: "⚡ Performance",
    description: "Improve performance by reducing repeated code",
  },
];

export const TYPE_SAFETY = {
  description:
    "All components are written in TypeScript with full support for type checking",
  benefits: [
    "✅ Error detection at development time",
    "✅ IDE support (IntelliSense)",
    "✅ Automatic documentation for props",
    "✅ Prevent logic errors",
  ],
};

export const DOCUMENTATION = {
  componentsDirectory:
    "src/components/ai-assistant/ - All assistant components",
  constantsFile:
    "src/constants/assistantUIStyles.ts - All styles and colors",
  examples:
    "This file - Practical usage examples",
};

