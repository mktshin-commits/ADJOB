let ALL_JOBS = []; // Data from jobs.json will be stored here
let KODA_MEMBERS = []; // Data from members.json will be stored here

// 1. 직무 분류 엔진 설정 (컬러 매핑 포함)
const JOB_CATEGORIES = {
    "기획/전략": {
        keywords: ["AE", "AP", "매체 플래너", "캠페인 플래너", "기획", "전략"],
        color: "#E0F2FE", 
        textColor: "#0369A1"
    },
    "크리에이티브": {
        keywords: ["카피", "아트", "디자인", "영상 PD", "카피라이터", "아트디렉터", "디자이너"],
        color: "#FCE7F3", 
        textColor: "#BE185D" // 핑크 계열
    },
    "퍼포먼스": {
        keywords: ["퍼포먼스 마케팅", "미디어 바잉", "데이터 분석", "퍼포먼스", "매체사", "ROAS"],
        color: "#F0FDF4", 
        textColor: "#15803D"
    },
    "소셜/콘텐츠": {
        keywords: ["SNS 에디터", "인플루언서", "바이럴", "콘텐츠", "SNS", "유튜브"],
        color: "#FFF7ED", 
        textColor: "#C2410C"
    },
    "테크/AI": {
        keywords: ["마케팅 엔지니어", "AI 프롬프트", "데이터 엔지니어", "AI", "GA4", "개발"],
        color: "#EFF6FF", 
        textColor: "#1D4ED8" // 블루 계열
    }
};

function matchCategories(title, techStacks = []) {
    const matched = new Set();
    const combinedText = (title + " " + techStacks.join(" ")).toLowerCase();

    for (const [category, data] of Object.entries(JOB_CATEGORIES)) {
        for (const kw of data.keywords) {
            if (combinedText.includes(kw.toLowerCase())) {
                matched.add(category);
                break;
            }
        }
    }
    
    return Array.from(matched);
}

// View Toggle Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const feedView = document.getElementById('feedView');
const tableView = document.getElementById('tableView');

// Elements
const jobListEl = document.getElementById('jobList');
const countEl = document.getElementById('count');
const resultSummaryEl = document.querySelector('.result-count'); // 요약 텍스트 영역
const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');
const memberTableBody = document.getElementById('memberTableBody');

// Filters
const searchInput = document.getElementById('searchInput');
const expFilters = document.querySelectorAll('.filter-exp');
const locationFilter = document.getElementById('locationFilter');
const kodaaFilter = document.getElementById('kodaaFilter');
const sortFilter = document.getElementById('sortFilter');
const dateFilter = document.getElementById('dateFilter');
const showExpiredToggle = document.getElementById('showExpiredToggle');
const techChips = document.querySelectorAll('.chip');

let activeTechFilter = null;

// Tab Switching Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        feedView.classList.add('hidden');
        tableView.classList.add('hidden');

        const targetId = btn.dataset.target;
        document.getElementById(targetId).classList.remove('hidden');
    });
});

// Logo Click Logic
const logoEl = document.querySelector('.logo');
logoEl.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-target="feedView"]').classList.add('active');
    tableView.classList.add('hidden');
    feedView.classList.remove('hidden');
    
    searchInput.value = '';
    kodaaFilter.checked = false;
    locationFilter.value = '';
    expFilters.forEach(cb => cb.checked = false);
    techChips.forEach(c => c.classList.remove('active'));
    activeTechFilter = null;
    
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function loadData() {
    try {
        try {
            const memberResponse = await fetch('members.json');
            if (memberResponse.ok) {
                KODA_MEMBERS = await memberResponse.json();
            }
        } catch (e) {
            console.warn('members.json 로딩 실패');
        }

        const response = await fetch('jobs.json');
        if (!response.ok) {
            throw new Error('jobs.json 데이터를 불러오는데 실패했습니다.');
        }
        
        const rawJobs = await response.json();
        
        ALL_JOBS = rawJobs.map(job => {
            // 게시일이 없으면 오늘 날짜를 기본값으로 설정 (전문가 조언 반영)
            const todayStr = new Date().toISOString().split('T')[0];
            return {
                ...job,
                posted_date: job.posted_date || todayStr,
                isMember: KODA_MEMBERS.some(member => 
                    job.company.includes(member) || member.includes(job.company)
                ),
                matchedCategories: matchCategories(job.title, job.techStack)
            };
        });
        
        applyFilters(); 
        renderTable(); 
    } catch (error) {
        console.error('데이터 로딩 에러:', error);
        jobListEl.innerHTML = `<div style="text-align:center; padding: 3rem; color: #718096;">데이터를 불러올 수 없습니다.</div>`;
    }
}

