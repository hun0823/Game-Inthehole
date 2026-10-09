using InTheHole.Core;

using UnityEngine;

using UnityEngine.UI;



namespace InTheHole.Gameplay

{

    /// <summary>별 텍스트 대신 스프라이트로 표시 — 폰트 깨짐 방지.</summary>

    public sealed class StarRatingRow : MonoBehaviour

    {

        const int SlotCount = StageRating.MaxStars;

        const float StarSize = 36f;

        const float StarGap = 6f;



        Image[] _slots;

        Text _gameOverLabel;



        public static StarRatingRow Create(Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot,

            Vector2 pos, Font font)

        {

            var go = new GameObject("StarRow", typeof(RectTransform));

            go.transform.SetParent(parent, false);

            var rt = go.GetComponent<RectTransform>();

            rt.anchorMin = anchorMin;

            rt.anchorMax = anchorMax;

            rt.pivot = pivot;

            rt.anchoredPosition = pos;

            rt.sizeDelta = new Vector2(220f, 44f);



            var row = go.AddComponent<StarRatingRow>();

            row.Build(font);

            return row;

        }



        void Build(Font font)

        {

            SpriteCatalog.EnsureReady();

            var starSprite = SpriteCatalog.Star;



            _slots = new Image[SlotCount];

            float x = 0f;

            for (int i = 0; i < SlotCount; i++)

            {

                var slotGo = new GameObject($"Star_{i}", typeof(RectTransform), typeof(Image));

                slotGo.transform.SetParent(transform, false);

                var img = slotGo.GetComponent<Image>();

                img.sprite = starSprite;

                img.preserveAspect = true;

                img.raycastTarget = false;

                img.color = VisualPalette.UiGold;



                var srt = slotGo.GetComponent<RectTransform>();

                srt.anchorMin = srt.anchorMax = new Vector2(0f, 0.5f);

                srt.pivot = new Vector2(0f, 0.5f);

                srt.anchoredPosition = new Vector2(x, 0f);

                srt.sizeDelta = new Vector2(StarSize, StarSize);

                _slots[i] = img;

                x += StarSize + StarGap;

            }



            var labelGo = new GameObject("GameOver", typeof(RectTransform), typeof(Text));

            labelGo.transform.SetParent(transform, false);

            _gameOverLabel = labelGo.GetComponent<Text>();

            _gameOverLabel.font = font;

            _gameOverLabel.text = "GAME OVER";

            _gameOverLabel.fontSize = 28;

            _gameOverLabel.fontStyle = FontStyle.Bold;

            _gameOverLabel.color = new Color(1f, 0.45f, 0.4f);

            _gameOverLabel.alignment = TextAnchor.MiddleLeft;

            _gameOverLabel.raycastTarget = false;

            HudTextStyle.Apply(_gameOverLabel);

            var lrt = labelGo.GetComponent<RectTransform>();

            lrt.anchorMin = lrt.anchorMax = new Vector2(0f, 0.5f);

            lrt.pivot = new Vector2(0f, 0.5f);

            lrt.anchoredPosition = Vector2.zero;

            lrt.sizeDelta = new Vector2(220f, 40f);

            labelGo.SetActive(false);

        }



        public void SetRating(int stars, bool gameOver)

        {

            if (_gameOverLabel != null)

                _gameOverLabel.gameObject.SetActive(gameOver);



            for (int i = 0; i < _slots.Length; i++)

            {

                bool on = !gameOver && i < stars;

                _slots[i].gameObject.SetActive(!gameOver);

                _slots[i].color = on

                    ? VisualPalette.UiGold

                    : new Color(VisualPalette.UiGold.r, VisualPalette.UiGold.g, VisualPalette.UiGold.b, 0.28f);

            }

        }

    }

}


