// Mặt nước biển/hồ: sóng nhiễu 2 lớp, phản chiếu bầu trời theo Fresnel, lấp lánh mặt trời, sương mù.
Shader "SaiCanh/Water"
{
    Properties
    {
        _Deep ("Deep", Color) = (0.03,0.17,0.24,1)
        _Shallow ("Shallow", Color) = (0.08,0.32,0.36,1)
        _Sky ("Sky", Color) = (0.62,0.75,0.88,1)
        _Wave ("Wave Normal", 2D) = "bump" {}
        _Scale ("Scale", Float) = 0.012
    }
    SubShader
    {
        Tags { "Queue"="Geometry+10" "RenderType"="Opaque" }
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            fixed4 _Deep, _Shallow, _Sky; sampler2D _Wave; float _Scale;
            struct v2f { float4 pos : SV_POSITION; float3 wp : TEXCOORD0; UNITY_FOG_COORDS(1) };
            v2f vert(appdata_base v)
            {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex);
                o.wp = mul(unity_ObjectToWorld, v.vertex).xyz;
                UNITY_TRANSFER_FOG(o, o.pos); return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                float t = _Time.y;
                float2 uv = i.wp.xz * _Scale;
                float3 n1 = UnpackNormal(tex2D(_Wave, uv + float2(t * 0.011, t * 0.007)));
                float3 n2 = UnpackNormal(tex2D(_Wave, uv * 3.7 - float2(t * 0.019, -t * 0.013)));
                float3 n3 = UnpackNormal(tex2D(_Wave, uv * 0.21 + float2(-t * 0.003, t * 0.002)));
                float3 nt = normalize(float3(n1.xy + n2.xy * 0.6 + n3.xy * 0.8, 3.2));
                float3 N = normalize(float3(nt.x, nt.z, nt.y));
                float3 V = normalize(_WorldSpaceCameraPos - i.wp);
                float dist = length(_WorldSpaceCameraPos - i.wp);
                N = normalize(lerp(N, float3(0,1,0), saturate(dist / 9000)));
                float fres = 0.02 + 0.98 * pow(1 - saturate(dot(N, V)), 5);
                float3 L = normalize(_WorldSpaceLightPos0.xyz);
                float3 H = normalize(L + V);
                float spec = pow(saturate(dot(N, H)), 380) * 6 + pow(saturate(dot(N, H)), 40) * 0.12;
                float3 water = lerp(_Shallow.rgb, _Deep.rgb, saturate(dot(N, V)));
                water *= 0.55 + 0.45 * saturate(L.y * 2);
                float3 col = lerp(water, _Sky.rgb * (0.6 + 0.4 * saturate(L.y * 2)), fres) + spec * _LightColor0.rgb;
                fixed4 c = fixed4(col, 1);
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }
    }
    Fallback "Diffuse"
}
