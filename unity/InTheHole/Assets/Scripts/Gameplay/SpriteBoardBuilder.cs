using System.Collections.Generic;
using InTheHole.Core;
using InTheHole.Data;
using UnityEngine;

namespace InTheHole.Gameplay
{
    public sealed class SpriteBoardBuilder : MonoBehaviour, IBoardBuilder
    {
        const int OrderTray = 0;
        const int OrderWood = 5;
        const int OrderHole = 12;
        const int OrderWall = 20;
        const int OrderFrame = 25;

        /// <summary>isometric PNG를 바닥(XZ)에 눕힘 — PNG 안의 사선 각도를 코드가 바꾸지 않음.</summary>
        static readonly Quaternion FloorRot = Quaternion.Euler(90f, 0f, 0f);

        Transform _root;

        public static void ResetStatics() => BoardSpriteUtil.ResetShaderCache();
        readonly Dictionary<string, GameObject> _glassObjects = new();
        readonly Dictionary<string, GameObject> _coloredObjects = new();
        readonly Dictionary<string, GameObject> _buttonObjects = new();

        public void Build(LevelDefinition level, GameSession session = null)
        {
            Clear(immediate: true);

            if (!SpriteCatalog.EnsureReady())
            {
                Debug.LogError("[SpriteBoardBuilder] Art missing. Menu: InTheHole → Ensure Game Art Imported");
                return;
            }

            var wood = SpriteCatalog.WoodA;
            if (wood == null || wood.texture == null)
            {
                Debug.LogError("[SpriteBoardBuilder] wood_a sprite invalid after EnsureReady.");
                return;
            }

            _root = new GameObject("BoardSprites").transform;
            _root.SetParent(transform, false);

            int n = level.Size;
            BoardLayout.SetActiveGrid(n);
            var ext = BoardLayout.BoardExtents(n);

            CreateWoodCells(n, level);
            CreateMintFrame(ext);

            int wallIdx = 0;
            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HWalls[r, c])
                    CreateWallH(r, c, n, wallIdx++);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VWalls[r, c])
                    CreateWallV(r, c, n, wallIdx++);

