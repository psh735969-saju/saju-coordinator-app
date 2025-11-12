// /api/month.js 파일의 최종 내용 (전체)

// ⭐️ 맨 위: DB 접속용 라이브러리 및 함수
import { MongoClient } from 'mongodb'; 
// Vercel 환경 변수 MONGODB_URI 사용
const uri = process.env.MONGODB_URI; 
const generateToken = () => Math.random().toString(36).substring(2, 15) + Date.now(); // 자동 인증 ID 생성


// --------------------------------------------------------------------------

/* ----------------------------------------------------------------------------------
   [PLACEHOLDER] 사주 핵심 로직: 젬사주코디완성본.html에서 오려낸 모든 상수와 함수 정의
   사장님의 원본 파일에서 TIANGAN, DIZHI 상수부터 monthTopN 함수까지 모든 코드를 복사해서
   이 블록 안에 붙여넣으세요. (today.js와 동일)
   ---------------------------------------------------------------------------------- */

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
    const userDayDZ = USER_SAJU_PILLARS.day.dz; 
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
        if (score >= 60) return { title: '장기 저축/재테크 집중', desc: '📈 급격한 변화보다는 안정적인 장기 저축이나 포트폴리오 재구성에 집중하십시오.' };
        if (score >= 40) return { title: '현상 유지 및 지출 통제', desc: '⚖️ 큰 변화 없이 현금 흐름을 안정적으로 유지하고, 불필요한 충동적인 지출을 삼가십시오.' };
        return { title: '지갑 단속, 소액 투자도 자제', desc: '🚧 현금 유출에 주의하고, 모든 신규 투자를 미루십시오.' };
    } 
    
    if (category === 'match') {
        if (score >= 80) return { title: '적극적인 만남 추진', desc: '❤️ 인연 운이 강하니, 적극적으로 활동하여 좋은 인연을 맺으십시오.' };
        if (score >= 60) return { title: '만남의 장 확대', desc: '😊 기존 관계를 발전시키고 새로운 모임에 참여하여 기회를 넓히십시오.' };
        if (score >= 40) return { title: '관계를 신중하게 유지', desc: '🤔 충동적인 만남은 피하고, 기존 관계를 돌아보는 데 집중하십시오.' };
        return { title: '대인 관계 휴식', desc: '🧘 잠시 혼자만의 시간을 가지며 다음 기회를 기다리십시오.' };
    }
    
    if (category === 'business') {
        // 사업 전략 (하위 테마 중 최고 점수 기준)
        if (score >= 80) return { title: '사업 확장/주요 계약 체결', desc: '🌟 추진력을 발휘하여 사업을 확장하고 대규모 계약을 성사시키십시오.' };
        if (score >= 60) return { title: '내부 정리 및 효율화', desc: '💡 큰 변화보다 내부 시스템을 점검하고 효율화하는 데 집중하십시오.' };
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
        return { 
            title: `이사 길함 테마: ${theme}`, 
            desc: `✨ ${extraRec.fortuneElement} 기운을 활용하는 이사에 길합니다. ${moveAdvice}`
        }; 
    }
    
    return { title: '일반적 권장', desc: '평이한 날입니다. 일상적인 활동을 유지하십시오.' }; 
}

// 로또 번호 생성 로직 추가 (사주 오행 강도 기반) (기존 유지)
function generateLottoNumbers(dayPillars) {
    const ohaengStrengths = {};
    ['목','화','토','금','수'].forEach(elem => {
         ohaengStrengths[elem] = getElementStrength(dayPillars, elem);
    });
    
    // 오행 강도를 기반으로 번호 범위와 가중치 설정 (1~45)
    // 오행별 번호 범위: 목(1-9), 화(10-18), 토(19-27), 금(28-36), 수(37-45)
    const ohaengRanges = {
        '목': [1, 9], '화': [10, 18], '토': [19, 27], '금': [28, 36], '수': [37, 45]
    };
    
    // 가장 강한 1~2개 오행 찾기
    const sortedOhaeng = Object.entries(ohaengStrengths).sort(([, a], [, b]) => b - a);
    const strongestOhaeng = sortedOhaeng.slice(0, 2).map(([elem]) => elem);
    
    // 번호 가중치 생성: 강한 오행의 번호 범위에 가중치 부여 (3배)
    let weightMap = new Array(45).fill(1);
    strongestOhaeng.forEach(elem => {
        const [min, max] = ohaengRanges[elem];
        for (let i = min; i <= max; i++) {
            weightMap[i - 1] = 3; 
        }
    });

    // 5세트 생성
    const sets = [];
    for (let s = 0; s < 5; s++) {
        const numbers = new Set();
        let attempts = 0;
        while (numbers.size < 6 && attempts < 1000) { // 무한 루프 방지
            let pool = [];
            for (let i = 1; i <= 45; i++) {
                for (let j = 0; j < weightMap[i - 1]; j++) {
                    pool.push(i);
                }
            }
            // 가중치 풀에서 무작위 선택
            const randIndex = Math.floor(Math.random() * pool.length);
            numbers.add(pool[randIndex]);
            attempts++;
        }
        sets.push([...numbers].sort((a, b) => a - b));
    }
    return sets;
}

