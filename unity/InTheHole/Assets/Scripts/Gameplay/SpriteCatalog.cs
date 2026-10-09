using UnityEngine;

namespace InTheHole.Gameplay
{
    public static class SpriteCatalog
    {
        const string Root = "Art/";
        const float Ppu = 100f;

        static Sprite _bg, _woodA, _woodB, _frame, _holeRing, _holeCore, _ball, _shadow, _star, _uiPanel;
        static Sprite _wallCoral, _wallBlue, _wallPurple, _wallGreen, _wallH, _wallV;
        static bool _loggedReady;
        static bool _sessionPinned;

        public static bool Ready => IsAlive(_woodA) && IsAlive(_ball);

        public static bool EnsureReady()
        {
            if (!_sessionPinned)
            {
                PreloadAll();
                if (Ready)
                    _sessionPinned = true;
            }

            if (Ready && !_loggedReady)
            {
                _loggedReady = true;
                int woodPx = _woodA.texture != null ? _woodA.texture.width : 0;
                int ballPx = _ball.texture != null ? _ball.texture.width : 0;
                if (woodPx < 200)
                    Debug.LogWarning($"[SpriteCatalog] wood_a only {woodPx}px — placeholder? Stop Play → InTheHole → Ensure Game Art Imported");
                else
                    Debug.Log($"[SpriteCatalog] Art ready — wood {woodPx}px, ball {ballPx}px");
            }
            else if (!_loggedReady && !IsAlive(_ball))
            {
                _loggedReady = true;
                Debug.LogError("[SpriteCatalog] Art missing. Unity 메뉴: InTheHole → Ensure Game Art Imported");
            }

            return IsAlive(_ball);
        }

        static void PreloadAll()
        {
            Load(ref _ball, "ball");
            Load(ref _woodA, "wood_a");
            Load(ref _woodB, "wood_b");
            Load(ref _bg, "bg_gradient");
            Load(ref _holeRing, "hole_ring");
            Load(ref _holeCore, "hole_core");
            Load(ref _shadow, "ball_shadow");
            Load(ref _star, "star");
            Load(ref _frame, "frame_mint");
            Load(ref _wallH, "wall_h");
            Load(ref _wallV, "wall_v");
            WallCandy(0);
            WallCandy(1);
            WallCandy(2);
            WallCandy(3);
        }

        public static Sprite Bg => Load(ref _bg, "bg_gradient");
        public static Sprite WoodA => Load(ref _woodA, "wood_a");
        public static Sprite WoodB => Load(ref _woodB, "wood_b");
        public static Sprite Frame => Load(ref _frame, "frame_mint");
        public static Sprite HoleRing => Load(ref _holeRing, "hole_ring");
        public static Sprite HoleCore => Load(ref _holeCore, "hole_core");
        public static Sprite Ball => Load(ref _ball, "ball");
        public static Sprite BallShadow => Load(ref _shadow, "ball_shadow");
        public static Sprite Star => Load(ref _star, "star");
        public static Sprite UiPanel => Load(ref _uiPanel, "ui_panel");

        public static Sprite WallCandy(int index) => (index % 4) switch
        {
            0 => Load(ref _wallCoral, "wall_coral"),
            1 => Load(ref _wallBlue, "wall_blue"),
            2 => Load(ref _wallPurple, "wall_purple"),
            _ => Load(ref _wallGreen, "wall_green"),
        };

        /// <summary>칸 사이 막대 벽 — wall_h/v 우선, 없으면 컬러 캔디.</summary>
        public static Sprite WallBar(bool horizontal, int candyIndex = 0)
        {
            if (horizontal && IsAlive(_wallH)) return _wallH;
            if (!horizontal && IsAlive(_wallV)) return _wallV;
            return WallCandy(candyIndex);
        }

        static Sprite Load(ref Sprite cache, string name)
        {
            if (IsAlive(cache)) return cache;
            cache = null;

            var path = $"{Root}{name}";
            cache = Resources.Load<Sprite>(path);
            if (IsAlive(cache)) return cache;

            foreach (var asset in Resources.LoadAll(path))
            {
                if (asset is Sprite sp)
                {
                    cache = sp;
                    return cache;
                }

                if (asset is Texture2D tex)
                {
                    cache = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), Ppu);
                    return cache;
                }
            }

            var texOnly = Resources.Load<Texture2D>(path);
            if (texOnly != null)
            {
                cache = Sprite.Create(texOnly, new Rect(0, 0, texOnly.width, texOnly.height), new Vector2(0.5f, 0.5f), Ppu);
                return cache;
            }

            Debug.LogWarning($"[SpriteCatalog] Missing Art/{name} — InTheHole → Ensure Game Art Imported");
            return null;
        }

        static bool IsAlive(Sprite sp) => sp;

        /// <summary>Play 세션 시작 시에만 호출. 스테이지 전환(N) 중에는 호출하지 않음.</summary>
        public static void ResetCache()
        {
            _bg = _woodA = _woodB = _frame = _holeRing = _holeCore = _ball = _shadow = _star = _uiPanel = null;
            _wallCoral = _wallBlue = _wallPurple = _wallGreen = _wallH = _wallV = null;
            _loggedReady = false;
            _sessionPinned = false;
        }
    }
}
