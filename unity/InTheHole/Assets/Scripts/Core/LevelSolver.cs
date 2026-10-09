using System.Collections.Generic;
using InTheHole.Data;

namespace InTheHole.Core
{
    public static class LevelSolver
    {
        public const int DefaultMaxMoves = 120;

        public sealed class SolveResult
        {
            public bool Solvable;
            public int OptimalMoves = -1;
        }

        public static SolveResult Analyze(LevelDefinition level, int maxMoves = DefaultMaxMoves) =>
            Analyze(level.HWalls, level.VWalls, level.Ball, level.Hole, maxMoves,
                level.HGlass, level.VGlass, level.HColored, level.VColored, level.Buttons);

        public static SolveResult Analyze(
            bool[,] hWalls, bool[,] vWalls, GridCoord ball, GridCoord hole, int maxMoves = DefaultMaxMoves,
            bool[,] hGlass = null, bool[,] vGlass = null,
            string[,] hColored = null, string[,] vColored = null,
            IReadOnlyList<ButtonDef> buttons = null)
        {
            if (TryFindSolution(hWalls, vWalls, ball, hole, out var moves, maxMoves, hGlass, vGlass,
                    hColored, vColored, buttons))
                return new SolveResult { Solvable = true, OptimalMoves = moves.Count };
            return new SolveResult { Solvable = false, OptimalMoves = -1 };
        }

        public static bool TryFindSolution(LevelDefinition level, out List<TiltDirection> moves, int maxMoves = DefaultMaxMoves) =>
            TryFindSolution(level.HWalls, level.VWalls, level.Ball, level.Hole, out moves, maxMoves,
                level.HGlass, level.VGlass, level.HColored, level.VColored, level.Buttons);

        public static bool TryFindSolutionFromState(GameSimulation fromState, out List<TiltDirection> moves, int maxMoves = DefaultMaxMoves) =>
            RunBfs(CloneSim(fromState), maxMoves, out moves, allowButton: true);

        /// <summary>색상벽 제거·버튼 없이 구멍 도달 가능 여부.</summary>
        public static bool IsClearableWithoutButton(LevelDefinition level, int maxMoves = DefaultMaxMoves)
        {
            var start = new GameSimulation();
            start.LoadFromLevel(level);
            start.SetAllowButtonActivation(false);
            return RunBfs(CloneSim(start), maxMoves, out _, allowButton: false);
        }

        /// <summary>버튼으로 색상벽을 없애야만 해결 가능한지 (클리어에 버튼 탭 자체는 필수 아님).</summary>
        public static bool NeedsColoredWallRemoval(LevelDefinition level, int maxMoves = DefaultMaxMoves) =>
            TryFindSolution(level, out _, maxMoves) && !IsClearableWithoutButton(level, maxMoves);

        public static bool TryFindSolution(
            bool[,] hWalls, bool[,] vWalls, GridCoord ball, GridCoord hole,
            out List<TiltDirection> moves, int maxMoves = DefaultMaxMoves,
            bool[,] hGlass = null, bool[,] vGlass = null,
            string[,] hColored = null, string[,] vColored = null,
            IReadOnlyList<ButtonDef> buttons = null)
        {
            var start = new GameSimulation();
            start.Load(hWalls, vWalls, ball, hole, hGlass, vGlass, hColored, vColored, buttons);
            return RunBfs(CloneSim(start), maxMoves, out moves, allowButton: true);
        }

        static bool RunBfs(GameSimulation start, int maxMoves, out List<TiltDirection> moves, bool allowButton)
        {
            moves = null;
            var visited = new HashSet<string>(512);
            var parent = new Dictionary<string, (string prev, TiltDirection? dir, bool wasPress)>(512);
            var queue = new Queue<(GameSimulation state, int depth)>(512);

            var startKey = start.StateKey();
            queue.Enqueue((start, 0));
            visited.Add(startKey);
            parent[startKey] = (null, null, false);

            int expanded = 0;
            const int expandCap = 300_000;

            while (queue.Count > 0)
            {
                var (state, depth) = queue.Dequeue();
                if (depth >= maxMoves)
                    continue;

                if (allowButton && TryExpandPress(state, depth, visited, parent, queue, ref expanded, expandCap, ref moves))
                    return moves != null && moves.Count >= 0;

                foreach (TiltDirection dir in System.Enum.GetValues(typeof(TiltDirection)))
                {
                    if (++expanded > expandCap)
                    {
                        moves = null;
                        return false;
                    }

                    var work = CloneSim(state);
                    work.SetAllowButtonActivation(allowButton);
                    var result = work.SimulateTilt(dir);
                    if (!result.Moved)
                        continue;

                    work.ApplyTiltResult(result);
                    var key = work.StateKey();

                    if (result.Won)
                    {
                        parent[key] = (state.StateKey(), dir, false);
                        moves = Reconstruct(parent, key);
                        return moves != null;
                    }

                    if (visited.Add(key))
                    {
                        parent[key] = (state.StateKey(), dir, false);
                        queue.Enqueue((work, depth + 1));
                    }
                }
            }

            return false;
        }

        static bool TryExpandPress(
            GameSimulation state, int depth,
            HashSet<string> visited,
            Dictionary<string, (string prev, TiltDirection? dir, bool wasPress)> parent,
            Queue<(GameSimulation state, int depth)> queue,
            ref int expanded, int expandCap,
            ref List<TiltDirection> moves)
        {
            if (!CanPressButton(state))
                return false;

            if (++expanded > expandCap)
            {
                moves = null;
                return true;
            }

            var work = CloneSim(state);
            if (!work.TryPressButton())
                return false;

            var key = work.StateKey();
            if (work.Won)
            {
                parent[key] = (state.StateKey(), null, true);
                moves = Reconstruct(parent, key);
                return true;
            }

            if (visited.Add(key))
            {
                parent[key] = (state.StateKey(), null, true);
                queue.Enqueue((work, depth + 1));
            }

            return false;
        }

        static bool CanPressButton(GameSimulation state)
        {
            if (state.Buttons == null)
                return false;

            foreach (var btn in state.Buttons)
            {
                if (btn.Row == state.Ball.Row && btn.Col == state.Ball.Col &&
                    !state.ActivatedColors.Contains(btn.Color))
                    return true;
            }

            return false;
        }

        static GameSimulation CloneSim(GameSimulation src)
        {
            var copy = new GameSimulation();
            copy.Load(src.HWalls, src.VWalls, src.Ball, src.Hole, src.HGlass, src.VGlass,
                src.HColored, src.VColored, src.Buttons);
            copy.CopyGlassStateFrom(src);
            copy.CopyColoredStateFrom(src);
            copy.SetAllowButtonActivation(src.AllowButtonActivation);
            return copy;
        }

        static List<TiltDirection> Reconstruct(
            Dictionary<string, (string prev, TiltDirection? dir, bool wasPress)> parent,
            string goal)
        {
            var tilts = new List<TiltDirection>();
            var cur = goal;
            while (parent.TryGetValue(cur, out var link) && link.prev != null)
            {
                if (link.dir.HasValue)
                    tilts.Add(link.dir.Value);
                cur = link.prev;
            }

            tilts.Reverse();
            return tilts;
        }
    }
}