function renderJobs(jobs) {
    jobListEl.innerHTML = '';
    
    // 결과 요약 표시
    const categoryText = activeTechFilter ? `[${activeTechFilter}] 분야 ` : '';
    resultSummaryEl.innerHTML = `현재 ${categoryText}공고 총 <span id="count">${jobs.length}</span>건`;

    if(jobs.length === 0) {
        jobListEl.innerHTML = '<div style="text-align:center; padding: 3rem; color: #718096;">조건에 맞는 공고가 없습니다.</div>';
        return;
    }

    jobs.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card';
        
        const daysLeft = getDaysLeft(job.deadline);
        const isExpired = daysLeft === '마감';
        
        if (isExpired) card.classList.add('expired');

        let kodaBadge = job.isMember ? `<span class="koda-badge">[KODA 회원사]</span>` : '';
        
        // 마감 임박 체크 (3일 이내)
        let urgentBadge = (!isExpired && daysLeft !== '∞' && daysLeft <= 3) 
            ? `<span class="urgent-badge">마감임박</span>` 
            : '';
        
        if (isExpired) {
            urgentBadge = `<span class="badge expired">채용 마감</span>`;
        }

        // 플랫폼 아이콘 (간이 처리)
        let platformIcon = job.platform === 'Saramin' 
            ? 'https://www.saramin.co.kr/favicon.ico' 
            : 'https://www.jobkorea.co.kr/favicon.ico';

        // 하단 태그 구성 (#직무, #경력, #지역)
        const jobCategoryTag = job.matchedCategories.length > 0 ? `#${job.matchedCategories[0]}` : '';
        const expTag = job.experience.length > 0 ? `#${job.experience[0]}` : '';
        const locTag = `#${job.location.split(' ')[1] || job.location}`;

        card.innerHTML = `
            <img src="${platformIcon}" class="platform-icon" alt="${job.platform}">
            <div class="job-header">
                <div class="company-wrapper">
                    <span class="company-name">${job.company}</span>
                    ${kodaBadge}
                    ${urgentBadge}
                </div>
                <span class="badge ${isExpired ? 'expired' : ''}">${job.deadline === '상시채용' ? '상시채용' : isExpired ? '마감됨' : 'D-' + daysLeft}</span>
            </div>
            <h2 class="job-title">${job.title}</h2>
            <div class="job-tags">
                <span>${jobCategoryTag}</span>
                <span>${expTag}</span>
                <span>${locTag}</span>
            </div>
        `;
        
        card.addEventListener('click', () => showDetail(job));
        jobListEl.appendChild(card);
    });
}

function renderStatistics(jobs) {
    const totalJobs = jobs.length;
    
    // 가장 많이 채용한 직무 찾기
    const categoryCounts = {};
    jobs.forEach(job => {
        job.matchedCategories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
    });
    const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] || "-";

    // 가장 많이 채용한 기업 TOP 3
    const companyCounts = {};
    jobs.forEach(job => {
        companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
    });
    const topCompanies = Object.keys(companyCounts)
        .sort((a, b) => companyCounts[b] - companyCounts[a])
        .slice(0, 3)
        .join(", ") || "-";

    document.getElementById('statTotalJobs').textContent = `${totalJobs}건`;
    document.getElementById('statTopCategory').textContent = topCategory;
    document.getElementById('statTopCompanies').textContent = topCompanies;
}

function getDaysLeft(deadline) {
    if (deadline === '상시채용') return '∞';
    const today = new Date();
    const end = new Date(deadline);
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : '마감';
}

