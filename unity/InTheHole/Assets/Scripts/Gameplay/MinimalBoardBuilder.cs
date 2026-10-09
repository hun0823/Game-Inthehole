using System.Collections.Generic;
using InTheHole.Core;
using InTheHole.Data;
using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>로직 분석용 — 단색 타일·벽·구멍·공 (스프라이트/텍스처 없음).
    /// </summary>
    public sealed class MinimalBoardBuilder : MonoBehaviour, IBoardBuilder
    {
        static readonly Color BgTray = new(0.22f, 0.24f, 0.30f);
        static readonly Color CellA = new(0.42f, 0.44f, 0.50f);
        static readonly Color CellB = new(0.36f, 0.38f, 0.44f);
        static readonly Color Frame = new(0.55f, 0.85f, 0.72f);
        static readonly Color Wall = new(0.90f, 0.35f, 0.35f);
        static readonly Color Glass = new(0.55f, 0.85f, 1f);
        static readonly Color ColoredWall = new(0.95f, 0.15f, 0.15f);
        static readonly Color Hole = new(0.15f, 0.75f, 0.45f);
        static readonly Color HoleRing = new(0.35f, 1f, 0.65f);

        Transform _root;
        readonly Dictionary<string, GameObject> _glassObjects = new();
        readonly Dictionary<string, GameObject> _coloredObjects = new();
        readonly Dictionary<string, GameObject> _buttonObjects = new();

        public void Build(LevelDefinition level, GameSession session = null)
        {
            Clear();
            _root = new GameObject("BoardMinimal").transform;
            _root.SetParent(transform, false);

            int n = level.Size;
            BoardLayout.SetActiveGrid(n);
            var ext = BoardLayout.BoardExtents(n);

            CreateTray(ext);
            CreateFrame(ext);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n; c++)
            {
                if (r == level.Hole.Row && c == level.Hole.Col)
                    CreateHole(r, c, n);
                else
                    CreateCell(r, c, n, (r + c) % 2 == 0);
            }

            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HWalls[r, c])
                    CreateWallH(r, c, n);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VWalls[r, c])
                    CreateWallV(r, c, n);

            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HGlass[r, c])
                    CreateGlassH(r, c, n);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VGlass[r, c])
                    CreateGlassV(r, c, n);

            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HColored[r, c] != null)
                    CreateColoredH(r, c, n, level.HColored[r, c]);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VColored[r, c] != null)
                    CreateColoredV(r, c, n, level.VColored[r, c]);

            if (level.Buttons != null && session != null)
            {
                foreach (var btn in level.Buttons)
                    CreateButton(btn.Row, btn.Col, n, session);
            }

            CameraFit.FitOrthographic(n, topDown: true);
        }

        public void HideColoredWalls(IReadOnlyList<ColoredEdge> removed)
        {
            foreach (var edge in removed)
            {
                var key = ColoredKey(edge.IsHorizontal, edge.Row, edge.Col);
                if (_coloredObjects.TryGetValue(key, out var go) && go != null)
                    go.SetActive(false);
            }
        }

        public void SetButtonPressed(int row, int col)
        {
            var key = ButtonKey(row, col);
            if (_buttonObjects.TryGetValue(key, out var go) && go != null)
            {
                var rend = go.GetComponent<Renderer>();
                if (rend != null)
                    FlatMaterialFactory.ApplyFlat(rend, new Color(0.4f, 0.1f, 0.1f));
            }
        }

        public void HideBrokenGlass(IReadOnlyList<GlassEdge> broken)
        {
            foreach (var edge in broken)
            {
                var key = GlassKey(edge.IsHorizontal, edge.Row, edge.Col);
                if (_glassObjects.TryGetValue(key, out var go) && go != null)
                    go.SetActive(false);
            }
        }

        void CreateTray(Vector3 ext)
        {
            CreateBox("Tray", Vector3.zero, new Vector3(ext.x + 0.5f, 0.04f, ext.z + 0.5f), BgTray);
        }

        void CreateFrame(Vector3 ext)
        {
            float hw = ext.x * 0.5f + BoardVisualConstants.BoardPad;
            float hd = ext.z * 0.5f + BoardVisualConstants.BoardPad;
            float t = 0.06f;
            CreateBox("F_N", new Vector3(0f, 0.05f, hd), new Vector3(hw * 2f + 0.3f, t, t), Frame);
            CreateBox("F_S", new Vector3(0f, 0.05f, -hd), new Vector3(hw * 2f + 0.3f, t, t), Frame);
            CreateBox("F_E", new Vector3(hw, 0.05f, 0f), new Vector3(t, t, hd * 2f + 0.3f), Frame);
            CreateBox("F_W", new Vector3(-hw, 0.05f, 0f), new Vector3(t, t, hd * 2f + 0.3f), Frame);
        }

        void CreateCell(int row, int col, int gridSize, bool alt)
        {
            var p = BoardLayout.CellCenter(row, col, gridSize);
            float s = BoardLayout.CellSize * 0.9f;
            CreateBox($"C_{row}_{col}", new Vector3(p.x, 0.06f, p.z), new Vector3(s, 0.05f, s), alt ? CellA : CellB);
        }

        void CreateHole(int row, int col, int gridSize)
        {
            var p = BoardLayout.CellCenter(row, col, gridSize);
            float s = BoardLayout.CellSize * 0.75f;
            CreateBox($"Hole_{row}_{col}", new Vector3(p.x, 0.05f, p.z), new Vector3(s, 0.06f, s), Hole);
            CreateCylinder($"HoleRing_{row}_{col}", new Vector3(p.x, 0.09f, p.z), new Vector3(s * 1.05f, 0.02f, s * 1.05f), HoleRing);
        }

        void CreateWallH(int r, int c, int gridSize)
        {
            var p = BoardLayout.WallHCenter(r, c, gridSize);
            CreateBox($"WH_{r}_{c}", new Vector3(p.x, 0.1f, p.z),
                new Vector3(BoardLayout.CellSize * 0.85f, 0.12f, 0.08f), Wall);
        }

        void CreateWallV(int r, int c, int gridSize)
        {
            var p = BoardLayout.WallVCenter(r, c, gridSize);
            CreateBox($"WV_{r}_{c}", new Vector3(p.x, 0.1f, p.z),
                new Vector3(0.08f, 0.12f, BoardLayout.CellSize * 0.85f), Wall);
        }

        void CreateGlassH(int r, int c, int gridSize)
        {
            var p = BoardLayout.WallHCenter(r, c, gridSize);
            var go = CreateBoxTracked(GlassKey(true, r, c), new Vector3(p.x, 0.11f, p.z),
                new Vector3(BoardLayout.CellSize * 0.85f, 0.08f, 0.06f), Glass);
            _glassObjects[GlassKey(true, r, c)] = go;
        }

        void CreateGlassV(int r, int c, int gridSize)
        {
            var p = BoardLayout.WallVCenter(r, c, gridSize);
            var go = CreateBoxTracked(GlassKey(false, r, c), new Vector3(p.x, 0.11f, p.z),
                new Vector3(0.06f, 0.08f, BoardLayout.CellSize * 0.85f), Glass);
            _glassObjects[GlassKey(false, r, c)] = go;
        }

        void CreateColoredH(int r, int c, int gridSize, string color)
        {
            var p = BoardLayout.WallHCenter(r, c, gridSize);
            var tint = WallColor.ToUnityColor(color);
            var go = CreateBoxTracked(ColoredKey(true, r, c), new Vector3(p.x, 0.115f, p.z),
                new Vector3(BoardLayout.CellSize * 0.82f, 0.1f, 0.1f), tint);
            _coloredObjects[ColoredKey(true, r, c)] = go;
        }

        void CreateColoredV(int r, int c, int gridSize, string color)
        {
            var p = BoardLayout.WallVCenter(r, c, gridSize);
            var tint = WallColor.ToUnityColor(color);
            var go = CreateBoxTracked(ColoredKey(false, r, c), new Vector3(p.x, 0.115f, p.z),
                new Vector3(0.1f, 0.1f, BoardLayout.CellSize * 0.82f), tint);
            _coloredObjects[ColoredKey(false, r, c)] = go;
        }

        void CreateButton(int row, int col, int gridSize, GameSession session)
        {
            var p = BoardLayout.CellCenter(row, col, gridSize);
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = ButtonKey(row, col);
            go.transform.SetParent(_root, false);
            go.transform.localPosition = new Vector3(p.x, 0.14f, p.z);
            go.transform.localScale = new Vector3(0.35f, 0.06f, 0.35f);
            FlatMaterialFactory.ApplyFlat(go.GetComponent<Renderer>(), ColoredWall);
            var cell = go.AddComponent<ButtonCell>();
            cell.Init(session, row, col);
            _buttonObjects[ButtonKey(row, col)] = go;
        }

        static string GlassKey(bool isH, int r, int c) => isH ? $"GH_{r}_{c}" : $"GV_{r}_{c}";
        static string ColoredKey(bool isH, int r, int c) => isH ? $"CH_{r}_{c}" : $"CV_{r}_{c}";
        static string ButtonKey(int r, int c) => $"Btn_{r}_{c}";

        GameObject CreateBoxTracked(string name, Vector3 pos, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(_root, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            Destroy(go.GetComponent<Collider>());
            FlatMaterialFactory.ApplyFlat(go.GetComponent<Renderer>(), color);
            return go;
        }

        void CreateBox(string name, Vector3 pos, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(_root, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            Destroy(go.GetComponent<Collider>());
            FlatMaterialFactory.ApplyFlat(go.GetComponent<Renderer>(), color);
        }

        void CreateCylinder(string name, Vector3 pos, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.SetParent(_root, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            Destroy(go.GetComponent<Collider>());
            FlatMaterialFactory.ApplyFlat(go.GetComponent<Renderer>(), color);
        }

        void Clear()
        {
            _glassObjects.Clear();
            _coloredObjects.Clear();
            _buttonObjects.Clear();
            if (_root != null)
                Destroy(_root.gameObject);
        }

        void OnDestroy() => Clear();
    }
}
