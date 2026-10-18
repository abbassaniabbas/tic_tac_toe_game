module.exports = {
  preset: "jest-expo",
  watchman: false,
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^@nexo/online$": "<rootDir>/../../packages/online/src/index.ts",
    "^@nexo/online/react$": "<rootDir>/../../packages/online/src/react.tsx",
    "^@nexo/engine$": "<rootDir>/../../packages/game-engine/src/index.ts",
    "^@nexo/shared$": "<rootDir>/../../packages/shared/src/index.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo/.*|react-native-svg|react-native-safe-area-context|@react-native-async-storage/async-storage)/)",
  ],
};
