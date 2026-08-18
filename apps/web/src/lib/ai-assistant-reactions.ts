import type { AiAssistantMode } from "./ai-assistant";

/**
 * Lottie state-machine events for the AI hero/avatar animation.
 * The animations live in `public/animations/ai-robo.lottie`
 * (state machine id: `StateMachine1`).
 *
 *  - `thinkClick`  → AI is currently generating a response
 *  - `yesClick`    → AI just gave a positive / normal-length answer
 *  - `noClick`     → AI gave a short denial / one-liner
 *  - `alertClick`  → error / failure keywords detected
 *  - `jumpClick`   → celebratory keywords in `student_agent` mode
 *
 * When no event is fired, the state machine plays its default "idle" state.
 */
export type AiReactionEvent =
  | "thinkClick"
  | "yesClick"
  | "noClick"
  | "alertClick"
  | "jumpClick";

/**
 * Pick a state-machine event based on the assistant's last reply.
 *
 * Heuristic — the Lottie state machine has discrete states
 * (idle / thinking / yes / no / alert / jump) and we map the latest
 * message onto one of them. Users can refine this later.
 */
export const pickReactionEvent = (
  content: string,
  currentMode: AiAssistantMode,
): AiReactionEvent => {
  const text = content.toLowerCase();

  // 1. Error / failure keywords → "alert" state (highest priority)
  const errorKeywords = [
    "error",
    "خطأ",
    "sorry",
    "عذراً",
    "عذرا",
    "i can't",
    "i cannot",
    "لا أستطيع",
    "لا يمكن",
    "فشل",
    "failed",
    "unable",
    "can't help",
    "cannot help",
    "لا أملك",
    "غير قادر",
    "timeout",
    "انتهت المهلة",
    "fatal",
    "crash",
    "panic",
    "exception",
  ];
  if (errorKeywords.some((k) => text.includes(k))) return "alertClick";

  // 2. Celebration keywords (student_agent mode only) → "jump" state.
  //    The student_agent gives study feedback, so a "correct!" / "أحسنت"
  //    reply deserves a celebratory animation, not a generic "yes".
  if (currentMode === "student_agent") {
    const celebrationKeywords = [
      "صحيح",
      "إجابة صحيحة",
      "إجابة سليمة",
      "بالضبط",
      "أحسنت",
      "ممتاز",
      "ممتازة",
      "correct",
      "well done",
      "exactly",
      "perfect",
      "great job",
      "nice work",
      "good job",
      "you got it",
      "that's right",
    ];
    if (celebrationKeywords.some((k) => text.includes(k))) {
      return "jumpClick";
    }
  }

  // 3. Very short replies (denials / "no"-style answers) → "no" state
  if (content.trim().length < 30) return "noClick";

  // 4. Default success → "yes" state
  return "yesClick";
};
