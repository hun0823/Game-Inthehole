using InTheHole.Core;
using InTheHole.Data;
using UnityEditor;
using UnityEngine;

namespace InTheHole.Editor
{
    public static class LevelValidationMenu
    {
        [MenuItem("InTheHole/Validate All Levels (BFS)")]
        static void ValidateAllLevels()
        {
            var levels = LevelDatabase.LoadAll();
            if (levels.Count == 0)
            {
                Debug.LogError("[InTheHole] No levels in Resources/Levels/levels.json");
                return;
            }

            int ok = 0;
            foreach (var lv in levels)
            {
                var r = LevelSolver.Analyze(lv);
                if (r.Solvable)
                {
                    ok++;
                    Debug.Log($"[OK] #{lv.Id} {lv.Name} ({lv.Size}×{lv.Size}) optimalMoves={r.OptimalMoves}");
                }
                else
                    Debug.LogError($"[FAIL] #{lv.Id} {lv.Name} — no solution within search limit");
            }

            Debug.Log($"[InTheHole] Validation done: {ok}/{levels.Count} solvable.");
        }
    }
}
