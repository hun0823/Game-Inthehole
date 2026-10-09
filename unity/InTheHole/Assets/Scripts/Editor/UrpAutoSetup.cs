#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace InTheHole.Editor
{
    /// <summary>
    /// URP + Universal Renderer 데이터를 생성·연결 (Default Renderer missing 방지).
    /// </summary>
    [InitializeOnLoad]
    static class UrpAutoSetup
    {
        const string PipelinePath = "Assets/Settings/UniversalRP.asset";
        const string RendererPath = "Assets/Settings/UniversalRP_Renderer.asset";

        static UrpAutoSetup() => EditorApplication.delayCall += EnsurePipeline;

        static void EnsurePipeline()
        {
            if (!AssetDatabase.IsValidFolder("Assets/Settings"))
                AssetDatabase.CreateFolder("Assets", "Settings");

            var renderer = GetOrCreateRenderer();
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);

            if (pipeline == null)
            {
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                ResourceReloader.ReloadAllNullIn(pipeline, UniversalRenderPipelineAsset.packagePath);
                AssetDatabase.CreateAsset(pipeline, PipelinePath);
                Debug.Log("[InTheHole] Created UniversalRP.asset with renderer.");
            }
            else if (!HasValidRenderer(pipeline))
            {
                AssignRenderer(pipeline, renderer);
                Debug.Log("[InTheHole] Fixed missing default renderer on UniversalRP.asset.");
            }

            if (GraphicsSettings.defaultRenderPipeline != pipeline)
            {
                GraphicsSettings.defaultRenderPipeline = pipeline;
                QualitySettings.renderPipeline = pipeline;
                Debug.Log("[InTheHole] URP assigned in Graphics settings.");
            }

            AssetDatabase.SaveAssets();
        }

        static UniversalRendererData GetOrCreateRenderer()
        {
            var existing = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(RendererPath);
            if (existing != null)
                return existing;

            var data = ScriptableObject.CreateInstance<UniversalRendererData>();
            ResourceReloader.ReloadAllNullIn(data, UniversalRenderPipelineAsset.packagePath);
            AssetDatabase.CreateAsset(data, RendererPath);
            return data;
        }

        static bool HasValidRenderer(UniversalRenderPipelineAsset pipeline)
        {
            var list = pipeline.rendererDataList;
            return list.Length > 0 && list[0] != null;
        }

        static void AssignRenderer(UniversalRenderPipelineAsset pipeline, UniversalRendererData renderer)
        {
            var so = new SerializedObject(pipeline);
            var list = so.FindProperty("m_RendererDataList");
            list.arraySize = 1;
            list.GetArrayElementAtIndex(0).objectReferenceValue = renderer;
            so.FindProperty("m_DefaultRendererIndex").intValue = 0;
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(pipeline);
        }
    }
}
#endif
