using System.Collections;

using System.Collections.Generic;

using InTheHole.Core;

using InTheHole.Data;

using InTheHole.Services;

using UnityEngine;



namespace InTheHole.Gameplay

{

    public sealed class GameSession : MonoBehaviour

    {

        [Header("References")]

        IBoardBuilder _boardBuilder;

        public BallPresenter ball;

        public TableTiltPresenter tableTilt;

        public Transform boardPivot;

        public GameHud hud;

        public HintGuidePresenter hintGuide;

        public GlassWallEffects glassEffects;



        readonly GameSimulation _sim = new GameSimulation();

        IReadOnlyList<LevelDefinition> _levels;

        int _stageIndex;

        bool _busy;

        bool _hintVisible;

        bool _hintBusy;

        int _parMoves = -1;

        bool _gameOver;

        int _lastScreenW;

        int _lastScreenH;



        public int Moves => _sim.Moves;

        public bool Won => _sim.Won;

        public bool IsGameOver => _gameOver;



        public void RegisterBoardBuilder(IBoardBuilder builder) => _boardBuilder = builder;



        void Awake()

        {

            _levels = LevelDatabase.LoadAll();

            if (_levels.Count == 0)

                Debug.LogError("[GameSession] No levels loaded.");

            if (hintGuide == null && boardPivot != null)

                hintGuide = boardPivot.GetComponent<HintGuidePresenter>();

        }



        void Start()

        {

            _lastScreenW = Screen.width;

            _lastScreenH = Screen.height;

            hud?.BindHint(ToggleHint);

            StartCoroutine(StartRoutine());

        }



        void Update()

        {

            if (Screen.width == _lastScreenW && Screen.height == _lastScreenH)

                return;

            _lastScreenW = Screen.width;

            _lastScreenH = Screen.height;

            if (BoardLayout.ActiveGridSize > 0)

                CameraFit.FitOrthographic(BoardLayout.ActiveGridSize, GameVisualMode.MinimalLogicView);

        }



        IEnumerator StartRoutine()

        {

            LoadStage(0);

            yield return null;

            if (BoardLayout.ActiveGridSize > 0)

                CameraFit.FitOrthographic(BoardLayout.ActiveGridSize, GameVisualMode.MinimalLogicView);

        }



        public void LoadStage(int index)

        {

            if (_levels == null || _levels.Count == 0) return;

            _stageIndex = Mathf.Clamp(index, 0, _levels.Count - 1);

            var lv = _levels[_stageIndex];

            _sim.LoadFromLevel(lv);

            _boardBuilder?.Build(lv, this);

            var boardTr = _boardBuilder is MonoBehaviour mb ? mb.transform : boardPivot;
            glassEffects?.SetBoard(boardTr, boardPivot, lv.Size);

            if (ball != null)

                ball.SnapTo(_sim.Ball);

            if (boardPivot != null)

            {

                boardPivot.localRotation = Quaternion.identity;

                boardPivot.localPosition = Vector3.zero;

            }

            tableTilt?.SetTilt(null, false);

            HideHint();

            _gameOver = false;

            _parMoves = ResolveParMoves(lv);

            hud?.Refresh(lv, _sim.Moves, _parMoves, false);

            Debug.Log($"[GameSession] Stage {lv.Id} {lv.Name} par={_parMoves}");

        }

        static int ResolveParMoves(LevelDefinition lv)
        {
            if (lv.ParMoves > 0)
                return lv.ParMoves;
            var r = LevelSolver.Analyze(lv);
            return r.OptimalMoves > 0 ? r.OptimalMoves : -1;
        }



        public void ToggleHint()

        {

            if (_levels == null || _levels.Count == 0 || _hintBusy || _busy) return;

            if (hintGuide == null || boardPivot == null)

            {

                Debug.LogWarning("[GameSession] Hint unavailable — missing hintGuide or boardPivot.");

                return;

            }

            if (_sim.Won || _gameOver) return;



            if (_hintVisible)

            {

                HideHint();

                return;

            }



            StartCoroutine(ShowHintRoutine());

        }



        IEnumerator ShowHintRoutine()

        {

            _hintBusy = true;

            yield return null;



            var lv = _levels[_stageIndex];

            List<TiltDirection> moves = null;

            bool ok = _sim.Moves == 0

                ? LevelSolver.TryFindSolution(lv, out moves, LevelSolver.DefaultMaxMoves)

                : LevelSolver.TryFindSolutionFromState(_sim, out moves, LevelSolver.DefaultMaxMoves);



            _hintBusy = false;



            if (!ok || moves == null || moves.Count == 0)

            {

                Debug.LogWarning($"[GameSession] No hint — stage {lv.Id} moves={_sim.Moves}");

                hud?.ShowHintRoute(null);

                yield break;

            }



            hintGuide.Show(lv, moves, boardPivot, _sim);

            hud?.ShowHintRoute(moves);

            _hintVisible = true;

            Debug.Log($"[GameSession] Hint shown — stage {lv.Id}, {moves.Count} tilts");

        }



        void HideHint()

        {

            hintGuide?.Clear();

            hud?.ClearHintMessage();

            _hintVisible = false;

        }



        public void NextStage() => LoadStage(_stageIndex + 1);

        public void PrevStage() => LoadStage(_stageIndex - 1);

        public void ResetStage() => LoadStage(_stageIndex);



        public void TryTilt(TiltDirection dir)

        {

            if (_busy || ball.IsBusy || _sim.Won || _gameOver) return;

            HideHint();

            StartCoroutine(TiltRoutine(dir));

        }



