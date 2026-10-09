using System;
using System.Collections.Generic;
using InTheHole.Core;

namespace InTheHole.Data
{
    [Serializable]
    public class IntPair
    {
        public int row;
        public int col;

        public GridCoord ToCoord() => new GridCoord(row, col);
    }

    [Serializable]
    public class ColoredEdgeJson
    {
        public int row;
        public int col;
        public string color;
    }

    [Serializable]
    public class ButtonJson
    {
        public int row;
        public int col;
        public string color;
    }

    [Serializable]
    public class LevelJson
    {
        public int id;
        public string name;
        public int size;
        /// <summary>BFS 최적 이동 수(기울임·버튼 탭). 0이면 런타임 분석.</summary>
        public int par;
        public List<IntPair> pillars = new List<IntPair>();
        public List<IntPair> glassH = new List<IntPair>();
        public List<IntPair> glassV = new List<IntPair>();
        public List<ColoredEdgeJson> coloredH = new List<ColoredEdgeJson>();
        public List<ColoredEdgeJson> coloredV = new List<ColoredEdgeJson>();
        public List<ButtonJson> buttons = new List<ButtonJson>();
        public IntPair ball;
        public IntPair hole;
    }

    [Serializable]
    public class LevelsFile
    {
        public int version;
        public List<LevelJson> levels = new List<LevelJson>();
    }

    public sealed class LevelDefinition
    {
        public int Id { get; }
        public string Name { get; }
        public int Size { get; }
        public bool[,] HWalls { get; }
        public bool[,] VWalls { get; }
        public bool[,] HGlass { get; }
        public bool[,] VGlass { get; }
        public string[,] HColored { get; }
        public string[,] VColored { get; }
        public IReadOnlyList<ButtonDef> Buttons { get; }
        public GridCoord Ball { get; }
        public GridCoord Hole { get; }
        public int ParMoves { get; }

        public LevelDefinition(LevelJson json)
        {
            Id = json.id;
            Name = json.name;
            Size = json.size;
            BuildWallsFromPillars(json, out var h, out var v);
            HWalls = h;
            VWalls = v;
            BuildGlass(json, out var gh, out var gv);
            HGlass = gh;
            VGlass = gv;
            BuildColored(json, out var ch, out var cv);
            HColored = ch;
            VColored = cv;
            Buttons = BuildButtons(json);
            Ball = json.ball.ToCoord();
            Hole = json.hole.ToCoord();
            ParMoves = json.par > 0 ? json.par : -1;
        }

        public static void BuildWallsFromPillars(LevelJson json, out bool[,] hWalls, out bool[,] vWalls)
        {
            int n = json.size;
            hWalls = new bool[n - 1, n];
            vWalls = new bool[n, n - 1];

            foreach (var p in json.pillars)
            {
                int r = p.row;
                int c = p.col;
                if (r > 0) hWalls[r - 1, c] = true;
                if (r < n - 1) hWalls[r, c] = true;
                if (c > 0) vWalls[r, c - 1] = true;
                if (c < n - 1) vWalls[r, c] = true;
            }
        }

        public static void BuildGlass(LevelJson json, out bool[,] hGlass, out bool[,] vGlass)
        {
            int n = json.size;
            hGlass = new bool[n - 1, n];
            vGlass = new bool[n, n - 1];

            if (json.glassH != null)
                foreach (var e in json.glassH)
                    hGlass[e.row, e.col] = true;

            if (json.glassV != null)
                foreach (var e in json.glassV)
                    vGlass[e.row, e.col] = true;
        }

        public static void BuildColored(LevelJson json, out string[,] hColored, out string[,] vColored)
        {
            int n = json.size;
            hColored = EmptyColorH(n);
            vColored = EmptyColorV(n);

            if (json.coloredH != null)
            {
                foreach (var e in json.coloredH)
                {
                    if (WallColor.IsValid(e.color))
                        hColored[e.row, e.col] = e.color;
                }
            }

            if (json.coloredV != null)
            {
                foreach (var e in json.coloredV)
                {
                    if (WallColor.IsValid(e.color))
                        vColored[e.row, e.col] = e.color;
                }
            }
        }

        static List<ButtonDef> BuildButtons(LevelJson json)
        {
            var list = new List<ButtonDef>();
            if (json.buttons == null)
                return list;

            foreach (var b in json.buttons)
            {
                if (WallColor.IsValid(b.color))
                    list.Add(new ButtonDef(b.row, b.col, b.color));
            }

            return list;
        }

        public static string[,] EmptyColorH(int n)
        {
            var a = new string[n - 1, n];
            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                a[r, c] = null;
            return a;
        }

        public static string[,] EmptyColorV(int n)
        {
            var a = new string[n, n - 1];
            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                a[r, c] = null;
            return a;
        }
    }
}
