// ============================
// 미연시(비주얼 노벨) 템플릿 엔진
// - 배경/캐릭터/대사/선택지/분기
// - 타이핑 효과
// - 자동 진행/스킵
// - 로그
// - 저장/불러오기(localStorage)
// ============================

// ===== DOM =====
const elBg = document.getElementById("bg");
const elLeft = document.getElementById("ch-left");
const elRight = document.getElementById("ch-right");
const elName = document.getElementById("name");
const elText = document.getElementById("text");
const elChoices = document.getElementById("choices");
const elStatus = document.getElementById("status");

const btnNext = document.getElementById("btn-next");
const btnAuto = document.getElementById("btn-auto");
const btnSkip = document.getElementById("btn-skip");
const btnLog = document.getElementById("btn-log");
const btnSave = document.getElementById("btn-save");
const btnLoad = document.getElementById("btn-load");

const logModal = document.getElementById("logModal");
const logList = document.getElementById("logList");
const saveModal = document.getElementById("saveModal");
const slotInfo = document.getElementById("slotInfo");
const slotSave = document.getElementById("slotSave");
const slotLoad = document.getElementById("slotLoad");
const slotClear = document.getElementById("slotClear");

// ===== 저장 키 =====
const SAVE_KEY = "vn_save_slot_1";

// ===== 게임 상태 =====
const state = {
  i: 0, // 현재 스크립트 인덱스
  vars: { affection: 0 }, // 호감도/플래그 같은 변수
  log: [], // 로그 배열
  typing: {
    running: false,
    fullText: "",
    shown: "",
    timer: null,
  },
  auto: false,
  skip: false,
  lock: false, // 선택지 표시 중 등 입력 잠금
};

// ====== 스크립트(스토리 데이터) ======
// type:
// - bg: {type:"bg", mode:"gradient" or "image", value:"..."}  // 이미지 없어도 돌아가게 mode 지원
// - ch: {type:"ch", side:"left|right", show:true/false, mode:"silhouette|image", value:"..."}
// - say: {type:"say", name:"", text:""}
// - choice: {type:"choice", choices:[{text:"", next: index, set:{}, add:{}}...]}
// - jump: {type:"jump", next:index}
// - if: {type:"if", cond:(vars)=>boolean, then:index, else:index}
// - set: {type:"set", set:{key:value}, add:{key:+1}}
const script = [
  {
    type: "bg",
    mode: "image",
    // ★ 배경 이미지 넣는 자리
    // 예: "assets/bg_school.png"
    value: "배경 이미지",
  },

  {
    type: "ch",
    side: "left",
    show: true,
    mode: "image",
    // ★ 왼쪽 캐릭터 이미지 넣는 자리
    // 예: "assets/heroine.png"
    value: "왼쪽 캐릭터 이미지",
  },
  { type: "say", name: "주인공", text: "…여긴 어디지?\n분명히 방금 전까진…." },
  { type: "say", name: "???", text: "드디어 깨어났구나." },
  {
    type: "ch",
    side: "right",
    show: true,
    mode: "image",
    // ★ 오른쪽 캐릭터도 이미지로 바꾸고 싶으면
    // mode: "image" 로 바꾸고
    // value: "assets/mysterious.png" 같은 식으로 넣으면 됨
    value: "오른쪽 캐릭터 이미지",
  },
  { type: "say", name: "수상한 사람", text: "걱정 마. 해치려는 건 아니니까." },

  {
    type: "choice",
    choices: [
      { text: "누구세요?", add: { affection: +1 }, next: 7 },
      { text: "여기서 나가게 해줘요.", add: { affection: -1 }, next: 10 },
    ],
  },

  { type: "say", name: "주인공", text: "누구세요?" },
  {
    type: "say",
    name: "수상한 사람",
    text: "나? 그냥 지나가던… 음, 아니지. 널 기다리던 사람이야.",
  },
  { type: "jump", next: 13 },

  { type: "say", name: "주인공", text: "여기서 나가게 해줘요." },
  { type: "say", name: "수상한 사람", text: "나가고 싶다면… 선택을 해야 해." },
  { type: "jump", next: 13 },

  // 분기 체크 예시
  {
    type: "if",
    cond: (v) => (v.affection ?? 0) >= 1,
    then: 14,
    else: 17,
  },

  {
    type: "say",
    name: "수상한 사람",
    text: "좋아. 네가 예의가 있네.\n그럼 힌트를 하나 주지.",
  },
  { type: "say", name: "주인공", text: "힌트요?" },
  {
    type: "say",
    name: "수상한 사람",
    text: "문은 두 개. 하지만 열쇠는 하나야.",
  },
  { type: "jump", next: 20 },

  {
    type: "say",
    name: "수상한 사람",
    text: "말을 좀 더 곱게 했으면 좋았을 텐데.",
  },
  { type: "say", name: "주인공", text: "…미안해요." },
  { type: "say", name: "수상한 사람", text: "그래. 아직 기회는 있어." },

  // 엔딩(간단)
  {
    type: "say",
    name: "시스템",
    text: "데모 끝!\n",
  },
];

