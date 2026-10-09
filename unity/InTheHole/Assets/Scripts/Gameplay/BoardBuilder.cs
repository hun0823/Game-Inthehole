using InTheHole.Data;
using UnityEngine;

namespace InTheHole.Gameplay
{
    public sealed class BoardBuilder : MonoBehaviour
    {
        public const float BoardPad = 0.42f;

        const float TileThickness = 0.11f;
        const float WallHeight = 0.22f;
        const float WallThick = 0.13f;
        const float FrameH = 0.14f;

        public static float BallHeight => TileThickness + 0.2f;
        public static float BallScale => BoardLayout.CellSize * 0.68f;

        Transform _root;

        public void Build(LevelDefinition level)
        {
            Clear();
            _root = new GameObject("BoardVisual").transform;
            _root.SetParent(transform, false);

            int n = level.Size;
            BoardLayout.SetActiveGrid(n);
            var ext = BoardLayout.BoardExtents(n);

            CreateSceneDecor(ext);
            CreateBoardPlate(ext);
            CreateFrame(ext);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n; c++)
            {
                if (r == level.Hole.Row && c == level.Hole.Col)
                    CreateHole(r, c, n);
                else
                    CreateCell(r, c, n);
            }

            int wallIdx = 0;
            for (int r = 0; r < n - 1; r++)
            for (int c = 0; c < n; c++)
                if (level.HWalls[r, c])
                    CreateWallH(r, c, n, wallIdx++);

            for (int r = 0; r < n; r++)
            for (int c = 0; c < n - 1; c++)
                if (level.VWalls[r, c])
                    CreateWallV(r, c, n, wallIdx++);

            CameraFit.FitOrthographic(n);
        }

        void CreateSceneDecor(Vector3 ext)
        {
            CreateBox("BackdropGlow", 0f, -0.14f, 0f,
                new Vector3(ext.x + 1.6f, 0.04f, ext.z + 1.2f), VisualPalette.BackdropGlow);
            CreateBox("FloorShadow", 0f, 0.012f, 0.06f,
                new Vector3(ext.x * 0.95f, 0.025f, ext.z * 0.45f), VisualPalette.FloorShadow);
        }

        void CreateBoardPlate(Vector3 ext)
        {
            float w = ext.x + BoardPad * 2f;
            float d = ext.z + BoardPad * 2f;
            float y = TileThickness * 0.35f;

            CreateBox("BoardShadow", 0f, y - 0.08f, 0.02f,
                new Vector3(w + 0.08f, 0.06f, d + 0.08f), VisualPalette.FrameMintShadow);
            CreateBox("BoardWood", 0f, y, 0f, new Vector3(w * 0.96f, 0.07f, d * 0.96f), VisualPalette.WoodMid);
            CreateBox("BoardWoodTop", 0f, y + 0.035f, 0f,
                new Vector3(w * 0.92f, 0.03f, d * 0.92f), VisualPalette.WoodLight);
        }

        void CreateFrame(Vector3 ext)
        {
            float halfW = ext.x * 0.5f + BoardPad;
            float halfD = ext.z * 0.5f + BoardPad;
            float y = TileThickness * 0.68f;
            float t = FrameH;

            CreateBox("FrameN", 0f, y, halfD, new Vector3(halfW * 2f, t, t), VisualPalette.FrameMint);
            CreateBox("FrameS", 0f, y, -halfD, new Vector3(halfW * 2f, t * 0.85f, t * 0.85f), VisualPalette.FrameMintDark);
            CreateBox("FrameE", halfW, y, 0f, new Vector3(t, t, halfD * 2f), VisualPalette.FrameMint);
            CreateBox("FrameW", -halfW, y, 0f, new Vector3(t, t, halfD * 2f), VisualPalette.FrameMintDark);
            CreateBox("FrameBevel", 0f, y + t * 0.45f, 0f,
                new Vector3(halfW * 2f - t, t * 0.25f, halfD * 2f - t), VisualPalette.FrameMintDark);
        }

        void CreateCell(int row, int col, int gridSize)
        {
            var center = BoardLayout.CellCenter(row, col, gridSize);
            float s = BoardLayout.CellSize * 0.82f;
            bool alt = (row + col) % 2 == 0;
            float y = TileThickness * 0.58f;

            var dark = alt ? VisualPalette.WoodDark : VisualPalette.WoodGrain;
            var light = alt ? VisualPalette.WoodMid : VisualPalette.WoodLight;

            CreateBox($"Cell_{row}_{col}", center.x, y, center.z, new Vector3(s, TileThickness, s), dark);
            CreateBox($"CellTop_{row}_{col}", center.x, y + TileThickness * 0.36f, center.z,
                new Vector3(s * 0.9f, TileThickness * 0.3f, s * 0.9f), light);
        }

