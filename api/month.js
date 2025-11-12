// /api/month.js 파일 (최종 수정본)
// *주의: 이 코드는 Vercel 서버리스 환경에서만 실행됩니다. DOM(document) 관련 코드는 모두 제거됨.

// ⭐️ 맨 위: DB 접속용 라이브러리 및 함수
import { MongoClient } from 'mongodb'; 
// Vercel 환경 변수 MONGODB_URI 사용
const uri = process.env.MONGODB_URI; 
const generateToken = () => Math.random().toString(36).substring(2, 15) + Date.now(); // 자동 인증 ID 생성

// --------------------------------------------------------------------------
// 🚨 사주 계산 로직 내부에서 참조하는 전역 변수 설정 (필수)
// 사장님의 사주 함수들이 이 전역 변수에 의존하므로, 여기서 선언하고 핸들러 안에서 값을 할당합니다.
let USER_SAJU_PILLARS = null; 

// --------------------------------------------------------------------------
// [핵심] 사주 핵심 로직: 모든 상수와 함수 정의
// 이 부분은 사장님의 원본 파일에서 TIANGAN, DIZHI 상수부터 monthTopN, generateLottoScores 함수까지 
// 사주 계산에 필요한 모든 코드를 포함하고 있어야 합니다.

const TIANGAN=['갑','을','병','정','무','기','경','신','임','계'];
const DIZHI=['자','축','인','묘','진','사','오','미','신','유','술','해'];
const TG_ELEM={'갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수'};
const DZ_ELEM={'자':'수','축':'토','인':'목','묘':'목','진':'토','사':'화','오':'화','미':'토','신':'금','유':'금','술':'토','해':'수'};
const OHENG_SANGSAENG_MAP = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
const OHENG_SANGGEUK_MAP = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };

// 코디/액션 관련 상수 추가 (NEW)
const OHAENG_COLOR = { '목': '녹색/청록색', '화': '빨간색/주황색', '토': '노란색/베이지색', '금': '흰색/회색', '수': '검은색/남색' };
const OHAENG_OUTFIT = { '목': '면,린넨 등 자연 소재 의상', '화': '화려한 액세서리나 활동적인 옷', '토': '단정하고 안정적인 스타일', '금': '금속 장식이나 구조적인 의상', '수': '부드러운 소재나 루즈핏 의상' };
const OHAENG_ACTION = { '목': '새로운 일 시작, 기획 회의', '화': '대외 활동, 사교적인 만남', '토': '계약 체결, 부동산 거래', '금': '업무 마무리, 재정 정리', '수': '휴식, 자기 계발, 아이디어 구상' };
const DZ_CLASH_MAP = { '자': '오', '오': '자', '묘': '유', '유': '묘', '인': '신', '신': '인', '사': '해', '해': '사', '진': '술', '술': '진', '축': '미', '미': '축' }; // 일지 충돌 확인용

// 고급 명리학 계산을 위한 상수 정의
const DZ_HIDDEN = { // 지지 장간 (通根 계산용)
    '자': ['임', '계'], '축': ['계', '신', '기'], '인': ['무', '병', '갑'], '묘': ['갑', '을'],
    '진': ['을', '계', '무'], '사': ['무', '경', '병'], '오': ['병', '기', '정'], '미': ['정', '을', '기'],
    '신': ['무', '임', '경'], '유': ['경', '신'], '술': ['신', '정', '무'], '해': ['갑', '무', '임']
};
const DZ_MONTHLY_AUTHORITY = { // 월령 오행
    '인': '목', '묘': '목', '진': '토', '사': '화', '오': '화', '미': '토',
    '신': '금', '유': '금', '술': '토', '해': '수', '자': '수', '축': '토'
};
// 흉살방
const SAM_SAL_BANG_MAP = { '해': '북', '묘': '북', '미': '북', '인': '서', '오': '서', '술': '서', '사': '동', '유': '동', '축': '동', '신': '남', '자': '남', '진': '남' };
const DAE_JANG_GUN_BANG_MAP = { '인': '북', '묘': '북', '진': '북', '사': '동', '오': '동', '미': '동', '신': '남', '유': '남', '술': '남', '해': '서', '자': '서', '축': '서' };
const OHAENG_DIRECTION = { '목': '동쪽', '화': '남쪽', '토': '중앙/서남쪽', '금': '서쪽', '수': '북쪽' }; // 디테일 추가


