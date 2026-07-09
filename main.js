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
camera.position.set(0.0, 1.3, 1.5);

// 背景画像はWebGL内ではなくCSS(body)で描画して軽量化するため、WebGLキャンバスを透明に設定(alpha: true)
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// ライトの配置
const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

// 環境光を追加してモデル全体を均一に明るくする
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// VRMモデルの管理オブジェクトと腕のボーン
let currentVrm = null;
let leftUpperArm = null;
let rightUpperArm = null;

// 制御フラグ
const enableLipSync = false;
const enableExpressionAnimation = false;

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
  "./3dmodel/ithiel.vrm",
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

    // 初期感情の設定（例：ニュートラルにする）
    setTargetExpression("neutral");
  },
  (progress) => {
    if (progress.total > 0) {
      // サーバーのgzip圧縮等の影響でloadedがtotalを上回ることがあるため、100%でキャップする
      const percent = Math.min((progress.loaded / progress.total) * 100, 100);
      console.log(`Loading... ${percent.toFixed(2)}%`);
    } else {
      // totalが不明な場合は読み込み済みの容量(MB)を表示する
      const mb = (progress.loaded / 1024 / 1024).toFixed(2);
      console.log(`Loading... ${mb} MB`);
    }
  },
  (error) => console.error(error),
);

/**
 * 目標となる感情を設定する関数
 * 特定の感情を1に、それ以外を0にする
 */
let expressionResetTimer = null;

function setTargetExpression(emotion) {
  Object.keys(expressionState.target).forEach((key) => {
    expressionState.target[key] = key === emotion ? 1.0 : 0.0;
  });

  // 表情リセットタイマーの管理
  if (expressionResetTimer) {
    clearTimeout(expressionResetTimer);
  }

  // 自然な表情(relaxed)に戻す
  if (emotion !== "relaxed") {
    expressionResetTimer = setTimeout(() => {
      setTargetExpression("relaxed");
    }, 6000);
  }
}

// --- 対話ロジック & UI連携 ---
let qaPairs = [];

async function loadQAPairs() {
  try {
    const response = await fetch("./assets/qa_pairs.json");
    qaPairs = await response.json();
  } catch (error) {
    console.error("Failed to load QA pairs:", error);
  }
}
loadQAPairs();

function getReply(inputText) {
  for (const pair of qaPairs) {
    if (pair.keywords.some((keyword) => inputText.includes(keyword))) {
      return { text: pair.reply, emotion: pair.emotion };
    }
  }
  return {
    text: "すみません、そのことについてはまだよく分からなくて……！もっと勉強して、皆さんのお手伝いができるように頑張りますね！",
    emotion: "sad",
  };
}

const textAreaContainer = document.getElementById("text-area-container");
const hiddenInput = document.getElementById("hidden-input");
const inputTextSpan = document.getElementById("input-text");
const logDiv = document.getElementById("log");
const logScroll = document.getElementById("log-scroll");
const inputLine = document.getElementById("input-line");

let isTypingResponse = false;

// 画面クリックでインプットへフォーカス
hiddenInput.focus();
window.addEventListener("click", () => {
  if (!isTypingResponse) hiddenInput.focus();
});
textAreaContainer.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!isTypingResponse) hiddenInput.focus();
});

// タイピングの同期
hiddenInput.addEventListener("input", () => {
  if (!isTypingResponse) {
    inputTextSpan.textContent = hiddenInput.value;
    logScroll.scrollTop = logScroll.scrollHeight;
  }
});

// 送信処理
hiddenInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = hiddenInput.value.trim();
    if (text === "") return;

    sendUserMessage(text);
  }
});

function sendUserMessage(text) {
  // ユーザーのメッセージをログへ追加
  const userRow = document.createElement("div");
  userRow.className = "log-row user-msg";
  userRow.textContent = `> ${text}`;
  logDiv.appendChild(userRow);

  // 入力のクリアと非表示
  hiddenInput.value = "";
  inputTextSpan.textContent = "";
  inputLine.style.display = "none";
  isTypingResponse = true;

  logScroll.scrollTop = logScroll.scrollHeight;

  // 応答の決定
  const { text: replyText, emotion } = getReply(text);

  // 表情の設定
  setTargetExpression(emotion);

  // キャラクターの応答コンテナ作成
  const charRow = document.createElement("div");
  charRow.className = "log-row char-msg";
  logDiv.appendChild(charRow);

  let index = 0;
  const typingInterval = setInterval(() => {
    charRow.textContent += replyText.charAt(index);
    index++;
    logScroll.scrollTop = logScroll.scrollHeight;

    if (index >= replyText.length) {
      clearInterval(typingInterval);
      isTypingResponse = false;

      // 入力受付を再開
      setTimeout(() => {
        inputLine.style.display = "flex";
        hiddenInput.focus();
        logScroll.scrollTop = logScroll.scrollHeight;
      }, 300);
    }
  }, 45); // 1文字あたり45ms
}

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
      // 簡易口パクアニメーション（フラグ有効時かつ応答テキストタイピング中のみ）
      if (enableLipSync && isTypingResponse) {
        const mouthOpen = Math.sin(clock.getElapsedTime() * 50) * 0.2 + 0.2;
        expressionManager.setValue(VRMExpressionPresetName.Aa, mouthOpen);
      } else {
        expressionManager.setValue(VRMExpressionPresetName.Aa, 0.0);
      }

      // 各表情の線形補間処理
      Object.keys(expressionState.current).forEach((key) => {
        const cur = expressionState.current[key];
        const tar = expressionState.target[key];

        // 状態遷移時にアニメーションするかどうかの制御
        if (enableExpressionAnimation) {
          // 線形補間によるウェイトの計算
          expressionState.current[key] =
            cur + (tar - cur) * expressionState.speed;
        } else {
          // 0秒で感情を即時切り替える
          expressionState.current[key] = tar;
        }

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
