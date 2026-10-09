using System.Collections.Generic;
using InTheHole.Core;
using InTheHole.Data;

namespace InTheHole.Gameplay
{
    public interface IBoardBuilder
    {
        void Build(LevelDefinition level, GameSession session = null);
        void HideBrokenGlass(IReadOnlyList<GlassEdge> broken);
        void HideColoredWalls(IReadOnlyList<ColoredEdge> removed);
        void SetButtonPressed(int row, int col);
    }
}