// 기본 만세력 계산 함수 (기존 유지)
function calcYearPillar(d){ const y=d.getFullYear(); return {tg:TIANGAN[(y-4)%10], dz:DIZHI[(y-4)%12]}; }
function calcMonthPillar(d){ const yp=calcYearPillar(d); const m=d.getMonth()+1;
const dzIndex=(m+1)%12; const yearTGIndex=TIANGAN.indexOf(yp.tg); const tgIndex=(yearTGIndex*2+m)%10; return {tg:TIANGAN[tgIndex], dz:DIZHI[dzIndex]}; }
function calcDayPillar(d){ const base=Date.UTC(1900,0,1); const cur=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()); const diff=Math.floor((cur-base)/(24*3600*1000)); return {tg:TIANGAN[(diff+6)%10], dz:DIZHI[(diff+12)%12]};
}
function calcHourPillar(dayTG,h){ const idx=Math.floor(((h+1)%24)/2); const dz=DIZHI[idx]; const dayIdx=TIANGAN.indexOf(dayTG); return {tg:TIANGAN[(dayIdx*2+idx)%10], dz:dz}; }
function calculatePillars(d,h){ const y=calcYearPillar(d), m=calcMonthPillar(d), day=calcDayPillar(d), hr=calcHourPillar(day.tg,h===null?0:h);
return {year:y, month:m, day:day, hour:hr}; }

// 오행 관계 점수 (기존 유지)
function getOhaengRelationshipScore(elemA, elemB) { 
    if (elemA === elemB) return 3; 
    if (OHENG_SANGSAENG_MAP[elemA] === elemB) return 5; 
    if (OHENG_SANGGEUK_MAP[elemA] === elemB) return -5; 
    if (OHENG_SANGSAENG_MAP[elemB] === elemA) return 2; 
    if (OHENG_SANGGEUK_MAP[elemB] === elemA) return -2; 
    return 0;
}

// getElementStrength 함수 - 월령 및 통근 가중치 반영 (기존 유지)
function getElementStrength(pillars, targetElem) {
    let s = 0;
    const monthDZ = pillars.month.dz;
    const monthlyAuthorityElem = DZ_MONTHLY_AUTHORITY[monthDZ];
    
    // 1. 월령(月令) 가중치 (50% 추가)
    if (monthlyAuthorityElem === targetElem) {
        s += 1.5; // 기존 지지 1.0 + 월령 0.5
    } else if (DZ_ELEM[monthDZ] === targetElem) {
        s += 1.0; // 월령이 아니더라도 월지 본기는 1.0
    }

    ['year', 'day', 'hour'].forEach(k => {
        const tg = pillars[k].tg;
        const dz = pillars[k].dz;
        
        // 2. 천간 (1.2)
        if (TG_ELEM[tg] === targetElem) {
            s += 1.2;
            // 3. 통근(通根) 가중치 (0.5 추가)
            if (DZ_HIDDEN[dz].includes(tg)) {
                s += 0.5; // 통근 시 천간에 추가 가중치
            }
        }
        
        // 4. 기타 지지 (1.0)
        if (k !== 'month' && DZ_ELEM[dz] === targetElem) {
            s += 1.0;
        }
    });

    return s;
}

// detectJaeStrength
function detectJaeStrength(userDayTG, pillars){ 
    const dayElem=TG_ELEM[userDayTG]; 
    const jaeElem=OHENG_SANGGEUK_MAP[dayElem];
    // 수정된 getElementStrength를 사용하여 재성 강도를 계산
    return getElementStrength(pillars, jaeElem);
}

// 희신/용신 대리 오행 및 추천 속성 함수
function getGeneratingElement(targetElem) {
    for (const [gen, prod] of Object.entries(OHENG_SANGSAENG_MAP)) {
        if (prod === targetElem) return gen;
    }
    return null; 
}