        IEnumerator TiltRoutine(TiltDirection dir)

        {

            _busy = true;

            var scratch = new GameSimulation();

            scratch.Load(_sim.HWalls, _sim.VWalls, _sim.Ball, _sim.Hole, _sim.HGlass, _sim.VGlass,
                _sim.HColored, _sim.VColored, _sim.Buttons);

            scratch.CopyGlassStateFrom(_sim);

            scratch.CopyColoredStateFrom(_sim);

            scratch.ImportStateFrom(_sim);



            var result = scratch.SimulateTilt(dir);

            if (result.GlassStressed.Count > 0)
                glassEffects?.PlayStressed(result.GlassStressed);
            if (result.GlassBroken.Count > 0)
                glassEffects?.PlayBroken(result.GlassBroken);
            if (result.ColoredRemoved.Count > 0)
                _boardBuilder?.HideColoredWalls(result.ColoredRemoved);

            tableTilt?.SetTilt(dir, true);

            if (result.Moved && result.Path.Count > 1)
                yield return ball.AnimatePath(result.Path, dir);
            else if (result.GlassStressed.Count > 0)
                yield return new WaitForSeconds(0.2f);
            else if (result.GlassBroken.Count > 0)
                yield return new WaitForSeconds(0.08f);

            scratch.ApplyTiltResult(result);

            var stage = _levels[_stageIndex];

            ApplyButtonVisuals(stage, result);

            _sim.Load(scratch.HWalls, scratch.VWalls, scratch.Ball, scratch.Hole, scratch.HGlass, scratch.VGlass,
                scratch.HColored, scratch.VColored, scratch.Buttons);
            _sim.ImportStateFrom(scratch);
            _sim.CopyColoredStateFrom(scratch);

            hud?.Refresh(stage, _sim.Moves, _parMoves, false);

            yield return HandleAfterMove(stage, result.Won);



            yield return new WaitForSeconds(0.12f);

            tableTilt?.SetTilt(null, false);

            _busy = false;

        }



        public void TryPressButtonAt(int row, int col)

        {

            if (_busy || ball == null || ball.IsBusy || _sim.Won || _gameOver) return;

            if (_sim.Ball.Row != row || _sim.Ball.Col != col) return;

            var stage = _levels[_stageIndex];

            var onButton = false;

            foreach (var btn in stage.Buttons)

            {

                if (btn.Row == row && btn.Col == col)

                {

                    onButton = true;

                    break;

                }

            }

            if (!onButton) return;

            HideHint();

            StartCoroutine(PressButtonRoutine());

        }



        IEnumerator PressButtonRoutine()

        {

            _busy = true;

            var scratch = new GameSimulation();

            scratch.Load(_sim.HWalls, _sim.VWalls, _sim.Ball, _sim.Hole, _sim.HGlass, _sim.VGlass,
                _sim.HColored, _sim.VColored, _sim.Buttons);

            scratch.CopyGlassStateFrom(_sim);

            scratch.CopyColoredStateFrom(_sim);

            scratch.ImportStateFrom(_sim);



            var result = new TiltSimulationResult();

            if (!scratch.TryPressButton(result))

            {

                _busy = false;

                yield break;

            }

            yield return new WaitForSeconds(0.15f);



            var stage = _levels[_stageIndex];

            ApplyButtonVisuals(stage, result);

            _sim.Load(scratch.HWalls, scratch.VWalls, scratch.Ball, scratch.Hole, scratch.HGlass, scratch.VGlass,
                scratch.HColored, scratch.VColored, scratch.Buttons);

            _sim.ImportStateFrom(scratch);

            _sim.CopyColoredStateFrom(scratch);

            hud?.Refresh(stage, _sim.Moves, _parMoves, false);

            yield return HandleAfterMove(stage, scratch.Won);

            yield return new WaitForSeconds(0.08f);

            _busy = false;

        }

        IEnumerator HandleAfterMove(LevelDefinition stage, bool reachedHole)
        {
            if (StageRating.IsGameOver(_parMoves, _sim.Moves))
            {
                _gameOver = true;
                hud?.Refresh(stage, _sim.Moves, _parMoves, false, true);
                Debug.Log($"[GameSession] Game over — stage {stage.Id} moves={_sim.Moves} at={StageRating.GameOverAt(_parMoves)}");
                yield break;
            }

            if (!reachedHole)
            {
                hud?.Refresh(stage, _sim.Moves, _parMoves, false);
                yield break;
            }

            var stars = StageRating.StarsForMoves(_parMoves, _sim.Moves);
            if (stars <= 0)
            {
                _gameOver = true;
                hud?.Refresh(stage, _sim.Moves, _parMoves, false, true);
                yield break;
            }

            yield return ball.DropIntoHole();

            ProgressSave.MarkCleared(stage.Id);
            ProgressSave.SaveStars(stage.Id, stars);

            hud?.Refresh(stage, _sim.Moves, _parMoves, true);

            Debug.Log($"[GameSession] Clear! {stage.Name} moves={_sim.Moves} par={_parMoves} stars={stars}");
        }



        void ApplyButtonVisuals(LevelDefinition stage, TiltSimulationResult result)

        {

            if (result.ColoredRemoved.Count > 0)

                _boardBuilder?.HideColoredWalls(result.ColoredRemoved);

            if (string.IsNullOrEmpty(result.ButtonColorActivated)) return;

            foreach (var btn in stage.Buttons)

            {

                if (btn.Color == result.ButtonColorActivated)

                    _boardBuilder?.SetButtonPressed(btn.Row, btn.Col);

            }

        }

    }

}


