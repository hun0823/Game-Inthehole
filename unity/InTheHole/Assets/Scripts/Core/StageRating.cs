namespace InTheHole.Core
{
    /// <summary>최적(최단) 기울임 수 대비 별·게임오버 판정.</summary>
    public static class StageRating
    {
        public const int MaxStars = 3;

        /// <summary>게임오버가 되는 이동 수 (par + 3, 예: par=3 → 6회째).</summary>
        public static int GameOverAt(int parMoves) =>
            parMoves > 0 ? parMoves + 3 : int.MaxValue;

        public static bool IsGameOver(int parMoves, int moves) =>
            parMoves > 0 && moves >= GameOverAt(parMoves);

        public enum MoveCountTone { Normal, Warning, Danger }

        /// <summary>par+1 주황, par+2 빨강, par+3+ 게임오버.</summary>
        public static MoveCountTone ToneForMoves(int parMoves, int moves)
        {
            if (parMoves <= 0) return MoveCountTone.Normal;
            var over = moves - parMoves;
            if (over <= 0) return MoveCountTone.Normal;
            if (over == 1) return MoveCountTone.Warning;
            return MoveCountTone.Danger;
        }

        /// <summary>0 = 게임오버 구간, 1~3 = 클리어 시 별.</summary>
        public static int StarsForMoves(int parMoves, int moves)
        {
            if (parMoves <= 0)
                return moves <= 0 ? MaxStars : 1;

            var over = moves - parMoves;
            if (over <= 0) return 3;
            if (over == 1) return 2;
            if (over == 2) return 1;
            return 0;
        }

        public static string StarsText(int stars)
        {
            if (stars <= 0) return "—";
            return new string('★', stars) + new string('☆', MaxStars - stars);
        }
    }
}