// [NEW] 행운 코디 조언 생성 함수
function generateCoordinationAdvice(userDayTG, dayPillars) {
    const userDayElem = TG_ELEM[userDayTG];
    
    // 1. 행운(희신) 요소 찾기 (인성 - 나를 돕는 기운, 안정)
    const luckyOhaeng = getGeneratingElement(userDayElem); 

    // 2. 위험(칠살) 요소 찾기 (관살 - 나를 극하는 기운, 스트레스/사고)
    const riskOhaeng = OHENG_SANGGEUK_MAP[userDayElem]; 
    const riskStrength = getElementStrength(dayPillars, riskOhaeng);

    let warning = [];
    let advice = '오늘은 평온하며, 일상적인 활동에 집중하면 좋습니다.';
    
    // --- 흉살 분석 로직 강화 ---
    
    // 관살(스트레스/사고수) 강도 분석
    if (riskStrength >= 3.0) { 
        warning.push('사고수 (관살 과다)');
        advice = `${advice.includes('⚠️') ? advice : '⚠️ 관살 과다로 인해'} 무리한 활동이나 충동적인 결정을 피하고, 안전을 최우선으로 하십시오. 이 기운은 곧 스트레스와 사고의 위험을 높입니다.`;
    }
    
    // 일지 충 (구설수/변동) 분석
    const userDayDZ = USER_SAJU_PILLARS.day.dz; // 🚨 전역 변수 의존
    const dayDZ = dayPillars.day.dz; 
    
    if (DZ_CLASH_MAP[userDayDZ] === dayDZ) { 
        warning.push('구설수/변동 (일지 충)');
        advice = `${advice.includes('⚠️') ? advice : '⚠️ 일지 충돌로 인해'} 오늘은 감정적인 구설수나 예상치 못한 변동이 있을 수 있습니다. 모든 언행을 신중히 하고 새로운 계약은 미루십시오.`;
    }

    const coordination = {
        luckyOhaeng: luckyOhaeng,
        luckyColor: OHAENG_COLOR[luckyOhaeng] || '모든 색상',
        luckyOutfit: OHAENG_OUTFIT[luckyOhaeng] || '편안한 의상',
        luckyDirection: OHAENG_DIRECTION[luckyOhaeng] || '정동쪽',
        actionAdvice: OHAENG_ACTION[luckyOhaeng] || '일상적인 활동',
        warning: warning.length > 0 ? warning.join(' | ') : '특이사항 없음',
        generalAdvice: advice
    };
    
    return coordination;
}

function determineFavorableElement(userDayTG) {
    const dayElem = TG_ELEM[userDayTG];
    // 돕는 기운(인성)을 희신 대리 요소로 사용 (안정적인 인연 추구)
    return getGeneratingElement(dayElem); 
}

function getOhaengRecommendation(ohaeng) {
    const maps = {
        '목': { region: '동쪽 방위 (새로운 시작)', occupation: '교육/문화, 창업/기획, 의류/가구 등 성장 관련 업종' },
        '화': { region: '남쪽 방위 (활발한 활동)', occupation: 'IT/방송, 미디어/광고, 전기/전자, 활력 서비스업' },
        '토': { region: '중앙/서남 방위 (안정적인 기반)', occupation: '부동산/건설, 중개/컨설팅, 농업/토목 등 안정 관련 업종' },
        '금': { region: '서쪽 방위 (결실과 정리)', occupation: '금융/회계, 의료/정밀기기, 법률/행정, 금속/제조업' },
        '수': { region: '북쪽 방위 (지혜와 통찰)', occupation: '유통/무역, 숙박/여행, 물류/해양, 심리/상담' }
    };
    return maps[ohaeng] || { region: '특정 방위 없음', occupation: '직업 선택에 제한 없음' };
}

// 이사 길방/흉살방 분석 함수 (기존 유지)
function getSafeMovingDirection(userDayTG, pillars) {
    const dayElem = TG_ELEM[userDayTG];
    const auspiciousOhaeng = getGeneratingElement(dayElem); 
    const auspiciousDirection = OHAENG_DIRECTION[auspiciousOhaeng]; 

    const yearDZ = pillars.year.dz;
    // 흉살방 계산
    const samSalBang = SAM_SAL_BANG_MAP[yearDZ]; 
    const daeJangGunBang = DAE_JANG_GUN_BANG_MAP[yearDZ]; 
    
    // 오행 방위와 흉살방 비교를 위해 단순화
    const directionMap = { '동쪽': '동', '남쪽': '남', '서쪽': '서', '북쪽': '북', '중앙/서남쪽': '중앙' };
    const simpleAuspDir = auspiciousDirection.split('/')[0].replace('쪽','');
    
    let isAuspiciousDirectionSafe = true;
    let safeDirection = auspiciousDirection;
    let badSal = [];

    if (directionMap[simpleAuspDir + '쪽'] === samSalBang) {
        isAuspiciousDirectionSafe = false;
        badSal.push('삼살방');
    }
    if (directionMap[simpleAuspDir + '쪽'] === daeJangGunBang) {
        isAuspiciousDirectionSafe = false;
        badSal.push('대장군방');
    }
    
    let advice = isAuspiciousDirectionSafe 
        ? `길방(${auspiciousDirection} 방위)이 흉살(삼살/대장군)을 피하므로 안심하고 진행하세요.`
        : `⚠️ 길방(${auspiciousDirection} 방위)이 ${badSal.join(', ')}에 해당되므로, 길방 대신 길일/길시를 활용하거나 방향을 재고하십시오.`;

    if (!isAuspiciousDirectionSafe) {
        safeDirection = `재고 필요 (${badSal.join(', ')} 포함)`;
    }

    return { 
        safeDirection: safeDirection, 
        isSafe: isAuspiciousDirectionSafe,
        auspiciousOhaeng: auspiciousOhaeng,
        advice: advice
    };
}