// 복권 점수 로직 (로또 번호 생성 추가) (기존 유지)
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
    
    // 로또 번호 생성 추가
    const generatedNumbers = generateLottoNumbers(dayPillars); 

    return {
        instant: instantScore, 
        pension: pensionScore, 
        lotto: lottoScore,
        lottoNumbers: generatedNumbers // NEW: 5세트 로또 번호
    };
}


// getOptimalLottoTime (기존 유지)
function getOptimalLottoTime(dayTG) {
    const dayElem = TG_ELEM[dayTG];
    let bestTime = null;
    let maxScore = -99;
    
    for (let h = 0; h < 24; h += 2) {
        const hourPillar = calcHourPillar(dayTG, h);
        const hourTG = hourPillar.tg;
        const hourElem = TG_ELEM[hourTG];
        
        // 일간과 상생 또는 비화(같은 오행)하는 시를 찾음
        let score = getOhaengRelationshipScore(dayElem, hourElem);

        if (score > maxScore) {
            maxScore = score;
            bestTime = hourPillar;
        }
    }
    return bestTime;
}


/* ---------------------------
   UI 렌더링 및 이벤트 처리
   --------------------------- */

function getBirthDateFromSelectors() {
    const y=document.getElementById('birthYear').value;
    const m=document.getElementById('birthMonth').value;
    const d=document.getElementById('birthDay').value;
    if (!y || !m || !d) return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function parseDateString(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// displayPillars 함수 - 만세력 표시 및 오류 방지 강화 (기존 유지)
function displayPillars() {
    const birthDateISO = getBirthDateFromSelectors();
    const hourRaw = document.getElementById('birthhour').value;
    const hour = hourRaw === '' ? null : parseInt(hourRaw, 10);
    const pillarDiv = document.getElementById('pillars');

    if (!birthDateISO) {
        pillarDiv.innerHTML = '<div style="color:red;font-weight:700;">⚠️ 생년월일 (년/월/일)을 모두 선택해야 만세력이 표시됩니다.</div>';
        USER_SAJU_PILLARS = null;
        return;
    }

    try {
        const dt = parseDateString(birthDateISO);
        USER_SAJU_PILLARS = calculatePillars(dt, hour === null ? 0 : hour);
        
        const p = USER_SAJU_PILLARS;
        const dayTG = p.day.tg;
        const dayMasterOhaeng = TG_ELEM[dayTG];

        // 5. 일간 기반 삶의 목표/비전 문구 (통근 기반)
        const vision = getUserLifeVision(p);
        
        const ohaengStrengths = {};
        ['목','화','토','금','수'].forEach(elem => {
             ohaengStrengths[elem] = getElementStrength(p, elem);
        });
        
        const ohaengHtml = Object.entries(ohaengStrengths)
            .sort(([, a], [, b]) => b - a)
            .map(([elem, strength]) => 
                `<span style="font-weight:700; color:${elem === dayMasterOhaeng ? 'var(--accent)' : '#333'}">${elem}:</span> ${strength.toFixed(1)}점`
            ).join(' | ');

        let html = `
            <div class="pillar-row">
                <div class="pillar-cell"><div class="pillar-label">년주</div><div class="pillar-tg">${p.year.tg}</div><div class="pillar-dz">${p.year.dz}</div></div>
                <div class="pillar-cell"><div class="pillar-label">월주</div><div class="pillar-tg">${p.month.tg}</div><div class="pillar-dz">${p.month.dz}</div></div>
                <div class="pillar-cell"><div class="pillar-label" style="font-weight:900;color:red;">일주 (나)</div><div class="pillar-tg">${p.day.tg}</div><div class="pillar-dz">${p.day.dz}</div></div>
                <div class="pillar-cell"><div class="pillar-label">시주</div><div class="pillar-tg">${p.hour.tg}</div><div class="pillar-dz">${p.hour.dz}</div></div>
            </div>
            <div style="margin-top:16px; font-size:14px;">
                <strong>일간(나):</strong> <span style="font-weight:700; color:var(--accent);">${dayTG} (${dayMasterOhaeng})</span>
            </div>
            <div style="margin-top:8px; font-size:13px; color:#4a4a4a;">
                <strong>오행 강도:</strong> ${ohaengHtml}
            </div>
            <div style="margin-top:12px; font-size:14px; padding:10px; border-top:1px dashed #eee;">
                <strong>✨ 삶의 비전:</strong> ${vision}
            </div>
        `;
        
        // 복권 최적 시각 정보
        let lottoHtml = '<div style="margin-top:16px; padding-top:10px; border-top:1px dashed #eee;"><strong>💰 복권 구매 최적 시각 (일간 기반):</strong> <div id="lottoTimeDisplay" style="margin-top:6px;">계산 중...</div></div>';
        
        // 비동기로 계산 결과 표시
        
setTimeout(() => {
  const lottoTimeDisplay = document.getElementById('lottoTimeDisplay');
  if (lottoTimeDisplay) {
    const optimalTime = getOptimalLottoTime(dayTG);
    if (optimalTime) {

      // ✅ 지지 → 실제 시각 매핑 추가
      const DZ_TO_TIME = {
        '자': '23:30 ~ 01:29',
        '축': '01:30 ~ 03:29',
        '인': '03:30 ~ 05:29',
        '묘': '05:30 ~ 07:29',
        '진': '07:30 ~ 09:29',
        '사': '09:30 ~ 11:29',
        '오': '11:30 ~ 13:29',
        '미': '13:30 ~ 15:29',
        '신': '15:30 ~ 17:29',
        '유': '17:30 ~ 19:29',
        '술': '19:30 ~ 21:29',
        '해': '21:30 ~ 23:29'
      };

      const dzName = optimalTime.dz;
      const timeRange = DZ_TO_TIME[dzName] || '';
      let displayContent = `
        <div style="margin-top:6px;">
          권장 시각: <strong>${dzName}시 (${timeRange})</strong> 
          (천간 ${optimalTime.tg}${TG_ELEM[optimalTime.tg]} 기운)
        </div>
        <div class="muted" style="margin-top:4px;">
          일간(${dayTG}${dayMasterOhaeng})과 상생/비화하는 기운을 가진 시간대에 구매하십시오.
        </div>`;
      lottoTimeDisplay.innerHTML = displayContent;
    } else {
      lottoTimeDisplay.innerHTML = `<div style="margin-top:6px;">최적의 상생 시간이 발견되지 않았습니다.</div>`;
    }
  }
}, 0);


        pillarDiv.innerHTML = html + lottoHtml;

    } catch (e) {
        console.error("만세력 표시 오류 발생:", e);
        pillarDiv.innerHTML = `<div style="color:red;font-weight:700;">❌ 만세력 계산 오류: 입력 값을 확인하거나 콘솔(F12)을 확인하십시오.</div><div class="muted" style="margin-top:6px;">오류 상세: ${e.message}</div>`;
        USER_SAJU_PILLARS = null;
    }
}


// getUserLifeVision 함수 - 통근(通根) 상태 반영 (기존 유지)
function getUserLifeVision(pillars) {
    const dayMasterTG = pillars.day.tg;
    const dayMasterOhaeng = TG_ELEM[dayMasterTG];
    let tonggeunCount = 0;
    
    // 일간이 년/월/일/시 지지에 통근하는지 확인 (통근 정의 사용)
    ['year', 'month', 'day', 'hour'].forEach(k => {
        const dz = pillars[k].dz;
        if (DZ_HIDDEN[dz].includes(dayMasterTG)) {
            tonggeunCount += 1;
        }
    });

    const baseVisions = { 
        '목': '성장과 발전 (창의성, 진취성).', 
        '화': '열정과 빛 (명예, 외향성).', 
        '토': '안정과 조율 (중재, 신용).', 
        '금': '결실과 정의 (원칙, 결단력).', 
        '수': '지혜와 통찰 (심사숙고, 유연성).' 
    };

    let vision = baseVisions[dayMasterOhaeng] || '자신만의 길을 찾는 것이 목표입니다.';

    if (tonggeunCount >= 3) {
        vision = `✨ **(${dayMasterOhaeng} 통근력 극대화)** ✨ ${vision} 잠재력이 매우 강하므로, 당신의 비전을 세상에 강력하게 펼치는 것이 핵심 목표입니다.`;
    } else if (tonggeunCount === 2) {
        vision = `🌟 **(${dayMasterOhaeng} 통근력 강함)** 🌟 ${vision} 탄탄한 기반을 활용하여 목표 달성에 집중하고, 인재 양성 및 리더십을 발휘하는 것이 목표입니다.`;
    } else if (tonggeunCount === 1) {
        vision = `🌱 **(${dayMasterOhaeng} 통근력 확보)** 🌱 ${vision} 발현을 위해 꾸준히 노력해야 합니다. 내실을 다지고 조력자(인성)를 적극적으로 찾는 것이 목표입니다.`;
    } else {
        vision = `💧 **(${dayMasterOhaeng} 통근력 약함)** 💧 ${vision} 자신의 힘을 키우기보다 협력과 지혜(수)를 통해 목표를 달성하고, 내면의 성숙에 집중하십시오.`;
    }
    
    return vision;
}

// [MODIFIED] renderDayAllBlock 함수 - 행운 코디 섹션 추가
function renderDayAllBlock(dateStr, weekday, resultsArray, lottoTime, dayPillars, coordinationAdvice) {
    const results = document.getElementById('results');
    const block = document.createElement('div');
    block.className='card'; block.dataset.cat='single';
    const h = document.createElement('div'); h.className='title'; h.textContent=`${dateStr} (${weekday}요일) 단일 날짜 운세`; block.appendChild(h);
    
    // 복권 최적 시각 정보
    const dayTG = dayPillars.day.tg;
    const dayMasterOhaeng = TG_ELEM[dayTG];
    let lottoTimeHtml = '';
    if (lottoTime) {
        lottoTimeHtml = `<div style="margin-top:12px; padding:10px; border-top:1px dashed #eee; font-size:14px;">
            <strong>💰 복권 최적 시각:</strong> ${lottoTime.dz}시 (천간 ${lottoTime.tg}${TG_ELEM[lottoTime.tg]} 기운)<br>
            <div class="muted" style="margin-top:4px;">일간(${dayTG}${dayMasterOhaeng})과 상생/비화하는 기운을 가진 시간에 구매하십시오.</div>
        </div>`;
    }

    block.innerHTML += lottoTimeHtml;

    // NEW: 행운 코디 섹션 추가
    const coordHtml = `<div style="margin-top:16px; padding:12px; border:1px solid var(--accent); background:#fffdf5; border-radius:8px;">
        <div style="font-size:18px; font-weight:700; color:var(--accent); margin-bottom:10px;">🌟 오늘의 행운 코디 (길함 오행: ${coordinationAdvice.luckyOhaeng})</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:14px;">
            <div><strong>🎨 행운 색상:</strong> <span style="font-weight:700; color:var(--accent);">${coordinationAdvice.luckyColor}</span></div>
            <div><strong>👔 권장 의상:</strong> ${coordinationAdvice.luckyOutfit}</div>
            <div><strong>🧭 권장 방향:</strong> ${coordinationAdvice.luckyDirection}</div>
            <div><strong>🏃 권장 행동:</strong> ${coordinationAdvice.actionAdvice}</div>
        </div>
        <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #f0e6cf; color:${coordinationAdvice.warning.includes('사고수') || coordinationAdvice.warning.includes('구설수') ? 'red' : 'green'}; font-weight:700;">
            🚨 주의 및 조언: ${coordinationAdvice.warning}
        </div>
        <div class="muted" style="margin-top:4px; font-size:13px;">
            ${coordinationAdvice.generalAdvice}
        </div>
    </div>`;
    
    block.innerHTML += coordHtml;

    resultsArray.forEach(res=>{
        const node = document.createElement('div'); node.className='single-result';
        const left = document.createElement('div'); left.className='left';
        const categoryMap = {wealth:'재물',match:'인연',business:'사업',travel:'여행',move:'이사'};
        const catLabel = categoryMap[res.category];
        
        left.innerHTML = `<div class="title">${catLabel} <span class="badge" style="background:${res.score>=80?'var(--high)':res.score>=65?'var(--mid)':res.score>=50?'var(--low)':'var(--def)'};color:#fff;">${res.score}점</span></div>
                          <div style="margin-top:6px; font-weight:700;">✅ ${res.strategy.title}</div>
                          <div class="muted" style="margin-top:2px; font-size:14px;">${res.strategy.desc}</div>`;

        if (res.recommend) {
             // 사업 항목 상세 점수 표시
             if (res.category === 'business' && res.recommend && res.recommend.allScores) { 
                left.innerHTML += `<div style="margin-top:8px; border-top:1px dashed #eee; padding-top:8px;">
                                    <strong>📈 비즈니스 상세 점수:</strong>
                                    <div class="muted" style="margin-top:4px; font-size:14px; line-height:1.5;">
                                      <strong>계약:</strong> ${res.recommend.allScores['계약']}점<br>
                                      <strong>매매/판매:</strong> ${res.recommend.allScores['매매/판매']}점<br>
                                      <strong>창업/개시:</strong> ${res.recommend.allScores['창업/개시']}점
                                    </div>
                                  </div>`;
             // 여행 항목 상세 점수 및 방위 표시
            } else if (res.category === 'travel' && res.recommend && res.recommend.allScores) { 
                const travelThemeMap = {
                    '비즈니스 여행': { ohaeng: '목', dir: OHAENG_DIRECTION['목'] },
                    '힐링 여행': { ohaeng: '토', dir: OHAENG_DIRECTION['토'] },
                    '가족 여행': { ohaeng: '화', dir: OHAENG_DIRECTION['화'] },
                    '지적인 여행': { ohaeng: '수', dir: OHAENG_DIRECTION['수'] },
                    '쇼핑/결실 여행': { ohaeng: '금', dir: OHAENG_DIRECTION['금'] }
                };
                let travelHtml = '';
                for (const [theme, data] of Object.entries(travelThemeMap)) {
                    travelHtml += `<strong>${theme.split(' ')[0]}(${data.ohaeng}):</strong> ${res.recommend.allScores[theme]}점 <span class="muted">(방위: ${data.dir})</span><br>`;
                }
                
                left.innerHTML += `<div style="margin-top:8px; border-top:1px dashed #eee; padding-top:8px;">
                                    <strong>✈️ 여행 테마 상세 점수:</strong>
                                    <div class="muted" style="margin-top:4px; font-size:14px; line-height:1.6;">
                                      ${travelHtml}
                                    </div>
                                  </div>`;
            // [NEW/MODIFIED] 이사 항목 상세 점수 표시 (Q2 반영)
            } else if (res.category === 'move' && res.recommend && res.recommend.allScores) { 
                const moveRec = res.recommend;
                const safeStatus = moveRec.isSafe ? '✅ 안전' : '❌ 흉살방';
                
                let moveHtml = '';
                for (const theme in moveRec.allScores) {
                    moveHtml += `<strong>${theme}:</strong> ${moveRec.allScores[theme]}점<br>`;
                }

                left.innerHTML += `<div style="margin-top:8px; border-top:1px dashed #eee; padding-top:8px;">
                                    <strong>🏠 이사 테마 상세 점수:</strong>
                                    <div class="muted" style="margin-top:4px; font-size:14px; line-height:1.6;">
                                      ${moveHtml}
                                    </div>
                                  </div>`;
                left.innerHTML += `<div style="margin-top:8px"><strong>추천 테마:</strong> ${moveRec.bestTheme} (${moveRec.bestScore}점)</div> <div class="muted" style="margin-top:4px;">길방: ${moveRec.safeDirection} (${safeStatus}) · 길함요소: ${moveRec.fortuneElement}</div>`; 
            }
            // '인연' 단일 날짜 렌더링
             else if (res.category === 'match' && res.recommend.region) { 
                left.innerHTML += `<div style="margin-top:8px"><strong>권장 지역/방위:</strong> ${res.recommend.region}</div>
                                     <div class="muted" style="margin-top:4px;"><strong>권장 직업/활동:</strong> ${res.recommend.occupation}</div>
                                     <div class="muted" style="margin-top:2px; font-size:12px;">(희신 ${res.recommend.favorableOhaeng} 기반)</div>`;
            }
        }
        // 재물 카테고리에 로또 번호 5세트 추가
        if(res.category === 'wealth' && res.lottoScores) {
             let lottoHtml = res.lottoScores.lottoNumbers.map((set, index) => 
                `<div style="font-weight:600; font-size:15px; margin-top:4px; padding:2px 0; border-bottom:1px solid #f0f0f0;">${index+1}. ${set.join(', ')}</div>`
             ).join('');
             
             left.innerHTML += `<div style="margin-top:8px"><strong>복권점수:</strong> 즉석 ${res.lottoScores.instant}점 · 연금 ${res.lottoScores.pension}점 · 로또 ${res.lottoScores.lotto}점</div>`;
             left.innerHTML += `<div style="margin-top:10px; border-top:1px dashed #eee; padding-top:8px;"><strong>🎯 오늘의 로또 추천 번호 (5세트):</strong>${lottoHtml}</div>`;
        }

        const right = document.createElement('div'); right.className='right-fixed';
        const actions = document.createElement('div'); actions.className='actions';
        const btnSave = document.createElement('button'); btnSave.textContent='저장';
        btnSave.onclick = ()=>{ if(!localDev){ alert('배포모드 인증 필요'); return; } const a=loadSaved(); a.push({ title:`${catLabel} — ${dateStr}`, summary:`${res.score}점`, items:[{category:catLabel,date:dateStr,weekday:weekday,score:res.score, recommend: res.recommend, strategy: res.strategy, lottoScores: res.lottoScores}], coordinationAdvice: coordinationAdvice, ts:Date.now() }); saveSaved(a); alert('저장 완료'); }; // 코디 정보 저장 추가
        const btnShare = document.createElement('button'); btnShare.textContent='공유';
        btnShare.onclick = ()=>{ if(!localDev){ alert('배포모드 인증 필요'); return; } doShareText(buildShareTextForSaved({ title:`${catLabel} — ${dateStr}`, summary:`${res.score}점`, items:[{category:catLabel,date:dateStr,weekday:weekday,score:res.score, recommend: res.recommend, strategy: res.strategy, lottoScores: res.lottoScores}], coordinationAdvice: coordinationAdvice, ts:Date.now() })); }; // 코디 정보 공유 추가

        actions.appendChild(btnSave); actions.appendChild(btnShare);
        const sb = document.createElement('div'); sb.className='score-box';
        sb.style.background = res.score>=80? 'var(--high)' : res.score>=65? 'var(--mid)' : res.score>=50? 'var(--low)' : 'var(--def)';
        sb.textContent = res.score;
        right.appendChild(sb); right.appendChild(actions);
        node.appendChild(left); node.appendChild(right);
        block.appendChild(node);
    });
    results.appendChild(block);
}

// [MODIFIED] renderSingleDayAll 함수 - 코디 정보 계산 추가
function renderSingleDayAll(dateStr){
    const results = document.getElementById('results');
    results.innerHTML = '';
    const userBirthISO = getBirthDateFromSelectors();

    if (!userBirthISO) { 
        alert('생년월일 (년/월/일)을 드롭다운에서 모두 선택해야 합니다. 확인 후 다시 시도해 주세요.'); 
        return; 
    }

    if (!USER_SAJU_PILLARS) { 
        displayPillars(); // 만세력 정보 로드 시도
        if (!USER_SAJU_PILLARS) {
             alert('사주 정보 로드에 실패했습니다. 생년월일 입력을 확인하십시오.');
             return;
        }
    }
    
    try {
        const dt = parseDateString(dateStr);
        const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
        const dayPillars = calculatePillars(dt, null);
        const optimalLottoTime = getOptimalLottoTime(dayPillars.day.tg);
        
        // [NEW] 행운 코디 조언 계산
        const coordinationAdvice = generateCoordinationAdvice(USER_SAJU_PILLARS.day.tg, dayPillars);
        
        const categories = ['wealth', 'match', 'business', 'travel', 'move'];
        const resultsArray = categories.map(cat => {
            const score = scoreForCategory(dayPillars, cat);
            const extraRec = dayPillars.travelRec || dayPillars.moveRec || dayPillars.businessRec || {};
            
            const strategy = getStrategyByScore(USER_SAJU_PILLARS.day.tg, cat, score, dayPillars.moveRec);
            
            const item = {
                category: cat,
                score: score,
                strategy: strategy,
                recommend: dayPillars[`${cat}Rec`] || null, // 기본값
                lottoScores: cat === 'wealth' ? generateLottoScores(dayPillars, USER_SAJU_PILLARS.day.tg) : null
            };
            
            // '인연' 항목 추천 정보 (희신 기반) 추가
            if (cat === 'match') {
                const userDayTG = USER_SAJU_PILLARS.day.tg;
                const favorableOhaeng = determineFavorableElement(userDayTG);
                const ohaengRec = getOhaengRecommendation(favorableOhaeng);
                item.recommend = {
                    favorableOhaeng: favorableOhaeng,
                    region: ohaengRec.region,
                    occupation: ohaengRec.occupation
                };
            }
            
            delete dayPillars.businessRec; delete dayPillars.travelRec; delete dayPillars.moveRec; // 임시 저장된 추천 정보 정리
            return item;
        });

        // [MODIFIED] coordinationAdvice 전달
        renderDayAllBlock(dateStr, weekday, resultsArray, optimalLottoTime, dayPillars, coordinationAdvice);

    } catch (e) {
        console.error("단일 날짜 운세 조회 오류:", e);
        results.innerHTML = `<div style="color:red;font-weight:700;padding:20px;">단일 날짜 운세 조회 중 오류 발생: ${e.message}</div>`;
    }
}


function findHighestScoringDayOfMonth(year, month, gender) {
    const key = `${year}-${month}-${gender}`;
    if(CACHE_HIGHEST_DAY[key]) return CACHE_HIGHEST_DAY[key];
    const daysInMonth = new Date(year, month, 0).getDate();
    let bestDay = null;
    let highestScore = -1;
    let dayPillars = null;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dt = new Date(year, month - 1, day);
        const pillars = calculatePillars(dt, null);
        const score = scoreForCategory(pillars, 'wealth'); // 대표 카테고리로 재물 사용
        if (score > highestScore) {
            highestScore = score;
            bestDay = dateStr;
            dayPillars = pillars;
        }
    }
    const result = { date: bestDay, score: highestScore, pillars: dayPillars };
    CACHE_HIGHEST_DAY[key] = result;
    return result;
}

function monthTopN(year, month, gender, category, N) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const results = [];
    const userDayTG = USER_SAJU_PILLARS ? USER_SAJU_PILLARS.day.tg : '갑'; 

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dt = new Date(year, month - 1, day);
        const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
        const dayPillars = calculatePillars(dt, null);
        const score = scoreForCategory(dayPillars, category);
        const extraRec = dayPillars.businessRec || dayPillars.travelRec || dayPillars.moveRec || {};
        const strategy = getStrategyByScore(userDayTG, category, score, dayPillars.moveRec);
        
        const item = {
            date: dateStr,
            weekday: weekday,
            score: score,
            strategy: strategy,
            reason: strategy.desc,
            recommend: dayPillars[`${category}Rec`] || null,
            lottoScores: category === 'wealth' ? generateLottoScores(dayPillars, userDayTG) : null
        };
        
        // '인연' 항목 추천 정보 (희신 기반) 추가
        if (category === 'match') {
            const favorableOhaeng = determineFavorableElement(userDayTG);
            const ohaengRec = getOhaengRecommendation(favorableOhaeng);
            item.recommend = {
                favorableOhaeng: favorableOhaeng,
                region: ohaengRec.region,
                occupation: ohaengRec.occupation
            };
        }
        
        delete dayPillars.businessRec; delete dayPillars.travelRec; delete dayPillars.moveRec;
        results.push(item);
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, N);
}

