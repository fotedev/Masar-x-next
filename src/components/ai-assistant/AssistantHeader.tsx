import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";
import {
  ASSISTANT_HEADER,
  ASSISTANT_AVATAR,
  ASSISTANT_TITLE,
  ASSISTANT_CONTROLS_CONTAINER,
} from "@/constants/assistantUIStyles";

interface AssistantHeaderProps {
  title: string;
  isOnline?: boolean;
  subtitle?: string;
  children?: ReactNode;
}

export function AssistantHeader({
  title,
  isOnline = true,
  subtitle,
  children,
}: AssistantHeaderProps) {
  const t = useTranslations("assistant");
  const defaultSubtitle = subtitle ?? t("responseFromPlatform");
  return (
    <div className={ASSISTANT_HEADER.container}>
      <div className={ASSISTANT_HEADER.leftSection}>
        <div className={ASSISTANT_AVATAR.container}>
          <Bot className={ASSISTANT_AVATAR.icon} />
        </div>

        {/* Title & Status */}
        <div className={ASSISTANT_TITLE.container}>
          {/* Main Title */}
          <h1 className={ASSISTANT_TITLE.heading}>{title}</h1>

          {/* Status Badge */}
          <div className={ASSISTANT_TITLE.statusBadge}>
            {/* Online Indicator */}
            {isOnline && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className={ASSISTANT_TITLE.statusDot}></span>
                  <span className={ASSISTANT_TITLE.statusDotStatic}></span>
                </span>
              </>
            )}
            <span className={ASSISTANT_TITLE.statusText}>{defaultSubtitle}</span>
          </div>
        </div>
      </div>

      {children && (
        <div className={ASSISTANT_CONTROLS_CONTAINER.wrapper}>{children}</div>
      )}
    </div>
  );
}

export default AssistantHeader;