// ===== 도우미: 배경 설정 =====
function setBackground(mode, value) {
  // 이미지 배경을 쓰려면: mode:"image", value:"./assets/bg.jpg" 같은 식
  if (mode === "image") {
    elBg.style.background = `url("${value}") center / cover no-repeat`;
    return;
  }

  // 기본은 gradient 모드
  if (value === "night") {
    elBg.style.background = `radial-gradient(1200px 800px at 25% 25%, rgba(122,167,255,0.45), transparent 55%),
       radial-gradient(1200px 800px at 70% 70%, rgba(255,122,203,0.30), transparent 55%),
       linear-gradient(180deg, #0f1220, #05060a)`;
  } else if (value === "sunset") {
    elBg.style.background = `radial-gradient(1000px 700px at 20% 35%, rgba(255,140,90,0.55), transparent 60%),
       radial-gradient(1000px 700px at 70% 65%, rgba(255,70,160,0.35), transparent 60%),
       linear-gradient(180deg, #221014, #07060a)`;
  } else {
    // default
    elBg.style.background = `radial-gradient(1200px 800px at 30% 30%, rgba(122,167,255,0.45), transparent 55%),
       radial-gradient(1200px 800px at 70% 70%, rgba(255,122,203,0.35), transparent 55%),
       linear-gradient(180deg, #11131a, #07080c)`;
  }
}

// ===== 도우미: 캐릭터 설정 =====
function setCharacter(side, show, mode, value) {
  const el = side === "left" ? elLeft : elRight;

  if (!show) {
    el.classList.remove("is-show");
    el.style.backgroundImage = "";
    return;
  }

  el.classList.add("is-show");

  if (mode === "image") {
    // 실제 이미지 사용(투명 PNG 추천)
    // value 자리에 들어간 이미지 경로를 여기서 화면에 적용함
    el.style.background = `url("${value}") center / contain no-repeat,
       linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))`;
  } else {
    // 실루엣/카드 느낌(이미지 없을 때)
    if (value === "hero") {
      el.style.background = `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)),
         radial-gradient(600px 400px at 50% 30%, rgba(255,255,255,0.16), transparent 55%),
         linear-gradient(180deg, rgba(122,167,255,0.35), rgba(60,110,255,0.12))`;
    } else {
      el.style.background = `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)),
         radial-gradient(600px 400px at 50% 30%, rgba(255,255,255,0.16), transparent 55%),
         linear-gradient(180deg, rgba(255,122,203,0.28), rgba(122,167,255,0.14))`;
    }
  }
}

// ===== 도우미: 말하는 캐릭터 강조(반대쪽 dim) =====
function focusSpeaker(name) {
  // 아주 간단히: "수상한 사람"이 나오면 오른쪽 강조 같은 방식(원하면 더 정교하게 가능)
  const rightSpeak = ["수상한 사람", "???"].includes(name);
  const leftSpeak = ["주인공"].includes(name);

  elLeft.classList.toggle("is-dim", rightSpeak);
  elRight.classList.toggle("is-dim", leftSpeak);
}

// ===== 로그 추가 =====
function pushLog(name, text) {
  state.log.push({ name, text });
  // 로그는 너무 길어지면 200개 정도로 자르자
  if (state.log.length > 200) state.log.shift();
}

// ===== 타이핑 효과 =====
function stopTyping() {
  if (state.typing.timer) clearInterval(state.typing.timer);
  state.typing.timer = null;
  state.typing.running = false;
}

function typeText(fullText, speedMs = 18) {
  stopTyping();
  state.typing.running = true;
  state.typing.fullText = fullText;
  state.typing.shown = "";
  elText.textContent = "";

  const chars = [...fullText];
  let idx = 0;

  state.typing.timer = setInterval(() => {
    // 스킵이 켜져 있으면 즉시 전체 표시
    if (state.skip) {
      elText.textContent = fullText;
      stopTyping();
      onLineFullyShown();
      return;
    }

    state.typing.shown += chars[idx] ?? "";
    elText.textContent = state.typing.shown;
    idx += 1;

    if (idx >= chars.length) {
      stopTyping();
      onLineFullyShown();
    }
  }, speedMs);
}