        void CreateHole(int row, int col, int gridSize)
        {
            var center = BoardLayout.CellCenter(row, col, gridSize);
            float s = BoardLayout.CellSize * 0.82f;
            float surfaceY = TileThickness * 0.6f;

            var vortexRoot = new GameObject($"HoleVortex_{row}_{col}").transform;
            vortexRoot.SetParent(_root, false);
            vortexRoot.localPosition = new Vector3(center.x, surfaceY, center.z);
            var animator = vortexRoot.gameObject.AddComponent<HoleVortexAnimator>();

            CreateBox($"HoleDeck_{row}_{col}", center.x, surfaceY - 0.02f, center.z,
                new Vector3(s * 1.02f, TileThickness * 0.3f, s * 1.02f), VisualPalette.WoodGrain);

            var ringA = CreateCylinderChild(vortexRoot, "RingA", Vector3.zero,
                new Vector3(s * 1.05f, 0.035f, s * 1.05f), VisualPalette.HoleVortexA, MaterialStyle.Glow);
            var ringB = CreateCylinderChild(vortexRoot, "RingB", new Vector3(0f, 0.02f, 0f),
                new Vector3(s * 0.88f, 0.03f, s * 0.88f), VisualPalette.HoleVortexB, MaterialStyle.Glow);
            animator.SetRings(ringA, ringB);

            CreateCylinderChild(vortexRoot, "Well", new Vector3(0f, -0.06f, 0f),
                new Vector3(s * 0.55f, 0.14f, s * 0.55f), VisualPalette.HoleVortexB, MaterialStyle.Glow);
            CreateCylinderChild(vortexRoot, "Deep", new Vector3(0f, -0.1f, 0f),
                new Vector3(s * 0.38f, 0.18f, s * 0.38f), VisualPalette.Hole, MaterialStyle.Hole);
            CreateCylinderChild(vortexRoot, "Core", new Vector3(0f, -0.14f, 0f),
                new Vector3(s * 0.22f, 0.12f, s * 0.22f), VisualPalette.HoleDeep, MaterialStyle.Hole);
        }

        void CreateWallH(int r, int c, int gridSize, int candyIndex)
        {
            var p = BoardLayout.WallHCenter(r, c, gridSize);
            CreateWallBar(p.x, p.z, new Vector3(BoardLayout.CellSize * 0.88f, WallHeight, WallThick), true, candyIndex);
        }

        void CreateWallV(int r, int c, int gridSize, int candyIndex)
        {
            var p = BoardLayout.WallVCenter(r, c, gridSize);
            CreateWallBar(p.x, p.z, new Vector3(WallThick, WallHeight, BoardLayout.CellSize * 0.88f), false, candyIndex);
        }

        void CreateWallBar(float x, float z, Vector3 scale, bool horizontal, int candyIndex)
        {
            var color = VisualPalette.WallCandy(candyIndex);
            var shade = Color.Lerp(color, Color.black, 0.28f);
            var highlight = Color.Lerp(color, Color.white, 0.35f);

            var root = new GameObject(horizontal ? "WallH" : "WallV").transform;
            root.SetParent(_root, false);
            root.localPosition = new Vector3(x, WallHeight * 0.5f + TileThickness * 0.48f, z);

            float capH = scale.y * 0.36f;
            float bodyH = scale.y - capH;
            var bodyScale = new Vector3(scale.x, bodyH, scale.z);
            var capScale = new Vector3(scale.x * 0.92f, capH, scale.z * 1.08f);

            AddCube(root, "Body", new Vector3(0f, -capH * 0.5f, 0f), bodyScale, shade);
            AddCube(root, "Face", Vector3.zero, new Vector3(bodyScale.x * 0.94f, bodyH * 0.96f, bodyScale.z * 0.94f), color);
            AddCube(root, "Cap", new Vector3(0f, bodyH * 0.5f + capH * 0.5f, 0f), capScale, highlight);
        }

        static Transform CreateCylinderChild(Transform parent, string name, Vector3 localPos, Vector3 scale, Color color, MaterialStyle style)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            Object.Destroy(go.GetComponent<Collider>());
            FlatMaterialFactory.Apply(go.GetComponent<Renderer>(), color, style);
            return go.transform;
        }

        static void AddCube(Transform parent, string name, Vector3 localPos, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            Object.Destroy(go.GetComponent<Collider>());
            FlatMaterialFactory.Apply(go.GetComponent<Renderer>(), color, MaterialStyle.Matte);
        }

        void CreateBox(string name, float x, float y, float z, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(_root, false);
            go.transform.localPosition = new Vector3(x, y, z);
            go.transform.localScale = scale;
            Object.Destroy(go.GetComponent<Collider>());
            FlatMaterialFactory.Apply(go.GetComponent<Renderer>(), color, MaterialStyle.Matte);
        }

        void Clear()
        {
            if (_root != null)
                Destroy(_root.gameObject);
        }

        void OnDestroy() => Clear();
    }
}
