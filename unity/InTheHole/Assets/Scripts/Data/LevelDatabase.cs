using System.Collections.Generic;
using UnityEngine;

namespace InTheHole.Data
{
    public static class LevelDatabase
    {
        const string ResourcePath = "Levels/levels";

        public static IReadOnlyList<LevelDefinition> LoadAll()
        {
            var text = Resources.Load<TextAsset>(ResourcePath);
            if (text == null)
            {
                Debug.LogError($"[LevelDatabase] Missing Resources/{ResourcePath}.json");
                return new List<LevelDefinition>();
            }

            var file = JsonUtility.FromJson<LevelsFile>(text.text);
            if (file?.levels == null || file.levels.Count == 0)
            {
                Debug.LogError("[LevelDatabase] levels.json has no levels.");
                return new List<LevelDefinition>();
            }

            var list = new List<LevelDefinition>(file.levels.Count);
            foreach (var lv in file.levels)
            {
                if (lv?.ball == null || lv.hole == null)
                {
                    Debug.LogError($"[LevelDatabase] Level {lv?.id} missing ball or hole.");
                    continue;
                }
                list.Add(new LevelDefinition(lv));
            }
            return list;
        }
    }
}