function revealAllTextNow() {
  if (!state.typing.running) return false;
  elText.textContent = state.typing.fullText;
  stopTyping();
  onLineFullyShown();
  return true;
}

// ===== 자동 진행 =====
function onLineFullyShown() {
  // 자동 진행이 켜져 있으면 조금 쉬었다가 다음으로
  if (state.auto && !state.lock) {
    setTimeout(() => {
      // 여전히 자동 모드이며, 선택지 중이 아니라면 진행
      if (state.auto && !state.lock) next();
    }, 700);
  }
}

// ===== 선택지 UI =====
function showChoices(choices) {
  state.lock = true;
  elChoices.hidden = false;
  elChoices.innerHTML = "";

  choices.forEach((c, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = c.text ?? `선택지 ${idx + 1}`;
    btn.addEventListener("click", () => {
      applyVarOps(c);
      hideChoices();
      jumpTo(c.next);
    });
    elChoices.appendChild(btn);
  });
}

function hideChoices() {
  elChoices.hidden = true;
  elChoices.innerHTML = "";
  state.lock = false;
}

// ===== 변수 조작 =====
function applyVarOps(node) {
  if (node?.set) {
    for (const [k, v] of Object.entries(node.set)) state.vars[k] = v;
  }
  if (node?.add) {
    for (const [k, v] of Object.entries(node.add)) {
      const cur = Number(state.vars[k] ?? 0);
      state.vars[k] = cur + Number(v);
    }
  }
}

// ===== 점프 =====
function jumpTo(index) {
  if (typeof index !== "number") return;
  state.i = index;
  step();
}

// ===== 상태 표시 =====
function setStatus(text) {
  elStatus.textContent = text;
}

// ===== 현재 노드 실행 =====
function step() {
  if (state.i < 0 || state.i >= script.length) {
    setStatus("끝");
    elName.textContent = "시스템";
    elText.textContent = "스크립트가 끝났어.";
    return;
  }

  const node = script[state.i];

  // 선택지 표시 중에는 다음 진행을 막음
  hideChoices();

  setStatus(`line ${state.i} / vars: affection=${state.vars.affection ?? 0}`);

  if (node.type === "bg") {
    setBackground(node.mode, node.value);
    state.i += 1;
    step();
    return;
  }

  if (node.type === "ch") {
    setCharacter(node.side, node.show, node.mode, node.value);
    state.i += 1;
    step();
    return;
  }

  if (node.type === "set") {
    applyVarOps(node);
    state.i += 1;
    step();
    return;
  }

  if (node.type === "jump") {
    jumpTo(node.next);
    return;
  }

  if (node.type === "if") {
    const ok = !!node.cond?.(state.vars);
    jumpTo(ok ? node.then : node.else);
    return;
  }

  if (node.type === "choice") {
    // 선택지에서는 자동/스킵이 켜져도 멈추게
    showChoices(node.choices ?? []);
    // 이름/텍스트는 안내 문구로
    elName.textContent = "선택";
    elText.textContent = "원하는 선택지를 눌러줘.";
    return;
  }

  if (node.type === "say") {
    const name = node.name ?? "";
    const text = node.text ?? "";

    elName.textContent = name;
    focusSpeaker(name);

    // 로그는 완성된 대사 기준으로 저장
    pushLog(name, text);

    typeText(text);
    return;
  }

  // 알 수 없는 타입이면 스킵
  state.i += 1;
  step();
}

// ===== 다음 진행 =====
function next() {
  if (state.lock) return;

  // 타이핑 중이면 일단 전체 표시
  if (revealAllTextNow()) return;

  // 다음 라인으로
  state.i += 1;
  step();
}

// ===== 로그 모달 =====
function openLog() {
  logList.innerHTML = "";
  const items = state.log.slice(-80); // 최근 80줄
  items.forEach((it) => {
    const div = document.createElement("div");
    div.className = "logItem";
    div.innerHTML = `<span class="logName">${escapeHtml(it.name)}</span>
                     <span class="logText">${escapeHtml(it.text)}</span>`;
    logList.appendChild(div);
  });
  logModal.hidden = false;
}
function closeLog() {
  logModal.hidden = true;
}

