// Minimal NativeWind className typing.
// We deliberately do NOT reference nativewind/types globally: its 4.2
// augmentation narrows ScrollView props (drops `refreshing`) with newer
// React Native versions. Merging only `className` keeps full RN props.
import type { PressableProps, ScrollViewProps, TextProps, TextInputProps, ViewProps } from "react-native";

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
}
