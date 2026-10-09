namespace InTheHole.Gameplay
{
    public static class BoardVisualConstants
    {
        /// <summary>카메라 프레이밍 (민트 테두리 포함).</summary>
        public const float BoardPad = 0.18f;
        public const float BallYOffset = 0.14f;
        /// <summary>칸 사이 캔디 벽 두께.</summary>
        public const float CandyBarThickness = 0.16f;
        /// <summary>벽 막대 길이 — 칸 안쪽에 맞춤.</summary>
        public static float CandyBarLength => BoardLayout.CellSize * 0.86f;
        /// <summary>민트 테두리 두께·바깥 여백.</summary>
        public const float MintBorderThickness = 0.09f;
        public const float MintFramePad = 0.10f;
        public static float BallDiameter => BoardLayout.CellSize * 0.46f;
        public static float BallScale => BallDiameter;
        /// <summary>칸을 거의 꽉 채움 (바둑판).</summary>
        public static float CellFill => BoardLayout.CellSize + BoardLayout.Gap * 0.85f;

        /// <summary>
        /// isometric PNG는 이미 사선 각도가 그려져 있음 → 바닥에 눕히기만 함 (추가 회전 금지).
        /// 다이아몬드 끝이 겹치지 않게 살짝만 축소.
        /// </summary>
        public static float CellSpriteSize => CellFill * 0.94f;
        public static float BallHeight => BallYOffset;
    }
}
