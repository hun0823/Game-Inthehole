using System.Collections.Generic;
using InTheHole.Data;

namespace InTheHole.Core

{

    /// <summary>

    /// 웹 game.js 와 동일한 규칙 (엣지 벽, 슬라이드 이동, 유리벽 2타격).

    /// </summary>

    public sealed class GameSimulation

    {

        public int Size { get; private set; }

        public bool[,] HWalls { get; private set; }

        public bool[,] VWalls { get; private set; }

        public bool[,] HGlass { get; private set; }

        public bool[,] VGlass { get; private set; }

        public bool[,] HGlassStressed { get; private set; }

        public bool[,] VGlassStressed { get; private set; }

        public string[,] HColored { get; private set; }

        public string[,] VColored { get; private set; }

        public IReadOnlyList<ButtonDef> Buttons { get; private set; }

        public HashSet<string> ActivatedColors { get; } = new HashSet<string>();

        /// <summary>false면 버튼 탭·착지 자동 활성화 없음 (검증용).</summary>
        public bool AllowButtonActivation { get; private set; } = true;

        public GridCoord Ball { get; private set; }

        public GridCoord Hole { get; private set; }

        public int Moves { get; private set; }

        public bool Won { get; private set; }



        public void LoadFromLevel(LevelDefinition level) =>
            Load(level.HWalls, level.VWalls, level.Ball, level.Hole,
                level.HGlass, level.VGlass, level.HColored, level.VColored, level.Buttons);

        public void Load(

            bool[,] hWalls, bool[,] vWalls, GridCoord ball, GridCoord hole,

            bool[,] hGlass = null, bool[,] vGlass = null,

            string[,] hColored = null, string[,] vColored = null,

            IReadOnlyList<ButtonDef> buttons = null)

        {

            Size = hWalls.GetLength(1);

            HWalls = Clone(hWalls);

            VWalls = Clone(vWalls);

            HGlass = hGlass != null ? Clone(hGlass) : EmptyH(Size);

            VGlass = vGlass != null ? Clone(vGlass) : EmptyV(Size);

            HGlassStressed = EmptyH(Size);

            VGlassStressed = EmptyV(Size);

            HColored = hColored != null ? CloneColor(hColored) : LevelDefinition.EmptyColorH(Size);

            VColored = vColored != null ? CloneColor(vColored) : LevelDefinition.EmptyColorV(Size);

            Buttons = buttons ?? new List<ButtonDef>();

            ActivatedColors.Clear();

            AllowButtonActivation = true;

            Ball = ball;

            Hole = hole;

            Moves = 0;

            Won = false;

        }



        public void Reset(

            bool[,] hWalls, bool[,] vWalls, GridCoord ball, GridCoord hole,

            bool[,] hGlass = null, bool[,] vGlass = null,

            string[,] hColored = null, string[,] vColored = null,

            IReadOnlyList<ButtonDef> buttons = null) =>

            Load(hWalls, vWalls, ball, hole, hGlass, vGlass, hColored, vColored, buttons);



        public void CopyGlassStateFrom(GameSimulation other)

        {

            HGlass = Clone(other.HGlass);

            VGlass = Clone(other.VGlass);

            HGlassStressed = Clone(other.HGlassStressed);

            VGlassStressed = Clone(other.VGlassStressed);

        }

        public void CopyColoredStateFrom(GameSimulation other)

        {

            HColored = CloneColor(other.HColored);

            VColored = CloneColor(other.VColored);

            ActivatedColors.Clear();

            foreach (var c in other.ActivatedColors)

                ActivatedColors.Add(c);

        }



        /// <summary>기울임 적용 후 공 위치·턴 수·승리·유리 상태 동기화.</summary>

        public void ImportStateFrom(GameSimulation other)

        {

            Ball = other.Ball;

            Hole = other.Hole;

            Moves = other.Moves;

            Won = other.Won;

            CopyGlassStateFrom(other);

            CopyColoredStateFrom(other);

        }



        public string StateKey() =>

            $"{Ball.Row},{Ball.Col}|{GlassStateFingerprint()}|{ActivatedColorsFingerprint()}";

        string ActivatedColorsFingerprint()

        {

            if (ActivatedColors.Count == 0)

                return "";

            var list = new List<string>(ActivatedColors);

            list.Sort();

            return string.Join(",", list);

        }



        public string GlassStateFingerprint()

        {

            var parts = new List<string>();

            int hr = HGlass.GetLength(0);

            int hc = HGlass.GetLength(1);

            for (int r = 0; r < hr; r++)

            for (int c = 0; c < hc; c++)

            {

                if (HGlass[r, c])

                    parts.Add($"H{r},{c}:{(HGlassStressed[r, c] ? 1 : 0)}");

            }

            int vr = VGlass.GetLength(0);

            int vc = VGlass.GetLength(1);

            for (int r = 0; r < vr; r++)

            for (int c = 0; c < vc; c++)

            {

                if (VGlass[r, c])

                    parts.Add($"V{r},{c}:{(VGlassStressed[r, c] ? 1 : 0)}");

            }

            return string.Join(";", parts);

        }



