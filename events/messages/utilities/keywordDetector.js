import {
  getAllKeywords,
  updateKeywordUsage,
} from "../../../middleware/keywords.js";
//KeywordDetector
// Logs instances of each tracked keyword

const allKeywords = await getAllKeywords();

export const keywordDetector = (rawMessage) => {
  const messageCase = rawMessage.content.toLowerCase();

  allKeywords.forEach((row) => {
    if (messageCase.includes(row.keyword.toLowerCase())) {
      updateKeywordUsage(row.keyword, rawMessage.author.id, rawMessage.id);
    }
  });
};
