import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  VRMLoaderPlugin,
  VRMExpressionPresetName,
  VRMHumanBoneName,
} from "@pixiv/three-vrm";

// シーン、カメラ、レンダラーの初期化
const canvas = document.getElementById("canvas");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  20.0,
);
camera.position.set(0.0, 1.4, 1.5);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// ライトの配置
const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

// VRMモデルの管理オブジェクトと腕のボーン
let currentVrm = null;
let leftUpperArm = null;
let rightUpperArm = null;

// 感情の状態管理
const expressionState = {
  // 現在の各表情のウェイト
  current: { happy: 0, angry: 0, sad: 0, relaxed: 0 },
  // 目標とする各表情のウェイト
  target: { happy: 0, angry: 0, sad: 0, relaxed: 0 },
  // 遷移速度（0.0〜1.0、値が大きいほど速く変化する）
  speed: 0.05,
};

// GLTFローダーにVRMプラグインを登録
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

// VRMモデルの読み込み
loader.load(
  "/3dmodel/ithiel.vrm",
  (gltf) => {
    const vrm = gltf.userData.vrm;
    currentVrm = vrm;
    scene.add(vrm.scene);

    // モデルの向きを正面に調整
    vrm.scene.rotation.y = Math.PI;

    // 正規化された腕のボーンを取得
    leftUpperArm = vrm.humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.LeftUpperArm,
    );
    rightUpperArm = vrm.humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.RightUpperArm,
    );

    // 初期感情の設定（例：喜びを目標にする）
    setTargetExpression("happy");
  },
  (progress) => {
    // progress.total が 0 の場合のゼロ除算を防ぐ
    const percent = progress.total
      ? (progress.loaded / progress.total) * 100
      : 0;
    console.log(`Loading... ${percent.toFixed(2)}%`);
  },
  (error) => console.error(error),
);

/**
 * 目標となる感情を設定する関数
 * 特定の感情を1に、それ以外を0にする
 */
function setTargetExpression(emotion) {
  Object.keys(expressionState.target).forEach((key) => {
    expressionState.target[key] = key === emotion ? 1.0 : 0.0;
  });
}

// 感情を変更するタイマー例（5秒ごとにランダム遷移）
const emotions = ["happy", "angry", "sad", "relaxed"];
setInterval(() => {
  const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
  setTargetExpression(randomEmotion);
}, 5000);

// クロックの初期化
const clock = new THREE.Clock();

// アニメーションループ
function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  if (currentVrm) {
    // VRMの更新（ボーンアニメーションや視線処理など）
    currentVrm.update(deltaTime);

    // 腕を下げるポーズを毎フレーム適用（updateの直後に実行してポーズを固定する）
    if (leftUpperArm) {
      leftUpperArm.rotation.z = Math.PI * 0.4; // 左腕を下げる
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -Math.PI * 0.4; // 右腕を下げる
    }

    // 表情Managerの取得
    const expressionManager = currentVrm.expressionManager;

    if (expressionManager) {
      // 各表情の線形補間処理
      Object.keys(expressionState.current).forEach((key) => {
        const cur = expressionState.current[key];
        const tar = expressionState.target[key];

        // 線形補間によるウェイトの計算
        expressionState.current[key] =
          cur + (tar - cur) * expressionState.speed;

        // 表情名をVRMのプリセット名にマッピング
        let presetName;
        if (key === "happy") presetName = VRMExpressionPresetName.Happy;
        if (key === "angry") presetName = VRMExpressionPresetName.Angry;
        if (key === "sad") presetName = VRMExpressionPresetName.Sad;
        if (key === "relaxed") presetName = VRMExpressionPresetName.Relaxed;

        // VRMモデルにウェイトを適用
        expressionManager.setValue(presetName, expressionState.current[key]);
      });
    }
  }

  renderer.render(scene, camera);
}

animate();

// 画面リサイズへの対応
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
