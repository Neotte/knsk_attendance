// Vercel Function: 공용 영구 저장용 API
// 필요 패키지: npm i @vercel/blob
// 필요 환경변수: BLOB_READ_WRITE_TOKEN

import { head, put } from '@vercel/blob';

const BLOB_PATH = 'kendo-attendance/state.json';

const DEFAULT_STATE = {
  heading: '강남성균 아침반 출석부',
  members: [
    '강인규', '구인회', '구창희', '김영민', '김용호', '김인성', '김태수', '김해리',
    '혁', '박상진', '박세종', '찬', '부척신', '서지우', '송규호', '신진우', '안재호',
    '유경일', '유병일', '이강민', '이경미', '이규범', '이인호', '이승호', '이종범',
    '임현주', '전미정', '전유진', '전종현', '정지욱', '채명헌', '한상면'
  ],
  checks: {},
  memo: ''
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function normalizeState(payload) {
  const members = Array.isArray(payload?.members)
    ? [...new Set(payload.members.map((name) => String(name).trim()).filter(Boolean))]
    : DEFAULT_STATE.members;

  return {
    heading: String(payload?.heading || DEFAULT_STATE.heading).slice(0, 40),
    members,
    checks: typeof payload?.checks === 'object' && payload.checks ? payload.checks : {},
    memo: String(payload?.memo || '').slice(0, 4000)
  };
}

async function getBlobUrl() {
  try {
    const blob = await head(BLOB_PATH);
    return blob.url;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, 500);
  }

  if (req.method === 'GET') {
    try {
      const url = await getBlobUrl();
      if (!url) return json(DEFAULT_STATE);
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      return json(normalizeState(data));
    } catch (error) {
      return json({ error: 'failed_to_read_state', detail: String(error) }, 500);
    }
  }

  if (req.method === 'POST') {
    try {
      const payload = await req.json();
      const state = normalizeState(payload);
      await put(BLOB_PATH, JSON.stringify(state, null, 2), {
        access: 'public',
        allowOverwrite: true,
        contentType: 'application/json; charset=utf-8',
        addRandomSuffix: false
      });
      return json({ ok: true, state });
    } catch (error) {
      return json({ error: 'failed_to_write_state', detail: String(error) }, 500);
    }
  }

  return json({ error: 'method_not_allowed' }, 405);
}