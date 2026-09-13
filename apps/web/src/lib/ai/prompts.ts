/**
 * Model-facing prompt fragments and persona naming (spec 004).
 *
 * These are instructions for the MODEL, not UI copy — they stay in code
 * (English/Arabic mix is deliberate prompt engineering). UI-facing strings
 * belong in packages/shared/src/messages.
 */

export const BREVITY_INSTRUCTION = `

إرشادات الإيجاز (مهم):
- كن مختصراً ومباشراً افتراضياً.
- لا تبدأ كل رد بتحية. ابدأ مباشرة بالإجابة.
- فقط إذا بدأ المستخدم بتحية (hi/hello/السلام عليكم/أهلاً) أو كانت أول رسالة في المحادثة: رد بتحية قصيرة مرة واحدة.
- إذا كانت رسالة المستخدم قصيرة جداً (مثل: hi / ok / ?) اسأل من 1 إلى 3 أسئلة توضيحية قصيرة كحد أقصى.
- لا تكتب ردود طويلة أو أمثلة إلا إذا طلب المستخدم ذلك أو كانت ضرورية لفهم الحل.
`;

export const ZANE_UI_INSTRUCTION = `
تعليمات واجهة تفاعلية (zane-ui) عند الحاجة (مهم):
- إذا احتجت توضيح قبل المتابعة، اسأل من 1 إلى 3 أسئلة قصيرة كحد أقصى.
- ثم أضف بلوك JSON واحد داخل كود بلوك بصيغة:
\n\n\`\`\`zane-ui
{"type":"buttons","title":"...","buttons":[{"label":"...","message":"..."}]}
\`\`\`
- اجعل الأزرار 2 إلى 4 فقط.
- قيمة message هي النص الذي سيتم إرساله عند الضغط.
- لا تضع أكثر من بلوك zane-ui واحد في الرد.
`;
