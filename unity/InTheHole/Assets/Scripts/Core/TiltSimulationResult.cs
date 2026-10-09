using System.Collections.Generic;



namespace InTheHole.Core

{

    public sealed class TiltSimulationResult

    {

        public List<GridCoord> Path { get; } = new List<GridCoord>();

        public List<GlassEdge> GlassStressed { get; } = new List<GlassEdge>();

        public List<GlassEdge> GlassBroken { get; } = new List<GlassEdge>();

        public List<ColoredEdge> ColoredRemoved { get; } = new List<ColoredEdge>();

        public string ButtonColorActivated { get; set; }

        /// <summary>공 이동·유리·버튼 활성화가 있으면 true — 턴 소모·BFS 분기.</summary>

        public bool Moved { get; set; }

        public bool Won { get; set; }

    }

}