        public bool IsHole(int r, int c) => r == Hole.Row && c == Hole.Col;

        public bool IsSolidBlocked(int r, int c, TiltDirection direction)

        {

            if (IsPillarBlocked(r, c, direction))

                return true;

            return IsColoredBlocked(r, c, direction);

        }

        bool IsPillarBlocked(int r, int c, TiltDirection direction)

        {

            GetDelta(direction, out int dr, out int dc);

            int nr = r + dr;

            int nc = c + dc;

            if (nr < 0 || nc < 0 || nr >= Size || nc >= Size)

                return true;

            switch (direction)

            {

                case TiltDirection.Right: return VWalls[r, c];

                case TiltDirection.Left: return VWalls[r, nc];

                case TiltDirection.Down: return HWalls[r, c];

                case TiltDirection.Up: return HWalls[nr, c];

                default: return true;

            }

        }

        bool IsColoredBlocked(int r, int c, TiltDirection direction)

        {

            if (!TryGetColoredEdge(r, c, direction, out var color))

                return false;

            return !ActivatedColors.Contains(color);

        }

        bool TryGetColoredEdge(int r, int c, TiltDirection direction, out string color)

        {

            color = null;

            GetDelta(direction, out int dr, out int dc);

            int nr = r + dr;

            int nc = c + dc;

            if (nr < 0 || nc < 0 || nr >= Size || nc >= Size)

                return false;

            switch (direction)

            {

                case TiltDirection.Right:

                    color = VColored[r, c];

                    return color != null;

                case TiltDirection.Left:

                    color = VColored[r, nc];

                    return color != null;

                case TiltDirection.Down:

                    color = HColored[r, c];

                    return color != null;

                case TiltDirection.Up:

                    color = HColored[nr, c];

                    return color != null;

                default:

                    return false;

            }

        }



        /// <summary>이동 방향의 칸 경계에 유리벽이 있는지 (깨진 벽 제외).</summary>

        public bool TryGetGlassEdge(int r, int c, TiltDirection direction, out bool isHorizontal, out int er, out int ec)

        {

            isHorizontal = false;

            er = ec = 0;

            GetDelta(direction, out int dr, out int dc);

            int nr = r + dr;

            int nc = c + dc;

            if (nr < 0 || nc < 0 || nr >= Size || nc >= Size)

                return false;



            switch (direction)

            {

                case TiltDirection.Right:

                    if (!VGlass[r, c]) return false;

                    isHorizontal = false;

                    er = r;

                    ec = c;

                    return true;

                case TiltDirection.Left:

                    if (!VGlass[r, nc]) return false;

                    isHorizontal = false;

                    er = r;

                    ec = nc;

                    return true;

                case TiltDirection.Down:

                    if (!HGlass[r, c]) return false;

                    isHorizontal = true;

                    er = r;

                    ec = c;

                    return true;

                case TiltDirection.Up:

                    if (!HGlass[nr, c]) return false;

                    isHorizontal = true;

                    er = nr;

                    ec = c;

                    return true;

                default:

                    return false;

            }

        }



        public bool IsBlocked(int r, int c, TiltDirection direction) =>

            IsSolidBlocked(r, c, direction) ||

            TryGetGlassEdge(r, c, direction, out _, out _, out _);



        public TiltSimulationResult SimulateTilt(TiltDirection direction)

        {

            var result = new TiltSimulationResult();

            result.Path.Add(Ball);



            if (Won)

            {

                result.Moved = false;

                result.Won = true;

                return result;

            }



            GetDelta(direction, out int dr, out int dc);

            int r = Ball.Row;

            int c = Ball.Col;

            TryActivateButtonAtCell(r, c, result);

            while (true)

            {

                if (IsSolidBlocked(r, c, direction))

                    break;



                if (TryGetGlassEdge(r, c, direction, out bool isH, out int er, out int ec))

                {

                    if (isH)

                    {

                        if (HGlassStressed[er, ec])

                        {

                            HGlass[er, ec] = false;

                            HGlassStressed[er, ec] = false;

                            result.GlassBroken.Add(new GlassEdge(true, er, ec));

                        }

                        else

                        {

                            HGlassStressed[er, ec] = true;
                            result.GlassStressed.Add(new GlassEdge(true, er, ec));
                            result.Moved = true;
                            break;

                        }

                    }

                    else

                    {

                        if (VGlassStressed[er, ec])

                        {

                            VGlass[er, ec] = false;

                            VGlassStressed[er, ec] = false;

                            result.GlassBroken.Add(new GlassEdge(false, er, ec));

                        }

                        else

                        {

                            VGlassStressed[er, ec] = true;
                            result.GlassStressed.Add(new GlassEdge(false, er, ec));
                            result.Moved = true;
                            break;

                        }

                    }

                }



                r += dr;

                c += dc;

                result.Path.Add(new GridCoord(r, c));

                result.Moved = true;

                TryActivateButtonAtCell(r, c, result);

                if (IsHole(r, c))

                {

                    result.Won = true;

                    return result;

                }

            }



            return result;

        }



