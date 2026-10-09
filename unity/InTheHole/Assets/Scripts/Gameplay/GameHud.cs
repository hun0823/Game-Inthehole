using System.Collections.Generic;

using System.Text;

using InTheHole.Core;

using InTheHole.Data;

using InTheHole.Services;

using UnityEngine;

using UnityEngine.UI;



namespace InTheHole.Gameplay

{

    /// <summary>Rollin' Board — 9:16 세로 HUD (좌: 이동수+별 / 중: 스테이지 / 우: 힌트).</summary>

    public sealed class GameHud : MonoBehaviour

    {

        public static float CameraTopInset => PortraitLayout.TopBand;

        public static float CameraBottomInset => PortraitLayout.BottomBand;



        const float SidePad = 36f;
        const float TopInset = 28f;



        Text _stageText;

        Text _movesText;

        Text _hintRouteText;

        StarRatingRow _starRow;

        GameObject _clearPanel;

        GameObject _gameOverPanel;

        Button _hintButton;

        PortraitFrameDriver _frame;



        public static GameHud Create()

        {

            var go = new GameObject("GameHUD");

            var canvas = go.AddComponent<Canvas>();

            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            canvas.sortingOrder = 1000;



            var scaler = go.AddComponent<CanvasScaler>();

            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;

            scaler.referenceResolution = new Vector2(1080, 1920);

            scaler.matchWidthOrHeight = 1f;



            go.AddComponent<GraphicRaycaster>();

            UiInputSetup.Ensure();

            PortraitFrameDriver.Attach(go.transform);

            return go.AddComponent<GameHud>();

        }



        void Awake()

        {

            _frame = GetComponent<PortraitFrameDriver>();

            if (_frame == null)

                _frame = PortraitFrameDriver.Attach(transform);

        }



        void Start() => BuildLayout();



        void BuildLayout()

        {

            var root = _frame != null ? _frame.SafeRoot : transform;

            var font = UiFont.Get();



            var foreground = HudForegroundLayer.Create(root, sortingOrder: 1100);

            var labels = CreateStretchChild("HudLabels", foreground);



            _movesText = CreateAnchoredLabel(labels, "Moves", "0/0",

                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),

                new Vector2(SidePad, -TopInset - 36f), new Vector2(300f, 56f),

                44, VisualPalette.UiText, font, TextAnchor.UpperLeft, richText: true);

            _movesText.fontStyle = FontStyle.Bold;

            _movesText.supportRichText = true;



            _starRow = StarRatingRow.Create(labels,

                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),

                new Vector2(SidePad, -TopInset - 96f), font);

            _starRow.SetRating(3, false);



            _stageText = CreateAnchoredLabel(labels, "Stage", "Lv.1",

                new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),

                new Vector2(0f, -TopInset - 52f), new Vector2(420f, 64f),