// calculateSubThemeScores (기존 유지)
function calculateSubThemeScores(datePillars, category, userDayTG) { 
    const dayElem = TG_ELEM[userDayTG]; 
    const results = {};
    const dayScore = (key) => getOhaengRelationshipScore(dayElem, TG_ELEM[datePillars[key].tg]) * 1.5 + getOhaengRelationshipScore(dayElem, DZ_ELEM[datePillars[key].dz]) * 1.0;
    const currentYear = new Date().getFullYear();

    if (category === 'business') {
        const wealthStrength = detectJaeStrength(userDayTG, datePillars); 
        const officialStrength = getElementStrength(datePillars, OHENG_SANGGEUK_MAP[dayElem]);
        const friendStrength = getElementStrength(datePillars, dayElem);
        const woodStrength = getElementStrength(datePillars, '목');
        const metalStrength = getElementStrength(datePillars, '금');
        const earthStrength = getElementStrength(datePillars, '토');

        results['계약'] = Math.round(50 + (officialStrength * 6) + (earthStrength * 3) + dayScore('day')); 
        results['매매/판매'] = Math.round(50 + (wealthStrength * 7) + (metalStrength * 4) + dayScore('month')); 
        results['창업/개시'] = Math.round(50 + (woodStrength * 6) + (friendStrength * 3) + dayScore('hour')); 

    } else if (category === 'travel') {
        const yearInfluence = (currentYear % 3 === 0) ? 5 : 0;
        const baseScore = 50 + yearInfluence;
        const totalScore = ['year', 'month', 'day', 'hour'].reduce((sum, k) => sum + dayScore(k), 0);

        results['비즈니스 여행'] = Math.round(baseScore + totalScore + getElementStrength(datePillars, '목') * 4); 
        results['힐링 여행'] = Math.round(baseScore + totalScore + getElementStrength(datePillars, '토') * 4); 
        results['가족 여행'] = Math.round(baseScore + totalScore + getElementStrength(datePillars, '화') * 4); 
        results['지적인 여행'] = Math.round(baseScore + totalScore + getElementStrength(datePillars, '수') * 4); 
        // '금' 오행 테마 추가
        results['쇼핑/결실 여행'] = Math.round(baseScore + totalScore + getElementStrength(datePillars, '금') * 4); 
        
    } else if (category === 'move') {
        // [MODIFIED] 이사 항목 세분화 (Q2 반영)
        const wealthStrength = detectJaeStrength(userDayTG, datePillars); 
        const supporterStrength = getElementStrength(datePillars, OHENG_SANGSAENG_MAP[dayElem]);
        const earthStrength = getElementStrength(datePillars, '토');

        const fortuneElementMap = {
            '사업/재물': wealthStrength > supporterStrength ? '재물운이 따름' : '사업에 길함',
            '가정 화목': '가정 화목/인덕 따름',
            '건강/안정': '건강과 안정이 따름'
        };

        results['사업/재물'] = Math.round(50 + (wealthStrength * 8) + (supporterStrength * 2));
        results['가정 화목'] = Math.round(50 + (supporterStrength * 8) + (earthStrength * 2));
        results['건강/안정'] = Math.round(50 + (earthStrength * 8) + (supporterStrength * 2));
        
        let bestTheme = '';
        let bestScore = -1;
        for (const theme in results) {
            if (results[theme] > bestScore) {
                bestScore = results[theme];
                bestTheme = theme;
            }
        }
        
        return { 
          bestTheme: bestTheme, 
          bestScore: Math.max(20, Math.min(95, bestScore)), 
          allScores: results,
          fortuneElement: fortuneElementMap[bestTheme]
        };
    }
    
    // 일반 테마의 경우 최대 점수와 테마를 반환
    let bestTheme = '';
    let bestScore = -1;
    for (const theme in results) {
        if (results[theme] > bestScore) {
            bestScore = results[theme];
            bestTheme = theme;
        }
    }

    return { 
      bestTheme: bestTheme, 
      bestScore: Math.max(20, Math.min(95, bestScore)), 
      allScores: results
    };
}


