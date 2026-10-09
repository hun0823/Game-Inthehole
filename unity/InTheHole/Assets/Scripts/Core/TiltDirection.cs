namespace InTheHole.Core
{
    public enum TiltDirection
    {
        Up,
        Down,
        Left,
        Right
    }

    public static class TiltDirectionUtil
    {
        /// <summary>UI용 — LegacyRuntime 등에서도 보이는 ASCII 화살표.</summary>
        public static string Arrow(TiltDirection dir) =>
            dir switch
            {
                TiltDirection.Up => "^",
                TiltDirection.Down => "v",
                TiltDirection.Left => "<",
                TiltDirection.Right => ">",
                _ => "·"
            };

        public static bool TryParse(string key, out TiltDirection dir)
        {
            switch (key)
            {
                case "up": dir = TiltDirection.Up; return true;
                case "down": dir = TiltDirection.Down; return true;
                case "left": dir = TiltDirection.Left; return true;
                case "right": dir = TiltDirection.Right; return true;
                default:
                    dir = TiltDirection.Up;
                    return false;
            }
        }
    }
}
