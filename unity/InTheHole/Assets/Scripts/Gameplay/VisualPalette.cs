using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>모바일 캐주얼 퍼즐 레퍼런스 톤 (민트 보드 · 우드 · 캔디 벽 · 구리 공 · 소용돌이 구멍).</summary>
    public static class VisualPalette
    {
        static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }

        public static readonly Color Bg = Hex("#0a0e28");
        public static readonly Color BgGlow = Hex("#141c42");

        public static readonly Color FrameMint = Hex("#8ef5d2");
        public static readonly Color FrameMintDark = Hex("#4cd4a8");
        public static readonly Color FrameMintShadow = Hex("#2a9a78");

        public static readonly Color WoodDark = Hex("#8b5e3c");
        public static readonly Color WoodMid = Hex("#a6744d");
        public static readonly Color WoodLight = Hex("#c49262");
        public static readonly Color WoodGrain = Hex("#6e4a30");

        public static readonly Color WallCoral = Hex("#ff6b6b");
        public static readonly Color WallBlue = Hex("#5b9dff");
        public static readonly Color WallPurple = Hex("#b47aff");
        public static readonly Color WallGreen = Hex("#5dd68a");

        public static readonly Color Hole = Hex("#001018");
        public static readonly Color HoleDeep = Hex("#000608");
        public static readonly Color HoleVortexA = Hex("#2ee8b6");
        public static readonly Color HoleVortexB = Hex("#18c8e8");
        public static readonly Color HoleGlow = Hex("#9dfff0");

        public static readonly Color Ball = Hex("#e88b4a");
        public static readonly Color BallEdge = Hex("#9a4e22");
        public static readonly Color BallShine = Hex("#ffe8c8");

        public static readonly Color Shadow = new(0.02f, 0.04f, 0.1f, 0.65f);
        public static readonly Color FloorShadow = new(0f, 0f, 0f, 0.4f);
        public static readonly Color BackdropGlow = new(0.15f, 0.35f, 0.45f, 0.35f);

        public static readonly Color UiPanel = new(0.06f, 0.08f, 0.2f, 0.55f);
        public static readonly Color UiPanelAccent = new(0.1f, 0.14f, 0.32f, 0.75f);
        public static readonly Color UiText = Hex("#f8fbff");
        public static readonly Color UiTextMuted = Hex("#8aa0c8");
        public static readonly Color UiGold = Hex("#ffc93d");
        public static readonly Color UiGoldDark = Hex("#e8a020");
        public static readonly Color UiMint = Hex("#8ef5d2");
        public static readonly Color UiGear = Hex("#7a8498");
        public static readonly Color UiBanner = new(0.08f, 0.12f, 0.28f, 0.65f);
        public static readonly Color StarTwinkleA = Hex("#fff6b0");
        public static readonly Color StarTwinkleB = Hex("#ffe566");

        public static Color WallCandy(int index)
        {
            return (index % 4) switch
            {
                0 => WallCoral,
                1 => WallBlue,
                2 => WallPurple,
                _ => WallGreen,
            };
        }
    }
}