function calcUserAge(iso, queryYear, queryMonth, queryDay) {
    const [by, bm, bd] = iso.split('-').map(Number);
    const age = queryYear - by;
    // 입춘 기준이 아닌 만 나이 계산 단순화
    if (queryMonth < bm || (queryMonth === bm && queryDay < bd)) {
        return age - 1;
    }
    return age;
}

function ageRangeLabel(age) {
    if (age < 25) return '20대 초중반';
    if (age < 30) return '20대 후반';
    if (age < 35) return '30대 초중반';
    if (age < 40) return '30대 후반';
    if (age < 50) return '40대';
    if (age < 60) return '50대';
    return '60대 이상';
}

function initBirthSelectors(){
  const y=document.getElementById('birthYear'), m=document.getElementById('birthMonth'), d=document.getElementById('birthDay');
  const now=new Date();
  for(let yy=now.getFullYear()-80; yy<=now.getFullYear(); yy++){ 
    const o=document.createElement('option'); o.value=yy; o.textContent=`${yy}년`; y.appendChild(o); 
  }
  y.value = now.getFullYear() - 30; 
  for(let mm=1; mm<=12; mm++){ const o=document.createElement('option'); o.value=mm; o.textContent=`${mm}월`; m.appendChild(o); }
  for(let dd=1; dd<=31; dd++){ const o=document.createElement('option'); o.value=dd; o.textContent=`${dd}일`; d.appendChild(o); }
  [y, m, d, document.getElementById('birthhour'), document.getElementById('gender')].forEach(el => {
    el.addEventListener('change', displayPillars);
  });
  setTimeout(displayPillars, 100);
}

