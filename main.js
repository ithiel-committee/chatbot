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
const qaPairs = [
  {
    keywords: ["こんにちは", "ハロー", "はじめまして", "自己紹介", "hi", "Hi"],
    reply:
      "こんにちは！中央大学国際情報学部（iTL）のイティエルです！何かお手伝いできることはありますか？",
    emotion: "happy",
  },
  {
    keywords: [
      "お腹空いた",
      "お腹すいた",
      "昼ご飯",
      "昼ごはん",
      "ランチ",
      "学食",
      "弁当",
    ],
    reply:
      "市ヶ谷田町キャンパスには学食がないので、近隣のお弁当屋さんやカフェが人気なんですよ！一週間頑張ったご褒美には、美味しい外食を食べに行くのもいいですね！",
    emotion: "relaxed",
  },
  {
    keywords: ["時間割", "授業", "講義", "課題"],
    reply:
      "時間割や講義情報ですね！国際情報学部の時間割は、学内ポータルで確認できます。課題の提出期限などは、うっかり忘れがちなのでスケジュール帳にしっかりメモしておきましょうね！",
    emotion: "relaxed",
  },
  {
    keywords: ["キャンパス", "場所", "どこ", "中央大学"],
    reply:
      "国際情報学部は「市ヶ谷田町キャンパス」の1学部のみ独立しているんです。市ヶ谷駅から近くて、とてもアクセスしやすい綺麗なビルなんですよ！",
    emotion: "happy",
  },
  {
    keywords: ["雨", "天気", "寒"],
    reply:
      "今日はなんだか天気が悪くて肌寒いですね……。激しい寒暖差が続いていますので、体調管理には気を付けて、温かくしてお過ごしくださいね。",
    emotion: "sad",
  },
  {
    keywords: ["疲れた", "しんどい", "眠い"],
    reply:
      "今日もお疲れ様です！なかなか作業に身が入らない日もありますよね。そういう時は温かい飲み物でも飲んで、無理せずスケジュールを見直してみるのもおすすめですよ。",
    emotion: "relaxed",
  },
  {
    keywords: ["法律", "情報", "勉強", "iTL", "itl"],
    reply:
      "国際情報学部は「情報の仕組み」と「法律（IT社会のルール）」の両方を学ぶ学部なんですよ。新しい技術を正しく使うための力を身につけられるんです！",
    emotion: "happy",
  },
];

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
      // 簡易口パクアニメーション（応答テキストタイピング中のみ）
      if (isTypingResponse) {
        const mouthOpen = Math.sin(clock.getElapsedTime() * 50) * 0.2 + 0.2;
        expressionManager.setValue(VRMExpressionPresetName.Aa, mouthOpen);
      } else {
        expressionManager.setValue(VRMExpressionPresetName.Aa, 0.0);
      }

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
