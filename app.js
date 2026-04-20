const DEFAULT_STATE = {
    heading: '강남성균 검도관 아침반 출석',
    members: [
      '강인규', '구인회', '구창희', '김영민', '김용호', '김인성', '김태수', '김해리',
      '혁', '박상진', '박세종', '찬', '부척신', '서지우', '송규호', '신진우', '안재호',
      '유경일', '유병일', '이강민', '이경미', '이규범', '이인호', '이승호', '이종범',
      '임현주', '전미정', '전유진', '전종현', '정지욱', '채명헌', '한상면'
    ],
    checks: {},
    memo: ''
  };
  
  const $ = (selector) => document.querySelector(selector);
  const memberList = $('#memberList');
  const template = $('#memberItemTemplate');
  const resultText = $('#resultText');
  const memoInput = $('#memoInput');
  const headingInput = $('#headingInput');
  const saveStatus = $('#saveStatus');
  const storageNotice = $('#storageNotice');
  
  let state = structuredClone(DEFAULT_STATE);
  let useRemoteStorage = true;
  let saveTimer = null;
  
  function getKSTDateParts() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    });
    const parts = formatter.formatToParts(now);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      year: map.year,
      month: map.month,
      day: map.day,
      weekday: map.weekday,
      display: `${map.year}년 ${map.month}월 ${map.day}일 ${map.weekday}`,
      compact: `${map.year}.${map.month}.${map.day}`
    };
  }
  
  function uniqueNames(names) {
    return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  }
  
  function sortedMembers() {
    return [...state.members].sort((a, b) => a.localeCompare(b, 'ko'));
  }
  
  function getPresentMembers() {
    return state.members.filter((name) => Boolean(state.checks[name]));
  }
  
  function buildResultText() {
    const date = getKSTDateParts();
    const present = getPresentMembers();
    const heading = state.heading?.trim() || '검도관 출석';
    const attendanceLine = present.length ? present.join(', ') : '출석자 없음';
    return [
      `[${date.compact}] ${heading}`,
      `출석 ${present.length}명 / 전체 ${state.members.length}명`,
      `출석자: ${attendanceLine}`
    ].join('\n');
  }
  
  function renderDate() {
    $('#currentDate').textContent = getKSTDateParts().display;
  }
  
  function renderMembers() {
    memberList.innerHTML = '';
    state.members.forEach((name) => {
      const fragment = template.content.cloneNode(true);
      const checkbox = fragment.querySelector('.member-checkbox');
      const labelName = fragment.querySelector('.member-name');
      const deleteBtn = fragment.querySelector('.delete-btn');
  
      checkbox.checked = Boolean(state.checks[name]);
      checkbox.dataset.name = name;
      labelName.textContent = name;
      deleteBtn.dataset.name = name;
      deleteBtn.setAttribute('aria-label', `${name} 삭제`);
  
      memberList.appendChild(fragment);
    });
  
    $('#presentCount').textContent = String(getPresentMembers().length);
    $('#totalCount').textContent = String(state.members.length);
  }
  
  function renderResult() {
    resultText.value = buildResultText();
  }
  
  function renderAll() {
    renderDate();
    headingInput.value = state.heading || '';
    memoInput.value = state.memo || '';
    renderMembers();
    renderResult();
  }
  
  function setSaveStatus(message, tone = 'default') {
    saveStatus.textContent = message;
    saveStatus.style.color = tone === 'ok' ? 'var(--success)' : tone === 'error' ? '#fca5a5' : 'var(--text)';
  }
  
  function showNotice(message) {
    storageNotice.hidden = false;
    storageNotice.innerHTML = message;
  }
  
  function hideNotice() {
    storageNotice.hidden = true;
    storageNotice.textContent = '';
  }
  
  function persistLocal() {
    localStorage.setItem('kendo-attendance-state', JSON.stringify(state));
  }
  
  function loadLocal() {
    const raw = localStorage.getItem('kendo-attendance-state');
    if (!raw) return structuredClone(DEFAULT_STATE);
    try {
      const parsed = JSON.parse(raw);
      return {
        heading: parsed.heading || DEFAULT_STATE.heading,
        members: uniqueNames(parsed.members || DEFAULT_STATE.members),
        checks: parsed.checks || {},
        memo: parsed.memo || ''
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }
  
  async function loadRemote() {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error('원격 상태를 불러오지 못했습니다.');
    const data = await response.json();
    return {
      heading: data.heading || DEFAULT_STATE.heading,
      members: uniqueNames(data.members || DEFAULT_STATE.members),
      checks: data.checks || {},
      memo: data.memo || ''
    };
  }
  
  async function saveRemote() {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (!response.ok) throw new Error('원격 저장 실패');
  }
  
  function queueSave() {
    setSaveStatus(useRemoteStorage ? '저장 중…' : '이 기기에서 저장 중…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        persistLocal();
        if (useRemoteStorage) {
          await saveRemote();
          setSaveStatus('공용 저장 완료', 'ok');
        } else {
          setSaveStatus('이 기기 저장 완료', 'ok');
        }
      } catch (error) {
        console.error(error);
        persistLocal();
        useRemoteStorage = false;
        showNotice('현재는 <strong>브라우저 내부 저장</strong>으로 동작 중입니다. Vercel Blob 환경변수를 연결하면 모든 접속자에게 공용 반영됩니다.');
        setSaveStatus('원격 저장 실패 · 로컬 저장으로 전환', 'error');
      }
    }, 350);
  }
  
  async function init() {
    renderDate();
    setSaveStatus('초기 데이터 불러오는 중…');
    try {
      state = await loadRemote();
      useRemoteStorage = true;
      hideNotice();
      setSaveStatus('공용 데이터 연결됨', 'ok');
    } catch (error) {
      console.warn(error);
      state = loadLocal();
      useRemoteStorage = false;
      showNotice('배포 직후이거나 저장소가 연결되지 않아 <strong>이 기기에서만 유지</strong>됩니다. 진짜 공용 영구 저장은 Vercel Blob 설정 후 활성화됩니다.');
      setSaveStatus('로컬 모드로 시작', 'error');
    }
    renderAll();
  }
  
  $('#addMemberForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#newMemberName');
    const name = input.value.trim();
    if (!name) return;
    if (state.members.includes(name)) {
      alert('이미 등록된 이름입니다.');
      input.select();
      return;
    }
    state.members.push(name);
    state.members = uniqueNames(state.members);
    state.checks[name] = false;
    input.value = '';
    renderMembers();
    renderResult();
    queueSave();
  });
  
  memberList.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.member-checkbox');
    if (!checkbox) return;
    const name = checkbox.dataset.name;
    state.checks[name] = checkbox.checked;
    renderMembers();
    renderResult();
    queueSave();
  });
  
  memberList.addEventListener('click', (event) => {
    const btn = event.target.closest('.delete-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    const ok = confirm(`'${name}' 인원을 삭제하시겠습니까?`);
    if (!ok) return;
    state.members = state.members.filter((member) => member !== name);
    delete state.checks[name];
    renderMembers();
    renderResult();
    queueSave();
  });
  
  $('#checkAllBtn').addEventListener('click', () => {
    state.members.forEach((name) => {
      state.checks[name] = true;
    });
    renderMembers();
    renderResult();
    queueSave();
  });
  
  $('#uncheckAllBtn').addEventListener('click', () => {
    state.members.forEach((name) => {
      state.checks[name] = false;
    });
    renderMembers();
    renderResult();
    queueSave();
  });
  
  $('#sortBtn').addEventListener('click', () => {
    state.members = sortedMembers();
    renderMembers();
    renderResult();
    queueSave();
  });
  
  headingInput.addEventListener('input', (event) => {
    state.heading = event.target.value;
    renderResult();
    queueSave();
  });
  
  memoInput.addEventListener('input', (event) => {
    state.memo = event.target.value;
    queueSave();
  });
  
  $('#rebuildBtn').addEventListener('click', () => {
    renderResult();
  });
  
  $('#copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultText.value);
      setSaveStatus('복사 완료', 'ok');
    } catch {
      resultText.focus();
      resultText.select();
      document.execCommand('copy');
      setSaveStatus('복사 완료', 'ok');
    }
  });
  
  setInterval(renderDate, 60 * 1000);
  init();