            int glassIdx = 0;
            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HGlass[r, c])
                    CreateGlassH(r, c, n, glassIdx++);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VGlass[r, c])
                    CreateGlassV(r, c, n, glassIdx++);

            int colorIdx = 0;
            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HColored[r, c] != null)
                    CreateColoredH(r, c, n, level.HColored[r, c], colorIdx++);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VColored[r, c] != null)
                    CreateColoredV(r, c, n, level.VColored[r, c], colorIdx++);

            if (level.Buttons != null && session != null)
            {
                foreach (var btn in level.Buttons)
                    CreateButton(btn.Row, btn.Col, n, session);
            }

            CameraFit.FitOrthographic(n);
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
                var sr = go.GetComponent<SpriteRenderer>();
                if (sr != null)
                    sr.color = new Color(0.45f, 0.1f, 0.1f, 1f);
            }
        }

        void CreateMintFrame(Vector3 ext)
        {
            var sp = SpriteCatalog.Frame;
            if (sp == null) return;

            float trayPad = 0.06f;
            float innerW = ext.x + trayPad * 2f;
            float innerD = ext.z + trayPad * 2f;
            float pad = BoardVisualConstants.MintFramePad;
            float outerW = innerW + pad * 2f;
            float outerD = innerD + pad * 2f;
            float t = BoardVisualConstants.MintBorderThickness;
            var tint = VisualPalette.FrameMint;

            float halfX = (outerW - t) * 0.5f;
            float halfZ = (outerD - t) * 0.5f;
            AddMintEdge(sp, "MintTop", 0f, halfZ, outerW, t, true, tint);
            AddMintEdge(sp, "MintBottom", 0f, -halfZ, outerW, t, true, tint);
            AddMintEdge(sp, "MintLeft", -halfX, 0f, t, outerD, false, tint);
            AddMintEdge(sp, "MintRight", halfX, 0f, t, outerD, false, tint);
        }

        void AddMintEdge(Sprite sp, string name, float x, float z, float length, float thickness,
            bool horizontal, Color tint)
        {
            AddSprite(name, sp, new Vector3(x, 0.002f, z),
                ScaleBar(sp, length, thickness, horizontal), OrderTray - 1, tint);
        }

        void CreateWoodTray(Vector3 ext)
        {
            float pad = 0.06f;
            float w = ext.x + pad * 2f;
            float d = ext.z + pad * 2f;
            AddSprite("WoodTray", SpriteCatalog.WoodB, new Vector3(0f, 0.008f, 0f),
                Scale(SpriteCatalog.WoodB, w, d), OrderTray, new Color(0.42f, 0.26f, 0.14f, 1f));
        }

        void CreateWoodCells(int n, LevelDefinition level)
        {
            float cell = BoardVisualConstants.CellSpriteSize;

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n; c++)
            {
                if (r == level.Hole.Row && c == level.Hole.Col)
                    CreateHole(r, c, n, cell);
                else
                {
                    var center = BoardLayout.CellCenter(r, c, n);
                    var sprite = (r + c) % 2 == 0 ? SpriteCatalog.WoodA : SpriteCatalog.WoodB;
                    AddSprite($"Cell_{r}_{c}", sprite, new Vector3(center.x, 0.032f, center.z),
                        ScaleUniform(sprite, cell), OrderWood);
                }
            }
        }

        void CreateHole(int row, int col, int gridSize, float cellSize)
        {
            var center = BoardLayout.CellCenter(row, col, gridSize);

            var vortex = new GameObject($"Hole_{row}_{col}").transform;
            vortex.SetParent(_root, false);
            vortex.localPosition = new Vector3(center.x, 0.036f, center.z);
            vortex.localRotation = FloorRot;
            var anim = vortex.gameObject.AddComponent<HoleVortexAnimator>();

            var ring = AddSpriteChild(vortex, "Ring", SpriteCatalog.HoleRing, Vector3.zero,
                ScaleUniform(SpriteCatalog.HoleRing, cellSize * 0.88f), OrderHole + 2);
            var ring2 = AddSpriteChild(vortex, "Ring2", SpriteCatalog.HoleRing, new Vector3(0.02f, 0f, 0f),
                ScaleUniform(SpriteCatalog.HoleRing, cellSize * 0.7f), OrderHole + 1, new Color(0.55f, 1f, 0.95f));
            anim.SetRings(ring, ring2);

            AddSpriteChild(vortex, "Core", SpriteCatalog.HoleCore, Vector3.zero,
                ScaleUniform(SpriteCatalog.HoleCore, cellSize * 0.45f), OrderHole);
        }

        void CreateWallH(int r, int c, int gridSize, int candyIndex) =>
            PlaceCandyWall(true, r, c, gridSize, candyIndex, $"WallH_{r}_{c}", OrderWall, null, null, null);

        void CreateWallV(int r, int c, int gridSize, int candyIndex) =>
            PlaceCandyWall(false, r, c, gridSize, candyIndex, $"WallV_{r}_{c}", OrderWall, null, null, null);

        public void HideBrokenGlass(IReadOnlyList<GlassEdge> broken)
        {
            foreach (var edge in broken)
            {
                var key = GlassKey(edge.IsHorizontal, edge.Row, edge.Col);
                if (_glassObjects.TryGetValue(key, out var go) && go != null)
                    go.SetActive(false);
            }
        }

        void CreateGlassH(int r, int c, int gridSize, int idx)
        {
            var key = GlassKey(true, r, c);
            PlaceCandyWall(true, r, c, gridSize, idx, key, OrderWall,
                new Color(0.55f, 0.9f, 1f, 0.85f), _glassObjects, key);
        }

        void CreateGlassV(int r, int c, int gridSize, int idx)
        {
            var key = GlassKey(false, r, c);
            PlaceCandyWall(false, r, c, gridSize, idx, key, OrderWall,
                new Color(0.55f, 0.9f, 1f, 0.85f), _glassObjects, key);
        }

        void CreateColoredH(int r, int c, int gridSize, string color, int idx)
        {
            var key = ColoredKey(true, r, c);
            PlaceCandyWall(true, r, c, gridSize, idx, key, OrderWall + 1,
                WallColor.ToUnityColor(color), _coloredObjects, key);
        }

        void CreateColoredV(int r, int c, int gridSize, string color, int idx)
        {
            var key = ColoredKey(false, r, c);
            PlaceCandyWall(false, r, c, gridSize, idx, key, OrderWall + 1,
                WallColor.ToUnityColor(color), _coloredObjects, key);
        }

        /// <summary>칸 사이 캔디 막대 1개 (reference2 — 겹침 없음).</summary>
        GameObject PlaceCandyWall(bool horizontal, int r, int c, int gridSize, int candyIndex,
            string baseName, int order, Color? tint,
            Dictionary<string, GameObject> registry, string registryKey)
        {
            var p = horizontal
                ? BoardLayout.WallHCenter(r, c, gridSize)
                : BoardLayout.WallVCenter(r, c, gridSize);

            var sp = SpriteCatalog.WallBar(horizontal, candyIndex);
            if (sp == null) return null;

            float length = BoardVisualConstants.CandyBarLength;
            float thickness = BoardVisualConstants.CandyBarThickness;
            var barScale = ScaleBar(sp, length, thickness, horizontal);

            var parent = new GameObject(baseName);
            parent.transform.SetParent(_root, false);
            parent.transform.localPosition = new Vector3(p.x, 0.10f, p.z);
            parent.transform.localRotation = FloorRot;

            SpawnWallPiece(parent.transform, baseName, sp, Vector3.zero, barScale, order, tint);

            if (registry != null && registryKey != null)
                registry[registryKey] = parent;
            return parent;
        }

        static void SpawnWallPiece(Transform parent, string name, Sprite sp, Vector3 localPos,
            Vector3 scale, int order, Color? tint)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = scale;
            var sr = go.AddComponent<SpriteRenderer>();
            BoardSpriteUtil.Apply(sr, sp, tint);
            sr.sortingOrder = order;
        }

        void CreateButton(int row, int col, int gridSize, GameSession session)
        {
            var p = BoardLayout.CellCenter(row, col, gridSize);
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = ButtonKey(row, col);
            go.transform.SetParent(_root, false);
            go.transform.localPosition = new Vector3(p.x, 0.12f, p.z);
            go.transform.localScale = new Vector3(0.32f, 0.05f, 0.32f);
            FlatMaterialFactory.ApplyFlat(go.GetComponent<Renderer>(), WallColor.ToUnityColor(WallColor.Red));
            var cell = go.AddComponent<ButtonCell>();
            cell.Init(session, row, col);
            _buttonObjects[ButtonKey(row, col)] = go;
        }

        static string GlassKey(bool isH, int r, int c) => isH ? $"GH_{r}_{c}" : $"GV_{r}_{c}";
        static string ColoredKey(bool isH, int r, int c) => isH ? $"CH_{r}_{c}" : $"CV_{r}_{c}";
        static string ButtonKey(int r, int c) => $"Btn_{r}_{c}";

        static Vector3 Scale(Sprite sprite, float worldX, float worldZ)
        {
            var b = sprite.bounds.size;
            return new Vector3(
                worldX / Mathf.Max(b.x, 0.001f),
                worldZ / Mathf.Max(b.y, 0.001f),
                1f);
        }

        /// <summary>정사각 스프라이트 비율 유지 (칸·구멍).</summary>
        static Vector3 ScaleUniform(Sprite sprite, float worldSize)
        {
            var b = sprite.bounds.size;
            float u = worldSize / Mathf.Max(b.x, b.y);
            return new Vector3(u, u, 1f);
        }

        /// <summary>캔디 벽·프레임 — 목표 길이·두께(world)에 맞게 비율 독립 스케일.</summary>
        static Vector3 ScaleBar(Sprite sprite, float length, float thickness, bool horizontal)
        {
            var b = sprite.bounds.size;
            if (horizontal)
                return new Vector3(length / Mathf.Max(b.x, 0.001f), thickness / Mathf.Max(b.y, 0.001f), 1f);
            return new Vector3(thickness / Mathf.Max(b.x, 0.001f), length / Mathf.Max(b.y, 0.001f), 1f);
        }

        SpriteRenderer AddSprite(string name, Sprite sprite, Vector3 localPos, Vector3 scale, int order,
            Color? tint = null, Quaternion? rot = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(_root, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = rot ?? FloorRot;
            go.transform.localScale = scale;

            var sr = go.AddComponent<SpriteRenderer>();
            BoardSpriteUtil.Apply(sr, sprite, tint);
            sr.sortingOrder = order;
            return sr;
        }

        static Transform AddSpriteChild(Transform parent, string name, Sprite sprite, Vector3 localPos,
            Vector3 scale, int order, Color? tint = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = scale;

            var sr = go.AddComponent<SpriteRenderer>();
            BoardSpriteUtil.Apply(sr, sprite, tint);
            sr.sortingOrder = order;
            return go.transform;
        }

        void Clear(bool immediate = false)
        {
            _glassObjects.Clear();
            _coloredObjects.Clear();
            _buttonObjects.Clear();
            if (_root == null) return;
            if (immediate && Application.isPlaying)
                DestroyImmediate(_root.gameObject);
            else if (Application.isPlaying)
                Destroy(_root.gameObject);
            else
                DestroyImmediate(_root.gameObject);
            _root = null;
        }

        void OnDestroy() => Clear();
    }
}