        public void ApplyTiltResult(TiltSimulationResult result)

        {

            var spent = false;

            if (result.Moved)
            {
                if (result.Path.Count > 1)
                    Ball = result.Path[result.Path.Count - 1];
                spent = true;
            }

            if (TryActivateButtonsOnPath(result))
                spent = true;

            if (spent)
                Moves++;

            if (result.Won)
                Won = true;

        }

        /// <summary>공이 버튼 칸에 있을 때 탭 — 기울임 없이 색상 벽 제거.</summary>

        public bool TryPressButton(TiltSimulationResult into = null)

        {

            if (Won)
                return false;

            var result = into ?? new TiltSimulationResult();

            if (!TryActivateButtonAtCell(Ball.Row, Ball.Col, result))
                return false;

            Moves++;

            if (IsHole(Ball.Row, Ball.Col))
                Won = true;

            return true;

        }

        public void SetAllowButtonActivation(bool allow) => AllowButtonActivation = allow;

        bool TryActivateButtonsOnPath(TiltSimulationResult result)

        {

            var any = false;

            foreach (var cell in result.Path)

            {
                if (TryActivateButtonAtCell(cell.Row, cell.Col, result))
                    any = true;
            }

            return any;

        }

        bool TryActivateButtonAtCell(int row, int col, TiltSimulationResult result)

        {

            if (!AllowButtonActivation)
                return false;

            if (Buttons == null || Buttons.Count == 0)
                return false;

            foreach (var btn in Buttons)
            {
                if (btn.Row != row || btn.Col != col)
                    continue;

                if (ActivatedColors.Contains(btn.Color))
                    continue;

                ActivatedColors.Add(btn.Color);
                RemoveColoredWalls(btn.Color, result);

                if (result != null)
                {
                    result.ButtonColorActivated = btn.Color;
                    result.Moved = true;
                }

                return true;
            }

            return false;

        }

        void RemoveColoredWalls(string color, TiltSimulationResult result)

        {

            for (int r = 0; r < HColored.GetLength(0); r++)
            for (int c = 0; c < HColored.GetLength(1); c++)
            {
                if (HColored[r, c] == color)
                {
                    HColored[r, c] = null;
                    result?.ColoredRemoved.Add(new ColoredEdge(true, r, c, color));
                }
            }

            for (int r = 0; r < VColored.GetLength(0); r++)
            for (int c = 0; c < VColored.GetLength(1); c++)
            {
                if (VColored[r, c] == color)
                {
                    VColored[r, c] = null;
                    result?.ColoredRemoved.Add(new ColoredEdge(false, r, c, color));
                }
            }

        }



        static bool[,] EmptyH(int n) => new bool[n - 1, n];

        static bool[,] EmptyV(int n) => new bool[n, n - 1];



        static void GetDelta(TiltDirection direction, out int dr, out int dc)

        {

            switch (direction)

            {

                case TiltDirection.Up: dr = -1; dc = 0; break;

                case TiltDirection.Down: dr = 1; dc = 0; break;

                case TiltDirection.Left: dr = 0; dc = -1; break;

                default: dr = 0; dc = 1; break;

            }

        }



        static bool[,] Clone(bool[,] src)

        {

            int r = src.GetLength(0);

            int c = src.GetLength(1);

            var copy = new bool[r, c];

            for (int i = 0; i < r; i++)

            for (int j = 0; j < c; j++)

                copy[i, j] = src[i, j];

            return copy;

        }

        static string[,] CloneColor(string[,] src)

        {

            int r = src.GetLength(0);

            int c = src.GetLength(1);

            var copy = new string[r, c];

            for (int i = 0; i < r; i++)

            for (int j = 0; j < c; j++)

                copy[i, j] = src[i, j];

            return copy;

        }

    }



    public readonly struct GlassEdge

    {

        public bool IsHorizontal { get; }

        public int Row { get; }

        public int Col { get; }



        public GlassEdge(bool isHorizontal, int row, int col)

        {

            IsHorizontal = isHorizontal;

            Row = row;

            Col = col;

        }

    }

}

