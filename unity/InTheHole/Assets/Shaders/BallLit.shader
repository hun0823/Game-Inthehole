Shader "InTheHole/BallLit"
{
    Properties
    {
        _Color ("Color", Color) = (1, 0.36, 0.22, 1)
        _ShadeColor ("Shade", Color) = (0.77, 0.23, 0.12, 1)
        _SpecularColor ("Specular", Color) = (1, 0.85, 0.7, 1)
        _Gloss ("Gloss", Range(8, 128)) = 48
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }
        Pass
        {
            Tags { "LightMode" = "UniversalForward" }
            ZWrite On
            Cull Back
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _Color;
                half4 _ShadeColor;
                half4 _SpecularColor;
                half _Gloss;
            CBUFFER_END

            static const half3 kLightDir = half3(0.4, 0.85, 0.35);

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                half3 normalWS : TEXCOORD0;
                half3 viewDirWS : TEXCOORD1;
            };

            Varyings vert(Attributes input)
            {
                Varyings o;
                float3 posWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(posWS);
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                o.viewDirWS = normalize(_WorldSpaceCameraPos - posWS);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 n = normalize(i.normalWS);
                half3 l = normalize(kLightDir);
                half3 v = normalize(i.viewDirWS);
                half3 h = normalize(l + v);

                half ndl = saturate(dot(n, l));
                half3 diffuse = lerp(_ShadeColor.rgb, _Color.rgb, ndl * 0.85h + 0.15h);
                half spec = pow(saturate(dot(n, h)), _Gloss) * 0.85h;
                half fresnel = pow(1.0h - saturate(dot(n, v)), 3.0h) * 0.08h;
                half3 col = diffuse + _SpecularColor.rgb * spec + fresnel;
                return half4(col, 1.0h);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