// scoreForCategory 함수 (고급 로직 사용)
function scoreForCategory(datePillars, cat){ 
    // 🚨 전역 변수 USER_SAJU_PILLARS에 의존
    if (!USER_SAJU_PILLARS || !USER_SAJU_PILLARS.day || !USER_SAJU_PILLARS.day.tg) return 50;
    
    const userDayTG = USER_SAJU_PILLARS.day.tg; 
    
    if (!userDayTG || !TIANGAN.includes(userDayTG)) return 50;
    
    let score=50; 

    // 'match' 점수 로직 (일간과의 비견/겁재 + 일지와의 합/충/형 등)
    if(cat==='wealth' || cat === 'match'){
        const jae=detectJaeStrength(userDayTG, datePillars); 
        if(cat==='wealth') score+=Math.round(jae*10);
        else if(cat==='match'){ 
            const dayElem=TG_ELEM[userDayTG]; 
            // 일간과 천간이 같은 경우 (비견/겁재)
            const sameTG = ['year','month','day','hour'].reduce((a,k)=> a + (TG_ELEM[datePillars[k].tg]===dayElem?1:0),0); 
            // 일지와 지지가 같은 경우
            const sameDZ = ['year','month','day','hour'].reduce((a,k)=> a + (DZ_ELEM[datePillars[k].dz]===DZ_ELEM[USER_SAJU_PILLARS.day.dz]?0.5:0),0);
            
            // (점수 로직 단순화: 비견/겁재가 많으면 인연 기회로 해석)
            score += (sameTG * 5) + (sameDZ * 3);
            
            // (추후 확장: 일지 합(육합, 삼합)이 들면 점수 가산)
        }
    } else if (cat === 'business' || cat === 'travel' || cat === 'move') {
        const themeResults = calculateSubThemeScores(datePillars, cat, userDayTG); 
        score = themeResults.bestScore;
        
        if (cat === 'business') datePillars.businessRec = themeResults;
        if (cat === 'travel') {
            const travelRec = {
              theme: themeResults.bestTheme, 
              bestScore: themeResults.bestScore,
              direction: getTravelDirection(themeResults.bestTheme), 
              distance: getTravelDistance(themeResults.bestScore),
              advice: getTravelAdvice(themeResults.bestTheme),
              allScores: themeResults.allScores // 모든 점수 저장
            };
            datePillars.travelRec = travelRec;
        }
        if (cat === 'move') {
            datePillars.moveRec = themeResults;
            // 이사 방향 안전 분석
            const moveDirection = getSafeMovingDirection(userDayTG, datePillars);
            datePillars.moveRec.safeDirection = moveDirection.safeDirection;
            datePillars.moveRec.isSafe = moveDirection.isSafe;
            datePillars.moveRec.moveAdvice = moveDirection.advice;
            datePillars.moveRec.auspiciousOhaeng = moveDirection.auspiciousOhaeng;
        }
    } 
    
    score+=evaluateYearInfluence((new Date()).getFullYear(),cat); 
    if(score>95) score=95; if(score<20) score=20; return Math.round(score);
}

// getTravelDirection, getTravelAdvice, getTravelDistance, evaluateYearInfluence (기존 유지)
function getTravelDirection(theme) {
    if (theme.includes('비즈니스') || theme.includes('지적인')) return '동북(새로운 시작) 또는 북(지혜)';
    if (theme.includes('힐링')) return '서남(안정) 또는 중앙(재충전)';
    if (theme.includes('가족')) return '남쪽(열정) 또는 서쪽(결실)';
    if (theme.includes('쇼핑')) return '서쪽(결실) 또는 남쪽(활력)';
    return '근거리/당일';
}
function getTravelAdvice(theme) {
    if (theme.includes('비즈니스')) return '업무 관련 만남이나 투자처 물색에 집중하세요.';
    if (theme.includes('힐링')) return '자연 속에서 휴식하며 마음의 안정을 찾으세요.';
    if (theme.includes('가족')) return '가족과의 시간을 통해 소중한 추억을 만들고 화합을 도모하세요.';
    if (theme.includes('지적인')) return '박물관이나 도서관 등 지적인 활동에 집중하세요.';
    if (theme.includes('쇼핑')) return '쇼핑이나 즐거운 활동으로 스트레스를 해소하고 결실을 얻으세요.';
    return '평이한 하루를 보낼 수 있는 곳이 좋습니다.'; 
}
function getTravelDistance(score) {
    const MAX_DISTANCE = 500; 
    const simpleDist = Math.round(10 * (score / 20)); 
    return `${Math.min(simpleDist, MAX_DISTANCE)}km ~ ${Math.min(simpleDist + 50, MAX_DISTANCE * 2)}km`; 
}
function evaluateYearInfluence(year, cat) { 
    if (year % 5 === 0 && (cat === 'wealth' || cat === 'business')) return 5; 
    if (year % 7 === 0 && cat === 'match') return 5; 
    return 0; 
} 