function renderTable() {
    memberTableBody.innerHTML = '';
    const sortedMembers = [...KODA_MEMBERS].sort();

    sortedMembers.forEach((company, index) => {
        const companyJobs = ALL_JOBS.filter(job => job.company.includes(company));
        const jobCount = companyJobs.length;
        
        const tr = document.createElement('tr');
        let statusHtml = jobCount > 0 ? `<span class="status-hiring">구인 중</span>` : `<span class="status-none">공고 없음</span>`;
        let actionHtml = jobCount > 0 ? `<button class="action-btn" onclick="filterByCompany('${company}')">공고 보기</button>` : `<span style="color:#CBD5E1">-</span>`;
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: 700;">${company}</td>
            <td>${jobCount}건</td>
            <td>${statusHtml}</td>
            <td>${actionHtml}</td>
        `;
        memberTableBody.appendChild(tr);
    });
}

window.filterByCompany = function(companyName) {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-target="feedView"]').classList.add('active');
    tableView.classList.add('hidden');
    feedView.classList.remove('hidden');
    searchInput.value = companyName;
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDetail(job) {
    let kodaBadge = job.isMember ? `<span class="highlight-tag tag-kodaa" style="margin-left:10px;">✨ 인증 회원사</span>` : '';
    const catTags = job.matchedCategories.map(cat => {
        const style = JOB_CATEGORIES[cat] || { color: '#F1F5F9', textColor: '#475569' };
        return `<span class="highlight-tag" style="background-color: ${style.color}; color: ${style.textColor}; margin-right: 5px;">${cat}</span>`;
    }).join('');
    const techTags = job.techStack.map(tech => `<span>${tech}</span>`).join('');

    modalBody.innerHTML = `
        <div class="modal-company">${job.company} ${kodaBadge}</div>
        <h2 class="modal-title">${job.title}</h2>
        <div style="margin-bottom: 1rem; color: #718096; font-size: 0.95rem; font-weight: 600;">
            <span>📍 ${job.location}</span> | <span>💼 ${job.experience.join(', ')}</span> | <span>💰 ${job.salary}</span>
        </div>
        <div class="job-tags" style="margin-bottom: 2rem;">
            ${catTags}
            ${techTags}
        </div>
        <div class="modal-details">
            <h3>지원 자격 및 상세 내용</h3>
            <p style="margin-top: 1rem; line-height: 1.8;">
                본 공고는 <strong>${job.company}</strong>의 공식 채용 정보입니다.<br>
                직무 분야: ${job.matchedCategories.join(', ') || '미분류'}<br>
                마감일: ${job.deadline}
            </p>
        </div>
        <a href="${job.url}" class="apply-btn" target="_blank">원본 공고 보러가기 / 지원하기</a>
    `;
    detailModal.style.display = 'flex';
}

closeModal.addEventListener('click', () => {
    detailModal.style.display = 'none';
});

detailModal.addEventListener('click', (e) => {
    if(e.target === detailModal) detailModal.style.display = 'none';
});

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const checkedExps = Array.from(expFilters).filter(cb => cb.checked).map(cb => cb.value);
    const selectedLocation = locationFilter.value;
    const isKodaOnly = kodaaFilter.checked; 
    const selectedDateMonth = dateFilter.value;
    const isShowExpired = showExpiredToggle.checked;

    const today = new Date();

    let filtered = ALL_JOBS.filter(job => {
        // 검색어: 제목, 회사명, 그리고 매칭된 직무 카테고리 포함 확인
        const matchesSearch = job.title.toLowerCase().includes(searchTerm) || 
                              job.company.toLowerCase().includes(searchTerm) ||
                              job.matchedCategories.some(cat => cat.toLowerCase().includes(searchTerm));
                              
        let matchesExp = checkedExps.length === 0 || job.experience.some(exp => checkedExps.includes(exp));
        let matchesLoc = !selectedLocation || job.location.includes(selectedLocation);
        let matchesTech = !activeTechFilter || (job.matchedCategories && job.matchedCategories.includes(activeTechFilter));
        let matchesKoda = !isKodaOnly || job.isMember === true;

        // 게시 기간 필터링 로직
        let matchesDate = true;
        if (selectedDateMonth !== 'all') {
            const months = parseInt(selectedDateMonth);
            const postDate = new Date(job.posted_date);
            const cutoffDate = new Date();
            cutoffDate.setMonth(today.getMonth() - months);
            matchesDate = postDate >= cutoffDate;
        }

        return matchesSearch && matchesExp && matchesLoc && matchesTech && matchesKoda && matchesDate;
    });

    // 통계 계산은 필터링된 모든 공고(진행+마감)를 대상으로 함
    renderStatistics(filtered);

    // 리스트 표시는 토글 상태에 따라 마감 공고 제외 여부 결정
    if (!isShowExpired) {
        filtered = filtered.filter(job => getDaysLeft(job.deadline) !== '마감');
    }

    // 정렬: 인증 회원사 우선 노출
    filtered.sort((a, b) => {
        if (a.isMember && !b.isMember) return -1;
        if (!a.isMember && b.isMember) return 1;
        const sortMode = sortFilter.value;
        if (sortMode === 'deadline') {
            if (a.deadline === '상시채용') return 1;
            if (b.deadline === '상시채용') return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        }
        return b.id - a.id; 
    });

    renderJobs(filtered);
}

searchInput.addEventListener('input', applyFilters);
expFilters.forEach(cb => cb.addEventListener('change', applyFilters));
locationFilter.addEventListener('change', applyFilters);
kodaaFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);
dateFilter.addEventListener('change', applyFilters);
showExpiredToggle.addEventListener('change', applyFilters);

techChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const value = chip.dataset.value;
        
        techChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        activeTechFilter = value === "" ? null : value;
        
        applyFilters();
    });
});

loadData();
