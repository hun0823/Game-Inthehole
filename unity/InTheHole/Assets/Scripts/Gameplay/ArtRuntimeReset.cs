using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>Play 세션마다 아트 캐시·머티리얼 초기화.</summary>
    public static class ArtRuntimeReset
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void OnSubsystemRegistration()
        {
            SpriteCatalog.ResetCache();
            SpriteBoardBuilder.ResetStatics();
        }
    }
}
