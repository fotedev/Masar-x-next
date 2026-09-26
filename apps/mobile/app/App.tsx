/**
 * Masar X mobile root (Expo SDK 51 + React Navigation v6).
 *
 * Provider stack: SafeAreaProvider > ThemeProvider > AuthProvider >
 * I18nProvider > SentryBoundary (spec 023 crash boundary), then
 * a NavigationContainer hosting the auth gate:
 *
 *   - status "loading"       -> minimal splash (no navigator mounted)
 *   - status "unconfigured"  -> clear "cannot reach Masar X" state with
 *                                a retry button (AuthContext.retry)
 *   - status "signedOut"     -> Login screen (email/password; Google
 *                                OAuth is deferred for v1 - spec US4 T046)
 *                                with SignUp pushed on the signed-out stack
 *                                (spec 019 C3)
 *   - status "authenticated" -> MainTabs (Subjects, Summaries, Quizzes,
 *                                AI, Profile) with QuizPlay pushed on the
 *                                root stack so the player covers the tabs.
 *
 * RTL (spec FR-008): I18nProvider applies I18nManager.allowRTL/forceRTL
 * from the effective locale; the root re-asserts it on direction change
 * so a cold start after a language flip keeps the requested direction.
 *
 * Mounted by index.js, which imports "./app/App" ("main": "index.js").
 */
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { I18nProvider, useI18n } from "../src/context/I18nContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import SentryBoundary from "../src/components/SentryBoundary";
import { darkColors, lightColors, type Palette } from "../src/lib/theme";
import AIAssistantScreen from "../src/screens/AIAssistantScreen";
import LoginScreen from "../src/screens/LoginScreen";
import NewsScreen from "../src/screens/NewsScreen";
import ProfileScreen from "../src/screens/ProfileScreen";
import QuizzesScreen from "../src/screens/QuizzesScreen";
import QuizPlayScreen from "../src/screens/QuizPlayScreen";
import QuizAttemptsScreen from "../src/screens/QuizAttemptsScreen";
import SubjectDetailScreen from "../src/screens/SubjectDetailScreen";
import SubjectsScreen from "../src/screens/SubjectsScreen";
import SummariesScreen from "../src/screens/SummariesScreen";
import SummaryDetailScreen from "../src/screens/SummaryDetailScreen";
import SignUpScreen from "../src/screens/SignUpScreen";

export type MainTabsParamList = {
  Subjects: undefined;
  Summaries: undefined;
  Quizzes: undefined;
  News: undefined;
  AI: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  MainTabs: undefined;
  QuizPlay: { quizId: string; title: string };
  QuizAttempts: undefined;
  SubjectDetail: { subjectName: string };
  SummaryDetail: { summaryId: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

function MainTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="Subjects" component={SubjectsScreen} options={{ title: t("mobile", "tabs.subjects") }} />
      <Tabs.Screen name="Summaries" component={SummariesScreen} options={{ title: t("mobile", "tabs.summaries") }} />
      <Tabs.Screen name="Quizzes" component={QuizzesScreen} options={{ title: t("mobile", "tabs.quizzes") }} />
      <Tabs.Screen name="News" component={NewsScreen} options={{ title: t("mobile", "tabs.news") }} />
      <Tabs.Screen name="AI" component={AIAssistantScreen} options={{ title: t("mobile", "tabs.ai") }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t("mobile", "tabs.profile") }} />
    </Tabs.Navigator>
  );
}

function UnconfiguredScreen() {
  const { retry } = useAuth();
  const { t } = useI18n();
  const { resolved } = useTheme();
  const styles = resolved === "dark" ? darkStyles : lightStyles;
  return (
    <View style={styles.center}>
      <Text style={styles.brand}>Masar X</Text>
      <Text style={styles.unconfiguredText}>{t("mobile", "offline.retryWhenOnline")}</Text>
      <Pressable style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryButtonText}>{t("mobile", "common.retry")}</Text>
      </Pressable>
    </View>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  const { isRTL } = useI18n();
  const { resolved, colors } = useTheme();
  const styles = resolved === "dark" ? darkStyles : lightStyles;

  // FR-008: keep layout direction in step with the effective locale
  // (a direction flip takes effect on the next cold start).
  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(isRTL);
  }, [isRTL]);

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === "unconfigured") {
    return <UnconfiguredScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator>
        {status === "authenticated" ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <RootStack.Screen
              name="QuizPlay"
              component={QuizPlayScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <RootStack.Screen
              name="QuizAttempts"
              component={QuizAttemptsScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <RootStack.Screen
              name="SubjectDetail"
              component={SubjectDetailScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <RootStack.Screen
              name="SummaryDetail"
              component={SummaryDetailScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
          </>
        ) : (
          <>
            <RootStack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <RootStack.Screen
              name="SignUp"
              component={SignUpScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            <SentryBoundary>
              <AppShell />
            </SentryBoundary>
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Scheme-aware status bar + navigator, inside the ThemeProvider. */
function AppShell() {
  const { resolved } = useTheme();
  return (
    <>
      <RootNavigator />
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
    </>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
      padding: 24,
    },
    brand: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.primary,
      marginBottom: 12,
    },
    unconfiguredText: {
      color: colors.ink,
      textAlign: "center",
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    retryButtonText: { color: colors.onPrimary, fontWeight: "700" },
  });

const lightStyles = createStyles(lightColors);
const darkStyles = createStyles(darkColors);