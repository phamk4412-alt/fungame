// Menu trong Unity Editor: tạo cảnh bay và bấm Play ngay. (Không bắt buộc: game tự dựng khi Play ở bất kỳ cảnh nào.)
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace SaiCanh.EditorTools
{
    public static class SaiCanhMenu
    {
        const string ScenePath = "Assets/SaiCanh/Scenes/SaiCanh.unity";

        [MenuItem("Sải Cánh/Tạo cảnh bay")]
        public static void CreateScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("SaiCanh").AddComponent<SaiCanh.FlightGame>();
            System.IO.Directory.CreateDirectory("Assets/SaiCanh/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.Refresh();
        }

        [MenuItem("Sải Cánh/Bay ngay %#p")]
        public static void PlayNow()
        {
            if (EditorApplication.isPlaying) return;
            if (!System.IO.File.Exists(ScenePath)) CreateScene();
            else EditorSceneManager.OpenScene(ScenePath);
            EditorApplication.isPlaying = true;
        }
    }
}
#endif
