namespace InTheHole.Core
{
    /// <summary>색상 벽·버튼 식별자 (JSON "red" 등, 추후 확장).</summary>
    public static class WallColor
    {
        public const string Red = "red";

        public static bool IsValid(string color) =>
            color == Red;

        public static UnityEngine.Color ToUnityColor(string color) =>
            color == Red
                ? new UnityEngine.Color(0.95f, 0.2f, 0.2f)
                : new UnityEngine.Color(0.8f, 0.8f, 0.8f);
    }
}
