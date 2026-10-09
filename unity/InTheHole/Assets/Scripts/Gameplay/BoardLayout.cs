using UnityEngine;

namespace InTheHole.Gameplay
{
    public static class BoardLayout
    {
        public const float CellSize = 1.05f;
        /// <summary>칸 사이 간격 — 바둑판 타일이 맞닿도록 최소화.</summary>
        public const float Gap = 0.02f;

        /// <summary>마지막 Build() 기준 그리드 크기 — 공·카메라가 중앙 좌표계를 쓰도록.</summary>
        public static int ActiveGridSize { get; private set; }

        public static float Step => CellSize + Gap;

        public static void SetActiveGrid(int size) => ActiveGridSize = size;

        public static Vector3 BoardExtents(int size)
        {
            float w = size * CellSize + (size - 1) * Gap;
            return new Vector3(w, 0f, w);
        }

        /// <summary>격자 기하학적 중심 (기울임 피벗 = 원점).</summary>
        public static Vector3 BoardCenter(int size)
        {
            var ext = BoardExtents(size);
            return new Vector3(ext.x * 0.5f, 0f, ext.z * 0.5f);
        }

        /// <summary>피벗(판 중앙) 기준 로컬 좌표.</summary>
        public static Vector3 CellCenter(int row, int col, int gridSize)
        {
            var origin = BoardCenter(gridSize);
            float x = col * Step + CellSize * 0.5f - origin.x;
            float z = row * Step + CellSize * 0.5f - origin.z;
            return new Vector3(x, 0f, z);
        }

        public static Vector3 CellCenter(int row, int col) =>
            CellCenter(row, col, ActiveGridSize);

        public static Vector3 WallHCenter(int row, int col, int gridSize)
        {
            var origin = BoardCenter(gridSize);
            float x = col * Step + CellSize * 0.5f - origin.x;
            float z = (row + 1) * Step - Gap * 0.5f - origin.z;
            return new Vector3(x, 0f, z);
        }

        public static Vector3 WallVCenter(int row, int col, int gridSize)
        {
            var origin = BoardCenter(gridSize);
            float x = (col + 1) * Step - Gap * 0.5f - origin.x;
            float z = row * Step + CellSize * 0.5f - origin.z;
            return new Vector3(x, 0f, z);
        }

        /// <summary>카메라 프레이밍용 — 피벗 기준 보드+패딩 반경.</summary>
        public static float ViewHalfExtent(int gridSize, float boardPad)
        {
            var ext = BoardExtents(gridSize);
            return Mathf.Max(ext.x, ext.z) * 0.5f + boardPad;
        }
    }
}
