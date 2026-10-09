using System.Collections.Generic;
using UnityEngine;

namespace InTheHole.Services
{
    /// <summary>클리어·별 저장 (PlayerPrefs).</summary>
    public static class ProgressSave
    {
        const string ClearedKey = "inthehole_cleared";
        const string StarsPrefix = "inthehole_stars_";

        public static HashSet<int> GetCleared()
        {
            var raw = PlayerPrefs.GetString(ClearedKey, "");
            var set = new HashSet<int>();
            if (string.IsNullOrEmpty(raw)) return set;
            foreach (var part in raw.Split(','))
                if (int.TryParse(part, out int id))
                    set.Add(id);
            return set;
        }

        public static void MarkCleared(int stageId)
        {
            var set = GetCleared();
            if (!set.Add(stageId)) return;
            PlayerPrefs.SetString(ClearedKey, string.Join(",", set));
            PlayerPrefs.Save();
        }

        public static int GetStars(int stageId) =>
            PlayerPrefs.GetInt(StarsPrefix + stageId, 0);

        public static void SaveStars(int stageId, int stars)
        {
            if (stars <= 0) return;
            var prev = GetStars(stageId);
            if (stars <= prev) return;
            PlayerPrefs.SetInt(StarsPrefix + stageId, stars);
            PlayerPrefs.Save();
        }

        /// <summary>획득 별 합계 (HUD 왼쪽 배지용).</summary>
        public static int TotalStarsEarned(int maxStageId = 50)
        {
            int sum = 0;
            for (int id = 1; id <= maxStageId; id++)
                sum += GetStars(id);
            return sum;
        }
    }
}