// getStrategyByScore 함수 (기존 유지)
function getStrategyByScore(userDayTG, category, score, extraRec = {}) { 
    if (!userDayTG || !TG_ELEM[userDayTG]) userDayTG = '갑'; 
    const dayElem = TG_ELEM[userDayTG]; 
    if (category === 'wealth') { 
        if (score >= 80) return { title: '대규모 투자/계약 실행', desc: '🚀 새로운 자산에 공격적으로 투자하거나 주요 계약을 실행하여 성과를 극대화하십시오.' }; 
        if (score >= 60) return { title: '안정적 투자/현금 확보', desc: '💰 안전한 범위 내에서 투자를 진행하고 현금 유동성을 확보하는 데 집중하십시오.' };
        if (score >= 40) return { title: '현상 유지 및 위험 관리', desc: '🛡️ 예상치 못한 지출이나 위험을 관리하며 현상 유지를 목표로 하십시오.' }; 
        return { title: '휴식/재정비', desc: '😴 중요 결정은 미루고, 휴식을 취하며 아이디어를 재정비하십시오.' }; 
    } 
    if (category === 'match') {
        if (score >= 80) return { title: '적극적인 만남 추진', desc: '💖 평소 관심 있던 사람에게 적극적으로 접근하거나 중요한 만남을 주선하십시오.' }; 
        if (score >= 60) return { title: '기존 관계 발전 모색', desc: '🤝 현재의 인연과 관계를 돈독히 하고, 발전시킬 기회를 찾으십시오.' };
        if (score >= 40) return { title: '소극적 만남/내실 다지기', desc: '🧘‍♀️ 무리한 관계 진전보다는 내실을 다지며 주변 상황을 관찰하십시오.' }; 
        return { title: '구설수/오해 방지', desc: '🗣️ 감정적인 충돌이나 오해를 부를 수 있는 상황을 피하고 말을 아끼십시오.' };
    }
    if (category === 'business') {
        if (score >= 80) return { title: '주요 프로젝트 및 발표', desc: '📈 추진력을 발휘하여 주요 프로젝트를 개시하거나 공식적으로 성과를 발표하십시오.' }; 
        if (score >= 60) return { title: '업무 시스템 점검 및 효율화', desc: '⚙️ 업무 시스템을 점검하고 효율화하는 데 집중하십시오.' }; 
        if (score >= 40) return { title: '현상 유지 및 위험 관리', desc: '🛡️ 예상치 못한 지출이나 위험을 관리하며 현상 유지를 목표로 하십시오.' }; 
        return { title: '휴식/재정비', desc: '😴 중요 결정은 미루고, 휴식을 취하며 아이디어를 재정비하십시오.' }; 
    }
    if (category === 'travel') { 
        if (score >= 80) return { title: '장거리/장기간 여행 추천', desc: '✈️ 새로운 경험과 에너지 충전을 위해 길게 떠나는 여행이 좋습니다.' }; 
        if (score >= 60) return { title: '중단거리 여행 추천', desc: '🚞 주말을 활용하여 기분 전환할 수 있는 중거리 여행을 계획하십시오.' }; 
        if (score >= 40) return { title: '근거리/당일치기 추천', desc: '🚶 근처에서 가볍게 기분을 전환할 수 있는 당일치기 여행이 좋습니다.' }; 
        return { title: '여행 자제, 휴식 필요', desc: '🏠 에너지가 부족하니, 집에서 충분한 휴식을 취하십시오.' }; 
    } 
    if (category === 'move' && extraRec.fortuneElement) { 
        const theme = extraRec.bestTheme; 
        const moveAdvice = extraRec.moveAdvice || ''; // 흉살방 조언 
        return { title: `이사 길함 테마: ${theme}`, desc: `✨ ${extraRec.fortuneElement} 기운을 활용하는 이사에 길합니다. ${moveAdvice}` }; 
    } 
    return { title: '일반적 권장', desc: '평이한 날입니다. 일상적인 활동을 유지하십시오.' }; 
} 