// ===== 저장/불러오기 모달 =====
function openSaveModal() {
  refreshSlotInfo();
  saveModal.hidden = false;
}
function closeSaveModal() {
  saveModal.hidden = true;
}
function refreshSlotInfo() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    slotInfo.textContent = "비어 있음";
    return;
  }
  try {
    const data = JSON.parse(raw);
    slotInfo.textContent = `line ${data.i}, affection=${data.vars?.affection ?? 0} (저장됨)`;
  } catch {
    slotInfo.textContent = "데이터 손상";
  }
}

function saveToSlot() {
  const data = {
    i: state.i,
    vars: state.vars,
    log: state.log,
    // 화면 복구를 위해 배경/캐릭터 상태도 저장(간단히 computed 값 대신 노드 기반으로 저장)
    // 여기서는 “현재까지 진행한 라인”만 저장하고 있음
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  refreshSlotInfo();
  setStatus("저장 완료");
}

function loadFromSlot() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    setStatus("저장 데이터 없음");
    return;
  }
  try {
    const data = JSON.parse(raw);
    state.i = Number(data.i ?? 0);
    state.vars = data.vars ?? { affection: 0 };
    state.log = Array.isArray(data.log) ? data.log : [];
    // 화면 상태 재구성: 0부터 state.i까지 bg/ch를 빠르게 재생성
    rebuildVisualStateUpTo(state.i);
    step();
    setStatus("불러오기 완료");
  } catch {
    setStatus("불러오기 실패(데이터 손상)");
  }
}

function clearSlot() {
  localStorage.removeItem(SAVE_KEY);
  refreshSlotInfo();
  setStatus("저장 삭제");
}

// bg/ch는 진행하면서 누적 상태라서, 불러오기 때 0부터 훑어서 배경/캐릭터 상태를 재구성
function rebuildVisualStateUpTo(targetIndex) {
  // 초기화
  setBackground("gradient", "night");
  setCharacter("left", false);
  setCharacter("right", false);
  elLeft.classList.remove("is-dim");
  elRight.classList.remove("is-dim");

  for (let k = 0; k <= targetIndex && k < script.length; k++) {
    const node = script[k];
    if (node.type === "bg") setBackground(node.mode, node.value);
    if (node.type === "ch") {
      setCharacter(node.side, node.show, node.mode, node.value);
    }
    if (node.type === "set") applyVarOps(node);
  }
}

// ===== 유틸 =====
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== 입력 이벤트 =====
btnNext.addEventListener("click", next);

btnAuto.addEventListener("click", () => {
  state.auto = !state.auto;
  btnAuto.textContent = `자동: ${state.auto ? "ON" : "OFF"}`;
  if (state.auto && !state.typing.running && !state.lock) {
    setTimeout(() => state.auto && next(), 350);
  }
});

btnSkip.addEventListener("click", () => {
  state.skip = !state.skip;
  btnSkip.textContent = `스킵: ${state.skip ? "ON" : "OFF"}`;
});

btnLog.addEventListener("click", openLog);
btnSave.addEventListener("click", openSaveModal);
btnLoad.addEventListener("click", openSaveModal);

// 모달 닫기(백드롭/닫기 버튼)
document.addEventListener("click", (e) => {
  const t = e.target;

  if (t?.dataset?.close === "log") closeLog();
  if (t?.dataset?.close === "save") closeSaveModal();
});

slotSave.addEventListener("click", saveToSlot);
slotLoad.addEventListener("click", loadFromSlot);
slotClear.addEventListener("click", clearSlot);

// 화면 클릭으로도 다음 진행(선택지/모달 제외)
document.getElementById("textbox").addEventListener("click", () => next());

// 키보드
window.addEventListener("keydown", (e) => {
  if (!logModal.hidden || !saveModal.hidden) {
    if (e.key === "Escape") {
      closeLog();
      closeSaveModal();
    }
    return;
  }

  if (e.key === "Enter") next();
  if (e.key === " ") {
    e.preventDefault();
    state.auto = !state.auto;
    btnAuto.textContent = `자동: ${state.auto ? "ON" : "OFF"}`;
    if (state.auto && !state.typing.running && !state.lock) {
      setTimeout(() => state.auto && next(), 350);
    }
  }
  if (e.key.toLowerCase() === "s") {
    state.skip = !state.skip;
    btnSkip.textContent = `스킵: ${state.skip ? "ON" : "OFF"}`;
  }
  if (e.key === "Escape") {
    closeLog();
    closeSaveModal();
  }
});

// ===== 시작 =====
step();
