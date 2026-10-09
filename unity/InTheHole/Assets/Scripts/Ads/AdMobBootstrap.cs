using UnityEngine;

namespace InTheHole.Ads
{
    /// <summary>
    /// Phase 3: Google Mobile Ads Unity Plugin 설치 후 구현.
    /// https://github.com/googleads/googleads-mobile-unity
    /// </summary>
    public sealed class AdMobBootstrap : MonoBehaviour
    {
        [Header("Ad unit IDs (Android / iOS)")]
        public string bannerId;
        public string interstitialId;
        public string rewardedId;

        public void ShowInterstitialOnStageClear()
        {
            // TODO: 스테이지 클리어 후 2~3스테이지마다 1회
            Debug.Log("[AdMob] Interstitial placeholder");
        }

        public void ShowRewardedForHint()
        {
            // TODO: 힌트 / Undo 보상형
            Debug.Log("[AdMob] Rewarded placeholder");
        }
    }
}