// 복권 번호 및 점수 계산 로직 (유료 서비스 핵심)
function generateLottoNumbers(jaeStrength) {
    const weightMap = Array.from({ length: 45 }, (_, i) => Math.round(5 + (i * (jaeStrength / 10)))); 
    const sets = [];
    for (let setIndex = 0; setIndex < 5; setIndex++) {
        const numbers = new Set();
        let attempts = 0;
        const pool = [];
        for (let i = 1; i <= 45; i++) {
            for (let j = 0; j < weightMap[i - 1]; j++) {
                pool.push(i);
            }
        }
        while (numbers.size < 6 && attempts < 100) {
            const randIndex = Math.floor(Math.random() * pool.length);
            numbers.add(pool[randIndex]);
            attempts++;
        }
        sets.push([...numbers].sort((a, b) => a - b));
    }
    return sets;
}
function generateLottoScores(dayPillars, userDayTG) { 
    const dayElem = TG_ELEM[userDayTG]; 
    const jaeElem = OHENG_SANGGEUK_MAP[dayElem]; 
    let jaeStrength = getElementStrength(dayPillars, jaeElem); 
    // 복권별 점수 계산 (재성 강도 및 성격 반영) 
    let instantScore = Math.round(50 + (jaeStrength * 8)); // 편재 성격 (단기/횡재성) 
    let pensionScore = Math.round(50 + (jaeStrength * 5)); // 정재 성격 (장기/안정성) 
    let lottoScore = Math.round(50 + (jaeStrength * 10)); // 편재 성격 (횡재성 극대화) 
    // 일간과의 오행 관계 점수 반영 (재물운이 너무 약하면 점수 하락) 
    const overallDayScore = ['year', 'month', 'day', 'hour'].reduce((sum, k) => sum + getOhaengRelationshipScore(dayElem, TG_ELEM[dayPillars[k].tg]), 0); 
    if (overallDayScore < -5) { 
        instantScore = Math.max(20, instantScore - 10); 
        lottoScore = Math.max(20, lottoScore - 15); 
    } 
    instantScore = Math.min(99, Math.max(10, instantScore)); 
    pensionScore = Math.min(99, Math.max(10, pensionScore)); 
    lottoScore = Math.min(99, Math.max(10, lottoScore));
    
    // 로또 번호 생성 (가중치 사용)
    const lottoNumbers = generateLottoNumbers(lottoScore / 10);
    
    return { instantScore, pensionScore, lottoScore, lottoNumbers }; 
}

// 월간 추천 결과를 HTML로 변환하는 서버 측 함수 (클라이언트 측 HTML 생성 함수 대체)
function serverRenderMonthResult(monthResult, birthInfo) {
    let html = `<div class="result-card"><h2>🔮 ${birthInfo.year}년 ${birthInfo.month}월 한 달 추천 길일</h2>`;
    html += `<p class="desc" style="color:#666; margin-bottom: 20px;">선택하신 월의 길일 추천 결과를 카테고리별로 모아보았습니다.</p>`;
    
    // 월간 데이터 정리 (카테고리별로 묶기)
    const categorizedResults = {};
    monthResult.forEach(day => {
        // day.results 배열을 순회
        day.results.forEach(res => {
            const cat = res.category;
            if (!categorizedResults[cat]) {
                categorizedResults[cat] = [];
            }
            // 필요한 정보만 저장 (HTML 렌더링을 위해)
            categorizedResults[cat].push({
                dateStr: day.dateStr,
                weekday: day.weekday,
                score: res.score,
                strategy: res.strategy,
                categoryLabel: {wealth:'재물',match:'인연',business:'사업',travel:'여행',move:'이사'}[cat]
            });
        });
    });

    // 카테고리 순서 정의
    const categoriesOrder = ['wealth', 'match', 'business', 'travel', 'move'];

    // 카테고리별 결과 HTML 생성
    categoriesOrder.forEach(cat => {
        const catResults = categorizedResults[cat];
        if (!catResults || catResults.length === 0) return;

        const catLabel = catResults[0].categoryLabel;
        html += `<div class="month-category-block" data-cat="${cat}" style="margin-top:25px; padding-top:15px; border-top:1px solid #eee;">
                    <h3 style="color:var(--accent); font-size:18px; margin-bottom:10px;">${catLabel} 분야 추천 길일 (${catResults.length}일)</h3>
                </div>`;
        
        catResults.sort((a, b) => b.score - a.score).slice(0, 7).forEach(res => { // 상위 7개만 표시
            html += `<div class="month-day-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px dotted #ddd;">
                        <div style="font-weight:700; color:#333;">
                            📅 ${res.dateStr} (${res.weekday}) <span style="font-size:14px; color:var(--muted); margin-left:10px;">${res.strategy.title}</span>
                        </div>
                        <span class="badge" style="background:${res.score>=80?'var(--high)':res.score>=65?'var(--mid)':res.score>=50?'var(--low)':'var(--def)'};color:#fff; padding: 4px 8px; border-radius: 4px;">${res.score}점</span>
                    </div>`;
        });
        
        // 추가 조언 (예시)
        if (cat === 'move') {
            html += `<p style="font-size:14px; color:#4a4a4a; margin-top:10px;">📌 **이사 길방 참고:** 이사 항목은 길일 외에 흉살방을 피하는 것이 중요합니다. 이사 결정 시 별도 상담을 통해 최종 방향을 확인하십시오.</p>`;
        }
    });

    html += `</div>`;
    return html;
}