                46, VisualPalette.UiText, font, TextAnchor.UpperCenter);

            _stageText.fontStyle = FontStyle.Bold;



            _hintRouteText = CreateAnchoredLabel(labels, "HintRoute", "",

                new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),

                new Vector2(0f, -148f), new Vector2(520f, 40f),

                26, VisualPalette.UiMint, font, TextAnchor.UpperCenter);

            _hintRouteText.gameObject.SetActive(false);



            _hintButton = CreateTextButton(labels, "BtnHint",

                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f),

                new Vector2(-SidePad, -TopInset - 52f), new Vector2(132f, 64f),

                "[ ? ]", font, 34, VisualPalette.UiText);

            _hintButton.transform.SetAsLastSibling();



            _clearPanel = CreatePanel("ClearOverlay", labels,

                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),

                Vector2.zero, new Vector2(640f, 280f), new Color(0.05f, 0.1f, 0.22f, 0.94f)).gameObject;

            CreateLabel(_clearPanel.transform, "Clear!", new Vector2(0.5f, 0.65f), 44, VisualPalette.UiMint, font).name = "ClearTitle";

            var clearMsg = CreateLabel(_clearPanel.transform, "", new Vector2(0.5f, 0.4f), 28, VisualPalette.UiText, font);

            clearMsg.name = "ClearMsg";

            _clearPanel.SetActive(false);



            _gameOverPanel = CreatePanel("GameOverOverlay", labels,

                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),

                Vector2.zero, new Vector2(640f, 240f), new Color(0.2f, 0.06f, 0.1f, 0.94f)).gameObject;

            CreateLabel(_gameOverPanel.transform, "Out of moves", new Vector2(0.5f, 0.62f), 36, new Color(1f, 0.5f, 0.45f), font).name = "GoTitle";

            var goMsg = CreateLabel(_gameOverPanel.transform, "", new Vector2(0.5f, 0.35f), 26, VisualPalette.UiText, font);

            goMsg.name = "GoMsg";

            _gameOverPanel.SetActive(false);

        }



        public void Refresh(LevelDefinition level, int moves, int parMoves, bool won = false, bool gameOver = false)

        {

            if (level == null || _stageText == null) return;



            _stageText.text = $"Lv.{level.Id}";



            if (parMoves > 0)

            {

                _movesText.supportRichText = true;

                _movesText.text = FormatMoveCounter(moves, parMoves);

                var live = StageRating.StarsForMoves(parMoves, moves);

                _starRow?.SetRating(live, gameOver);

            }

            else

            {

                _movesText.supportRichText = true;

                _movesText.text = FormatMoveCounter(moves, 0);

                _starRow?.SetRating(3, false);

            }



            _gameOverPanel?.SetActive(gameOver);

            if (gameOver)

            {

                _clearPanel.SetActive(false);

                var msg = _gameOverPanel.transform.Find("GoMsg")?.GetComponent<Text>();

                if (msg != null && parMoves > 0)

                    msg.text = $"{moves}/{parMoves} · R reset";

            }

            else if (won)

            {

                _clearPanel.SetActive(true);

                int stars = StageRating.StarsForMoves(parMoves, moves);

                var msg = _clearPanel.transform.Find("ClearMsg")?.GetComponent<Text>();

                if (msg != null)

                    msg.text = $"Lv.{level.Id} · {moves}/{parMoves} · {StageRating.StarsText(stars)} · ★ {ProgressSave.TotalStarsEarned()}";

            }

            else

                _clearPanel.SetActive(false);

        }



        public void BindHint(System.Action onHintClicked)

        {

            if (_hintButton != null)

                _hintButton.onClick.AddListener(() => onHintClicked?.Invoke());

        }



        public void ShowHintRoute(IReadOnlyList<TiltDirection> moves)

        {

            if (_hintRouteText == null) return;

            if (moves == null || moves.Count == 0)

            {

                _hintRouteText.text = "No hint";

                _hintRouteText.gameObject.SetActive(true);

                return;

            }



            var sb = new StringBuilder("Hint ");

            for (int i = 0; i < moves.Count; i++)

            {

                if (i > 0) sb.Append(' ');

                sb.Append(TiltDirectionUtil.Arrow(moves[i]));

            }

            sb.Append($" · {moves.Count}");

            _hintRouteText.text = sb.ToString();

            _hintRouteText.gameObject.SetActive(true);

        }



        public void ClearHintMessage()

        {

            if (_hintRouteText == null) return;

            _hintRouteText.text = "";

            _hintRouteText.gameObject.SetActive(false);

        }



        static string FormatMoveCounter(int moves, int parMoves)

        {

            if (parMoves <= 0)

                return $"<color=#FFFFFF>{moves}</color><color=#8EC8FF>/{0}</color>";



            var tone = StageRating.ToneForMoves(parMoves, moves);

            var numHex = tone switch

            {

                StageRating.MoveCountTone.Warning => "#FFAA33",

                StageRating.MoveCountTone.Danger => "#FF4444",

                _ => "#FFFFFF"

            };

            return $"<color={numHex}>{moves}</color><color=#8EC8FF>/{parMoves}</color>";

        }



        static RectTransform CreateStretchChild(string name, Transform parent)

        {

            var go = new GameObject(name, typeof(RectTransform));

            go.transform.SetParent(parent, false);

            var rt = go.GetComponent<RectTransform>();

            rt.anchorMin = Vector2.zero;

            rt.anchorMax = Vector2.one;

            rt.offsetMin = Vector2.zero;

            rt.offsetMax = Vector2.zero;

            return rt;

        }



        static RectTransform CreatePanel(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax,

            Vector2 pivot, Vector2 pos, Vector2 size, Color color)

        {

            var go = new GameObject(name, typeof(RectTransform), typeof(Image));

            go.transform.SetParent(parent, false);

            var img = go.GetComponent<Image>();

            img.color = color;

            img.raycastTarget = false;

            var rt = go.GetComponent<RectTransform>();

            rt.anchorMin = anchorMin;

            rt.anchorMax = anchorMax;

            rt.pivot = pivot;

            rt.anchoredPosition = pos;

            rt.sizeDelta = size;

            return rt;

        }



        static Text CreateAnchoredLabel(Transform parent, string name, string text,

            Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 pos, Vector2 size,

            int fontSize, Color color, Font font, TextAnchor alignment, bool richText = false)

        {

            var go = new GameObject(name, typeof(RectTransform), typeof(Text));

            go.transform.SetParent(parent, false);

            var t = go.GetComponent<Text>();

            t.font = font;

            t.text = text;

            t.fontSize = fontSize;

            t.color = color;

            t.alignment = alignment;

            t.horizontalOverflow = HorizontalWrapMode.Overflow;

            t.verticalOverflow = VerticalWrapMode.Overflow;

            t.raycastTarget = false;

            HudTextStyle.Apply(t, richText);

            var rt = go.GetComponent<RectTransform>();

            rt.anchorMin = anchorMin;

            rt.anchorMax = anchorMax;

            rt.pivot = pivot;

            rt.anchoredPosition = pos;

            rt.sizeDelta = size;

            return t;

        }



        static Button CreateTextButton(Transform parent, string name,

            Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 anchoredPosition, Vector2 size,

            string label, Font font, int fontSize, Color textColor)

        {

            var panel = CreatePanel(name, parent, anchorMin, anchorMax, pivot, anchoredPosition, size,

                new Color(0.08f, 0.12f, 0.28f, 0.35f));

            panel.GetComponent<Image>().raycastTarget = true;

            var text = CreateAnchoredLabel(panel, "Label", label,

                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),

                Vector2.zero, size, fontSize, textColor, font, TextAnchor.MiddleCenter);

            text.fontStyle = FontStyle.Bold;

            text.raycastTarget = false;



            var btn = panel.gameObject.AddComponent<Button>();

            btn.targetGraphic = panel.GetComponent<Image>();

            var colors = btn.colors;

            colors.normalColor = new Color(0.08f, 0.12f, 0.28f, 0.35f);

            colors.highlightedColor = new Color(0.14f, 0.2f, 0.38f, 0.55f);

            colors.pressedColor = new Color(0.05f, 0.08f, 0.18f, 0.65f);

            btn.colors = colors;

            return btn;

        }



        static Text CreateLabel(Transform parent, string text, Vector2 anchor, int fontSize, Color color, Font font)

        {

            var go = new GameObject("Label", typeof(RectTransform), typeof(Text));

            go.transform.SetParent(parent, false);

            var t = go.GetComponent<Text>();

            t.font = font;

            t.text = text;

            t.fontSize = fontSize;

            t.color = color;

            t.alignment = TextAnchor.MiddleCenter;

            t.horizontalOverflow = HorizontalWrapMode.Overflow;

            t.raycastTarget = false;

            HudTextStyle.Apply(t);

            var rt = go.GetComponent<RectTransform>();

            rt.anchorMin = rt.anchorMax = anchor;

            rt.pivot = new Vector2(0.5f, 0.5f);

            rt.anchoredPosition = Vector2.zero;

            rt.sizeDelta = new Vector2(480f, 56f);

            return t;

        }

    }

}