(function initSelectors(){
  const y=document.getElementById('queryYear'), m=document.getElementById('queryMonth'); const now=new Date();
  for(let yy=now.getFullYear()-1; yy<=now.getFullYear()+2; yy++){ const o=document.createElement('option'); o.value=yy; o.textContent=`${yy}년`; y.appendChild(o); }
  for(let mm=1; mm<=12; mm++){ const o=document.createElement('option'); o.value=mm; o.textContent=`${mm}월`; m.appendChild(o); }
  y.value = now.getFullYear(); m.value = now.getMonth()+1;
  initBirthSelectors(); 
})();

// ⭐️ 서버 함수 (유료 운세 계산 + 인증)
export default async function handler(request, response) {
    const { email, code, token, ...birthInfo } = request.body;
    let client; // DB 연결 객체

    // 이메일 없이 유료 기능 사용 불가
    if (!email) {
         return response.status(401).json({ error: '이메일 정보가 누락되었습니다.' });
    }

    try {
        // 1. DB 연결
        client = new MongoClient(uri);
        await client.connect();
        const collection = client.db("sajuDB").collection("PaidUsers");
        let user = null;
        let newToken = null;

        // 2. 인증 시도 (토큰 > 코드 순서로 확인)
        if (token) {
            user = await collection.findOne({ access_token: token, user_email: email });
        }
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
            return response.status(401).json({ error: '인증 실패: 유효한 토큰 또는 코드가 없습니다.' });
        }
        
        // 4. ✅ 인증 성공: 유료 로직 실행
        const dt = new Date(birthInfo.year, birthInfo.month - 1, birthInfo.day);
        const userPillars = calculatePillars(dt, parseInt(birthInfo.hour, 10));
        const monthResult = monthTopN(userPillars, birthInfo.year, birthInfo.month); 

        // 5. 결과 반환 (간단하게 대체)
        const htmlContent = `<div class="result-card"><h2>[유료] 한 달 전체 추천 결과</h2><p>총 ${monthResult.length}일 분의 추천 결과가 계산되었습니다.</p></div>`;

        response.status(200).json({ 
            htmlContent: htmlContent,
            access_token: newToken // 새 토큰이 있다면 함께 보냄
        });

    } catch (error) {
        response.status(500).json({ error: '유료 서버 내부 오류 발생', message: error.message });
    } finally {
        if (client) client.close(); // DB 연결 종료
    }
}