// monthTopN 함수는 월간 계산 로직이므로, 서버에서만 사용됩니다.
function monthTopN(userPillars, year, month) { 
    // 🚨 전역 변수 USER_SAJU_PILLARS 의존성이 있습니다. monthTopN 호출 전에 handler에서 전역변수를 설정해야 합니다.

    const daysInMonth = new Date(year, month, 0).getDate();
    const results = [];
    
    for (let day = 1; day <= daysInMonth; day++) { 
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dt = new Date(year, month - 1, day);
        const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
        const hour = userPillars.hour ? parseInt(userPillars.hour.hour.slice(0,2), 10) : null; // 시간 정보 추출 (필요 시 수정)
        
        const pillars = calculatePillars(dt, hour);
        
        const dayResults = [];
        ['wealth', 'match', 'business', 'travel', 'move'].forEach(category => {
            const score = scoreForCategory(pillars, category);
            const extraRec = (pillars.businessRec || pillars.travelRec || pillars.moveRec) || {};
            const strategy = getStrategyByScore(USER_SAJU_PILLARS.day.tg, category, score, extraRec);
            
            dayResults.push({ category, score, strategy, recommend: extraRec });
        });

        results.push({
            dateStr,
            weekday,
            results: dayResults,
            dayPillars: pillars,
            coordinationAdvice: generateCoordinationAdvice(USER_SAJU_PILLARS.day.tg, pillars)
        });
    } 
    return results; 
}


// ----------------------------------------------------------------------
// ⭐️ 서버리스 함수 진입점: /api/month
// ----------------------------------------------------------------------
export default async function handler(request, response) {
    // 요청 바디에서 필요한 데이터 추출
    const { birthInfo, email, token, code } = request.body; 
    let client; // MongoDB 클라이언트 변수

    // 🚨 전체 로직을 try...catch로 감싸서 500 에러 발생 시 디버깅 정보 제공
    try {
        // 1. MongoDB 연결
        client = await MongoClient.connect(uri, { /* 옵션 */ });
        const db = client.db('saju_db'); // 데이터베이스 이름 확인
        const collection = db.collection('users'); // 컬렉션 이름 확인
        
        // 2. 인증 로직
        let user = null;
        let newToken = null;

        // 기존 토큰으로 확인
        if (token) {
            user = await collection.findOne({ access_token: token, user_email: email });
        }
        
        // 토큰이 없거나 만료되어 코드로 재인증 시도
        if (!user && code) {
            // 이메일과 코드가 매칭되는지 확인 (최초 인증)
            user = await collection.findOne({ user_email: email, auth_code: code });
            
            if (user) {
                // 인증 성공! 새로운 토큰 발급 및 DB에 업데이트
                newToken = generateToken();
                await collection.updateOne({ _id: user._id }, { $set: { access_token: newToken } });
            }
        }

        // 3. 🚨 최종 인증 실패
        if (!user) {
            // DB 연결 닫고 401 반환
            await client.close();
            return response.status(401).json({ error: '인증 실패: 입력 정보가 잘못되었거나 유료 토큰이 만료되었습니다.' });
        }
        
        // 4. ✅ 인증 성공: 유료 로직 실행
        const dt = new Date(birthInfo.year, birthInfo.month - 1, birthInfo.day);
        const userPillars = calculatePillars(dt, parseInt(birthInfo.hour, 10));
        
        // 🚨 사주 계산 로직이 전역 변수 USER_SAJU_PILLARS에 의존하므로, 여기서 설정합니다.
        USER_SAJU_PILLARS = userPillars;
        
        // 월간 운세 계산 실행
        const monthResult = monthTopN(userPillars, parseInt(birthInfo.year, 10), parseInt(birthInfo.month, 10)); 

        // 5. 결과 반환을 위한 HTML 생성 (서버 측 렌더링 함수 사용)
        const htmlContent = serverRenderMonthResult(monthResult, birthInfo);
        
        // DB 연결 닫기
        await client.close(); 
        
        return response.status(200).json({ 
            htmlContent: htmlContent, 
            access_token: newToken // 새로운 토큰이 있다면 반환
        });
    
    // 🚨 catch 블록: 치명적인 서버 오류 발생 시 처리
    } catch (error) {
        // DB 클라이언트가 연결된 상태라면 닫아줍니다.
        if (client) {
            await client.close();
        }
        console.error("month.js 실행 중 치명적인 오류 발생:", error);
        
        // 오류 메시지를 클라이언트에게 500 응답으로 보냄
        return response.status(500).json({ 
            error: '서버 내부 오류로 계산을 완료할 수 없습니다.', 
            detail: error.message 
        });
    }
}