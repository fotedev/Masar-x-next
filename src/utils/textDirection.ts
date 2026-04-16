/**
 * Utility function to detect the visual direction of text based on its content.
 * It counts Arabic and English characters to determine if the text should be RTL or LTR.
 */
export const getTextDirection = (text: string): 'rtl' | 'ltr' => {
  if (!text) return 'ltr';
  
  const arabicRegex = /[\u0600-\u06FF]/g;
  const englishRegex = /[a-zA-Z]/g;
  
  const arabicMatch = text.match(arabicRegex);
  const englishMatch = text.match(englishRegex);
  
  const arabicCount = arabicMatch ? arabicMatch.length : 0;
  const englishCount = englishMatch ? englishMatch.length : 0;
  
  // If no matches, return default LTR
  if (arabicCount === 0 && englishCount === 0) return 'ltr';
  
  return arabicCount >= englishCount ? 'rtl' : 'ltr';
};
