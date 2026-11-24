// Mây: hình nộm mềm có ánh sáng theo hướng mặt trời, mờ dần khi ở gần camera để bay xuyên mây không bị cắt.
Shader "SaiCanh/Cloud"
{
    Properties
    {
        _MainTex ("Puff", 2D) = "white" {}
        _Lit ("Lit", Color) = (1,1,1,1)
        _Shade ("Shade", Color) = (0.62,0.66,0.74,1)
    }
    SubShader
    {
        Tags { "Queue"="Transparent+5" "IgnoreProjector"="True" "RenderType"="Transparent" }
        ZWrite Off Cull Off
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            sampler2D _MainTex; fixed4 _Lit, _Shade;
            struct a2v { float4 vertex : POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; float3 normal : NORMAL; };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; float fade : TEXCOORD1; UNITY_FOG_COORDS(2) };
            v2f vert(a2v v)
            {
                v2f o;
                // điểm giữa hình nộm nằm trong normal; đỉnh = tâm + offset quay theo camera (billboard)
                float3 center = v.normal;
                float3 wc = mul(unity_ObjectToWorld, float4(center, 1)).xyz;
                float3 right = UNITY_MATRIX_V[0].xyz, up = UNITY_MATRIX_V[1].xyz;
                float2 off = v.vertex.xy;
                float3 wp = wc + right * off.x + up * off.y;
                o.pos = mul(UNITY_MATRIX_VP, float4(wp, 1));
                o.uv = v.uv; o.color = v.color;
                float d = distance(_WorldSpaceCameraPos, wc);
                float r = max(abs(off.x), abs(off.y));
                o.fade = saturate((d - r * 0.6) / (r * 0.9 + 1));
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 t = tex2D(_MainTex, i.uv);
                float lit = i.color.r; // độ sáng tính sẵn theo vị trí trong đám mây
                fixed4 c = fixed4(lerp(_Shade.rgb, _Lit.rgb, lit), t.a * i.color.a * i.fade);
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }
    }
}
